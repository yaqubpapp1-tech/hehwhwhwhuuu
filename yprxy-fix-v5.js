(() => {
  if (window.__yprxyFixV5) return;
  window.__yprxyFixV5 = true;
  const $ = s => document.querySelector(s);

  const toast = msg => {
    let t = $('#yprxyToast');
    if (!t) { t = document.createElement('div'); t.id = 'yprxyToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._yprxyTimer);
    t._yprxyTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  function installStyles() {
    if ($('#yprxyFixV5Styles')) return;
    const s = document.createElement('style'); s.id = 'yprxyFixV5Styles';
    s.textContent = `
      html,body{overflow:hidden!important}
      .content{overflow-y:auto!important;overflow-x:hidden!important;min-height:0!important;scroll-behavior:smooth!important}
      .linksView{height:max-content!important;min-height:100%!important;padding-bottom:100px!important}
      #homeView{overflow:hidden!important}
      .main{background-color:#11141a!important;background-image:radial-gradient(circle,#ffffff18 1px,transparent 1.5px)!important;background-size:22px 22px!important}
      .rail,.sidebar,.sideHead,.sideBottom{background-image:none!important}
      .rail{background:#08090d!important}.sidebar{background:#0e1016!important}
      button{transition:transform .15s ease,filter .15s ease,box-shadow .15s ease,background .15s ease!important}
      button:hover{filter:brightness(1.1)}button:active{transform:scale(1.045)!important;filter:brightness(1.22)!important;box-shadow:0 0 24px #5865f244!important}
      .yprxy-modal,.modal{transition:opacity .2s ease!important}
      .yprxy-box,.modalBox{transition:transform .24s cubic-bezier(.2,.8,.2,1)!important}
      .yprxy-close-v5{margin-left:auto!important;width:40px;height:40px!important;display:grid!important;place-items:center!important;border:0!important;border-radius:10px!important;background:#ffffff08!important;color:#fff!important;font-size:18px!important}
      .yprxy-close-v5:hover{background:#ed424533!important;color:#fff!important}
      .yprxy-admin-scroll{max-height:calc(88vh - 130px)!important;overflow:auto!important}
    `;
    document.head.appendChild(s);
  }

  function renameStable() {
    document.title = 'yprxy.';
    const replacements = [
      ["Yaqub's Hub", 'yprxy.'],
      ['Yaqub’s Hub', 'yprxy.'],
      ['Discord', 'yachat!']
    ];
    document.querySelectorAll('body *').forEach(el => {
      if (el.children.length) return;
      let text = el.textContent;
      if (!text) return;
      for (const [from,to] of replacements) text = text.replaceAll(from,to);
      if (el.textContent !== text) el.textContent = text;
    });
    const side = $('.sideHead span'); if (side) side.textContent = 'yprxy.';
    const hero = $('.hero h1'); if (hero && hero.textContent.includes('Welcome')) hero.textContent = 'Welcome to yprxy. 👋';
    const chat = $('.sidebar .channel[data-view="chat"]'); if (chat) chat.innerHTML = '<b>#</b> yachat!';
    const railChat = $('.rail .server[data-view="chat"]'); if (railChat) railChat.title = 'yachat!';
  }

  function openView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
    document.querySelectorAll('[data-view]').forEach(v => v.classList.toggle('active', v.dataset.view === id.replace('View','')));
    const view = $('#'+id); if (view) view.scrollTop = 0;
  }

  function wireProfileButtons() {
    ['#profileBtn','#openSettings','#accountBtn'].forEach(sel => {
      const b = $(sel); if (!b || b.dataset.v5Profile) return;
      b.dataset.v5Profile = '1';
      b.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openView('profileView'); renameStable(); }, true);
    });
  }

  function addAdminClose() {
    const candidates = document.querySelectorAll('.yprxy-modal,.modal,[role="dialog"]');
    candidates.forEach(m => {
      const text = (m.textContent || '').toLowerCase();
      if (!text.includes('admin')) return;
      const head = m.querySelector('.yprxy-head,.modalHead');
      if (!head || head.querySelector('.yprxy-close-v5')) return;
      const close = document.createElement('button');
      close.className = 'yprxy-close-v5';
      close.type = 'button';
      close.textContent = '✕';
      close.title = 'Close';
      close.onclick = () => m.remove();
      head.appendChild(close);
      const body = m.querySelector('.yprxy-body,.modalBody'); if (body) body.classList.add('yprxy-admin-scroll');
    });
  }

  async function adminApi(path, userId) {
    const r = await fetch(path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})});
    let d={}; try{d=await r.json()}catch{}
    if(!r.ok||d.success===false) throw new Error(d.error||'Request failed');
    return d;
  }

  function patchAdminButtons() {
    addAdminClose();
    document.querySelectorAll('tr').forEach(row => {
      if (row.dataset.v5Admin) return;
      const text=(row.textContent||'').toLowerCase();
      if (!text.includes('banned') && !text.includes('blocked')) return;
      const buttons=[...row.querySelectorAll('button')];
      const idButton=buttons.find(b=>b.dataset.userId||b.getAttribute('data-user-id'));
      let userId=idButton?.dataset.userId||idButton?.getAttribute('data-user-id');
      if(!userId){
        const source=[...row.querySelectorAll('[data-user-id]')].find(x=>x.dataset.userId);
        userId=source?.dataset.userId;
      }
      if(!userId) return;
      row.dataset.v5Admin='1';
      const unban=document.createElement('button');
      unban.className='btn secondary'; unban.type='button'; unban.textContent=text.includes('banned')?'Unban':'Unblock';
      unban.onclick=async()=>{try{await adminApi('/api/admin/unblock',userId);toast(unban.textContent+'ned ✓');row.remove()}catch(e){toast(e.message)}};
      row.querySelector('.toolbar')?.appendChild(unban) || row.appendChild(unban);
    });
  }

  function patchAdminCards() {
    addAdminClose();
    document.querySelectorAll('button').forEach(btn => {
      const t=(btn.textContent||'').trim().toLowerCase();
      if(!['ban','block'].includes(t) || btn.dataset.v5Pair) return;
      const row=btn.closest('tr,.report,.userRow,.adminUser,.yprxy-user')||btn.parentElement;
      if(!row) return;
      const candidate=row.querySelector('[data-user-id]');
      const userId=candidate?.dataset.userId||btn.dataset.userId;
      if(!userId) return;
      btn.dataset.v5Pair='1';
      const un=document.createElement('button');un.className=btn.className;un.type='button';un.textContent=t==='ban'?'Unban':'Unblock';
      un.onclick=async()=>{try{await adminApi('/api/admin/unblock',userId);toast((t==='ban'?'Unban':'Unblock')+' complete ✓');patchAdminCards()}catch(e){toast(e.message)}};
      btn.parentElement.appendChild(un);
    });
  }

  function stopNoisyReconnectUI() {
    const original=window.setTimeout;
    if(window.__yprxyTimerPatch) return;
    window.__yprxyTimerPatch=true;
    // Do not globally cancel timers; instead hide connection/reconnect toasts produced by older chat UI.
    const oldAppend=Node.prototype.appendChild;
    if(window.__yprxyToastPatch)return;
    window.__yprxyToastPatch=true;
    const observer=new MutationObserver(()=>{
      const t=$('#yprxyToast');
      if(t && /reconnect|disconnect|connection error|connected to/i.test(t.textContent||'')) t.classList.remove('show');
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  }

  function init(){
    installStyles();
    wireProfileButtons();
    renameStable();
    patchAdminButtons();
    patchAdminCards();
    stopNoisyReconnectUI();
  }

  const observer=new MutationObserver(()=>{wireProfileButtons();renameStable();patchAdminButtons();patchAdminCards();addAdminClose();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
