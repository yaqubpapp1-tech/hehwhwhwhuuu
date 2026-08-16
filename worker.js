export default {
    async fetch(request, env) {

        const url = new URL(request.url);

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        // OPTIONS / CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        // ================================================
        // HEALTH CHECK
        // GET /api/health
        // ================================================

        if (
            url.pathname === "/api/health" &&
            request.method === "GET"
        ) {

            return json({
                success: true,
                status: "online",
                service: "Global Link Reports"
            }, 200, corsHeaders);
        }


        // ================================================
        // REPORT A LINK
        // POST /api/report
        // ================================================

        if (
            url.pathname === "/api/report" &&
            request.method === "POST"
        ) {

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

                // Only HTTP / HTTPS
                if (
                    parsedURL.protocol !== "https:" &&
                    parsedURL.protocol !== "http:"
                ) {

                    return json({
                        success: false,
                        error: "Invalid protocol"
                    }, 400, corsHeaders);

                }

                const normalizedURL = parsedURL.href;

                const key = encodeURIComponent(normalizedURL);

                // Check if already reported
                const existing = await env.KV.get(key, "json");

                if (existing) {

                    // Increase report count
                    existing.reports =
                        Number(existing.reports || 1) + 1;

                    existing.lastReported =
                        new Date().toISOString();

                    await env.KV.put(
                        key,
                        JSON.stringify(existing)
                    );

                    return json({
                        success: true,
                        message: "Link report updated",
                        report: existing
                    }, 200, corsHeaders);
                }

                // New report
                const report = {

                    id: crypto.randomUUID(),

                    url: normalizedURL,

                    name:
                        typeof data.name === "string" &&
                        data.name.trim()
                            ? data.name.slice(0, 500)
                            : parsedURL.hostname,

                    time:
                        new Date().toISOString(),

                    lastReported:
                        new Date().toISOString(),

                    reports: 1,

                    status: "reported"

                };

                await env.KV.put(
                    key,
                    JSON.stringify(report)
                );

                return json({
                    success: true,
                    message: "Link reported",
                    report: report
                }, 200, corsHeaders);

            } catch (error) {

                console.error(
                    "REPORT ERROR:",
                    error
                );

                return json({
                    success: false,
                    error: "Invalid request"
                }, 400, corsHeaders);
            }
        }


        // ================================================
        // GET ALL REPORTS
        // GET /api/reports
        // ================================================

        if (
            url.pathname === "/api/reports" &&
            request.method === "GET"
        ) {

            try {

                const reports = [];

                let cursor = undefined;

                do {

                    const result =
                        await env.KV.list({
                            cursor: cursor,
                            limit: 1000
                        });

                    for (
                        const item of result.keys
                    ) {

                        const report =
                            await env.KV.get(
                                item.name,
                                "json"
                            );

                        if (report) {
                            reports.push(report);
                        }
                    }

                    cursor =
                        result.list_complete
                            ? undefined
                            : result.cursor;

                } while (cursor);

                // Newest first
                reports.sort(
                    (a, b) =>
                        new Date(b.lastReported || b.time) -
                        new Date(a.lastReported || a.time)
                );

                return json({
                    success: true,
                    reports: reports,
                    count: reports.length
                }, 200, corsHeaders);

            } catch (error) {

                console.error(
                    "KV LIST ERROR:",
                    error
                );

                return json({
                    success: false,
                    error: "Could not load reports"
                }, 500, corsHeaders);
            }
        }


        // ================================================
        // RESTORE / REMOVE REPORT
        // POST /api/restore
        // ================================================

        if (
            url.pathname === "/api/restore" &&
            request.method === "POST"
        ) {

            try {

                const data =
                    await request.json();

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

                const key =
                    encodeURIComponent(
                        parsedURL.href
                    );

                await env.KV.delete(key);

                return json({
                    success: true,
                    message: "Report restored"
                }, 200, corsHeaders);

            } catch (error) {

                console.error(
                    "RESTORE ERROR:",
                    error
                );

                return json({
                    success: false,
                    error: "Could not restore report"
                }, 400, corsHeaders);
            }
        }


        // ================================================
        // DELETE REPORT
        // DELETE /api/report
        // ================================================

        if (
            url.pathname === "/api/report" &&
            request.method === "DELETE"
        ) {

            try {

                const data =
                    await request.json();

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

                const key =
                    encodeURIComponent(
                        parsedURL.href
                    );

                await env.KV.delete(key);

                return json({
                    success: true,
                    message: "Report deleted"
                }, 200, corsHeaders);

            } catch (error) {

                console.error(
                    "DELETE ERROR:",
                    error
                );

                return json({
                    success: false,
                    error: "Could not delete report"
                }, 400, corsHeaders);
            }
        }


        // ================================================
        // SERVE WEBSITE
        // ================================================

        return env.ASSETS.fetch(request);
    }
};


// ================================================
// JSON RESPONSE HELPER
// ================================================

function json(
    data,
    status = 200,
    extraHeaders = {}
) {

    return new Response(
        JSON.stringify(data),
        {
            status: status,

            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8",

                ...extraHeaders
            }
        }
    );
}
