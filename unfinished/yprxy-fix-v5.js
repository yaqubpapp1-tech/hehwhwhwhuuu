(() => {
  if (window.__yprxyFastFix) return;
  window.__yprxyFastFix = true;

  // This file is injected on every HTML response. Keep it tiny: the old
  // version used a document-wide MutationObserver and repeatedly scanned the
  // entire page, which caused severe CPU/layout churn.
  const style = document.createElement('style');
  style.textContent = `
    html,body{overflow:hidden!important}
    .content{overflow-y:auto!important;overflow-x:hidden!important;min-height:0!important;scroll-behavior:smooth!important}
    .linksView{min-height:max-content!important;padding-bottom:90px!important}
    .main{background-color:#11141a!important;background-image:radial-gradient(circle,#ffffff18 1px,transparent 1.5px)!important;background-size:22px 22px!important}
    .rail,.sidebar,.sideHead,.sideBottom{background-image:none!important}
    button{transition:transform .15s ease,filter .15s ease,box-shadow .15s ease,background .15s ease!important}
    button:hover{filter:brightness(1.08)}
    button:active{transform:scale(1.045)!important;filter:brightness(1.2)!important;box-shadow:0 0 20px #5865f244!important}
  `;
  document.head.appendChild(style);

  // Never make successful login/account creation wait for the expensive
  // DM/group list refreshes. The app continues loading those in the background.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if ((url.pathname === '/api/login' || url.pathname === '/api/register') && response.ok) {
        requestAnimationFrame(() => {
          const auth = document.getElementById('yprxyAuth');
          if (!auth) return;
          auth.style.opacity = '0';
          auth.style.pointerEvents = 'none';
          setTimeout(() => auth.remove(), 180);
        });
      }
    } catch {}
    return response;
  };
})();
