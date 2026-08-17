(() => {
  if (window.__yprxyBootFix) return;
  window.__yprxyBootFix = true;

  // Never let account creation/login wait for the DM/group list scans.
  // The auth screen is removed as soon as authentication succeeds.
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);

    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if ((url.pathname === '/api/login' || url.pathname === '/api/register') && response.ok) {
        const removeAuth = () => {
          const auth = document.getElementById('yprxyAuth');
          if (auth) {
            auth.style.opacity = '0';
            auth.style.pointerEvents = 'none';
            setTimeout(() => auth.remove(), 180);
          }
        };
        requestAnimationFrame(removeAuth);
      }
    } catch {}

    return response;
  };

  // The old page could leave a blocking auth layer visible while background
  // lists were loading. Keep the UI usable while those requests finish.
  const observer = new MutationObserver(() => {
    const auth = document.getElementById('yprxyAuth');
    if (!auth) return;
    const form = document.getElementById('yprxyAuthForm');
    if (form && !form.dataset.bootFixed) {
      form.dataset.bootFixed = '1';
      form.addEventListener('submit', () => {
        const button = form.querySelector('button[type="submit"],button');
        if (button) {
          button.disabled = true;
          button.textContent = 'Working…';
        }
      }, { capture: true });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
