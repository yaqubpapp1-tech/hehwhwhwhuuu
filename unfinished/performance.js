(() => {
  if (window.__yprxyPerformancePatch) return;
  window.__yprxyPerformancePatch = true;

  const originalFetch = window.fetch.bind(window);
  const cache = new Map();
  const CACHE_TTL = { '/api/dms': 4000, '/api/groups': 4000 };

  window.fetch = async (input, init = {}) => {
    const request = new Request(input, init);
    const url = new URL(request.url, location.href);
    const method = (request.method || 'GET').toUpperCase();

    if (method === 'GET' && request.credentials !== 'omit') {
      const path = url.pathname;
      let ttl = CACHE_TTL[path] || 0;
      if (path === '/api/users/search') ttl = 1200;
      if (ttl) {
        const key = url.href;
        const hit = cache.get(key);
        if (hit && hit.expires > Date.now()) return hit.response.clone();
        const response = await originalFetch(request);
        if (response.ok) cache.set(key, { expires: Date.now() + ttl, response: response.clone() });
        return response;
      }
    }

    const response = await originalFetch(request);
    if (method !== 'GET' && response.ok) {
      for (const key of cache.keys()) {
        if (key.includes('/api/dms') || key.includes('/api/groups') || key.includes('/api/users/search')) cache.delete(key);
      }
    }
    return response;
  };

  const style = document.createElement('style');
  style.id = 'yprxyPerformanceStyles';
  style.textContent = `
    .content,.messages,.dmMessages,.chatList,.panelView,.modalBox,.yprxy-box{contain:layout paint}
    .content,.messages,.dmMessages{overscroll-behavior:contain}
    @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
  `;
  document.head.appendChild(style);
})();
