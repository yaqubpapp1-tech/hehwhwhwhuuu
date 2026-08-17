(() => {
  if (window.__yprxyWSRouteFix) return;
  window.__yprxyWSRouteFix = true;
  const NativeWebSocket = window.WebSocket;
  function FixedWebSocket(url, protocols) {
    try {
      const u = new URL(url, location.href);
      if (u.pathname === '/api/dm/ws') {
        const id = u.searchParams.get('id');
        u.pathname = '/api/chat'; u.search = `?room=${encodeURIComponent(`dm:${id || ''}`)}`; url = u.toString();
      } else if (u.pathname === '/api/group/ws') {
        const id = u.searchParams.get('id');
        u.pathname = '/api/chat'; u.search = `?room=${encodeURIComponent(`group:${id || ''}`)}`; url = u.toString();
      }
    } catch {}
    return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
  }
  FixedWebSocket.prototype = NativeWebSocket.prototype;
  FixedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  FixedWebSocket.OPEN = NativeWebSocket.OPEN;
  FixedWebSocket.CLOSING = NativeWebSocket.CLOSING;
  FixedWebSocket.CLOSED = NativeWebSocket.CLOSED;
  window.WebSocket = FixedWebSocket;
})();
