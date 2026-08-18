import core, { ChatRoom } from "./worker.js";
import { VoiceRoom } from "./voice-room.js";

export { ChatRoom, VoiceRoom };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/voice" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const room = env.VOICE_ROOM.get(env.VOICE_ROOM.idFromName("general"));
      return room.fetch(request);
    }

    const response = await core.fetch(request, env, ctx);
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("text/html")) return response;

    const html = await response.text();
    const injected = html.replace(
      /<\/body>/i,
      '<script src="/enhancements.js" defer></script><script src="/yaprxy-labels.js" defer></script><script src="/yachat-enhance.js" defer></script><script src="/admin-enhance.js" defer></script></body>'
    );
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    return new Response(injected,{status:response.status,statusText:response.statusText,headers});
  }
};
