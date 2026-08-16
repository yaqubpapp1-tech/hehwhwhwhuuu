const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 100000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    try {
      if (
        url.pathname === "/api/health" &&
        request.method === "GET"
      ) {
        return json({
          success: true,
          status: "online",
          service: "Global Link Reports + Accounts"
        });
      }

      if (
        url.pathname === "/api/register" &&
        request.method === "POST"
      ) {
        return await registerUser(request, env);
      }

      if (
        url.pathname === "/api/login" &&
        request.method === "POST"
      ) {
        return await loginUser(request, env);
      }

      if (
        url.pathname === "/api/logout" &&
        request.method === "POST"
      ) {
        const token = getToken(request);

        if (token) {
          await env.SESSIONS.delete(`session:${token}`);
        }

        return json({
          success: true,
          message: "Logged out"
        });
      }

      if (
        url.pathname === "/api/me" &&
        request.method === "GET"
      ) {
        const auth = await authenticate(request, env);

        if (!auth.success) {
          return json({
            success: false,
            error: auth.error
          }, auth.status || 401);
        }

        return json({
          success: true,
          user: publicUser(auth.user)
        });
      }

      if (
        url.pathname === "/api/admin/setup" &&
        request.method === "POST"
      ) {
        return await setupFirstAdmin(request, env);
      }

      if (
        url.pathname === "/api/report" &&
        request.method === "POST"
      ) {
        return await reportLink(request, env);
      }

      if (
        url.pathname === "/api/reports" &&
        request.method === "GET"
      ) {
        const auth = await requireAdmin(request, env);

        if (!auth.success) {
          return json({
            success: false,
            error: auth.error
          }, auth.status);
        }

        return await getReports(env);
      }

      if (
        url.pathname === "/api/restore" &&
        request.method === "POST"
      ) {
        const auth = await requireAdmin(request, env);

        if (!auth.success) {
          return json({
            success: false,
            error: auth.error
          }, auth.status);
        }

        return await restoreReport(request, env);
      }

      if (
        url.pathname === "/api/admin/users" &&
        request.method === "GET"
      ) {
        const auth = await requireAdmin(request, env);

        if (!auth.success) {
          return json({
            success: false,
            error: auth.error
          }, auth.status);
        }

        return await listUsers(env);
      }

      if (
        url.pathname === "/api/admin/block" &&
        request.method === "POST"
      ) {
        return await changeUserStatus(
          request,
          env,
          "blocked"
        );
      }

      if (
        url.pathname === "/api/admin/ban" &&
        request.method === "POST"
      ) {
        return await changeUserStatus(
          request,
          env,
          "banned"
        );
      }

      if (
        url.pathname === "/api/admin/unblock" &&
        request.method === "POST"
      ) {
        return await changeUserStatus(
          request,
          env,
          "active"
        );
      }

      if (
        url.pathname === "/api/admin/promote" &&
        request.method === "POST"
      ) {
        return await promoteUser(request, env);
      }
    if (
  url.pathname === "/api/chat" &&
  request.headers.get("Upgrade") === "websocket"
) {
  const id = env.CHAT_ROOM.idFromName("main");
  const room = env.CHAT_ROOM.get(id);

  return room.fetch(request);
}

      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error(
        "WORKER ERROR:",
        error?.stack || error
      );

      return json({
        success: false,
        error: "Internal server error"
      }, 500);
    }
  }
};


// =========================================================
// REGISTER
// =========================================================

