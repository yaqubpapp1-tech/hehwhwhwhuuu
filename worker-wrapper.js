import worker from "./worker.js";
import { SocialRoom } from "./social-room.js";
import { VoiceRoom } from "./voice-room.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...CORS, "Content-Type": "application/json;charset=UTF-8" }
});

function getToken(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function getUser(request, env) {
  const token = getToken(request);
  if (!token) return null;

  const session = await env.SESSIONS.get(`session:${token}`, "json");
  if (!session || Date.now() >= Number(session.expiresAt || 0)) return null;

  const user = await env.USERS.get(`id:${session.userId}`, "json");
  if (!user || user.status === "banned" || user.status === "blocked") return null;

  return user;
}

function socialRequest(request, user, room = "global") {
  const headers = new Headers(request.headers);
  headers.set("X-Social-User-Id", user.id);
  headers.set("X-Social-Username", user.username || "user");
  headers.set("X-Social-Display-Name", user.displayName || user.username || "User");
  headers.set("X-Social-Pfp", user.pfp || "");
  headers.set("X-Social-Role", user.role || "user");
  headers.set("X-Social-Room", room);
  return new Request(request, { headers });
}

async function routeSocial(request, env) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return json({ success: false, error: "WebSocket required" }, 426);
  }

  const user = await getUser(request, env);
  if (!user) return json({ success: false, error: "Not authenticated" }, 401);

  const url = new URL(request.url);
  const room = url.searchParams.get("room") || "global";
  const id = env.SOCIAL_ROOM.idFromName(room);
  return env.SOCIAL_ROOM.get(id).fetch(socialRequest(request, user, room));
}

async function routeVoice(request, env) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return json({ success: false, error: "WebSocket required" }, 426);
  }

  const user = await getUser(request, env);
  if (!user) return json({ success: false, error: "Not authenticated" }, 401);

  const url = new URL(request.url);
  const room = url.searchParams.get("room") || "global-voice";
  const id = env.VOICE_ROOM.idFromName(room);
  return env.VOICE_ROOM.get(id).fetch(request);
}

export { SocialRoom, VoiceRoom };

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS });
      }

      const url = new URL(request.url);

      // Discord-style social chat. Keep /api/chat compatible with the existing UI.
      if (
        url.pathname === "/api/chat" ||
        url.pathname === "/api/social" ||
        url.pathname === "/api/dm" ||
        url.pathname === "/api/group-chat"
      ) {
        return routeSocial(request, env);
      }

      // WebRTC signaling for audio calls / voice channels.
      if (
        url.pathname === "/api/voice" ||
        url.pathname === "/api/audio" ||
        url.pathname === "/api/call"
      ) {
        return routeVoice(request, env);
      }

      // Everything else stays on the original worker so accounts,
      // profiles, reports, moderation, assets, and admin APIs keep working.
      return worker.fetch(request, env, ctx);
    } catch (error) {
      console.error("WORKER WRAPPER ERROR", error?.stack || error);
      return json({ success: false, error: "Internal server error" }, 500);
    }
  }
};
