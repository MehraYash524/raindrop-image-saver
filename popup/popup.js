// popup/popup.js — Brick 6: Save & Confirm

let allImages          = [];
let selectedIndexes    = new Set();
let rescanInterval     = null;
let allSelected        = false;
let allCollections     = [];
let filteredCollections = [];
let selectedCollection = null;
let parentMap          = {};
const MAX_SELECTION = 99;

// ─── Messaging ───────────────────────────────────────────────────────────────

async function sendToContentScript(type) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return browser.tabs.sendMessage(tab.id, { type });
}

async function sendToBackground(type, extra = {}) {
  return browser.runtime.sendMessage({ type, ...extra });
}

async function getAccessToken() {
  const { token } = await sendToBackground("GET_TOKEN");
  return token;
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────

function renderAuthScreen() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="header">
      <div class="header-title">Raindrop <span>Saver</span></div>
      <button class="btn-close" id="btn-close">✕</button>
    </div>
    <div class="auth-screen">
      <div class="auth-logo">💧</div>
      <h2 class="auth-title">Connect to Raindrop.io</h2>
      <p class="auth-desc">Sign in to your Raindrop account to start saving images to your collections.</p>
      <button class="btn-login" id="btn-login">Sign in with Raindrop</button>
      <p class="auth-waiting hidden" id="auth-waiting">Waiting for authorization…</p>
      <p class="auth-error hidden" id="auth-error"></p>
    </div>
  `;
  document.getElementById("btn-close").addEventListener("click", () => window.close());
  document.getElementById("btn-login").addEventListener("click", onLogin);
  browser.runtime.onMessage.addListener(onAuthMessage);
}

async function onLogin() {
  document.getElementById("btn-login").disabled = true;
  document.getElementById("btn-login").textContent = "Opening Raindrop…";
  document.getElementById("auth-waiting").classList.remove("hidden");
  await sendToBackground("START_AUTH");
}

function onAuthMessage(message) {
  if (message.type === "AUTH_COMPLETE") {
    browser.runtime.onMessage.removeListener(onAuthMessage);
    renderAll();
    initialScan().then(startRescanLoop);
  }
  if (message.type === "AUTH_ERROR") {
    const errEl = document.getElementById("auth-error");
    if (errEl) { errEl.textContent = "Authorization failed. Please try again."; errEl.classList.remove("hidden"); }
    const loginBtn = document.getElementById("btn-login");
    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = "Sign in with Raindrop"; }
    const waitEl = document.getElementById("auth-waiting");
    if (waitEl) waitEl.classList.add("hidden");
  }
}

// ─── Main Image Grid ──────────────────────────────────────────────────────────

function renderAll() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="header">
      <div class="header-title">Raindrop <span>Saver</span></div>
      <button class="btn-close" id="btn-close">✕</button>
    </div>
    <div class="preview-strip hidden" id="preview-strip">
      <span class="preview-strip-label">Selected:</span>
    </div>
    <div class="toolbar">
      <span class="img-count" id="img-count">Scanning…</span><span class="img-limit">· Save up to 99</span>
      <button class="btn-select-all" id="btn-select-all">Select All</button>
    </div>
    <div class="image-grid" id="image-grid"></div>
    <div class="footer">
      <button class="btn-next" id="btn-next" disabled>Next →</button>
    </div>
  `;
  document.getElementById("btn-close").addEventListener("click", () => window.close());
  document.getElementById("btn-select-all").addEventListener("click", toggleSelectAll);
  document.getElementById("btn-next").addEventListener("click", onNext);
}

