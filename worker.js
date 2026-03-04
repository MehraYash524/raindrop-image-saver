// Raindrop Auth Proxy — Cloudflare Worker
// Only purpose: keep CLIENT_SECRET off the extension code

const RAINDROP_TOKEN_URL = "https://raindrop.io/oauth/access_token";
const REDIRECT_URI       = "https://localhost";
const CLIENT_ID          = "YOUR_CLIENT_ID"; // Not sensitive — safe to put here

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
    }

    try {
      const body = await request.json();
      const { code } = body;

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Missing auth code" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(RAINDROP_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type:    "authorization_code",
          code,
          client_id:     CLIENT_ID,          // hardcoded — not sensitive
          client_secret: env.RAINDROP_CLIENT_SECRET, // secret — safely stored in Cloudflare
          redirect_uri:  REDIRECT_URI,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "Token exchange failed", details: data }),
          { status: response.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Worker error", message: err.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  }
};
