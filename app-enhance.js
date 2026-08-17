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
  const go = view => { const el = document.querySelector(`[data-view="${view}"]`); if (el) el.click(); else { document.querySelectorAll(".view").forEach(x => x.classList.remove("active")); $(`#${view}View`)?.classList.add("active"); } };
  const avatar = u => esc(u?.profile?.avatar || (u?.displayName || u?.username || "Y").slice(0,1).toUpperCase());
  const name = u => esc(u?.displayName || u?.username || "Unknown");

  function styleAvatar(el, u) { if (!el) return; el.textContent = avatar(u); if (u?.profile?.accent) el.style.background = `linear-gradient(135deg,${u.profile.accent},#9b59b6)`; }
  function replaceButton(id, fn) { const old = document.getElementById(id); if (!old) return null; const n = old.cloneNode(true); old.replaceWith(n); n.addEventListener("click", e => { e.preventDefault(); fn(e); }); return n; }

  function addStyles() {
    if ($("#serverEnhanceStyles")) return;
    const s = document.createElement("style"); s.id = "serverEnhanceStyles"; s.textContent = `
      .server-modal{position:fixed;inset:0;z-index:999;background:#000b;display:none;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(12px)}
      .server-modal.show{display:flex}.server-box{width:min(620px,100%);max-height:86vh;overflow:auto;background:#191c24;border:1px solid #ffffff16;border-radius:18px;box-shadow:0 30px 90px #0009}.server-head{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;border-bottom:1px solid #ffffff12}.server-head h3{margin:0}.server-body{padding:18px}.server-search,.server-group-name{width:100%;padding:12px;border:1px solid #ffffff12;border-radius:10px;background:#0b0d12;color:#fff;outline:0}.server-group-name{margin-bottom:12px}.server-results{display:grid;gap:7px;margin-top:12px}.server-user{display:flex;align-items:center;gap:11px;padding:10px;border:1px solid #ffffff0d;border-radius:11px;background:#11141a;color:#fff;text-align:left}.server-user:hover{background:#252a34}.server-user .avatar{width:38px;height:38px}.server-user-main{min-width:0;flex:1}.server-user-main strong{display:block}.server-user-main small{color:#969dab}.server-check{width:18px;height:18px}.server-primary{border:0;border-radius:9px;background:#5865f2;color:#fff;padding:11px 15px;font-weight:900}.server-muted{color:#969dab;font-size:12px}.server-dm-head{padding:12px 20px;border-bottom:1px solid #ffffff12}.server-message{display:flex;gap:10px;padding:7px 0}.server-message .avatar{width:34px;height:34px}.server-message-body{min-width:0}.server-message-head{display:flex;gap:7px;align-items:center}.server-message-head strong{font-size:13px}.server-message-head time{font-size:10px;color:#969dab}.server-message-text{font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word;margin-top:2px}
    `; document.head.appendChild(s);
  }

  function modal(title, body, actions = "") {
    $("#serverModal")?.remove();
    const m = document.createElement("div"); m.id = "serverModal"; m.className = "server-modal show";
    m.innerHTML = `<div class="server-box"><div class="server-head"><h3>${esc(title)}</h3><button class="iconBtn server-close">✕</button></div><div class="server-body">${body}</div>${actions ? `<div class="server-head" style="justify-content:flex-end;gap:8px">${actions}</div>` : ""}</div>`;
    document.body.appendChild(m); m.querySelector(".server-close").onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); }; return m;
  }

  async function loadMe() {
    try { const d = await api("/api/me"); me = d.user; syncMini(); await Promise.all([loadDMs(), loadGroups()]); return true; } catch { me = null; return false; }
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
    $("#profileEmoji") && ($("#profileEmoji").value = me.profile?.avatar || "");
    $("#profileBio") && ($("#profileBio").value = me.profile?.bio || "");
    $("#profileAccent") && ($("#profileAccent").value = me.profile?.accent || "#5865f2");
    $("#profileStatus") && ($("#profileStatus").value = me.profile?.status || "online");
  }

  async function loadDMs() {
    if (!me) return; const d = await api("/api/dms"); const box = $("#dmList"); if (!box) return; box.innerHTML = "";
    for (const dm of d.dms) {
      const other = dm.users.find(u => u.id !== me.id) || dm.users[0];
      const b = document.createElement("button"); b.className = "dm"; b.innerHTML = `<div class="avatar">${avatar(other)}</div><div style="min-width:0"><strong style="font-size:12px">${name(other)}</strong><small style="display:block;color:#969dab">@${esc(other.username)}</small></div>`;
      b.onclick = () => openChat({ type:"dm", id:dm.id, title:other.displayName || other.username, user:other }); box.appendChild(b);
    }
  }

  async function loadGroups() {
    if (!me) return; const d = await api("/api/groups"); const box = $("#groupList"); if (!box) return; box.innerHTML = "";
    for (const g of d.groups) {
      const b = document.createElement("button"); b.className = "dm"; b.innerHTML = `<div class="avatar">👥</div><div style="min-width:0"><strong style="font-size:12px">${esc(g.name)}</strong><small style="display:block;color:#969dab">${g.members.length} members</small></div>`;
      b.onclick = () => openChat({ type:"group", id:g.id, title:g.name, group:g }); box.appendChild(b);
    }
  }

  function renderMessages(messages) { const box = $("#dmMessages"); if (!box) return; box.innerHTML = ""; (messages || []).forEach(appendMessage); box.scrollTop = box.scrollHeight; }
  function appendMessage(m) {
    const box = $("#dmMessages"); if (!box) return;
    const row = document.createElement("div"); row.className = "server-message";
    row.innerHTML = `<div class="avatar">${esc((m.displayName || m.username || "Y").slice(0,1).toUpperCase())}</div><div class="server-message-body"><div class="server-message-head"><strong>${esc(m.displayName || m.username)}</strong><time>${new Date(m.time || Date.now()).toLocaleString()}</time></div><div class="server-message-text">${esc(m.text)}</div></div>`;
    box.appendChild(row); box.scrollTop = box.scrollHeight;
  }

  function closeSocket() { if (socket) { try { socket.close(); } catch {} socket = null; } }
  function openChat(c) {
    closeSocket(); go("dm");
    const title = $("#dmTitle"); if (title) title.innerHTML = `<div class="server-dm-head"><div style="display:flex;align-items:center;gap:10px"><div class="avatar">${c.type === "group" ? "👥" : avatar(c.user)}</div><div><strong>${esc(c.title)}</strong><div class="server-muted">${c.type === "group" ? "Group chat" : `@${esc(c.user.username)}`}</div></div></div></div>`;
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
    const m = modal("Start a direct message", `<input id="dmUserSearch" class="server-search" placeholder="Search usernames..."/><div id="dmUserResults" class="server-results"></div>`);
    const render = async q => { try { const d=await api(`/api/users/search?q=${encodeURIComponent(q)}`); const r=$("#dmUserResults"); r.innerHTML=""; d.users.forEach(u=>{const b=document.createElement("button");b.className="server-user";b.innerHTML=`<div class="avatar">${avatar(u)}</div><div class="server-user-main"><strong>${name(u)}</strong><small>@${esc(u.username)}</small></div>`;b.onclick=async()=>{try{const x=await api("/api/dm/create",{method:"POST",body:JSON.stringify({userId:u.id})});m.remove();await loadDMs();const other=x.dm.users.find(z=>z.id!==me.id)||u;openChat({type:"dm",id:x.dm.id,title:other.displayName||other.username,user:other});}catch(e){toast(e.message)}};r.appendChild(b)})}catch(e){toast(e.message)}};
    $("#dmUserSearch").oninput=e=>render(e.target.value); render("");
  }

  async function createGroup() {
    const m = modal("Create a group", `<input id="groupName" class="server-group-name" maxlength="60" placeholder="Group name"/><input id="groupUserSearch" class="server-search" placeholder="Search members..."/><div id="groupUserResults" class="server-results"></div>`, `<button id="makeGroup" class="server-primary">Create Group</button>`);
    const selected = new Set();
    const render = async q => { try { const d=await api(`/api/users/search?q=${encodeURIComponent(q)}`); const r=$("#groupUserResults"); r.innerHTML=""; d.users.forEach(u=>{const b=document.createElement("label");b.className="server-user";b.innerHTML=`<input class="server-check" type="checkbox" value="${esc(u.id)}"><div class="avatar">${avatar(u)}</div><div class="server-user-main"><strong>${name(u)}</strong><small>@${esc(u.username)}</small></div>`;const cb=b.querySelector("input");cb.checked=selected.has(u.id);cb.onchange=()=>cb.checked?selected.add(u.id):selected.delete(u.id);r.appendChild(b)})}catch(e){toast(e.message)}};
    $("#groupUserSearch").oninput=e=>render(e.target.value); render("");
    $("#makeGroup").onclick=async()=>{const groupName=$("#groupName").value.trim();if(!groupName)return toast("Enter a group name");if(!selected.size)return toast("Pick at least one member");try{const d=await api("/api/group/create",{method:"POST",body:JSON.stringify({name:groupName,memberIds:[...selected]})});m.remove();await loadGroups();openChat({type:"group",id:d.group.id,title:d.group.name,group:d.group});}catch(e){toast(e.message)}};
  }

  async function saveProfile() {
    try { const d=await api("/api/profile",{method:"POST",body:JSON.stringify({displayName:$("#profileDisplay").value,avatar:$("#profileEmoji").value,bio:$("#profileBio").value,accent:$("#profileAccent").value,status:$("#profileStatus").value})});me=d.user;syncMini();toast("Profile saved ✨"); } catch(e){toast(e.message)}
  }

  function wire() {
    addStyles();
    replaceButton("addDm", startDM); replaceButton("newGroup", createGroup); replaceButton("addGroup", createGroup);
    replaceButton("saveProfile", saveProfile); replaceButton("profileBtn", () => go("profile")); replaceButton("openSettings", () => go("profile")); replaceButton("accountBtn", () => go("profile"));
    wireDMForm(); loadMe().catch(()=>{}); setInterval(() => { if (!me) loadMe().catch(()=>{}); }, 5000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, {once:true}); else wire();
})();
