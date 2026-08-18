import { DurableObject } from "cloudflare:workers";

const SESSION_TTL_SECONDS=7*24*60*60;
const PASSWORD_ITERATIONS=100000;
const CHAT_HISTORY_LIMIT=75;
const CHAT_WINDOW_MS=1000;
const CHAT_MAX_MESSAGES=5;
const CHAT_MUTE_MS=5000;
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization"};
const json=(d,s=200,extra={})=>new Response(JSON.stringify(d),{status:s,headers:{...CORS,"Content-Type":"application/json;charset=UTF-8",...extra}});
const token=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};
const username=v=>typeof v==="string"?v.trim().toLowerCase():"";
const realName=v=>typeof v==="string"?v.trim().toLowerCase().replace(/\s+/g," "):"";
const pub=u=>({id:u.id,username:u.username,displayName:u.displayName,bio:u.bio||"",pfp:u.pfp||"",createdAt:u.createdAt,status:u.status,role:u.role,verified:u.role==="owner"||u.role==="admin"?true:u.verified===true});
const adminPub=u=>({...pub(u),realName:u.realName,realNameConflict:!!u.realNameConflict});

export default {async fetch(request,env){const url=new URL(request.url);if(request.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});try{
if(url.pathname==="/api/health")return json({success:true,status:"online",service:"yaprxy."});
if(url.pathname==="/api/register"&&request.method==="POST")return register(request,env);
if(url.pathname==="/api/login"&&request.method==="POST")return login(request,env);
if(url.pathname==="/api/logout"&&request.method==="POST"){const t=getToken(request);if(t)await env.SESSIONS.delete(`session:${t}`);return json({success:true,message:"Logged out"},200,{"Set-Cookie":"session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"})}
if(url.pathname==="/api/me"&&request.method==="GET"){const a=await auth(request,env);return a.success?json({success:true,user:pub(a.user)}):json({success:false,error:a.error,errorCode:a.errorCode},a.status)}
if(url.pathname==="/api/profile"&&(request.method==="POST"||request.method==="PUT"))return updateProfile(request,env);
if(url.pathname==="/api/admin/setup"&&request.method==="POST")return setupOwner(request,env);
if(url.pathname==="/api/report"&&request.method==="POST")return report(request,env);
if(url.pathname==="/api/reports"&&request.method==="GET"){const a=await requireAdmin(request,env);return a.success?reports(env):json({success:false,error:a.error},a.status)}
if(url.pathname==="/api/restore"&&request.method==="POST"){const a=await requireAdmin(request,env);return a.success?restore(request,env):json({success:false,error:a.error},a.status)}
if(url.pathname==="/api/admin/users"&&request.method==="GET"){const a=await requireAdmin(request,env);return a.success?users(env):json({success:false,error:a.error},a.status)}
if(url.pathname==="/api/admin/user"&&request.method==="GET")return adminUser(request,env);
if(url.pathname==="/api/admin/verify"&&request.method==="POST")return changeVerification(request,env,true);
if(url.pathname==="/api/admin/unverify"&&request.method==="POST")return changeVerification(request,env,false);
if(url.pathname==="/api/admin/block"&&request.method==="POST")return changeStatus(request,env,"blocked");
if(url.pathname==="/api/admin/unblock"&&request.method==="POST")return changeStatus(request,env,"active");
if(url.pathname==="/api/admin/ban"&&request.method==="POST")return changeStatus(request,env,"banned");
if(url.pathname==="/api/admin/promote"&&request.method==="POST")return promote(request,env);
if(url.pathname==="/api/admin/delete"&&request.method==="POST")return deleteAccount(request,env);
if(url.pathname==="/api/chat"&&request.headers.get("Upgrade")?.toLowerCase()==="websocket"){const a=await auth(request,env);if(!a.success)return new Response(a.error,{status:a.status,headers:CORS});const h=new Headers(request.headers);h.set("X-Chat-User-Id",a.user.id);h.set("X-Chat-Username",a.user.username);h.set("X-Chat-Display-Name",a.user.displayName||"");h.set("X-Chat-Bio",a.user.bio||"");h.set("X-Chat-Pfp",a.user.pfp||"");h.set("X-Chat-Role",a.user.role||"user");const room=env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName("main"));return room.fetch(new Request(request,{headers:h}))}
const response=await env.ASSETS.fetch(request);if(response.status<400){const h=new Headers(response.headers);h.set("Cache-Control","public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");return new Response(response.body,{status:response.status,headers:h})}return response;
}catch(e){console.error(e?.stack||e);return json({success:false,error:"Internal server error"},500)}}};

