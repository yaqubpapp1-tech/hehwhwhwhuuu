(() => {
  const $ = s => document.querySelector(s);
  function updateMode(){
    const home = $('#homeView')?.classList.contains('active');
    document.body.classList.toggle('yprxy-links-mode', !!home);
    document.body.classList.toggle('yprxy-discord-mode', !home);
    const head = $('.sideHead span'); if(head) head.textContent = home ? 'yprxy.' : 'Discord';
    const sections = document.querySelectorAll('.sidebar .section');
    if(sections[0]) sections[0].textContent = home ? 'Links' : 'Discord';
    if(sections[1]) sections[1].textContent = 'Direct Messages';
    if(sections[2]) sections[2].textContent = 'Groups';
  }
  const style = document.createElement('style');
  style.textContent = `
    body.yprxy-links-mode #dmList,body.yprxy-links-mode #addDm,body.yprxy-links-mode #groupList,body.yprxy-links-mode #addGroup{display:none!important}
    body.yprxy-links-mode .sidebar .section:nth-of-type(n+2){display:none!important}
    body.yprxy-links-mode .sidebar .channel[data-view="chat"]{display:none!important}
    body.yprxy-discord-mode .sidebar .channel[data-view="home"]{display:none!important}
    body.yprxy-discord-mode .sideSearch{display:block}
  `;
  document.head.appendChild(style);
  document.addEventListener('click', e => { if(e.target.closest('[data-view]')) setTimeout(updateMode,0); });
  new MutationObserver(updateMode).observe($('.content') || document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',updateMode,{once:true}); else updateMode();
})();