function renderGrid() {
  const grid = document.getElementById("image-grid");
  if (!grid) return;

  // Create 3 columns if they don't exist yet
  let cols = grid.querySelectorAll(".masonry-col");
  if (cols.length === 0) {
    for (let c = 0; c < 3; c++) {
      const col = document.createElement("div");
      col.className = "masonry-col";
      col.dataset.col = c;
      grid.appendChild(col);
    }
    cols = grid.querySelectorAll(".masonry-col");
  }

  // Only append newly added images
  const existingCount = grid.querySelectorAll(".img-tile").length;
  const toAdd = allImages.slice(existingCount);

  toAdd.forEach((img, idx) => {
    const i = existingCount + idx;

    const tile = document.createElement("div");
    tile.className = "img-tile" + (selectedIndexes.has(i) ? " selected" : "");
    tile.dataset.index = i;
    tile.innerHTML = `
      <img src="${img.src}" alt="${img.alt || ""}"
           onerror="this.parentElement.style.display='none'"
           loading="lazy" />
      <div class="check">✓</div>
    `;
    tile.addEventListener("click", () => toggleSelect(i));

    // Distribute to shortest column
    const shortestCol = Array.from(cols).reduce((shortest, col) =>
      col.offsetHeight <= shortest.offsetHeight ? col : shortest
    , cols[0]);

    shortestCol.appendChild(tile);
  });

  updateToolbar();
}

function updateToolbar() {
  const countEl      = document.getElementById("img-count");
  const selectAllBtn = document.getElementById("btn-select-all");
  const nextBtn      = document.getElementById("btn-next");
  if (countEl) countEl.textContent = `${allImages.length} image(s) found`;
  if (selectAllBtn) {
    selectAllBtn.textContent = allSelected ? "Deselect All" : "Select All";
    selectAllBtn.classList.toggle("active", allSelected);
  }
  if (nextBtn) {
    const count = selectedIndexes.size;
    nextBtn.disabled = count === 0;
    nextBtn.textContent = count > 0 ? `Next → (${count} selected)` : "Next →";
  }
}

function updatePreviewStrip() {
  const strip = document.getElementById("preview-strip");
  if (!strip) return;
  if (selectedIndexes.size === 0) { strip.classList.add("hidden"); return; }
  strip.classList.remove("hidden");
  strip.innerHTML = `<span class="preview-strip-label">Selected:</span>`;
  for (const index of selectedIndexes) {
    const img = allImages[index];
    if (!img) continue;
    const thumb = document.createElement("img");
    thumb.className = "preview-thumb";
    thumb.src = img.src;
    thumb.onerror = () => thumb.remove();
    strip.appendChild(thumb);
  }
}

function toggleSelect(index) {
  if (selectedIndexes.has(index)) {
    selectedIndexes.delete(index);
  } else {
    if (selectedIndexes.size >= MAX_SELECTION) {
      showToast("Maximum 99 images reached");
      return;
    }
    selectedIndexes.add(index);
  }
  const tile = document.querySelector(`.img-tile[data-index="${index}"]`);
  if (tile) tile.classList.toggle("selected", selectedIndexes.has(index));
  allSelected = selectedIndexes.size === allImages.length && allImages.length > 0;
  updateToolbar();
  updatePreviewStrip();
}

function toggleSelectAll() {
  if (allSelected) { selectedIndexes.clear(); allSelected = false; }
  else {
    let count = 0;
    for (let i = 0; i < allImages.length; i++) {
      if (count >= MAX_SELECTION) break;
      selectedIndexes.add(i);
      count++;
    }
    if (allImages.length > MAX_SELECTION) showToast("Maximum 99 images reached");
    allSelected = true;
  }
  document.querySelectorAll(".img-tile").forEach(tile => {
    tile.classList.toggle("selected", selectedIndexes.has(parseInt(tile.dataset.index)));
  });
  updateToolbar();
  updatePreviewStrip();
}


// ─── Toast ────────────────────────────────────────────────────────────────────

let toastTimeout = null;
function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.getElementById("app").appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ─── Collection Picker ────────────────────────────────────────────────────────

async function onNext() {
  stopRescanLoop();
  await renderCollectionPicker();
}

