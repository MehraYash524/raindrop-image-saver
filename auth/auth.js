// auth/auth.js
// This page is loaded when Raindrop redirects back after user approves OAuth.
// It extracts the ?code= from the URL, sends it to background.js to exchange
// for an access token, then closes itself.

(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");

  if (error || !code) {
    // Auth was denied or something went wrong
    await browser.runtime.sendMessage({ type: "AUTH_ERROR", error: error || "no_code" });
    window.close();
    return;
  }

  // Send code to background script to exchange for access token
  await browser.runtime.sendMessage({ type: "AUTH_CODE_RECEIVED", code });
  window.close();
})();
