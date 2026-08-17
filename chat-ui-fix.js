(() => {
  const $ = s => document.querySelector(s);
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    let d = {}; try { d = await r.json(); } catch {}
    if (!r.ok || d.success === false) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  };
  let me = null, globalSocket = null, activeSocket = null, activeRoom = null;
  const esc = s => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function toast(msg) {
    let t = $('#yprxyToast');
    if (!t) { t = document.createElement('div'); t.id = 'yprxyToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function rename() {
    document.title = 'yprxy.';
    document.querySelectorAll('body *').forEach(e => { if (e.children.length === 0 && e.textContent) e.textContent = e.textContent.replaceAll("Yaqub's Hub", 'yprxy.').replaceAll('Discord', 'yachat!').replaceAll('Global Chat', 'yachat!'); });
    const chat = document.querySelector('.rail .server[data-view="chat"]'); if (chat) { chat.textContent = '💬'; chat.title = 'yachat!'; }
    const chatChannel = document.querySelector('.sidebar .channel[data-view="chat"]'); if (chatChannel) chatChannel.innerHTML = '<b>#</b> yachat!';
    const title = $('#topTitle'); if (title && (title.textContent.includes('Chat') || title.textContent.includes('Discord'))) title.textContent = 'yachat!';
  }

  function getUser() { return api('/api/me').then(x => x.user); }
  function avatar(el, u) { if (!el) return; const v = u?.profile?.avatar || ''; if (/^(data:image\/|https?:\/\/)/i.test(v)) { el.textContent = ''; el.style.backgroundImage = `url(${JSON.stringify(v)})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; } else { el.style.backgroundImage = ''; el.textContent = (v || u?.displayName || u?.username || 'Y').slice(0,1).toUpperCase(); } }

  function appendGlobal(m) {
    const box = $('#messages'); if (!box) return;
    const row = document.createElement('div'); row.className = 'message';
    row.innerHTML = `<div class="avatar"></div><div class="body"><div class="msgHead"><strong>${esc(m.displayName || m.username)}</strong><time>${new Date(m.time || Date.now()).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time></div><div class="msgText">${esc(m.text)}</div></div>`;
    avatar(row.querySelector('.avatar'), m); box.appendChild(row); box.scrollTop = box.scrollHeight;
  }

  function appendDM(m) {
    const box = $('#dmMessages'); if (!box) return;
    const row = document.createElement('div'); row.className = 'server-message';
    row.innerHTML = `<div class="avatar">${esc((m.displayName || m.username || 'Y').slice(0,1).toUpperCase())}</div><div class="server-message-body"><div class="server-message-head"><strong>${esc(m.displayName || m.username)}</strong><time>${new Date(m.time || Date.now()).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time></div><div class="server-message-text">${esc(m.text)}</div></div>`;
    box.appendChild(row); box.scrollTop = box.scrollHeight;
  }

  function socketURL(room) { const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'; return `${proto}//${location.host}/api/chat?room=${encodeURIComponent(room)}`; }

  function connectGlobal() {
    if (!me) return;
    try { globalSocket?.close(); } catch {}
    globalSocket = new WebSocket(socketURL('main'));
    globalSocket.onopen = () => toast('Connected to yachat! 🟢');
    globalSocket.onmessage = e => { try { const d = JSON.parse(e.data); if (d.type === 'history') { const b = $('#messages'); if (b) { b.innerHTML=''; d.messages.forEach(appendGlobal); } } else if (d.type === 'message') appendGlobal(d); else if (d.type === 'error') toast(d.error); } catch {} };
    globalSocket.onclose = () => { if (me) setTimeout(connectGlobal, 1800); };
    globalSocket.onerror = () => {};
  }

  function connectRoom(type, id, title, obj) {
    try { activeSocket?.close(); } catch {}
    activeRoom = `${type}:${id}`;
    const box = $('#dmMessages'); if (box) box.innerHTML = '<div class="dmEmpty"><h2>Connecting…</h2><p>Opening secure chat</p></div>';
    try {
      activeSocket = new WebSocket(socketURL(activeRoom));
      activeSocket.onopen = () => { if (box) box.innerHTML = ''; };
      activeSocket.onmessage = e => { try { const d = JSON.parse(e.data); if (d.type === 'history') { if (box) { box.innerHTML=''; d.messages.forEach(appendDM); } } else if (d.type === 'message') appendDM(d); else if (d.type === 'error') toast(d.error); } catch {} };
      activeSocket.onerror = () => toast('Chat connection error — retrying…');
      activeSocket.onclose = () => { if (activeRoom === `${type}:${id}` && me) setTimeout(() => connectRoom(type,id,title,obj), 1800); };
    } catch { toast('Chat connection error'); }
  }

  function wireGlobalForm() {
    const old = $('#chatForm'); if (!old || old.dataset.yachatFixed) return; const form = old.cloneNode(true); old.replaceWith(form); form.dataset.yachatFixed = '1';
    form.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); const input = $('#chatInput'), text = input?.value.trim(); if (!text) return; if (!globalSocket || globalSocket.readyState !== WebSocket.OPEN) return toast('yachat! is reconnecting…'); globalSocket.send(JSON.stringify({type:'chat',text})); input.value=''; input.focus(); }, true);
  }

  function wireDMForm() {
    const old = $('#dmForm'); if (!old || old.dataset.yachatFixed) return; const form = old.cloneNode(true); old.replaceWith(form); form.dataset.yachatFixed = '1';
    form.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); const input=$('#dmInput'), text=input?.value.trim(); if(!text)return; if(!activeSocket || activeSocket.readyState!==WebSocket.OPEN)return toast('Chat is reconnecting…'); activeSocket.send(JSON.stringify({type:'chat',text})); input.value=''; input.focus(); }, true);
  }

  function patchDMButtons() {
    const links = document.querySelectorAll('#dmList .dm, #groupList .dm');
    links.forEach(b => { if (b.dataset.yachatFixed) return; b.dataset.yachatFixed='1'; const copy=b.cloneNode(true); b.replaceWith(copy); copy.addEventListener('click', async e => { e.preventDefault(); const name=copy.querySelector('strong')?.textContent || copy.textContent.trim(); const isGroup=copy.closest('#groupList'); const dms=await api('/api/dms').catch(()=>({dms:[]})); if(!isGroup){const dm=(dms.dms||[]).find(x=>x.users.some(u=>u.displayName===name||u.username===name)); if(dm) { openRoomUI('dm',dm.id,name,dm.users.find(u=>u.id!==me.id)); }} else { const gs=(await api('/api/groups').catch(()=>({groups:[]}))).groups||[]; const g=gs.find(x=>x.name===name); if(g)openRoomUI('group',g.id,g.name,g); } }); });
  }

  function openRoomUI(type,id,title,obj) {
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='dmView'));
    document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active', x.dataset.view==='dm'));
    const h=$('#dmTitle'); if(h) h.innerHTML=`<div class="dmTitle"><div class="avatar">${type==='group'?'👥':''}</div><div><strong>${esc(title)}</strong><div class="sub">${type==='group'?'Group chat':'@'+esc(obj?.username||'')}</div></div></div>`;
    const a=h?.querySelector('.avatar'); if(type==='dm')avatar(a,obj);
    connectRoom(type,id,title,obj);
  }

  async function boot() {
    try { me = await getUser(); } catch { return; }
    rename(); wireGlobalForm(); wireDMForm(); connectGlobal();
    // app-enhance-v4 owns the DM/group creation UI. Patch the generated sidebar items shortly after it updates them.
    patchDMButtons(); setInterval(patchDMButtons, 1200);
    document.addEventListener('click', e => { const b=e.target.closest('[data-view="chat"]'); if(b){ setTimeout(()=>{ rename(); wireGlobalForm(); connectGlobal(); },80); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
