import { DurableObject } from "cloudflare:workers";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
});

function getToken(request) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function authenticate(request, env) {
  const t = getToken(request);
  if (!t) return null;
  const session = await env.SESSIONS.get(`session:${t}`, "json");
  if (!session || Date.now() >= Number(session.expiresAt || 0)) return null;
  const user = await env.USERS.get(`id:${session.userId}`, "json");
  if (!user || user.status === "banned" || user.status === "blocked") return null;
  return user;
}

export class VoiceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return json({ success: false, error: "WebSocket required" }, 426);
    }

    const user = await authenticate(request, this.env);
    if (!user) return json({ success: false, error: "Not authenticated" }, 401);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const connectionId = crypto.randomUUID();
    const attachment = {
      connectionId,
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      pfp: user.pfp || "",
      role: user.role || "user"
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  peers(except) {
    return this.ctx.getWebSockets()
      .filter(ws => ws !== except && ws.readyState === WebSocket.OPEN)
      .map(ws => ({ ws, info: ws.deserializeAttachment() }))
      .filter(x => x.info);
  }

  send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  }

  broadcast(data, except) {
    for (const { ws } of this.peers(except)) this.send(ws, data);
  }

  webSocketMessage(ws, message) {
    let data;
    try {
      data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    const me = ws.deserializeAttachment();
    if (!me) return;

    if (data.type === "join") {
      const current = this.peers(ws).map(x => x.info);
      this.send(ws, { type: "voice:peers", peers: current });
      this.broadcast({ type: "voice:peer-joined", peer: me }, ws);
      return;
    }

    if (data.type === "signal" && typeof data.target === "string" && data.signal) {
      const target = this.ctx.getWebSockets().find(other => {
        const info = other.deserializeAttachment();
        return info?.connectionId === data.target;
      });
      if (target) {
        this.send(target, {
          type: "voice:signal",
          from: me.connectionId,
          peer: me,
          signal: data.signal
        });
      }
      return;
    }

    if (data.type === "leave") {
      try { ws.close(1000, "Left voice"); } catch {}
    }
  }

  webSocketClose(ws) {
    const me = ws.deserializeAttachment();
    if (me) this.broadcast({ type: "voice:peer-left", connectionId: me.connectionId });
  }

  webSocketError(ws) {
    try { ws.close(1011, "Voice error"); } catch {}
  }
}