async function fetchCollections(token) {
  const response = await fetch("https://api.raindrop.io/rest/v1/collections", {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to fetch collections: ${response.status}`);
  const data = await response.json();
  return data.items || [];
}

async function fetchRecentCollectionId(token) {
  try {
    const response = await fetch("https://api.raindrop.io/rest/v1/raindrops/0?perpage=1&sort=-created", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.items?.length > 0) return data.items[0].collection?.$id || null;
  } catch { /* ignore */ }
  return null;
}

function buildParentMap(collections) {
  const map = {};
  for (const col of collections) map[col._id] = col.title;
  return map;
}

function sortCollections(collections, recentId) {
  return [...collections].sort((a, b) => {
    if (a._id === recentId) return -1;
    if (b._id === recentId) return 1;
    return a.title.localeCompare(b.title);
  });
}

async function renderCollectionPicker() {
  const app = document.getElementById("app");
  const selectedCount = selectedIndexes.size;

  app.innerHTML = `
    <div class="collection-screen">
      <div class="collection-header">
        <button class="btn-back" id="btn-back">←</button>
        <div class="collection-header-title">Choose Collection</div>
        <span class="collection-saving-badge">${selectedCount} image${selectedCount > 1 ? "s" : ""}</span>
        <button class="btn-close" id="btn-close">✕</button>
      </div>
      <div class="collection-search-wrap">
        <input class="collection-search" id="collection-search" type="text" placeholder="Search collections…" autocomplete="off" />
      </div>
      <div class="collection-list" id="collection-list">
        <div class="collection-loading">Loading collections…</div>
      </div>
      <div class="create-collection-wrap">
        <div class="create-collection-row">
          <input class="create-collection-input" id="new-collection-name" type="text" placeholder="New collection name…" autocomplete="off" />
          <button class="btn-create" id="btn-create" disabled>Create</button>
        </div>
      </div>
      <div class="collection-footer">
        <button class="btn-save" id="btn-save" disabled>Save to Collection</button>
      </div>
    </div>
  `;

  document.getElementById("btn-close").addEventListener("click", () => window.close());
  document.getElementById("btn-back").addEventListener("click", () => { renderAll(); renderGrid(); startRescanLoop(); });
  document.getElementById("collection-search").addEventListener("input", onSearchInput);
  document.getElementById("new-collection-name").addEventListener("input", onNewNameInput);
  document.getElementById("btn-create").addEventListener("click", onCreateCollection);
  document.getElementById("btn-save").addEventListener("click", onSave);

  try {
    const token = await getAccessToken();
    const [collections, recentId] = await Promise.all([
      fetchCollections(token),
      fetchRecentCollectionId(token)
    ]);
    parentMap = buildParentMap(collections);
    allCollections = sortCollections(collections, recentId);
    filteredCollections = [...allCollections];
    selectedCollection = null;
    renderCollectionList(recentId);
  } catch (e) {
    document.getElementById("collection-list").innerHTML =
      `<div class="collection-empty" style="color:#e05c5c;">Failed to load collections.<br/>${e.message}</div>`;
  }
}

function renderCollectionList(recentId) {
  const list = document.getElementById("collection-list");
  if (!list) return;

  if (filteredCollections.length === 0) {
    list.innerHTML = `<div class="collection-empty">No collections found.</div>`;
    return;
  }

  list.innerHTML = "";
  const isFiltering = document.getElementById("collection-search")?.value.trim().length > 0;

  if (!isFiltering && recentId) {
    const recentCol = allCollections.find(c => c._id === recentId);
    if (recentCol) {
      appendSectionLabel(list, "Recent");
      list.appendChild(buildCollectionItem(recentCol));
      appendSectionLabel(list, "All Collections");
      for (const col of filteredCollections) {
        if (col._id === recentId) continue;
        list.appendChild(buildCollectionItem(col));
      }
      return;
    }
  }

  for (const col of filteredCollections) list.appendChild(buildCollectionItem(col));
}

function appendSectionLabel(list, text) {
  const label = document.createElement("div");
  label.className = "collection-section-label";
  label.textContent = text;
  list.appendChild(label);
}

function buildCollectionItem(col) {
  const item = document.createElement("div");
  item.className = "collection-item" + (selectedCollection?.id === col._id ? " selected" : "");
  item.dataset.id = col._id;
  const parentTitle = col.parent?.$id ? parentMap[col.parent.$id] : null;
  item.innerHTML = `
    <div class="collection-icon">📁</div>
    <div class="collection-info">
      <div class="collection-name">${col.title}</div>
      ${parentTitle ? `<div class="collection-parent">${parentTitle}</div>` : ""}
    </div>
    <div class="collection-count">${col.count || 0}</div>
  `;
  item.addEventListener("click", () => selectCollection({ id: col._id, title: col.title }));
  return item;
}

function selectCollection(col) {
  selectedCollection = col;
  document.querySelectorAll(".collection-item").forEach(item => {
    item.classList.toggle("selected", item.dataset.id === String(col.id));
  });
  const saveBtn = document.getElementById("btn-save");
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = `Save to "${col.title}"`; }
}

function onSearchInput(e) {
  const query = e.target.value.trim().toLowerCase();
  filteredCollections = query
    ? allCollections.filter(c => c.title.toLowerCase().includes(query))
    : [...allCollections];
  renderCollectionList(null);
}

function onNewNameInput(e) {
  const btn = document.getElementById("btn-create");
  if (btn) btn.disabled = e.target.value.trim().length === 0;
}

async function onCreateCollection() {
  const nameInput = document.getElementById("new-collection-name");
  const name = nameInput?.value.trim();
  if (!name) return;
  const btn = document.getElementById("btn-create");
  btn.disabled = true;
  btn.textContent = "Creating…";
  try {
    const token = await getAccessToken();
    const response = await fetch("https://api.raindrop.io/rest/v1/collection", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: name })
    });
    if (!response.ok) throw new Error(`Create failed: ${response.status}`);
    const data = await response.json();
    const newCol = data.item;
    allCollections.unshift(newCol);
    filteredCollections = [...allCollections];
    parentMap[newCol._id] = newCol.title;
    renderCollectionList(null);
    selectCollection({ id: newCol._id, title: newCol.title });
    if (nameInput) nameInput.value = "";
    btn.textContent = "Create";
    btn.disabled = true;
  } catch (e) {
    btn.textContent = "Create";
    btn.disabled = false;
    renderErrorScreen(`Could not create collection: ${e.message}`, true);
  }
}

// ─── Save & Confirm ───────────────────────────────────────────────────────────

async function onSave() {
  if (!selectedCollection) return;

  const saveBtn = document.getElementById("btn-save");
  saveBtn.disabled = true;
  saveBtn.classList.add("saving");
  saveBtn.textContent = "Saving…";

  const selected = [...selectedIndexes].map(i => allImages[i]);

  // Format items for Raindrop bulk API
  const items = selected.map(img => ({
    link: img.src,
    title: img.alt || img.src.split("/").pop() || "Image",
    collection: { $id: selectedCollection.id }
  }));

  try {
    const token = await getAccessToken();

    const response = await fetch("https://api.raindrop.io/rest/v1/raindrops", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items })
    });

    if (response.status === 401) throw new Error("auth_expired");
    if (response.status === 429) throw new Error("rate_limited");
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    if (!data.result) throw new Error("Raindrop returned an error. Please try again.");

    renderSuccessScreen(selected.length, selectedCollection, selected);

  } catch (e) {
    if (e.message === "auth_expired") {
      // Clear token and show auth screen
      await sendToBackground("LOGOUT");
      renderAuthScreen();
    } else if (e.message === "rate_limited") {
      renderErrorScreen("Too many requests. Please wait a moment and try again.", true);
    } else {
      renderErrorScreen(e.message, true);
    }
  }
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function buildCollage(images) {
  const count = images.length;

  let gridClass, maxImgs;
  if (count === 1)      { gridClass = "grid-1"; maxImgs = 1; }
  else if (count === 2) { gridClass = "grid-2"; maxImgs = 2; }
  else if (count === 3) { gridClass = "grid-3"; maxImgs = 3; }
  else if (count === 4) { gridClass = "grid-4"; maxImgs = 4; }
  else                  { gridClass = "grid-many"; maxImgs = 9; }

  const collage = document.createElement("div");
  collage.className = `success-collage ${gridClass}`;

  const toShow = images.slice(0, maxImgs);
  for (const img of toShow) {
    const cell = document.createElement("div");
    cell.className = "collage-cell";
    const el = document.createElement("img");
    el.src = img.src;
    el.alt = img.alt || "";
    el.onerror = () => { cell.style.background = "#2a2d3a"; };
    cell.appendChild(el);
    collage.appendChild(cell);
  }

  // Fill remaining cells with blank if needed for even grid
  const remaining = maxImgs - toShow.length;
  for (let i = 0; i < remaining; i++) {
    const cell = document.createElement("div");
    cell.className = "collage-cell";
    collage.appendChild(cell);
  }

  return collage;
}

function renderSuccessScreen(count, collection, savedImages) {
  const app = document.getElementById("app");
  const collectionUrl = `https://app.raindrop.io/my/${collection.id}`;

  app.innerHTML = `
    <div class="header">
      <div class="header-title">Raindrop <span>Saver</span></div>
      <button class="btn-close" id="btn-close">✕</button>
    </div>
    <div class="success-screen">
      <div id="collage-slot"></div>
      <h2 class="success-title">Saved!</h2>
      <p class="success-desc">
        ${count} image${count > 1 ? "s" : ""} saved to<br/>
        <strong style="color:#fff;">${collection.title}</strong>
      </p>
      <button class="btn-visit" id="btn-visit">
        Visit Collection →
      </button>
    </div>
  `;

  // Insert collage into slot
  const slot = document.getElementById("collage-slot");
  slot.appendChild(buildCollage(savedImages));

  document.getElementById("btn-close").addEventListener("click", () => window.close());
  document.getElementById("btn-visit").addEventListener("click", () => {
    browser.tabs.create({ url: collectionUrl });
    window.close();
  });
}

// ─── Error Screen ─────────────────────────────────────────────────────────────

function renderErrorScreen(message, canGoBack = false) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="header">
      <div class="header-title">Raindrop <span>Saver</span></div>
      <button class="btn-close" id="btn-close">✕</button>
    </div>
    <div class="error-screen">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">Something went wrong</h2>
      <p class="error-desc">${message}</p>
      ${canGoBack ? `<button class="btn-retry" id="btn-retry">← Go Back</button>` : ""}
    </div>
  `;
  document.getElementById("btn-close").addEventListener("click", () => window.close());
  if (canGoBack) {
    document.getElementById("btn-retry").addEventListener("click", () => renderCollectionPicker());
  }
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

async function initialScan() {
  try {
    const response = await sendToContentScript("GET_IMAGES");
    if (response?.images?.length) { allImages = response.images; renderGrid(); }
  } catch (e) {
    const grid = document.getElementById("image-grid");
    if (grid) grid.innerHTML = `<p class="empty-msg" style="color:#e05c5c;">${e.message}</p>`;
  }
}

function startRescanLoop() {
  rescanInterval = setInterval(async () => {
    try {
      const response = await sendToContentScript("RESCAN_IMAGES");
      if (response?.images?.length) { allImages = allImages.concat(response.images); renderGrid(); }
    } catch { stopRescanLoop(); }
  }, 3000);
}

function stopRescanLoop() {
  if (rescanInterval) { clearInterval(rescanInterval); rescanInterval = null; }
}

window.addEventListener("unload", stopRescanLoop);

// ─── Entry Point ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  allImages = [];
  selectedIndexes = new Set();
  allSelected = false;

  document.getElementById("app").innerHTML = `<p class="empty-msg">Loading…</p>`;

  const { authenticated } = await sendToBackground("CHECK_AUTH");
  if (!authenticated) {
    renderAuthScreen();
  } else {
    renderAll();
    await initialScan();
    startRescanLoop();
  }
});
