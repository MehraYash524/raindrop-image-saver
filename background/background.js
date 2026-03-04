// background/background.js — OAuth2 + Token Management
// CLIENT_SECRET is now safely stored in Cloudflare Worker — not here

// ─── Config ──────────────────────────────────────────────────────────────────
const CLIENT_ID   = "YOUR_CLIENT_ID"; // Only CLIENT_ID needed here, no secret
const REDIRECT_URI = "https://localhost";
const AUTH_URL     = "https://raindrop.io/oauth/authorize";
const PROXY_URL    = "PROXY_URL"; // Cloudflare Worker
const STORAGE_KEY  = "raindrop_token";

// ─── Token Storage ───────────────────────────────────────────────────────────

async function saveToken(tokenData) {
  await browser.storage.local.set({ [STORAGE_KEY]: tokenData });
}

async function getToken() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

async function clearToken() {
  await browser.storage.local.remove(STORAGE_KEY);
}

function isTokenValid(tokenData) {
  if (!tokenData || !tokenData.access_token) return false;
  if (!tokenData.expires_at) return true;
  return Date.now() < tokenData.expires_at - 60000;
}

// ─── OAuth Flow ──────────────────────────────────────────────────────────────

async function startOAuthFlow() {
  const authPageUrl = `${AUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;

  const tab = await browser.tabs.create({ url: authPageUrl });

  browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
    if (tabId !== tab.id) return;
    if (!changeInfo.url) return;

    const url = changeInfo.url;
    if (!url.startsWith("https://localhost")) return;

    browser.tabs.onUpdated.removeListener(listener);
    browser.tabs.remove(tabId).catch(() => {});

    const params = new URLSearchParams(new URL(url).search);
    const code  = params.get("code");
    const error = params.get("error");

    if (error || !code) {
      browser.runtime.sendMessage({ type: "AUTH_ERROR", error: error || "no_code" }).catch(() => {});
      return;
    }

    // Send code to Cloudflare Worker proxy — secret never leaves the Worker
    exchangeCodeViaProxy(code)
      .then(() => browser.runtime.sendMessage({ type: "AUTH_COMPLETE" }).catch(() => {}))
      .catch(err => browser.runtime.sendMessage({ type: "AUTH_ERROR", error: err.message }).catch(() => {}));
  });
}

async function exchangeCodeViaProxy(code) {
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) throw new Error(`Proxy error: ${response.status}`);

  const data = await response.json();

  if (data.error) throw new Error(data.error);

  const tokenData = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token || null,
    expires_at:    data.expires_in ? Date.now() + data.expires_in * 1000 : null,
  };

  await saveToken(tokenData);
  return tokenData;
}

// ─── Message Listener ────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "CHECK_AUTH") {
    getToken().then(token => sendResponse({ authenticated: isTokenValid(token) }));
    return true;
  }

  if (message.type === "START_AUTH") {
    startOAuthFlow().then(() => sendResponse({ started: true }));
    return true;
  }

  if (message.type === "GET_TOKEN") {
    getToken().then(token => {
      sendResponse(isTokenValid(token) ? { token: token.access_token } : { token: null });
    });
    return true;
  }

  if (message.type === "LOGOUT") {
    clearToken().then(() => sendResponse({ success: true }));
    return true;
  }

});
