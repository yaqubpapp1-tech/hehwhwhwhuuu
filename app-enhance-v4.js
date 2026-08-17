(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const api = async (url, opts = {}) => {
    const r = await fetch(url, { credentials:'include', ...opts, headers:{'Content-Type':'application/json', ...(opts.headers || {})} });
    let d = {}; try { d = await r.json(); } catch {}
    if (!r.ok || d.success === false) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  };
  let me = null, socket = null;

  function styles() {
    if ($('#yprxyV4Styles')) return;
    const s = document.createElement('style'); s.id = 'yprxyV4Styles'; s.textContent = `
      html,body{overflow:hidden!important}
      .content{overflow-y:auto!important;overflow-x:hidden!important;scroll-behavior:smooth!important}
      .linksView{min-height:max-content!important;padding-bottom:80px!important}
      .main{background-color:#11141a!important;background-image:radial-gradient(circle,#ffffff18 1px,transparent 1.5px)!important;background-size:22px 22px!important}
      .rail,.sidebar,.sideHead,.sideBottom{background:#08090d!important;background-image:none!important}
      .sidebar{background:#0e1016!important}.top,.linksView,.chatView,.dmView,.panelView{background:transparent!important}
      .view.active{animation:yprxyView .28s cubic-bezier(.2,.8,.2,1)}
      @keyframes yprxyView{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      button{transition:transform .15s ease,filter .15s ease,box-shadow .15s ease,background .15s ease!important}
      button:hover{filter:brightness(1.1)} button:active{transform:scale(1.06)!important;filter:brightness(1.25)!important;box-shadow:0 0 24px #5865f244!important}
      .server,.channel,.dm,.btn,.iconBtn,.composer button,.dmComposer button{min-height:42px}
      .link{min-height:72px}
      .modal,.yprxy-modal{opacity:0;transition:opacity .22s ease!important}.modal.show,.yprxy-modal.show{opacity:1}
      .modalBox,.yprxy-box{transform:translateY(14px) scale(.97);transition:transform .26s cubic-bezier(.2,.8,.2,1)!important}
      .modal.show .modalBox,.yprxy-modal.show .yprxy-box{transform:none}
      .yprxy-modal{position:fixed;inset:0;z-index:99999;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(12px)}
      .yprxy-box{width:min(620px,100%);max-height:88vh;overflow:auto;background:#191c24;border:1px solid #ffffff18;border-radius:20px;box-shadow:0 35px 110px #000b}
      .yprxy-head{display:flex;justify-content:space-between;align-items:center;padding:17px 20px;border-bottom:1px solid #ffffff12}.yprxy-head h3{margin:0}.yprxy-body{padding:20px}
      .yprxy-input{width:100%;padding:13px;border:1px solid #ffffff16;border-radius:11px;background:#0b0d12;color:#fff;outline:0}.yprxy-results{display:grid;gap:8px;margin-top:12px}
      .yprxy-user{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid #ffffff0d;border-radius:12px;background:#11141a;color:#fff;text-align:left;width:100%}.yprxy-user:hover{background:#252a34}.yprxy-user .avatar{width:40px;height:40px}.yprxy-user-main{min-width:0;flex:1}.yprxy-user-main strong{display:block}.yprxy-user-main small{color:#969dab}.yprxy-check{width:18px;height:18px}.yprxy-primary{border:0;border-radius:10px;background:#5865f2;color:#fff;padding:12px 17px;font-weight:900}
      .yprxy-auth{position:fixed;inset:0;z-index:100000;background:radial-gradient(circle at 50% 0,#5865f230,transparent 40%),#07090e;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto}.yprxy-auth-card{width:min(470px,100%);background:#171a22;border:1px solid #ffffff18;border-radius:22px;padding:28px;box-shadow:0 35px 120px #000c;animation:yprxyAuth .4s cubic-bezier(.2,.8,.2,1)}@keyframes yprxyAuth{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}.yprxy-logo{width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#5865f2,#9b59b6);display:grid;place-items:center;font-size:26px;font-weight:1000;margin-bottom:16px}.yprxy-auth h1{margin:0 0 6px}.yprxy-auth p{color:#969dab;font-size:13px}.yprxy-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:18px 0 14px}.yprxy-auth-tab{border:0;border-radius:10px;padding:12px;background:#0d1016;color:#969dab;font-weight:900}.yprxy-auth-tab.active{background:#5865f2;color:#fff}.yprxy-auth-form{display:grid;gap:10px}.yprxy-auth-form input{padding:13px;border:1px solid #ffffff14;border-radius:10px;background:#0b0d12;color:#fff;outline:0}.yprxy-auth-submit{border:0;border-radius:10px;padding:13px;background:#5865f2;color:#fff;font-weight:900}.yprxy-auth-error{min-height:20px;color:#ff6970;font-size:12px;margin-top:5px}
      .yprxy-pfp-row{display:flex;align-items:center;gap:14px}.yprxy-pfp-preview{width:76px;height:76px;border-radius:50%;background:#5865f2 center/cover;display:grid;place-items:center;font-weight:900;overflow:hidden}
    `; document.head.appendChild(s);
  }

  function avatar(el,u){ if(!el)return; const v=u?.profile?.avatar||''; el.style.backgroundImage=/^(data:image\/|https?:\/\/)/i.test(v)?`url(${JSON.stringify(v)})`:''; el.style.backgroundSize='cover'; el.style.backgroundPosition='center'; el.textContent=/^(data:image\/|https?:\/\/)/i.test(v)?'':(v||(u?.displayName||u?.username||'Y')).slice(0,1).toUpperCase(); if(u?.profile?.accent&&!v)el.style.background=`linear-gradient(135deg,${u.profile.accent},#9b59b6)`; }
  const userName = u => esc(u?.displayName || u?.username || 'Unknown');

  function rename(){
    document.title='yprxy.';
    document.querySelectorAll('body *').forEach(e=>{if(e.children.length===0&&e.textContent.includes("Yaqub's Hub"))e.textContent=e.textContent.replaceAll("Yaqub's Hub",'yprxy.');});
    const h=$('.hero h1'); if(h)h.innerHTML='Welcome to yprxy. 👋';
    const first=$('.rail .server[data-view="home"]'); if(first){first.textContent='🔗';first.title='yprxy. Links';}
    const chat=$('.rail .server[data-view="chat"]'); if(chat){chat.textContent='💬';chat.title='Discord';}
    const head=$('.sideHead span');if(head)head.textContent='yprxy.';
    const secs=document.querySelectorAll('.section');if(secs[0])secs[0].textContent='Links';
  }

  function toast(msg){let t=$('#yprxyToast');if(!t){t=document.createElement('div');t.id='yprxyToast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600)}

  function gate(){
    if($('#yprxyAuth'))return;
    const g=document.createElement('div');g.id='yprxyAuth';g.className='yprxy-auth';
    g.innerHTML=`<div class="yprxy-auth-card"><div class="yprxy-logo">Y.</div><h1>Welcome to yprxy.</h1><p>You must create an account or log in before using the site.</p><div class="yprxy-auth-tabs"><button class="yprxy-auth-tab active" data-mode="login">Log In</button><button class="yprxy-auth-tab" data-mode="register">Create Account</button></div><form id="yprxyAuthForm" class="yprxy-auth-form"></form><div id="yprxyAuthError" class="yprxy-auth-error"></div></div>`;
    document.body.appendChild(g);
    const form=$('#yprxyAuthForm');
    const render=mode=>{g.dataset.mode=mode;g.querySelectorAll('.yprxy-auth-tab').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));form.innerHTML=mode==='login'?`<input id="yaUser" autocomplete="username" placeholder="Username" required><input id="yaPass" type="password" autocomplete="current-password" placeholder="Password" required><button class="yprxy-auth-submit">Log In</button>`:`<input id="yaUser" autocomplete="username" placeholder="Username" required><input id="yaDisplay" placeholder="Display name" required><input id="yaReal" placeholder="Real name" required><input id="yaPass" type="password" autocomplete="new-password" placeholder="Password (8+ characters)" required><button class="yprxy-auth-submit">Create Account</button>`;$('#yprxyAuthError').textContent=''};
    g.querySelectorAll('.yprxy-auth-tab').forEach(x=>x.onclick=()=>render(x.dataset.mode));
    form.onsubmit=async e=>{e.preventDefault();const mode=g.dataset.mode;const p={username:$('#yaUser').value,password:$('#yaPass').value};if(mode==='register')Object.assign(p,{displayName:$('#yaDisplay').value,realName:$('#yaReal').value});try{await api(mode==='login'?'/api/login':'/api/register',{method:'POST',body:JSON.stringify(p)});if(mode==='register')await api('/api/login',{method:'POST',body:JSON.stringify({username:p.username,password:p.password})});me=(await api('/api/me')).user;g.remove();sync();await refreshLists();toast(mode==='login'?'Welcome back 👋':'Account created 🎉')}catch(err){$('#yprxyAuthError').textContent=err.message}};
    render('login');
  }

  async function loadMe(){try{me=(await api('/api/me')).user;sync();await refreshLists()}catch{me=null;gate()}}
  function sync(){if(!me)return;$('#miniName')&&($('#miniName').textContent=me.displayName||me.username);$('#miniTag')&&($('#miniTag').textContent='@'+me.username+(me.verified?' ✓':''));avatar($('#miniAvatar'),me);avatar($('#profileAvatar'),me);$('#profileName')&&($('#profileName').textContent=me.displayName||me.username);$('#profilePreviewBio')&&($('#profilePreviewBio').textContent=me.profile?.bio||'No bio yet.');$('#profileDisplay')&&($('#profileDisplay').value=me.displayName||'');$('#profileBio')&&($('#profileBio').value=me.profile?.bio||'');$('#profileAccent')&&($('#profileAccent').value=me.profile?.accent||'#5865f2');$('#profileStatus')&&($('#profileStatus').value=me.profile?.status||'online');if(me.profile?.accent)document.documentElement.style.setProperty('--accent',me.profile.accent)}

  async function refreshLists(){await Promise.all([loadDMs(),loadGroups()])}
  async function loadDMs(){if(!me)return;try{const d=await api('/api/dms'),box=$('#dmList');if(!box)return;box.innerHTML='';(d.dms||[]).forEach(dm=>{const other=dm.users.find(x=>x.id!==me.id)||dm.users[0];const b=document.createElement('button');b.className='dm';b.innerHTML=`<div class="avatar"></div><div style="min-width:0"><strong style="font-size:12px">${userName(other)}</strong><small style="display:block;color:#969dab">@${esc(other.username)}</small></div>`;avatar(b.querySelector('.avatar'),other);b.onclick=()=>openChat('dm',dm.id,other.displayName||other.username,other);box.appendChild(b)})}catch(e){console.error(e)}}
  async function loadGroups(){if(!me)return;try{const d=await api('/api/groups'),box=$('#groupList');if(!box)return;box.innerHTML='';(d.groups||[]).forEach(g=>{const b=document.createElement('button');b.className='dm';b.innerHTML=`<div class="avatar">👥</div><div style="min-width:0"><strong style="font-size:12px">${esc(g.name)}</strong><small style="display:block;color:#969dab">${g.members.length} members</small></div>`;b.onclick=()=>openChat('group',g.id,g.name,g);box.appendChild(b)})}catch(e){console.error(e)}}

  function modal(title,html,action){const m=document.createElement('div');m.className='yprxy-modal';m.innerHTML=`<div class="yprxy-box"><div class="yprxy-head"><h3>${esc(title)}</h3><button class="iconBtn closeY">✕</button></div><div class="yprxy-body">${html}</div>${action?`<div class="yprxy-head" style="justify-content:flex-end">${action}</div>`:''}</div>`;document.body.appendChild(m);requestAnimationFrame(()=>m.classList.add('show'));m.querySelector('.closeY').onclick=()=>m.remove();return m}

  async function startDM(){if(!me)return gate();const m=modal('Start a direct message','<input id="dmSearch" class="yprxy-input" placeholder="Search users..."><div id="dmResults" class="yprxy-results"></div>');const render=async q=>{try{const d=await api('/api/users/search?q='+encodeURIComponent(q));const r=$('#dmResults');r.innerHTML='';(d.users||[]).forEach(u=>{const b=document.createElement('button');b.className='yprxy-user';b.innerHTML=`<div class="avatar"></div><div class="yprxy-user-main"><strong>${userName(u)}</strong><small>@${esc(u.username)}</small></div>`;avatar(b.querySelector('.avatar'),u);b.onclick=async()=>{try{const x=await api('/api/dm/create',{method:'POST',body:JSON.stringify({userId:u.id})});m.remove();await loadDMs();openChat('dm',x.dm.id,u.displayName||u.username,u)}catch(e){toast(e.message)}};r.appendChild(b)})}catch(e){toast(e.message)}};$('#dmSearch').oninput=e=>render(e.target.value);render('')}

  async function startGroup(){if(!me)return gate();const m=modal('Create a group','<input id="groupNameY" class="yprxy-input" maxlength="60" placeholder="Group name"><input id="groupSearchY" class="yprxy-input" style="margin-top:10px" placeholder="Search members..."><div id="groupResultsY" class="yprxy-results"></div>','<button id="createGroupY" class="yprxy-primary">Create Group</button>');const selected=new Set();const render=async q=>{try{const d=await api('/api/users/search?q='+encodeURIComponent(q));const r=$('#groupResultsY');r.innerHTML='';(d.users||[]).forEach(u=>{const b=document.createElement('label');b.className='yprxy-user';b.innerHTML=`<input class="yprxy-check" type="checkbox" value="${esc(u.id)}"><div class="avatar"></div><div class="yprxy-user-main"><strong>${userName(u)}</strong><small>@${esc(u.username)}</small></div>`;avatar(b.querySelector('.avatar'),u);const c=b.querySelector('input');c.checked=selected.has(u.id);c.onchange=()=>c.checked?selected.add(u.id):selected.delete(u.id);r.appendChild(b)})}catch(e){toast(e.message)}};$('#groupSearchY').oninput=e=>render(e.target.value);render('');$('#createGroupY').onclick=async()=>{const n=$('#groupNameY').value.trim();if(!n)return toast('Enter a group name');if(!selected.size)return toast('Pick at least one member');try{const d=await api('/api/group/create',{method:'POST',body:JSON.stringify({name:n,memberIds:[...selected]})});m.remove();await loadGroups();openChat('group',d.group.id,d.group.name,d.group)}catch(e){toast(e.message)}}}

  function openChat(type,id,title,obj){if(socket)try{socket.close()}catch{};const nav=document.querySelector('[data-view="dm"]');if(nav)nav.click();else document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='dmView'));const head=$('#dmTitle');head.innerHTML=`<div class="server-dm-head"><div style="display:flex;align-items:center;gap:10px"><div class="avatar">${type==='group'?'👥':''}</div><div><strong>${esc(title)}</strong><div style="color:#969dab;font-size:12px">${type==='group'?'Group chat':'@'+esc(obj.username)}</div></div></div></div>`;if(type==='dm')avatar(head.querySelector('.avatar'),obj);const box=$('#dmMessages');box.innerHTML='';const proto=location.protocol==='https:'?'wss':'ws';socket=new WebSocket(`${proto}://${location.host}/api/${type}/ws?id=${encodeURIComponent(id)}`);socket.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==='history'){box.innerHTML='';d.messages.forEach(renderMsg);box.scrollTop=box.scrollHeight}else if(d.type==='message'){renderMsg(d);box.scrollTop=box.scrollHeight}else if(d.type==='error')toast(d.error)}catch{}};socket.onerror=()=>toast('Chat connection error')}
  function renderMsg(m){const box=$('#dmMessages');const row=document.createElement('div');row.className='server-message';row.innerHTML=`<div class="avatar">${esc((m.displayName||m.username||'Y').slice(0,1).toUpperCase())}</div><div class="server-message-body"><div class="server-message-head"><strong>${esc(m.displayName||m.username)}</strong><time>${new Date(m.time||Date.now()).toLocaleString()}</time></div><div class="server-message-text">${esc(m.text)}</div></div>`;box.appendChild(row)}
  function wireDMForm(){const f=$('#dmForm');if(!f)return;f.addEventListener('submit',e=>{e.preventDefault();const i=$('#dmInput'),t=i.value.trim();if(!t||!socket||socket.readyState!==1)return;socket.send(JSON.stringify({type:'chat',text:t}));i.value='';i.focus()})}

  function addPfp(){const f=$('#profileEmoji')?.closest('.field');if(!f||$('#profilePfpY'))return;f.innerHTML='<label>Profile picture</label><div class="yprxy-pfp-row"><div class="yprxy-pfp-preview" id="pfpPreviewY">Y</div><input id="profilePfpY" type="file" accept="image/*"></div><small style="color:#969dab">Upload a profile picture.</small>';$('#profilePfpY').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{$('#pfpPreviewY').style.backgroundImage=`url(${JSON.stringify(await imageData(file))})`}catch(err){toast(err.message)}}}
  function imageData(file){return new Promise((resolve,reject)=>{if(!file.type.startsWith('image/'))return reject(new Error('Choose an image file'));const r=new FileReader(),i=new Image();r.onload=()=>{i.onload=()=>{const c=document.createElement('canvas');c.width=256;c.height=256;const sc=Math.max(256/i.width,256/i.height),w=i.width*sc,h=i.height*sc,x=(256-w)/2,y=(256-h)/2,ctx=c.getContext('2d');ctx.drawImage(i,x,y,w,h);resolve(c.toDataURL('image/jpeg',.78))};i.onerror=()=>reject(new Error('Could not read image'));i.src=r.result};r.onerror=()=>reject(new Error('Could not read image'));r.readAsDataURL(file)})}
  async function saveProfile(){try{let av='';const file=$('#profilePfpY')?.files?.[0];if(file)av=await imageData(file);const d=await api('/api/profile',{method:'POST',body:JSON.stringify({displayName:$('#profileDisplay').value,avatar:av,bio:$('#profileBio').value,accent:$('#profileAccent').value,status:$('#profileStatus').value})});me=d.user;sync();toast('Profile saved ✨')}catch(e){toast(e.message)}}

  function replace(id,fn){const old=$('#'+id);if(!old)return;const n=old.cloneNode(true);old.replaceWith(n);n.onclick=e=>{e.preventDefault();fn()}}
  function init(){styles();rename();addPfp();replace('addDm',startDM);replace('newGroup',startGroup);replace('addGroup',startGroup);replace('saveProfile',saveProfile);replace('profileBtn',()=>{const x=document.querySelector('[data-view="profile"]');if(x)x.click()});replace('openSettings',()=>{const x=document.querySelector('[data-view="profile"]');if(x)x.click()});replace('accountBtn',()=>{const x=document.querySelector('[data-view="profile"]');if(x)x.click()});wireDMForm();loadMe()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
