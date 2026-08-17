(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { credentials: "include", ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch {}
    if (!r.ok || d.success === false) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  };
  let me = null, socket = null;

  const toast = msg => {
    let t = $("#serverToast");
    if (!t) { t = document.createElement("div"); t.id = "serverToast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._x); t._x = setTimeout(() => t.classList.remove("show"), 2600);
  };

  const go = view => {
    const el = document.querySelector(`[data-view="${view}"]`);
    if (el) el.click();
    else { document.querySelectorAll(".view").forEach(x => x.classList.remove("active")); $(`#${view}View`)?.classList.add("active"); }
  };

  const avatar = u => esc(u?.profile?.avatar || (u?.displayName || u?.username || "Y").slice(0, 1).toUpperCase());
  const name = u => esc(u?.displayName || u?.username || "Unknown");

  function styleAvatar(el, u) {
    if (!el) return;
    const value = u?.profile?.avatar || "";
    el.style.background = u?.profile?.accent ? `linear-gradient(135deg,${u.profile.accent},#9b59b6)` : "linear-gradient(135deg,#5865f2,#9b59b6)";
    if (/^data:image\//i.test(value) || /^https?:\/\//i.test(value)) {
      el.textContent = "";
      el.style.backgroundImage = `url(${JSON.stringify(value)})`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    } else {
      el.style.backgroundImage = "";
      el.textContent = value || (u?.displayName || u?.username || "Y").slice(0, 1).toUpperCase();
    }
  }

  function replaceButton(id, fn) {
    const old = document.getElementById(id); if (!old) return null;
    const n = old.cloneNode(true); old.replaceWith(n); n.addEventListener("click", e => { e.preventDefault(); fn(e); }); return n;
  }

  function addStyles() {
    if ($("#serverEnhanceStyles")) return;
    const s = document.createElement("style"); s.id = "serverEnhanceStyles"; s.textContent = `
      html,body{overflow:hidden!important}
      .content{overflow-y:auto!important;overflow-x:hidden!important;scroll-behavior:smooth!important}
      .view.active{animation:viewIn .28s cubic-bezier(.2,.8,.2,1)}
      @keyframes viewIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .main{background-color:#11141a!important;background-image:radial-gradient(circle,#ffffff18 1px,transparent 1.5px)!important;background-size:22px 22px!important}
      .top,.linksView,.chatView,.dmView,.panelView{background:transparent!important}
      .sidebar,.rail,.sideBottom,.sideHead{background:#0e1016!important;background-image:none!important}
      .rail{background:#08090d!important}
      .server,.channel,.dm,.btn,.composer button,.dmComposer button,.iconBtn,.tab,.server-primary{min-height:42px}
      button{transition:transform .16s ease,filter .16s ease,background-color .16s ease,box-shadow .16s ease!important}
      button:hover{filter:brightness(1.10)}
      button:active{transform:scale(1.06)!important;filter:brightness(1.25)!important;box-shadow:0 0 22px #5865f244!important}
      .server:active{transform:scale(1.08)!important}
      .link{min-height:70px}
      .linksView{min-height:max-content!important;padding-bottom:70px!important}
      .modal,.server-modal{opacity:0!important;transition:opacity .22s ease!important}
      .modal.show,.server-modal.show{opacity:1!important}
      .modalBox,.server-box{transform:translateY(12px) scale(.97);transition:transform .26s cubic-bezier(.2,.8,.2,1)!important}
      .modal.show .modalBox,.server-modal.show .server-box{transform:none}
      .server-modal{position:fixed;inset:0;z-index:9999;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(12px)}
      .server-box{width:min(620px,100%);max-height:88vh;overflow:auto;background:#191c24;border:1px solid #ffffff16;border-radius:20px;box-shadow:0 30px 100px #000b}
      .server-head{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;border-bottom:1px solid #ffffff12}.server-head h3{margin:0}.server-body{padding:20px}
      .server-search,.server-group-name{width:100%;padding:13px;border:1px solid #ffffff16;border-radius:11px;background:#0b0d12;color:#fff;outline:0}.server-group-name{margin-bottom:12px}.server-results{display:grid;gap:8px;margin-top:12px}
      .server-user{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid #ffffff0d;border-radius:12px;background:#11141a;color:#fff;text-align:left}.server-user:hover{background:#252a34}.server-user .avatar{width:40px;height:40px}.server-user-main{min-width:0;flex:1}.server-user-main strong{display:block}.server-user-main small{color:#969dab}.server-check{width:18px;height:18px}.server-primary{border:0;border-radius:10px;background:#5865f2;color:#fff;padding:12px 17px;font-weight:900}
      .server-muted{color:#969dab;font-size:12px}.server-dm-head{padding:13px 20px;border-bottom:1px solid #ffffff12}.server-message{display:flex;gap:10px;padding:8px 0}.server-message .avatar{width:36px;height:36px}.server-message-body{min-width:0}.server-message-head{display:flex;gap:7px;align-items:center}.server-message-head strong{font-size:13px}.server-message-head time{font-size:10px;color:#969dab}.server-message-text{font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word;margin-top:2px}
      .authGate{position:fixed;inset:0;z-index:100000;background:radial-gradient(circle at 50% 0,#5865f230,transparent 40%),#07090e;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}.authCard{width:min(460px,100%);background:#171a22;border:1px solid #ffffff18;border-radius:22px;box-shadow:0 35px 120px #000b;padding:26px;animation:authIn .4s cubic-bezier(.2,.8,.2,1)}@keyframes authIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}.authLogo{width:62px;height:62px;border-radius:18px;background:linear-gradient(135deg,#5865f2,#9b59b6);display:grid;place-items:center;font-size:25px;font-weight:1000;margin-bottom:16px}.authCard h1{margin:0 0 6px;font-size:25px}.authCard p{color:#969dab;margin:0 0 20px;font-size:13px}.authTabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px}.authTab{border:0;border-radius:10px;padding:12px;background:#0d1016;color:#9aa1ae;font-weight:900}.authTab.active{background:#5865f2;color:#fff}.authForm{display:grid;gap:10px}.authForm input{width:100%;padding:13px;border:1px solid #ffffff14;border-radius:10px;background:#0b0d12;color:#fff;outline:0}.authForm input:focus{border-color:#5865f2}.authSubmit{border:0;border-radius:10px;padding:13px;background:#5865f2;color:#fff;font-weight:900;margin-top:4px}.authError{min-height:18px;color:#ff6970;font-size:12px}.authNote{font-size:11px!important;margin:12px 0 0!important;text-align:center}.pfpUpload{display:flex;align-items:center;gap:12px}.pfpPreview{width:72px;height:72px;border-radius:50%;background:#5865f2 center/cover;display:grid;place-items:center;font-weight:900;overflow:hidden}
    `; document.head.appendChild(s);
  }

  function modal(title, body, actions = "") {
    $("#serverModal")?.remove();
    const m = document.createElement("div"); m.id = "serverModal"; m.className = "server-modal";
    m.innerHTML = `<div class="server-box"><div class="server-head"><h3>${esc(title)}</h3><button class="iconBtn server-close" aria-label="Close">✕</button></div><div class="server-body">${body}</div>${actions ? `<div class="server-head" style="justify-content:flex-end;gap:8px">${actions}</div>` : ""}</div>`;
    document.body.appendChild(m); requestAnimationFrame(() => m.classList.add("show"));
    m.querySelector(".server-close").onclick = () => { m.classList.remove("show"); setTimeout(() => m.remove(), 220); };
    m.onclick = e => { if (e.target === m) m.querySelector(".server-close").click(); };
    return m;
  }

  function authGate() {
    if ($("#yprxyAuthGate")) return;
    const gate = document.createElement("div"); gate.id = "yprxyAuthGate"; gate.className = "authGate";
    gate.innerHTML = `<div class="authCard"><div class="authLogo">Y.</div><h1>Welcome to yprxy.</h1><p>You need an account to use yprxy. Log in or create your account to continue.</p><div class="authTabs"><button class="authTab active" data-auth="login">Log In</button><button class="authTab" data-auth="register">Create Account</button></div><form class="authForm" id="authForm"></form><div class="authError" id="authError"></div><p class="authNote">Your account is required for chats, DMs, groups, and profiles.</p></div>`;
    document.body.appendChild(gate);
    const form = $("#authForm");
    const render = mode => {
      gate.querySelectorAll(".authTab").forEach(b => b.classList.toggle("active", b.dataset.auth === mode));
      form.innerHTML = mode === "login" ? `<input id="authUsername" autocomplete="username" placeholder="Username" required><input id="authPassword" type="password" autocomplete="current-password" placeholder="Password" required><button class="authSubmit">Log In</button>` : `<input id="authUsername" autocomplete="username" placeholder="Username" required><input id="authDisplay" placeholder="Display name" required><input id="authReal" placeholder="Real name" required><input id="authPassword" type="password" autocomplete="new-password" placeholder="Password (8+ characters)" required><button class="authSubmit">Create Account</button>`;
      gate.dataset.mode = mode; $("#authError").textContent = "";
    };
    gate.querySelectorAll(".authTab").forEach(b => b.onclick = () => render(b.dataset.auth));
    form.onsubmit = async e => {
      e.preventDefault(); $("#authError").textContent = "";
      try {
        const mode = gate.dataset.mode; const payload = { username: $("#authUsername").value, password: $("#authPassword").value };
        if (mode === "register") Object.assign(payload, { displayName: $("#authDisplay").value, realName: $("#authReal").value });
        const d = await api(mode === "login" ? "/api/login" : "/api/register", { method:"POST", body:JSON.stringify(payload) });
        if (mode === "register") { await api("/api/login", { method:"POST", body:JSON.stringify({username:payload.username,password:payload.password})}); }
        me = (await api("/api/me")).user; gate.remove(); syncMini(); await Promise.all([loadDMs(), loadGroups()]); toast(mode === "login" ? "Welcome back 👋" : "Account created 🎉");
      } catch (e) { $("#authError").textContent = e.message; }
    };
    render("login");
  }

  async function loadMe() {
    try { const d = await api("/api/me"); me = d.user; syncMini(); await Promise.all([loadDMs(), loadGroups()]); return true; }
    catch { me = null; authGate(); return false; }
  }

  function syncMini() {
    if (!me) return;
    $("#miniName") && ($("#miniName").textContent = me.displayName || me.username);
    $("#miniTag") && ($("#miniTag").textContent = `@${me.username}${me.verified ? "  ✓" : ""}`);
    styleAvatar($("#miniAvatar"), me); styleAvatar($("#profileAvatar"), me);
    if (me.profile?.accent) document.documentElement.style.setProperty("--accent", me.profile.accent);
    $("#profileName") && ($("#profileName").textContent = me.displayName || me.username);
    $("#profilePreviewBio") && ($("#profilePreviewBio").textContent = me.profile?.bio || "No bio yet.");
    $("#profileDisplay") && ($("#profileDisplay").value = me.displayName || "");
    $("#profileEmoji") && ($("#profileEmoji").value = /^data:image/i.test(me.profile?.avatar || "") ? "" : (me.profile?.avatar || ""));
    $("#profileBio") && ($("#profileBio").value = me.profile?.bio || "");
    $("#profileAccent") && ($("#profileAccent").value = me.profile?.accent || "#5865f2");
    $("#profileStatus") && ($("#profileStatus").value = me.profile?.status || "online");
  }

  async function loadDMs() {
    if (!me) return; const d = await api("/api/dms"); const box = $("#dmList"); if (!box) return; box.innerHTML = "";
    for (const dm of d.dms || []) {
      const other = dm.users.find(u => u.id !== me.id) || dm.users[0];
      const b = document.createElement("button"); b.className = "dm"; b.innerHTML = `<div class="avatar"></div><div style="min-width:0"><strong style="font-size:12px">${name(other)}</strong><small style="display:block;color:#969dab">@${esc(other.username)}</small></div>`;
      styleAvatar(b.querySelector(".avatar"), other); b.onclick = () => openChat({ type:"dm", id:dm.id, title:other.displayName || other.username, user:other }); box.appendChild(b);
    }
  }

  async function loadGroups() {
    if (!me) return; const d = await api("/api/groups"); const box = $("#groupList"); if (!box) return; box.innerHTML = "";
    for (const g of d.groups || []) {
      const b = document.createElement("button"); b.className = "dm"; b.innerHTML = `<div class="avatar">👥</div><div style="min-width:0"><strong style="font-size:12px">${esc(g.name)}</strong><small style="display:block;color:#969dab">${g.members.length} members</small></div>`;
      b.onclick = () => openChat({ type:"group", id:g.id, title:g.name, group:g }); box.appendChild(b);
    }
  }

  function renderMessages(messages) { const box = $("#dmMessages"); if (!box) return; box.innerHTML = ""; (messages || []).forEach(appendMessage); box.scrollTop = box.scrollHeight; }
  function appendMessage(m) {
    const box = $("#dmMessages"); if (!box) return;
    const row = document.createElement("div"); row.className = "server-message";
    row.innerHTML = `<div class="avatar"></div><div class="server-message-body"><div class="server-message-head"><strong>${esc(m.displayName || m.username)}</strong><time>${new Date(m.time || Date.now()).toLocaleString()}</time></div><div class="server-message-text">${esc(m.text)}</div></div>`;
    styleAvatar(row.querySelector(".avatar"), {displayName:m.displayName,username:m.username}); box.appendChild(row); box.scrollTop = box.scrollHeight;
  }

  function closeSocket() { if (socket) { try { socket.close(); } catch {} socket = null; } }
  function openChat(c) {
    closeSocket(); go("dm");
    const title = $("#dmTitle"); if (title) title.innerHTML = `<div class="server-dm-head"><div style="display:flex;align-items:center;gap:10px"><div class="avatar">${c.type === "group" ? "👥" : ""}</div><div><strong>${esc(c.title)}</strong><div class="server-muted">${c.type === "group" ? "Group chat" : `@${esc(c.user.username)}`}</div></div></div></div>`;
    if (c.type === "dm") styleAvatar(title.querySelector(".avatar"), c.user);
    renderMessages([]);
    const proto = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${proto}://${location.host}/api/${c.type}/ws?id=${encodeURIComponent(c.id)}`);
    socket.onmessage = e => { try { const d = JSON.parse(e.data); if (d.type === "history") renderMessages(d.messages); else if (d.type === "message") appendMessage(d); else if (d.type === "error") toast(d.error); } catch {} };
    socket.onerror = () => toast("Chat connection error"); socket.onclose = () => { socket = null; };
  }

  function wireDMForm() {
    const old = $("#dmForm"); if (!old) return; const form = old.cloneNode(true); old.replaceWith(form);
    form.addEventListener("submit", e => { e.preventDefault(); const input = $("#dmInput"); const text = input?.value.trim(); if (!text || !socket || socket.readyState !== 1) return; socket.send(JSON.stringify({type:"chat",text})); input.value = ""; input.focus(); });
  }

  async function startDM() {
    if (!me) return authGate();
    const m = modal("Start a direct message", `<input id="dmUserSearch" class="server-search" placeholder="Search usernames..."/><div id="dmUserResults" class="server-results"></div>`);
    const render = async q => { try { const d=await api(`/api/users/search?q=${encodeURIComponent(q)}`); const r=$("#dmUserResults"); r.innerHTML=""; d.users.forEach(u=>{const b=document.createElement("button");b.className="server-user";b.innerHTML=`<div class="avatar"></div><div class="server-user-main"><strong>${name(u)}</strong><small>@${esc(u.username)}</small></div>`;styleAvatar(b.querySelector(".avatar"),u);b.onclick=async()=>{try{const x=await api("/api/dm/create",{method:"POST",body:JSON.stringify({userId:u.id})});m.remove();await loadDMs();const other=x.dm.users.find(z=>z.id!==me.id)||u;openChat({type:"dm",id:x.dm.id,title:other.displayName||other.username,user:other});}catch(e){toast(e.message)}};r.appendChild(b)})}catch(e){toast(e.message)}};
    $("#dmUserSearch").oninput=e=>render(e.target.value); render("");
  }

  async function createGroup() {
    if (!me) return authGate();
    const m = modal("Create a group", `<input id="groupName" class="server-group-name" maxlength="60" placeholder="Group name"/><input id="groupUserSearch" class="server-search" placeholder="Search members..."/><div id="groupUserResults" class="server-results"></div>`, `<button id="makeGroup" class="server-primary">Create Group</button>`);
    const selected = new Set();
    const render = async q => { try { const d=await api(`/api/users/search?q=${encodeURIComponent(q)}`); const r=$("#groupUserResults"); r.innerHTML=""; d.users.forEach(u=>{const b=document.createElement("label");b.className="server-user";b.innerHTML=`<input class="server-check" type="checkbox" value="${esc(u.id)}"><div class="avatar"></div><div class="server-user-main"><strong>${name(u)}</strong><small>@${esc(u.username)}</small></div>`;styleAvatar(b.querySelector(".avatar"),u);const cb=b.querySelector("input");cb.checked=selected.has(u.id);cb.onchange=()=>cb.checked?selected.add(u.id):selected.delete(u.id);r.appendChild(b)})}catch(e){toast(e.message)}};
    $("#groupUserSearch").oninput=e=>render(e.target.value); render("");
    $("#makeGroup").onclick=async()=>{const groupName=$("#groupName").value.trim();if(!groupName)return toast("Enter a group name");if(!selected.size)return toast("Pick at least one member");try{const d=await api("/api/group/create",{method:"POST",body:JSON.stringify({name:groupName,memberIds:[...selected]})});m.remove();await loadGroups();openChat({type:"group",id:d.group.id,title:d.group.name,group:d.group});}catch(e){toast(e.message)}};
  }

  async function saveProfile() {
    try {
      const payload={displayName:$("#profileDisplay").value,avatar:$("#profileEmoji").value,bio:$("#profileBio").value,accent:$("#profileAccent").value,status:$("#profileStatus").value};
      const file=$("#profilePfp").files?.[0];
      if(file){payload.avatar=await resizeImage(file);}
      const d=await api("/api/profile",{method:"POST",body:JSON.stringify(payload)});me=d.user;syncMini();toast("Profile saved ✨");
    } catch(e){toast(e.message)}
  }

  function resizeImage(file) {
    return new Promise((resolve,reject)=>{ if(!file.type.startsWith("image/")) return reject(new Error("Choose an image file")); const img=new Image(); const reader=new FileReader(); reader.onload=()=>{img.onload=()=>{const c=document.createElement("canvas");const size=256;c.width=size;c.height=size;const ctx=c.getContext("2d");const scale=Math.max(size/img.width,size/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);resolve(c.toDataURL("image/jpeg",.78));};img.onerror=()=>reject(new Error("Could not read image"));img.src=reader.result;};reader.onerror=()=>reject(new Error("Could not read image"));reader.readAsDataURL(file); });
  }

  function addPfpField() {
    const emoji=$("#profileEmoji"); if(!emoji || $("#profilePfp")) return;
    const field=emoji.closest(".field"); if(!field) return;
    field.innerHTML=`<label>Profile picture</label><div class="pfpUpload"><div class="pfpPreview" id="pfpPreview">Y</div><input id="profilePfp" type="file" accept="image/*"></div><small style="color:#969dab">Upload a picture, or leave it empty to use your emoji.</small>`;
    $("#profilePfp").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=await resizeImage(f);$("#pfpPreview").style.backgroundImage=`url(${JSON.stringify(data)})`;}catch(err){toast(err.message)}};
  }

  function renameBranding() {
    document.title="yprxy.";
    document.querySelectorAll("body *").forEach(el=>{if(el.children.length===0&&el.textContent.includes("Yaqub's Hub"))el.textContent=el.textContent.replaceAll("Yaqub's Hub","yprxy.");});
    const hero=$(".hero h1"); if(hero) hero.innerHTML="Welcome to yprxy. 👋";
    const p=$(".hero p"); if(p) p.textContent="Your links, communities, and global chat — all in one place.";
  }

  function separateLinksAndDiscord() {
    const rail=document.querySelector(".rail"); if(!rail)return;
    const first=rail.querySelector(".server[data-view=home]"); if(first){first.textContent="🔗";first.title="yprxy. Links";}
    const chat=rail.querySelector(".server[data-view=chat]"); if(chat){chat.textContent="💬";chat.title="Discord";}
    const add=rail.querySelector("#newGroup"); if(add){add.textContent="+";add.title="Create group";}
    const sideHead=document.querySelector(".sideHead span"); if(sideHead)sideHead.textContent="yprxy.";
    const sections=document.querySelectorAll(".section"); if(sections[0])sections[0].textContent="Links";
  }

  function wire() {
    addStyles(); renameBranding(); separateLinksAndDiscord();
    addPfpField();
    replaceButton("addDm", startDM); replaceButton("newGroup", createGroup); replaceButton("addGroup", createGroup);
    replaceButton("saveProfile", saveProfile); replaceButton("profileBtn", () => go("profile")); replaceButton("openSettings", () => go("profile")); replaceButton("accountBtn", () => go("profile"));
    wireDMForm();
    loadMe().catch(()=>{});
    setInterval(() => { if (!me && !$("#yprxyAuthGate")) loadMe().catch(()=>{}); }, 5000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, {once:true}); else wire();
})();
