// content/content.js
// Brick 2 — Image Extraction
// - Scans DOM for all valid images (min 50x50px)
// - Resolves relative URLs to absolute
// - Checks src, data-src, data-lazy, data-original for lazy-loaded images
// - Tracks already-found URLs to avoid duplicates on re-scan

const foundUrls = new Set();

/**
 * Resolve any URL (relative or absolute) to a full absolute URL.
 */
function resolveUrl(url) {
  if (!url || url.startsWith("data:")) return null;
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return null;
  }
}

/**
 * Extract the best available src from an <img> element.
 * Checks real src first, then common lazy-load data attributes.
 */
function getBestSrc(img) {
  const candidates = [
    img.src,
    img.dataset.src,
    img.dataset.lazy,
    img.dataset.original,
    img.dataset.lazySrc,
    img.getAttribute("data-src"),
    img.getAttribute("data-lazy"),
    img.getAttribute("data-original"),
    img.getAttribute("data-lazy-src"),
  ];

  for (const candidate of candidates) {
    const resolved = resolveUrl(candidate);
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Check if an <img> element meets our minimum size requirement (50x50px).
 * Uses naturalWidth/naturalHeight (actual image size) and falls back
 * to rendered width/height if the image hasn't fully loaded yet.
 */
function isBigEnough(img) {
  const w = img.naturalWidth || img.width || img.offsetWidth;
  const h = img.naturalHeight || img.height || img.offsetHeight;
  return w >= 50 && h >= 50;
}

/**
 * Extract CSS background-image URLs from all elements on the page.
 */
function extractBackgroundImages() {
  const results = [];
  const allElements = document.querySelectorAll("*");

  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const bg = style.backgroundImage;

    if (bg && bg !== "none") {
      // bg can be: url("..."), or multiple: url("..."), url("...")
      const urlMatches = bg.matchAll(/url\(["']?([^"')]+)["']?\)/g);
      for (const match of urlMatches) {
        const resolved = resolveUrl(match[1]);
        if (resolved) {
          results.push({
            src: resolved,
            width: el.offsetWidth || 0,
            height: el.offsetHeight || 0,
            alt: el.getAttribute("aria-label") || el.getAttribute("title") || "",
            type: "background",
          });
        }
      }
    }
  }
  return results;
}

/**
 * Main scan function.
 * Returns only images that are NEW (not already in foundUrls).
 */
function scanImages() {
  const newImages = [];

  // --- 1. Scan <img> tags ---
  const imgElements = document.querySelectorAll("img");

  for (const img of imgElements) {
    const src = getBestSrc(img);
    if (!src) continue;
    if (foundUrls.has(src)) continue;
    if (!isBigEnough(img)) continue;

    foundUrls.add(src);
    newImages.push({
      src,
      width: img.naturalWidth || img.width || img.offsetWidth || 0,
      height: img.naturalHeight || img.height || img.offsetHeight || 0,
      alt: img.alt || img.title || "",
      type: "img",
    });
  }

  // --- 2. Scan CSS background images ---
  const bgImages = extractBackgroundImages();
  for (const bg of bgImages) {
    if (foundUrls.has(bg.src)) continue;
    if (bg.width < 50 || bg.height < 50) continue;

    foundUrls.add(bg.src);
    newImages.push(bg);
  }

  return newImages;
}

// ─── Message Listener ───────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Fresh scan — clears memory first, then scans everything visible
  if (message.type === "GET_IMAGES") {
    foundUrls.clear(); // reset so reopening popup always shows all images
    const images = scanImages();
    sendResponse({ images });
    return true;
  }

  // Re-scan — only returns newly loaded images since last scan
  if (message.type === "RESCAN_IMAGES") {
    const newImages = scanImages();
    sendResponse({ images: newImages });
    return true;
  }

});