async function registerUser(request, env) {
  try {
    const data = await request.json();

    const username =
      normalizeUsername(data.username);

    const displayName =
      typeof data.displayName === "string"
        ? data.displayName.trim().slice(0, 80)
        : "";

    const realName =
      typeof data.realName === "string"
        ? data.realName.trim().slice(0, 120)
        : "";

    const password =
      typeof data.password === "string"
        ? data.password
        : "";

    if (
      !username ||
      !displayName ||
      !realName ||
      !password
    ) {
      return json({
        success: false,
        error: "Username, display name, real name, and password are required"
      }, 400);
    }

    if (
      username.length < 3 ||
      username.length > 30
    ) {
      return json({
        success: false,
        error: "Username must be 3-30 characters"
      }, 400);
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return json({
        success: false,
        error:
          "Username may only contain letters, numbers, and underscores"
      }, 400);
    }

    if (
      password.length < 8 ||
      password.length > 200
    ) {
      return json({
        success: false,
        error:
          "Password must be between 8 and 200 characters"
      }, 400);
    }

    const existingUsername =
      await env.USERS.get(
        `username:${username}`,
        "json"
      );

    if (existingUsername) {
      return json({
        success: false,
        error: "That username is already taken"
      }, 409);
    }

    const normalizedRealName =
      normalizeRealName(realName);

    const existingRealName =
      await env.USERS.get(
        `realname:${normalizedRealName}`,
        "json"
      );

    const passwordData =
      await hashPassword(password);

    const user = {
      id: crypto.randomUUID(),

      username,
      displayName,
      realName,

      passwordHash:
        passwordData.hash,

      passwordSalt:
        passwordData.salt,

      createdAt:
        new Date().toISOString(),

      status: "active",
      role: "user",

      realNameConflict:
        Boolean(existingRealName)
    };

    await saveUser(env, user);

    if (!existingRealName) {
      await env.USERS.put(
        `realname:${normalizedRealName}`,
        JSON.stringify({
          firstUserId: user.id
        })
      );
    }

    return json({
      success: true,
      message: "Account created",
      user: publicUser(user)
    });

  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not create account"
    }, 500);
  }
}


// =========================================================
// LOGIN
// =========================================================

