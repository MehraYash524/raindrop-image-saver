# Raindrop Image Saver

A Firefox browser extension to save multiple images from any website directly to your [Raindrop.io](https://raindrop.io) collections.

Inspired by the Pinterest Save Button extension — but for Raindrop.

![Extension Preview](assets/icons/icon96.png)

---

## Features

- 🖼️ Masonry grid — images display at natural size, nothing cropped
- ✅ Select images individually or all at once (up to 99)
- 🔍 Auto-detects lazy-loaded images as you scroll
- 📁 Browse, search, and filter your Raindrop collections
- ➕ Create new collections directly from the extension
- 🎨 Dark midnight theme
- 🔒 Secure OAuth2 login — sign in once, stay logged in

---

## Installation

### From Firefox Add-ons Store
https://addons.mozilla.org/addon/raindrop-image-saver/

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Firefox and go to `about:debugging`
3. Click **This Firefox** → **Load Temporary Add-on**
4. Select `manifest.json` from the extension folder

---

## Setup

### 1. Create a Raindrop OAuth App
- Go to [app.raindrop.io/settings/integrations](https://app.raindrop.io/settings/integrations)
- Click **Create new app**
- Set Redirect URI to `https://localhost`
- Copy your **Client ID** and **Client Secret**

### 2. Deploy the Cloudflare Worker
- Copy `worker.js` to a new Cloudflare Worker
- Add environment variable: `RAINDROP_CLIENT_SECRET` = your secret
- Add environment variable: `RAINDROP_CLIENT_ID` = your client ID
- Note your Worker URL (e.g. `https://your-worker.workers.dev`)

### 3. Configure the Extension
Open `background/background.js` and update:
```javascript
const CLIENT_ID  = "YOUR_CLIENT_ID";
const PROXY_URL  = "YOUR_CLOUDFLARE_WORKER_URL";
```

---

## Project Structure

```
raindrop-extension/
├── manifest.json              Firefox MV2 config
├── assets/icons/              Extension icons
├── popup/
│   ├── popup.html             Extension popup
│   ├── popup.css              Dark theme styles
│   └── popup.js               UI logic
├── background/
│   └── background.js          OAuth + token management
├── content/
│   └── content.js             Image extraction
└── worker.js                  Cloudflare Worker proxy
```

---

## Privacy

This extension stores only your Raindrop.io OAuth token, locally in your browser. No personal data is collected or transmitted to any third party other than Raindrop.io. See [Privacy Policy](https://mehrayash524.github.io/raindrop-image-saver/
) for details.

---

## License

MIT License — free to use, modify, and distribute.

---

## Disclaimer

This is an unofficial extension. It is not affiliated with or endorsed by Raindrop.io.
