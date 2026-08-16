export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // HEALTH
    if (url.pathname === "/api/health") {
      return json({
        success: true,
        status: "online",
        service: "Global Link Reports"
      }, 200, corsHeaders);
    }

    // REPORT A LINK
    if (url.pathname === "/api/report" && request.method === "POST") {
      try {
        const data = await request.json();

        if (!data.url) {
          return json({
            success: false,
            error: "Missing URL"
          }, 400, corsHeaders);
        }

        let parsedURL;

        try {
          parsedURL = new URL(data.url);
        } catch {
          return json({
            success: false,
            error: "Invalid URL"
          }, 400, corsHeaders);
        }

        if (
          parsedURL.protocol !== "https:" &&
          parsedURL.protocol !== "http:"
        ) {
          return json({
            success: false,
            error: "Invalid protocol"
          }, 400, corsHeaders);
        }

        const key = encodeURIComponent(parsedURL.href);

        const existing = await env.REPORTS.get(key);

        if (!existing) {
          const report = {
            url: parsedURL.href,
            name:
              typeof data.name === "string"
                ? data.name.slice(0, 500)
                : parsedURL.hostname,
            time: new Date().toISOString(),
            reports: 1
          };

          await env.REPORTS.put(
            key,
            JSON.stringify(report)
          );
        }

        return json({
          success: true,
          message: "Link reported"
        }, 200, corsHeaders);

      } catch (error) {
        console.error("REPORT ERROR:", error);

        return json({
          success: false,
          error: "Could not save report"
        }, 500, corsHeaders);
      }
    }

    // GET ALL REPORTS
    if (url.pathname === "/api/reports" && request.method === "GET") {
      try {
        const reports = [];

        // Use KV list without passing an undefined cursor.
        let cursor;

        while (true) {
          const options = {
            limit: 1000
          };

          if (cursor) {
            options.cursor = cursor;
          }

          const result = await env.REPORTS.list(options);

          for (const item of result.keys) {
            const report = await env.REPORTS.get(
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

          cursor = result.cursor;
        }

        reports.sort(
          (a, b) =>
            new Date(b.time) - new Date(a.time)
        );

        return json({
          success: true,
          reports,
          count: reports.length
        }, 200, corsHeaders);

      } catch (error) {
        console.error("KV LIST ERROR:", error);

        return json({
          success: false,
          error: "Could not load reports"
        }, 500, corsHeaders);
      }
    }

    // RESTORE LINK
    if (url.pathname === "/api/restore" && request.method === "POST") {
      try {
        const data = await request.json();

        if (!data.url) {
          return json({
            success: false,
            error: "Missing URL"
          }, 400, corsHeaders);
        }

        const parsedURL = new URL(data.url);
        const key = encodeURIComponent(parsedURL.href);

        await env.REPORTS.delete(key);

        return json({
          success: true,
          message: "Report restored"
        }, 200, corsHeaders);

      } catch (error) {
        console.error("RESTORE ERROR:", error);

        return json({
          success: false,
          error: "Could not restore report"
        }, 400, corsHeaders);
      }
    }

    // Everything else → your website
    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        ...extraHeaders
      }
    }
  );
}