async function register(request,env){try{const d=await request.json();const u=username(d.username),display=typeof d.displayName==="string"?d.displayName.trim().slice(0,80):"",rn=typeof d.realName==="string"?d.realName.trim().slice(0,120):"",pw=typeof d.password==="string"?d.password:"";if(!u||!display||!rn||!pw)return json({success:false,error:"Username, display name, real name, and password are required"},400);if(!/^[a-z0-9_]{3,30}$/.test(u))return json({success:false,error:"Username must be 3-30 characters and use letters, numbers, or underscores"},400);if(pw.length<8||pw.length>200)return json({success:false,error:"Password must be between 8 and 200 characters"},400);if(await env.USERS.get(`username:${u}`))return json({success:false,error:"That username is already taken"},409);const salt=token(),hash=await hashPw(pw,salt),conf=await env.USERS.get(`realname:${realName(rn)}`);const user={id:crypto.randomUUID(),username:u,displayName:display,realName:rn,bio:"",pfp:"",passwordHash:hash,passwordSalt:salt,createdAt:new Date().toISOString(),status:"active",role:"user",verified:false,realNameConflict:!!conf};await save(env,user);if(!conf)await env.USERS.put(`realname:${realName(rn)}`,JSON.stringify({firstUserId:user.id}));return await createSession(env,user)}catch(e){console.error("REGISTER",e);return json({success:false,error:"Could not create account"},500)}}
async function login(request,env){try{const d=await request.json(),u=username(d.username),pw=typeof d.password==="string"?d.password:"",user=await env.USERS.get(`username:${u}`,"json");if(!user||!(await verifyPw(pw,user.passwordHash,user.passwordSalt)))return json({success:false,error:"Invalid credentials"},401);if(user.status==="banned")return json({success:false,error:"You have been banned",errorCode:"BANNED"},403);if(user.status==="blocked")return json({success:false,error:"This account is blocked",errorCode:"BLOCKED"},403);return createSession(env,user)}catch(e){console.error("LOGIN",e);return json({success:false,error:"Could not log in"},500)}}
async function createSession(env,user){const t=token(),expiresAt=Date.now()+SESSION_TTL_SECONDS*1000;await env.SESSIONS.put(`session:${t}`,JSON.stringify({userId:user.id,createdAt:new Date().toISOString(),expiresAt}),{expirationTtl:SESSION_TTL_SECONDS});return json({success:true,message:"Login successful",user:pub(user)},200,{"Set-Cookie":`session=${t}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`})}
async function setupOwner(request,env){const d=await request.json();async function setupOwner(request, env) {
    try {
        const d = await request.json().catch(() => ({}));

        // Accept the setup key from either JSON or an Authorization header.
        const suppliedKey =
            typeof d.setupKey === "string"
                ? d.setupKey.trim()
                : (
                    request.headers.get("Authorization")?.startsWith("Bearer ")
                        ? request.headers.get("Authorization").slice(7).trim()
                        : ""
                );

        // Wrangler secret.
        const setupKey =
            typeof env.ADMIN_SETUP_KEY === "string"
                ? env.ADMIN_SETUP_KEY.trim()
                : "";

        if (!setupKey) {
            return json({
                success: false,
                error: "ADMIN_SETUP_KEY is not configured on this Worker."
            }, 500);
        }

        if (!suppliedKey || suppliedKey !== setupKey) {
            return json({
                success: false,
                error: "Invalid setup key"
            }, 403);
        }

        // Don't allow replacing an existing owner.
        if (await findRole(env, "owner")) {
            return json({
                success: false,
                error: "An owner already exists"
            }, 409);
        }

        const requestedUsername =
            username(d.username);

        if (!requestedUsername) {
            return json({
                success: false,
                error: "Username is required"
            }, 400);
        }

        const user =
            await env.USERS.get(
                `username:${requestedUsername}`,
                "json"
            );

        if (!user) {
            return json({
                success: false,
                error: "Account not found"
            }, 404);
        }

        user.role = "owner";
        user.verified = true;
        user.status = "active";

        await save(env, user);

        return json({
            success: true,
            message: "Account promoted to owner",
            user: pub(user)
        });

    } catch (e) {
        console.error("SETUP OWNER", e);

        return json({
            success: false,
            error: "Could not set owner"
        }, 500);
    }
}if(await findRole(env,"owner"))return json({success:false,error:"An owner already exists"},409);const user=await env.USERS.get(`username:${username(d.username)}`,"json");if(!user)return json({success:false,error:"Account not found"},404);user.role="owner";user.verified=true;user.status="active";await save(env,user);return json({success:true,message:"Account promoted to owner",user:pub(user)})}
async function updateProfile(request,env){const a=await auth(request,env);if(!a.success)return json({success:false,error:a.error,errorCode:a.errorCode},a.status);const d=await request.json();if(typeof d.displayName==="string")a.user.displayName=d.displayName.trim().slice(0,80);if(typeof d.bio==="string")a.user.bio=d.bio.trim().slice(0,500);if(typeof d.pfp==="string")a.user.pfp=d.pfp.trim().slice(0,1000);await save(env,a.user);return json({success:true,user:pub(a.user)})}
async function report(request,env){const d=await request.json();let u;try{u=new URL(d.url)}catch{return json({success:false,error:"Invalid URL"},400)}if(!["http:","https:"].includes(u.protocol))return json({success:false,error:"Invalid protocol"},400);const k=encodeURIComponent(u.href),old=await env.REPORTS.get(k,"json"),r=old||{url:u.href,name:typeof d.name==="string"?d.name.slice(0,500):u.hostname,time:new Date().toISOString(),reports:0};r.reports=Number(r.reports||0)+1;r.lastReported=new Date().toISOString();await env.REPORTS.put(k,JSON.stringify(r));return json({success:true,message:"Link reported"})}
async function reports(env){const out=[];let cursor;do{const r=await env.REPORTS.list({limit:1000,...(cursor?{cursor}:{})});for(const k of r.keys){const v=await env.REPORTS.get(k.name,"json");if(v)out.push(v)}cursor=r.list_complete?null:r.cursor}while(cursor);out.sort((a,b)=>new Date(b.lastReported||b.time)-new Date(a.lastReported||a.time));return json({success:true,reports:out,count:out.length})}
async function restore(request,env){const d=await request.json();try{const u=new URL(d.url);await env.REPORTS.delete(encodeURIComponent(u.href));return json({success:true,message:"Report restored"})}catch{return json({success:false,error:"Invalid URL"},400)}}
async function users(env){const out=[];let cursor;do{const r=await env.USERS.list({prefix:"id:",limit:1000,...(cursor?{cursor}:{})});for(const k of r.keys){const u=await env.USERS.get(k.name,"json");if(u)out.push(adminPub(u))}cursor=r.list_complete?null:r.cursor}while(cursor);out.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));return json({success:true,users:out,count:out.length})}
async function adminUser(request,env){const a=await requireAdmin(request,env);if(!a.success)return json({success:false,error:a.error},a.status);const id=new URL(request.url).searchParams.get("id");if(!id)return json({success:false,error:"User id is required"},400);const u=await env.USERS.get(`id:${id}`,"json");if(!u)return json({success:false,error:"User not found"},404);return json({success:true,user:adminPub(u)})}
async function changeVerification(request,env,value){const a=value?await requireAdmin(request,env):await requireOwner(request,env);if(!a.success)return json({success:false,error:a.error},a.status);const d=await request.json(),u=await env.USERS.get(`id:${d.userId}`,"json");if(!u)return json({success:false,error:"User not found"},404);if((u.role!=="user")&&!ownerCheck(a.user))return json({success:false,error:"Only owners can manage staff accounts"},403);u.verified=value;await save(env,u);return json({success:true,message:value?"User verified":"User verification removed",user:adminPub(u)})}
async function changeStatus(request,env,status){const a=status==="blocked"?await requireAdmin(request,env):await requireOwner(request,env);if(!a.success)return json({success:false,error:a.error},a.status);if(status==="banned"&&!ownerCheck(a.user))return json({success:false,error:"Only owners can ban users"},403);const d=await request.json();if(d.userId===a.user.id)return json({success:false,error:"You cannot disable your own account"},400);const u=await env.USERS.get(`id:${d.userId}`,"json");if(!u)return json({success:false,error:"User not found"},404);if((u.role==="owner"||u.role==="admin")&&!ownerCheck(a.user))return json({success:false,error:"Only owners can manage staff accounts"},403);u.status=status;await save(env,u);if(status!=="active")await revoke(env,u.id);return json({success:true,message:`User status changed to ${status}`,user:adminPub(u)})}
async function promote(request,env){const a=await requireOwner(request,env);if(!a.success)return json({success:false,error:a.error},a.status);const d=await request.json(),u=await env.USERS.get(`id:${d.userId}`,"json");if(!u)return json({success:false,error:"User not found"},404);if(u.role==="owner")return json({success:false,error:"That account is already the owner"},400);u.role="admin";u.verified=true;await save(env,u);return json({success:true,message:"User promoted to admin",user:adminPub(u)})}
async function deleteAccount(request,env){const a=await requireOwner(request,env);if(!a.success)return json({success:false,error:a.error},a.status);const d=await request.json();if(d.userId===a.user.id)return json({success:false,error:"The owner account cannot be deleted here"},400);const u=await env.USERS.get(`id:${d.userId}`,"json");if(!u)return json({success:false,error:"User not found"},404);await env.USERS.delete(`id:${u.id}`);await env.USERS.delete(`username:${u.username}`);if(u.realName){const key=`realname:${realName(u.realName)}`;const mapping=await env.USERS.get(key,"json");if(mapping?.firstUserId===u.id)await env.USERS.delete(key)}await revoke(env,u.id);return json({success:true,message:"Account permanently deleted"})}
async function auth(request,env){const t=getToken(request);if(!t)return {success:false,error:"Not authenticated",status:401};const s=await env.SESSIONS.get(`session:${t}`,"json");if(!s||Date.now()>=s.expiresAt){if(s)await env.SESSIONS.delete(`session:${t}`);return {success:false,error:"Session expired",status:401}}const u=await env.USERS.get(`id:${s.userId}`,"json");if(!u)return {success:false,error:"Account not found",status:401};if(u.status==="banned")return {success:false,error:"You have been banned",errorCode:"BANNED",status:403};if(u.status==="blocked")return {success:false,error:"Account access is disabled",errorCode:"BLOCKED",status:403};return {success:true,user:u,token:t}}
async function requireAdmin(req,env){const a=await auth(req,env);if(!a.success)return a;return a.user.role==="admin"||a.user.role==="owner"?a:{success:false,error:"Admin access required",status:403}}
async function requireOwner(req,env){const a=await auth(req,env);if(!a.success)return a;return ownerCheck(a.user)?a:{success:false,error:"Owner access required",status:403}}
const ownerCheck=u=>u?.role==="owner";
async function findRole(env,role){let c;do{const r=await env.USERS.list({prefix:"id:",limit:1000,...(c?{cursor:c}:{})});for(const k of r.keys){const u=await env.USERS.get(k.name,"json");if(u?.role===role)return u}c=r.list_complete?null:r.cursor}while(c);return null}
async function save(env,u){await env.USERS.put(`id:${u.id}`,JSON.stringify(u));await env.USERS.put(`username:${u.username}`,JSON.stringify(u))}
async function revoke(env,id){let c;do{const r=await env.SESSIONS.list({prefix:"session:",limit:1000,...(c?{cursor:c}:{})});for(const k of r.keys){const s=await env.SESSIONS.get(k.name,"json");if(s?.userId===id)await env.SESSIONS.delete(k.name)}c=r.list_complete?null:r.cursor}while(c)}
function getToken(req){const c=req.headers.get("Cookie")||"";for(const p of c.split(";")){const [k,...v]=p.trim().split("=");if(k==="session"&&v.length)return v.join("=")}const a=req.headers.get("Authorization");return a?.startsWith("Bearer ")?a.slice(7).trim():null}
async function hashPw(p,s){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(p),"PBKDF2",false,["deriveBits"]);const b=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(s),iterations:PASSWORD_ITERATIONS,hash:"SHA-256"},k,256);return b64(new Uint8Array(b))}
async function verifyPw(p,h,s){return timing(await hashPw(p,s),h)}
function timing(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function b64(b){let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}

export class ChatRoom extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env}
 async fetch(req){if(req.headers.get("Upgrade")?.toLowerCase()!=="websocket")return new Response("WebSocket endpoint",{status:426});const id=req.headers.get("X-Chat-User-Id"),u=req.headers.get("X-Chat-Username"),display=req.headers.get("X-Chat-Display-Name")||"",pfp=req.headers.get("X-Chat-Pfp")||"",role=req.headers.get("X-Chat-Role")||"user";if(!id||!u)return new Response("Authentication required",{status:401});const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server);server.serializeAttachment({userId:id,username:u,displayName:display,pfp,role});const history=await this.ctx.storage.get("messages")||[];server.send(JSON.stringify({type:"history",messages:history}));return new Response(null,{status:101,webSocket:client})}
 async webSocketMessage(ws,raw){const id=ws.deserializeAttachment();if(!id)return;let d;try{d=typeof raw==="string"?JSON.parse(raw):null}catch{return this.safe(ws,{type:"error",error:"Invalid message"})}if(d?.type!=="chat")return;const text=typeof d.text==="string"?d.text.trim():"";if(!text)return;if(text.length>1000)return this.safe(ws,{type:"error",error:"Message too long"});const now=Date.now(),state=await this.ctx.storage.get(`rate:${id.userId}`)||{times:[],mutedUntil:0};if(now<state.mutedUntil)return this.safe(ws,{type:"error",error:"You are muted for 5 seconds",errorCode:"CHAT_MUTED",mutedUntil:state.mutedUntil});state.times=(state.times||[]).filter(t=>now-t<CHAT_WINDOW_MS);if(state.times.length>=CHAT_MAX_MESSAGES){state.mutedUntil=now+CHAT_MUTE_MS;state.times=[];await this.ctx.storage.put(`rate:${id.userId}`,state);return this.safe(ws,{type:"error",error:"Spam limit reached. You cannot send messages for 5 seconds.",errorCode:"CHAT_MUTED",mutedUntil:state.mutedUntil})}state.times.push(now);if(state.times.length>=CHAT_MAX_MESSAGES){state.mutedUntil=now+CHAT_MUTE_MS;state.times=[]}await this.ctx.storage.put(`rate:${id.userId}`,state);const m={type:"message",id:crypto.randomUUID(),userId:id.userId,username:id.username,displayName:id.displayName,pfp:id.pfp,role:id.role,text,time:new Date().toISOString()};let history=await this.ctx.storage.get("messages")||[];history=[...history,m].slice(-CHAT_HISTORY_LIMIT);await this.ctx.storage.put("messages",history);await this.broadcast(m);if(state.mutedUntil>now)this.safe(ws,{type:"rate_limit",error:"5 messages sent in 1 second. Chat locked for 5 seconds.",errorCode:"CHAT_MUTED",mutedUntil:state.mutedUntil})}
 async broadcast(m){const p=JSON.stringify(m);for(const s of this.ctx.getWebSockets()){try{if(s.readyState===WebSocket.OPEN)s.send(p)}catch{}}}
 safe(ws,d){try{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(d))}catch{}}
 async webSocketClose(ws){try{ws.close()}catch{}}
 async webSocketError(ws,e){console.error("CHAT",e)}
}
