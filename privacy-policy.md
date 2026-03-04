# Privacy Policy — Raindrop Image Saver

**Last updated: March 2026**

This Privacy Policy explains how the Raindrop Image Saver Firefox extension handles your data.

---

## What Data We Collect

### Raindrop.io Access Token
When you sign in with your Raindrop.io account, we receive and store an OAuth2 access token. This token is stored locally in your browser using Firefox's extension storage (`browser.storage.local`). It never leaves your device except when making API calls to Raindrop.io on your behalf.

### Images on Web Pages
When you open the extension on a webpage, it scans the page for image URLs. These URLs are processed locally in your browser. They are only sent to Raindrop.io when you explicitly choose to save them.

### What We Do NOT Collect
- We do not collect your Raindrop.io username, email, or password
- We do not collect any browsing history
- We do not collect any personal information
- We do not use analytics or tracking of any kind
- We do not store any data on our own servers

---

## How We Use Your Data
The access token is used solely to make API calls to Raindrop.io on your behalf — to fetch your collections and save images you select. No data is used for any other purpose.

---

## Data Storage
Your access token is stored locally in your browser using Firefox's built-in extension storage. It is never transmitted to any server other than Raindrop.io's official API at `api.raindrop.io`.

---

## Cloudflare Worker
This extension uses a Cloudflare Worker as a secure proxy for the initial OAuth2 authentication step. The Worker receives your temporary authorization code, exchanges it for an access token using a server-side secret, and returns the token to your browser. The Worker does not log, store, or transmit any user data beyond what is required to complete this single exchange.

---

## Third Party Services
This extension interacts with the following third-party services:
- **Raindrop.io** — to authenticate and save images to your collections. Subject to [Raindrop.io's Privacy Policy](https://raindrop.io/privacy)
- **Cloudflare Workers** — used only for the initial OAuth token exchange. Subject to [Cloudflare's Privacy Policy](https://cloudflare.com/privacypolicy)

---

## Data Deletion
You can remove all locally stored data at any time by uninstalling the extension. You can also revoke the extension's access to your Raindrop account at any time from your Raindrop.io account settings under Integrations.

---

## Children's Privacy
This extension is not directed at children under the age of 13. We do not knowingly collect any information from children.

---

## Changes to This Policy
We may update this Privacy Policy from time to time. Any changes will be posted on this page.

---

## Contact
If you have any questions about this Privacy Policy, please open an issue on the [GitHub repository](https://github.com/MehraYash524/raindrop-image-saver).

