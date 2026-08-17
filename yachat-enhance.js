(()=>{
"use strict";
const API="https://hehwhwhwhuuu.yaqubpapp1.workers.dev";let ws=null,me=null,muted=false;
const q=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
async function api(path,opt={}){opt.credentials="include";opt.headers={"Content-Type":"application/json",...(opt.headers||{})};const r=await fetch(API+path,opt);let d={};try{d=await r.json()}catch{}return{r,d}}
const badge=u=>u?.role==="owner"?'<span class="yb owner">♛ OWNER</span>':u?.role==="admin"?'<span class="yb admin">ADMIN</span>':'';
function render(m){const box=q("#messages");if(!box)return;const d=document.createElement("div");d.className="bubble"+(m.userId===me?.id?" mine":"");d.innerHTML=`<div class="meta2"><strong>${esc(m.displayName||m.username)}</strong> ${badge(m)} · ${new Date(m.time).toLocaleTimeString()}</div><div>${esc(m.text)}</div>`;box.appendChild(d);box.scrollTop=box.scrollHeight}
function connect(){if(ws&&ws.readyState<=1)return;ws=new WebSocket(API.replace(/^http/,"ws")+"/api/chat");ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==="history"){q("#messages").innerHTML="";(m.messages||[]).forEach(render)}else if(m.type==="message")render(m);else if(m.type==="error"){if(/5 seconds|Spam limit/i.test(m.error)){muted=true;q("#chatInput").disabled=true;q("#chatSend").disabled=true;setTimeout(()=>{muted=false;q("#chatInput").disabled=false;q("#chatSend").disabled=false},5000)}if(window.toast)toast("❌ "+m.error);else console.warn(m.error)}}catch{}};ws.onerror=()=>window.toast?toast("❌ Chat connection error"):null;ws.onclose=()=>{ws=null}}
async function boot(){const x=await api("/api/me");if(!x.r.ok||!x.d.success)return;me=x.d.user;const nav=q("#chatNav"),send=q("#chatSend"),input=q("#chatInput");if(nav)nav.onclick=()=>{q("#chatModal")?.classList.add("show");connect()};if(send)send.onclick=sendMsg;if(input)input.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg()}}}
function sendMsg(){if(muted)return;if(!ws||ws.readyState!==1)return connect();const input=q("#chatInput"),text=input?.value.trim();if(!text)return;ws.send(JSON.stringify({type:"chat",text}));input.value=""}
boot();
})();