async function loginUser(request, env) {
  try {
    const data = await request.json();

    const username =
      normalizeUsername(data.username);

    const password =
      typeof data.password === "string"
        ? data.password
        : "";

    if (!username || !password) {
      return json({
        success: false,
        error: "Username and password are required"
      }, 400);
    }

    const user =
      await env.USERS.get(
        `username:${username}`,
        "json"
      );

    if (!user) {
      return json({
        success: false,
        error: "Invalid credentials"
      }, 401);
    }

    if (
      user.status === "blocked" ||
      user.status === "banned"
    ) {
      return json({
        success: false,
        error:
          "This account cannot access the service"
      }, 403);
    }

    const valid =
      await verifyPassword(
        password,
        user.passwordHash,
        user.passwordSalt
      );

    if (!valid) {
      return json({
        success: false,
        error: "Invalid credentials"
      }, 401);
    }

    const token =
      randomToken();

    const expiresAt =
      Date.now() +
      SESSION_TTL_SECONDS * 1000;

    const session = {
      userId: user.id,
      createdAt:
        new Date().toISOString(),
      expiresAt
    };

    await env.SESSIONS.put(
      `session:${token}`,
      JSON.stringify(session),
      {
        expirationTtl:
          SESSION_TTL_SECONDS
      }
    );

    return new Response(
  JSON.stringify({
    success: true,
    message: "Login successful",
    user: publicUser(user)
  }),
  {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=UTF-8",
      "Set-Cookie":
        `session=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
    }
  }
);

  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not log in"
    }, 500);
  }
}


// =========================================================
// FIRST ADMIN SETUP
// =========================================================

async function setupFirstAdmin(
  request,
  env
) {
  try {
    const data =
      await request.json();

    const setupKey =
      typeof data.setupKey === "string"
        ? data.setupKey
        : "";

    const username =
      normalizeUsername(
        data.username
      );

    if (!setupKey || !username) {
      return json({
        success: false,
        error:
          "Username and setup key are required"
      }, 400);
    }

    if (
      !env.ADMIN_SETUP_KEY ||
      setupKey !== env.ADMIN_SETUP_KEY
    ) {
      return json({
        success: false,
        error: "Invalid setup key"
      }, 403);
    }

    const existingAdmin =
      await findAdmin(env);

    if (existingAdmin) {
      return json({
        success: false,
        error: "An admin already exists"
      }, 409);
    }

    const user =
      await env.USERS.get(
        `username:${username}`,
        "json"
      );

    if (!user) {
      return json({
        success: false,
        error: "Account not found"
      }, 404);
    }

    user.role =
      "admin";

    await saveUser(
      env,
      user
    );

    return json({
      success: true,
      message:
        "Account promoted to admin"
    });

  } catch (error) {
    console.error(
      "ADMIN SETUP ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Admin setup failed"
    }, 500);
  }
}


// =========================================================
// REPORT
// =========================================================

async function reportLink(
  request,
  env
) {
  try {
    const data =
      await request.json();

    if (!data.url) {
      return json({
        success: false,
        error: "Missing URL"
      }, 400);
    }

    let parsedURL;

    try {
      parsedURL =
        new URL(data.url);
    } catch {
      return json({
        success: false,
        error: "Invalid URL"
      }, 400);
    }

    if (
      parsedURL.protocol !== "https:" &&
      parsedURL.protocol !== "http:"
    ) {
      return json({
        success: false,
        error: "Invalid protocol"
      }, 400);
    }

    const key =
      encodeURIComponent(
        parsedURL.href
      );

    const existing =
      await env.REPORTS.get(
        key,
        "json"
      );

    if (!existing) {
      const report = {
        url: parsedURL.href,
        name:
          typeof data.name === "string"
            ? data.name.slice(0, 500)
            : parsedURL.hostname,
        time:
          new Date().toISOString(),
        reports: 1
      };

      await env.REPORTS.put(
        key,
        JSON.stringify(report)
      );

    } else {
      existing.reports =
        Number(existing.reports || 1) + 1;

      existing.lastReported =
        new Date().toISOString();

      await env.REPORTS.put(
        key,
        JSON.stringify(existing)
      );
    }

    return json({
      success: true,
      message: "Link reported"
    });

  } catch (error) {
    console.error(
      "REPORT ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not save report"
    }, 500);
  }
}


// =========================================================
// REPORT LIST
// =========================================================

async function getReports(env) {
  try {
    const reports = [];
    let cursor;

    while (true) {
      const options = {
        limit: 1000
      };

      if (cursor) {
        options.cursor = cursor;
      }

      const result =
        await env.REPORTS.list(
          options
        );

      for (
        const item
        of result.keys
      ) {
        const report =
          await env.REPORTS.get(
            item.name,
            "json"
          );

        if (report) {
          reports.push(report);
        }
      }

      if (result.list_complete) {
        break;
      }

      cursor =
        result.cursor;
    }

    reports.sort(
      (a, b) =>
        new Date(
          b.lastReported || b.time
        ) -
        new Date(
          a.lastReported || a.time
        )
    );

    return json({
      success: true,
      reports,
      count: reports.length
    });

  } catch (error) {
    console.error(
      "KV LIST ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not load reports"
    }, 500);
  }
}


// =========================================================
// RESTORE
// =========================================================

async function restoreReport(
  request,
  env
) {
  try {
    const data =
      await request.json();

    if (!data.url) {
      return json({
        success: false,
        error: "Missing URL"
      }, 400);
    }

    const parsedURL =
      new URL(data.url);

    const key =
      encodeURIComponent(
        parsedURL.href
      );

    await env.REPORTS.delete(
      key
    );

    return json({
      success: true,
      message: "Report restored"
    });

  } catch (error) {
    console.error(
      "RESTORE ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not restore report"
    }, 400);
  }
}


// =========================================================
// LIST USERS
// =========================================================

async function listUsers(env) {
  try {
    const users = [];
    let cursor;

    while (true) {
      const result =
        await env.USERS.list({
          prefix: "id:",
          limit: 1000,
          ...(cursor
            ? { cursor }
            : {})
        });

      for (
        const item
        of result.keys
      ) {
        const user =
          await env.USERS.get(
            item.name,
            "json"
          );

        if (user) {
          users.push(
            adminUser(user)
          );
        }
      }

      if (result.list_complete) {
        break;
      }

      cursor =
        result.cursor;
    }

    users.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    return json({
      success: true,
      users,
      count: users.length
    });

  } catch (error) {
    console.error(
      "USER LIST ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not load users"
    }, 500);
  }
}


// =========================================================
// USER STATUS
// =========================================================

async function changeUserStatus(
  request,
  env,
  newStatus
) {
  const auth =
    await requireAdmin(
      request,
      env
    );

  if (!auth.success) {
    return json({
      success: false,
      error: auth.error
    }, auth.status);
  }

  try {
    const data =
      await request.json();

    const userId =
      typeof data.userId === "string"
        ? data.userId
        : "";

    if (!userId) {
      return json({
        success: false,
        error: "Missing userId"
      }, 400);
    }

    if (
      userId === auth.user.id &&
      newStatus !== "active"
    ) {
      return json({
        success: false,
        error:
          "You cannot disable your own admin account"
      }, 400);
    }

    const user =
      await env.USERS.get(
        `id:${userId}`,
        "json"
      );

    if (!user) {
      return json({
        success: false,
        error: "User not found"
      }, 404);
    }

    user.status =
      newStatus;

    await saveUser(
      env,
      user
    );

    if (
      newStatus === "blocked" ||
      newStatus === "banned"
    ) {
      await revokeUserSessions(
        env,
        user.id
      );
    }

    return json({
      success: true,
      message:
        `User status changed to ${newStatus}`
    });

  } catch (error) {
    console.error(
      "STATUS ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not change user status"
    }, 500);
  }
}


// =========================================================
// PROMOTE USER
// =========================================================

async function promoteUser(
  request,
  env
) {
  const auth =
    await requireAdmin(
      request,
      env
    );

  if (!auth.success) {
    return json({
      success: false,
      error: auth.error
    }, auth.status);
  }

  try {
    const data =
      await request.json();

    const userId =
      typeof data.userId === "string"
        ? data.userId
        : "";

    if (!userId) {
      return json({
        success: false,
        error: "Missing userId"
      }, 400);
    }

    const user =
      await env.USERS.get(
        `id:${userId}`,
        "json"
      );

    if (!user) {
      return json({
        success: false,
        error: "User not found"
      }, 404);
    }

    user.role =
      "admin";

    await saveUser(
      env,
      user
    );

    return json({
      success: true,
      message:
        "User promoted to admin"
    });

  } catch (error) {
    console.error(
      "PROMOTE ERROR:",
      error?.stack || error
    );

    return json({
      success: false,
      error: "Could not promote user"
    }, 500);
  }
}


// =========================================================
// AUTH
// =========================================================

async function authenticate(
  request,
  env
) {
  const token =
    getToken(request);

  if (!token) {
    return {
      success: false,
      error: "Not authenticated",
      status: 401
    };
  }

  const session =
    await env.SESSIONS.get(
      `session:${token}`,
      "json"
    );

  if (!session) {
    return {
      success: false,
      error: "Invalid session",
      status: 401
    };
  }

  if (
    Date.now() >=
    session.expiresAt
  ) {
    await env.SESSIONS.delete(
      `session:${token}`
    );

    return {
      success: false,
      error: "Session expired",
      status: 401
    };
  }

  const user =
    await env.USERS.get(
      `id:${session.userId}`,
      "json"
    );

  if (!user) {
    return {
      success: false,
      error: "Account not found",
      status: 401
    };
  }

  if (
    user.status === "blocked" ||
    user.status === "banned"
  ) {
    return {
      success: false,
      error: "Account access is disabled",
      status: 403
    };
  }

  return {
    success: true,
    user,
    session,
    token
  };
}


async function requireAdmin(
  request,
  env
) {
  const auth =
    await authenticate(
      request,
      env
    );

  if (!auth.success) {
    return auth;
  }

  if (
    auth.user.role !== "admin"
  ) {
    return {
      success: false,
      error: "Admin access required",
      status: 403
    };
  }

  return auth;
}


// =========================================================
// PASSWORD HASHING
// =========================================================

async function hashPassword(
  password
) {
  const salt =
    randomToken();

  const hash =
    await derivePasswordHash(
      password,
      salt
    );

  return {
    salt,
    hash
  };
}


async function verifyPassword(
  password,
  expectedHash,
  salt
) {
  const actualHash =
    await derivePasswordHash(
      password,
      salt
    );

  return timingSafeEqual(
    actualHash,
    expectedHash
  );
}


async function derivePasswordHash(
  password,
  salt
) {
  const encoder =
    new TextEncoder();

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(salt),
        iterations:
          PASSWORD_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

  return bytesToBase64Url(
    new Uint8Array(bits)
  );
}


// =========================================================
// USER STORAGE
// =========================================================

async function saveUser(
  env,
  user
) {
  await env.USERS.put(
    `id:${user.id}`,
    JSON.stringify(user)
  );

  await env.USERS.put(
    `username:${user.username}`,
    JSON.stringify(user)
  );
}


// =========================================================
// FIND ADMIN
// =========================================================

async function findAdmin(
  env
) {
  let cursor;

  while (true) {
    const result =
      await env.USERS.list({
        prefix: "id:",
        limit: 1000,
        ...(cursor
          ? { cursor }
          : {})
      });

    for (
      const item
      of result.keys
    ) {
      const user =
        await env.USERS.get(
          item.name,
          "json"
        );

      if (
        user &&
        user.role === "admin"
      ) {
        return user;
      }
    }

    if (result.list_complete) {
      return null;
    }

    cursor =
      result.cursor;
  }
}


// =========================================================
// REVOKE SESSIONS
// =========================================================

async function revokeUserSessions(
  env,
  userId
) {
  let cursor;

  while (true) {
    const result =
      await env.SESSIONS.list({
        prefix: "session:",
        limit: 1000,
        ...(cursor
          ? { cursor }
          : {})
      });

    for (
      const item
      of result.keys
    ) {
      const session =
        await env.SESSIONS.get(
          item.name,
          "json"
        );

      if (
        session &&
        session.userId === userId
      ) {
        await env.SESSIONS.delete(
          item.name
        );
      }
    }

    if (result.list_complete) {
      break;
    }

    cursor =
      result.cursor;
  }
}


// =========================================================
// HELPERS
// =========================================================

function randomToken() {
  const bytes =
    new Uint8Array(32);

  crypto.getRandomValues(
    bytes
  );

  return bytesToBase64Url(
    bytes
  );
}


function bytesToBase64Url(
  bytes
) {
  let binary = "";

  for (
    const byte of bytes
  ) {
    binary +=
      String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function getToken(request) {
  const cookieHeader =
    request.headers.get("Cookie");

  if (cookieHeader) {
    const cookies = {};

    cookieHeader
      .split(";")
      .forEach(part => {
        const index = part.indexOf("=");

        if (index === -1) {
          return;
        }

        const name =
          part.slice(0, index).trim();

        const value =
          part.slice(index + 1).trim();

        cookies[name] = value;
      });

    if (cookies.session) {
      return cookies.session;
    }
  }

  // Keep Bearer-token support temporarily so
  // your current frontend doesn't break.
  const authorization =
    request.headers.get("Authorization");

  if (
    authorization &&
    authorization.startsWith("Bearer ")
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return null;
}

function normalizeUsername(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .toLowerCase();
}


function normalizeRealName(
  value
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


function publicUser(
  user
) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    createdAt: user.createdAt,
    status: user.status,
    role: user.role
  };
}


function adminUser(
  user
) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    realName: user.realName,
    createdAt: user.createdAt,
    status: user.status,
    role: user.role,
    realNameConflict:
      Boolean(user.realNameConflict)
  };
}


function timingSafeEqual(
  a,
  b
) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    a.length !== b.length
  ) {
    return false;
  }

  let difference = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    difference |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return difference === 0;
}


function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          "application/json; charset=UTF-8"
      }
    }
  );
}
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket endpoint", {
        status: 426
      });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    const id = crypto.randomUUID();

    this.sessions.set(id, server);

    server.addEventListener("message", event => {
      this.handleMessage(id, event.data);
    });

    server.addEventListener("close", () => {
      this.sessions.delete(id);
    });

    server.addEventListener("error", () => {
      this.sessions.delete(id);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async handleMessage(id, rawMessage) {
    let message;

    try {
      message =
        typeof rawMessage === "string"
          ? JSON.parse(rawMessage)
          : rawMessage;
    } catch {
      this.send(id, {
        type: "error",
        error: "Invalid message"
      });

      return;
    }

    if (message.type !== "chat") {
      return;
    }

    const text =
      typeof message.text === "string"
        ? message.text.trim()
        : "";

    if (!text) {
      return;
    }

    if (text.length > 1000) {
      this.send(id, {
        type: "error",
        error: "Message too long"
      });

      return;
    }

    const username =
      typeof message.username === "string"
        ? message.username.trim().slice(0, 30)
        : "User";

    const chatMessage = {
      type: "message",
      id: crypto.randomUUID(),
      username,
      text,
      time: new Date().toISOString()
    };

    await this.broadcast(chatMessage);
  }

  send(id, data) {
    const socket =
      this.sessions.get(id);

    if (!socket) {
      return;
    }

    try {
      socket.send(
        JSON.stringify(data)
      );
    } catch {
      this.sessions.delete(id);
    }
  }

  async broadcast(data) {
    const payload =
      JSON.stringify(data);

    for (
      const [id, socket]
      of this.sessions
    ) {
      try {
        socket.send(payload);
      } catch {
        this.sessions.delete(id);
      }
    }
  }
}
