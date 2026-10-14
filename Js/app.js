/* ============================================
   Offline Photo Print Studio
   File: js/app.js

   Features:
   - Multiple image upload
   - Drag and drop
   - Thumbnail management and reordering
   - Individual copy counts
   - Photo and paper presets
   - Millimeter-based multi-page layout
   - Print preview and zoom
   - PDF export using local jsPDF
   - IndexedDB persistence
   - LocalStorage settings
   - Project save/load
============================================ */

"use strict";

/* ============================================
   1. CONFIGURATION
============================================ */

const CONFIG = {
  maxFileSize: 10 * 1024 * 1024,
  maxFiles: 100,
  maxCopiesPerPhoto: 500,
  maxTotalCopies: 2000,
  maxPerRow: 5,
  defaultCopies: 4,
  defaultMargin: 10,
  defaultSpacing: 5,
  defaultZoom: 0.65,
  minZoom: 0.2,
  maxZoom: 1.5,
  dbName: "OfflinePhotoPrintStudio",
  dbVersion: 1,
  storeName: "projects",
  settingsKey: "photoPrintStudioSettings",
};

const PHOTO_PRESETS = {
  passport: {
    width: 35,
    height: 45,
    label: "Passport",
  },
  square: {
    width: 25,
    height: 25,
    label: "Square ID",
  },
  stamp: {
    width: 25,
    height: 30,
    label: "Stamp",
  },
  visa: {
    width: 35,
    height: 45,
    label: "Visa",
  },
};

const PAPER_PRESETS = {
  a4: {
    width: 210,
    height: 297,
    label: "A4",
  },
  a5: {
    width: 148,
    height: 210,
    label: "A5",
  },
  "4r": {
    width: 102,
    height: 152,
    label: "4R",
  },
  "5r": {
    width: 127,
    height: 178,
    label: "5R",
  },
  "6r": {
    width: 152,
    height: 203,
    label: "6R",
  },
};

const state = {
  photos: [],
  pages: [],
  currentPage: 0,
  zoom: CONFIG.defaultZoom,
  db: null,
  projectId: "default",
  ready: false,
  rendering: false,
  dragIndex: null,
  lastError: "",
};

/* ============================================
   2. DOM HELPERS
============================================ */

const $ = (selector) => document.querySelector(selector);

const elements = {
  photoInput: $("#photoInput"),
  uploadDropzone: $("#uploadDropzone"),
  addMorePhotosBtn: $("#addMorePhotosBtn"),
  thumbnailGrid: $("#thumbnailGrid"),
  emptyPhotoState: $("#emptyPhotoState"),
  photoCount: $("#photoCount"),
  photoList: $("#photoList"),
  photoListCount: $("#photoListCount"),

  photoPreset: $("#photoPreset"),
  photoWidth: $("#photoWidth"),
  photoHeight: $("#photoHeight"),
  defaultCopies: $("#defaultCopies"),
  decreaseCopiesBtn: $("#decreaseCopiesBtn"),
  increaseCopiesBtn: $("#increaseCopiesBtn"),

  paperSize: $("#paperSize"),
  previewPaperSize: $("#previewPaperSize"),
  paperWidth: $("#paperWidth"),
  paperHeight: $("#paperHeight"),
  customPaperGroup: $("#customPaperGroup"),
  margin: $("#margin"),
  spacing: $("#spacing"),
  maxPerRow: $("#maxPerRow"),
  showCutLines: $("#showCutLines"),

  previewViewport: $("#previewViewport"),
  printPage: $("#printPage"),
  previewEmptyState: $("#previewEmptyState"),
  pageIndicator: $("#pageIndicator"),
  previousPageBtn: $("#previousPageBtn"),
  nextPageBtn: $("#nextPageBtn"),
  zoomLevel: $("#zoomLevel"),
  zoomInBtn: $("#zoomInBtn"),
  zoomOutBtn: $("#zoomOutBtn"),

  generatePreviewBtn: $("#generatePreviewBtn"),
  printPreviewBtn: $("#printPreviewBtn"),
  downloadPdfBtn: $("#downloadPdfBtn"),
  printBtn: $("#printBtn"),

  saveProjectBtn: $("#saveProjectBtn"),
  loadProjectBtn: $("#loadProjectBtn"),
  clearDataBtn: $("#clearDataBtn"),
  projectFileInput: $("#projectFileInput"),

  summaryTotalPhotos: $("#summaryTotalPhotos"),
  summaryPages: $("#summaryPages"),
  summaryPhotoSize: $("#summaryPhotoSize"),
  summaryPaperSize: $("#summaryPaperSize"),
  summaryOrientation: $("#summaryOrientation"),

  toastContainer: $("#toastContainer"),
};

/* ============================================
   3. UTILITIES
============================================ */

function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberValue(element, fallback) {
  if (!element) return fallback;

  const value = Number(element.value);

  return Number.isFinite(value) ? value : fallback;
}

function formatSize(width, height) {
  return `${width} × ${height} mm`;
}

function getOrientation() {
  return (
    document.querySelector('input[name="orientation"]:checked')?.value ||
    "portrait"
  );
}

function getPaperDimensions() {
  const preset = elements.paperSize.value;
  const base = PAPER_PRESETS[preset];

  let width;
  let height;

  if (preset === "custom") {
    width = numberValue(elements.paperWidth, 210);
    height = numberValue(elements.paperHeight, 297);
  } else {
    width = base.width;
    height = base.height;
  }

  if (getOrientation() === "landscape") {
    [width, height] = [height, width];
  }

  return {
    width,
    height,
    label: base?.label || "Custom",
    preset,
    orientation: getOrientation(),
  };
}

function getPhotoDimensions() {
  const preset = elements.photoPreset.value;
  const saved = PHOTO_PRESETS[preset];

  return {
    width: numberValue(elements.photoWidth, saved?.width || 35),
    height: numberValue(elements.photoHeight, saved?.height || 45),
    label: saved?.label || "Custom",
  };
}

function totalCopies() {
  return state.photos.reduce((sum, photo) => sum + photo.copies, 0);
}

function showToast(message, type = "success") {
  if (!elements.toastContainer) {
    console.log(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3500);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function isValidDimension(value, maximum) {
  return Number.isFinite(value) && value > 0 && value <= maximum;
}

/* ============================================
   4. INDEXEDDB
============================================ */

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported."));
      return;
    }

    const request = indexedDB.open(CONFIG.dbName, CONFIG.dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(CONFIG.storeName)) {
        db.createObjectStore(CONFIG.storeName, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => {
      state.db = request.result;
      resolve(state.db);
    };

    request.onerror = () => {
      reject(request.error || new Error("Database could not open."));
    };
  });
}

function dbRequest(mode, callback) {
  return new Promise((resolve, reject) => {
    if (!state.db) {
      reject(new Error("Database is not ready."));
      return;
    }

    const transaction = state.db.transaction(CONFIG.storeName, mode);

    const store = transaction.objectStore(CONFIG.storeName);

    let result;

    try {
      result = callback(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      resolve(result?.result);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    transaction.onabort = () => {
      reject(transaction.error || new Error("Transaction aborted."));
    };
  });
}

function saveProjectToDB() {
  const record = {
    id: state.projectId,
    updatedAt: new Date().toISOString(),
    photos: state.photos.map((photo) => ({
      id: photo.id,
      name: photo.name,
      dataUrl: photo.dataUrl,
      copies: photo.copies,
    })),
    settings: getSettings(),
  };

  return dbRequest("readwrite", (store) => store.put(record));
}

function loadProjectFromDB() {
  return dbRequest("readonly", (store) => store.get(state.projectId));
}

function deleteProjectFromDB(id) {
  return dbRequest("readwrite", (store) => store.delete(id));
}

/* ============================================
   5. LOCAL SETTINGS
============================================ */

function getSettings() {
  return {
    photoPreset: elements.photoPreset.value,
    photoWidth: numberValue(elements.photoWidth, 35),
    photoHeight: numberValue(elements.photoHeight, 45),
    defaultCopies: numberValue(elements.defaultCopies, 4),

    paperSize: elements.paperSize.value,
    paperWidth: numberValue(elements.paperWidth, 210),
    paperHeight: numberValue(elements.paperHeight, 297),

    orientation: getOrientation(),
    margin: numberValue(elements.margin, 10),
    spacing: numberValue(elements.spacing, 5),
    maxPerRow: numberValue(elements.maxPerRow, 5),
    showCutLines: elements.showCutLines.checked,
  };
}

function applySettings(settings = {}) {
  const setValue = (element, value) => {
    if (element && value !== undefined && value !== null) {
      element.value = value;
    }
  };

  setValue(elements.photoPreset, settings.photoPreset);
  setValue(elements.photoWidth, settings.photoWidth);
  setValue(elements.photoHeight, settings.photoHeight);
  setValue(elements.defaultCopies, settings.defaultCopies);

  setValue(elements.paperSize, settings.paperSize);
  setValue(elements.paperWidth, settings.paperWidth);
  setValue(elements.paperHeight, settings.paperHeight);

  setValue(elements.margin, settings.margin);
  setValue(elements.spacing, settings.spacing);
  setValue(elements.maxPerRow, settings.maxPerRow);

  if (settings.showCutLines !== undefined) {
    elements.showCutLines.checked = settings.showCutLines;
  }

  if (settings.orientation) {
    const radio = document.querySelector(
      `input[name="orientation"][value="${settings.orientation}"]`,
    );

    if (radio) radio.checked = true;
  }

  syncPresetFields();
  syncPaperFields();

  elements.previewPaperSize.value = elements.paperSize.value;
}

function saveSettingsLocally() {
  try {
    localStorage.setItem(CONFIG.settingsKey, JSON.stringify(getSettings()));
  } catch (error) {
    console.warn("Settings could not be saved:", error);
  }
}

function loadSettingsLocally() {
  try {
    const saved = localStorage.getItem(CONFIG.settingsKey);

    if (saved) {
      applySettings(JSON.parse(saved));
    }
  } catch (error) {
    console.warn("Settings could not be loaded:", error);
  }
}

/* ============================================
   6. IMAGE LOADING
============================================ */

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);

    reader.readAsDataURL(file);
  });
}

function validateImageFile(file) {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!supportedTypes.includes(file.type)) {
    throw new Error(`${file.name}: Use JPG, PNG or WEBP images.`);
  }

  if (file.size > CONFIG.maxFileSize) {
    throw new Error(`${file.name}: Maximum file size is 10 MB.`);
  }
}

async function addImages(files) {
  const incoming = Array.from(files || []);

  if (!incoming.length) return;

  let added = 0;
  const errors = [];

  for (const file of incoming) {
    if (state.photos.length >= CONFIG.maxFiles) {
      errors.push("Maximum 100 photos allowed.");
      break;
    }

    try {
      validateImageFile(file);

      const dataUrl = await readFileAsDataURL(file);

      const image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () =>
          reject(new Error("The image could not be decoded."));

        image.src = dataUrl;
      });

      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error("The image is invalid.");
      }

      state.photos.push({
        id: makeId(),
        name: file.name,
        dataUrl,
        copies: clamp(
          numberValue(elements.defaultCopies, 4),
          1,
          CONFIG.maxCopiesPerPhoto,
        ),
        width: image.naturalWidth,
        height: image.naturalHeight,
      });

      added++;
    } catch (error) {
      errors.push(error.message || "Could not add image.");
    }
  }

  renderPhotoList();
  renderThumbnails();
  await regeneratePreview();

  if (added > 0) {
    showToast(`${added} photo(s) added.`);
    await persistProjectSafely();
  }

  if (errors.length) {
    showToast(errors.slice(0, 3).join(" "), "warning");
  }
}

/* ============================================
   7. PHOTO LIST AND THUMBNAILS
============================================ */

function createThumbnail(photo, index) {
  const wrapper = document.createElement("div");

  wrapper.className = "photo-thumbnail";
  wrapper.draggable = true;
  wrapper.dataset.index = index;

  const image = document.createElement("img");
  image.src = photo.dataUrl;
  image.alt = photo.name;
  image.loading = "lazy";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-photo-btn";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Remove ${photo.name}`);

  remove.addEventListener("click", async () => {
    state.photos = state.photos.filter((item) => item.id !== photo.id);

    renderThumbnails();
    renderPhotoList();

    await regeneratePreview();
    await persistProjectSafely();
  });

  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⠿";

  wrapper.append(image, remove, handle);

  wrapper.addEventListener("dragstart", (event) => {
    state.dragIndex = index;

    wrapper.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  });

  wrapper.addEventListener("dragend", () => {
    state.dragIndex = null;

    document.querySelectorAll(".photo-thumbnail").forEach((item) => {
      item.classList.remove("is-dragging", "drag-target");
    });
  });

  wrapper.addEventListener("dragover", (event) => {
    event.preventDefault();
    wrapper.classList.add("drag-target");
  });

  wrapper.addEventListener("dragleave", () => {
    wrapper.classList.remove("drag-target");
  });

  wrapper.addEventListener("drop", async (event) => {
    event.preventDefault();

    const from = state.dragIndex;
    const to = Number(wrapper.dataset.index);

    if (
      from === null ||
      !Number.isInteger(to) ||
      from === to ||
      !state.photos[from] ||
      !state.photos[to]
    ) {
      return;
    }

    const [photo] = state.photos.splice(from, 1);
    state.photos.splice(to, 0, photo);

    renderThumbnails();
    renderPhotoList();

    await regeneratePreview();
    await persistProjectSafely();
  });

  return wrapper;
}

function renderThumbnails() {
  elements.thumbnailGrid.replaceChildren();

  elements.emptyPhotoState.hidden = state.photos.length > 0;

  state.photos.forEach((photo, index) => {
    elements.thumbnailGrid.appendChild(createThumbnail(photo, index));
  });

  elements.photoCount.textContent = `${state.photos.length} photo(s) selected`;
}

function renderPhotoList() {
  elements.photoList.replaceChildren();

  elements.photoListCount.textContent = state.photos.length;

  if (!state.photos.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const message = document.createElement("p");
    message.textContent = "No photos added yet.";

    empty.appendChild(message);
    elements.photoList.appendChild(empty);

    return;
  }

  state.photos.forEach((photo) => {
    const item = document.createElement("div");
    item.className = "photo-list-item";

    const image = document.createElement("img");
    image.src = photo.dataUrl;
    image.alt = photo.name;

    const info = document.createElement("div");
    info.className = "photo-list-info";

    const name = document.createElement("strong");
    name.textContent = photo.name;
    name.title = photo.name;

    const copiesLabel = document.createElement("span");
    copiesLabel.textContent = `${photo.copies} copies`;

    const controls = document.createElement("div");
    controls.className = "photo-list-controls";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", "Decrease copies");

    const copies = document.createElement("input");
    copies.type = "number";
    copies.min = "1";
    copies.max = String(CONFIG.maxCopiesPerPhoto);
    copies.value = photo.copies;
    copies.setAttribute("aria-label", "Copies for " + photo.name);

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.setAttribute("aria-label", "Increase copies");

    const updateCopies = async (nextValue) => {
      photo.copies = clamp(Math.round(nextValue), 1, CONFIG.maxCopiesPerPhoto);

      copies.value = photo.copies;
      copiesLabel.textContent = `${photo.copies} copies`;

      await regeneratePreview();
      await persistProjectSafely();
    };

    minus.addEventListener("click", () => {
      updateCopies(photo.copies - 1);
    });

    plus.addEventListener("click", () => {
      updateCopies(photo.copies + 1);
    });

    copies.addEventListener("change", () => {
      updateCopies(numberValue(copies, 1));
    });

    controls.append(minus, copies, plus);
    info.append(name, copiesLabel, controls);
    item.append(image, info);

    elements.photoList.appendChild(item);
  });
}

/* ============================================
   8. PRESET HANDLING
============================================ */

function syncPresetFields() {
  const preset = PHOTO_PRESETS[elements.photoPreset.value];

  if (preset) {
    elements.photoWidth.value = preset.width;
    elements.photoHeight.value = preset.height;
  }
}

function syncPaperFields() {
  const preset = PAPER_PRESETS[elements.paperSize.value];

  elements.customPaperGroup.hidden = elements.paperSize.value !== "custom";

  if (preset) {
    elements.paperWidth.value = preset.width;
    elements.paperHeight.value = preset.height;
  }

  if (elements.previewPaperSize.value !== elements.paperSize.value) {
    elements.previewPaperSize.value = elements.paperSize.value;
  }
}

/* ============================================
   9. AUTOMATIC LAYOUT ENGINE
============================================ */

function calculateLayout() {
  const paper = getPaperDimensions();
  const photo = getPhotoDimensions();

  const margin = numberValue(elements.margin, 10);
  const spacing = numberValue(elements.spacing, 5);

  const maxPerRow = clamp(
    numberValue(elements.maxPerRow, 5),
    1,
    CONFIG.maxPerRow,
  );

  if (
    !isValidDimension(paper.width, 1000) ||
    !isValidDimension(paper.height, 1000)
  ) {
    throw new Error("Invalid paper dimensions.");
  }

  if (
    !isValidDimension(photo.width, 210) ||
    !isValidDimension(photo.height, 297)
  ) {
    throw new Error("Invalid photo dimensions.");
  }

  if (
    !Number.isFinite(margin) ||
    margin < 0 ||
    !Number.isFinite(spacing) ||
    spacing < 0
  ) {
    throw new Error("Margin and spacing cannot be negative.");
  }

  const availableWidth = paper.width - margin * 2;
  const availableHeight = paper.height - margin * 2;

  if (photo.width > availableWidth || photo.height > availableHeight) {
    throw new Error(
      "The selected photo is too large for the paper's printable area.",
    );
  }

  const possiblePerRow = Math.floor(
    (availableWidth + spacing) / (photo.width + spacing),
  );

  const columns = Math.min(maxPerRow, possiblePerRow);

  if (columns < 1) {
    throw new Error("No photo fits with the current margin and spacing.");
  }

  const rowsPerPage = Math.floor(
    (availableHeight + spacing) / (photo.height + spacing),
  );

  if (rowsPerPage < 1) {
    throw new Error("No photo fits vertically on this paper.");
  }

  const capacity = columns * rowsPerPage;
  const copies = totalCopies();

  if (copies > CONFIG.maxTotalCopies) {
    throw new Error(`Maximum ${CONFIG.maxTotalCopies} total copies allowed.`);
  }

  const pages = [];
  let page = [];
  let pageNumber = 0;

  for (const item of state.photos) {
    for (let copyIndex = 0; copyIndex < item.copies; copyIndex++) {
      const position = page.length;

      const row = Math.floor(position / columns);
      const column = position % columns;

      const photoLeft = margin + column * (photo.width + spacing);

      const photoTop = margin + row * (photo.height + spacing);

      page.push({
        id: item.id,
        name: item.name,
        dataUrl: item.dataUrl,

        x: photoLeft,
        y: photoTop,

        width: photo.width,
        height: photo.height,

        row,
        column,
        copyIndex,
      });

      if (page.length === capacity) {
        pages.push({
          number: pageNumber++,
          photos: page,
        });

        page = [];
      }
    }
  }

  if (page.length) {
    pages.push({
      number: pageNumber,
      photos: page,
    });
  }

  return {
    paper,
    photo,
    margin,
    spacing,
    columns,
    rowsPerPage,
    capacity,
    pages,
    total: copies,
  };
}

/* ============================================
   10. PAGE PREVIEW
============================================ */

function buildPageElement(layout, pageData) {
  const page = document.createElement("div");

  page.className = "print-page";
  page.dataset.pageNumber = pageData.number + 1;

  page.style.width = `${layout.paper.width}mm`;
  page.style.height = `${layout.paper.height}mm`;
  page.style.minHeight = `${layout.paper.height}mm`;

  page.style.position = "relative";
  page.style.flex = "none";
  page.style.padding = "0";
  page.style.boxSizing = "border-box";
  page.style.transform = `scale(${state.zoom})`;
  page.style.transformOrigin = "top center";

  for (const photo of pageData.photos) {
    const image = document.createElement("img");

    image.className = "preview-photo";
    image.src = photo.dataUrl;
    image.alt = photo.name;

    image.style.position = "absolute";
    image.style.left = `${photo.x}mm`;
    image.style.top = `${photo.y}mm`;
    image.style.width = `${photo.width}mm`;
    image.style.height = `${photo.height}mm`;

    image.style.maxWidth = "none";
    image.style.maxHeight = "none";
    image.style.objectFit = "fill";

    if (elements.showCutLines.checked) {
      image.classList.add("cut-guides");
    }

    image.draggable = false;

    page.appendChild(image);
  }

  return page;
}

function renderCurrentPage() {
  const pages = elements.previewViewport.querySelectorAll(".print-page");

  pages.forEach((page, index) => {
    page.style.display = index === state.currentPage ? "block" : "none";
  });

  if (state.pages.length) {
    const current = pages[state.currentPage];

    if (current) {
      const scaledWidth =
        ((state.pages[state.currentPage].paper.width * 96) / 25.4) * state.zoom;

      const scaledHeight =
        ((state.pages[state.currentPage].paper.height * 96) / 25.4) *
        state.zoom;

      current.style.marginBottom = "0";

      elements.previewViewport.style.minHeight = `${Math.min(scaledHeight + 36, 1200)}px`;

      elements.previewViewport.style.paddingTop = "18px";

      // Leave room for the scaled page without changing its print size.
      current.style.marginLeft = "auto";
      current.style.marginRight = "auto";

      current.style.transform = `scale(${state.zoom})`;

      current.style.marginBottom = `${scaledHeight * (1 / state.zoom - 1)}px`;

      current.style.transformOrigin = "top center";

      current.dataset.scaledWidth = scaledWidth;
    }
  }

  elements.pageIndicator.textContent = state.pages.length
    ? `Page ${state.currentPage + 1} of ${state.pages.length}`
    : "Page 0 of 0";

  elements.previousPageBtn.disabled = state.currentPage <= 0;

  elements.nextPageBtn.disabled = state.currentPage >= state.pages.length - 1;

  elements.zoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;
}

async function regeneratePreview() {
  if (state.rendering) return;

  state.rendering = true;

  try {
    const layout = calculateLayout();

    state.pages = layout.pages.map((page) => ({
      ...page,
      paper: layout.paper,
    }));

    state.currentPage = clamp(
      state.currentPage,
      0,
      Math.max(0, state.pages.length - 1),
    );

    // Replace the previous preview pages.
    elements.previewViewport.replaceChildren();

    if (!state.pages.length) {
      elements.previewViewport.appendChild(elements.previewEmptyState);

      elements.previewEmptyState.hidden = false;
      updateSummary(layout);

      return;
    }

    elements.previewEmptyState.hidden = true;

    state.pages.forEach((pageData) => {
      const pageElement = buildPageElement(layout, pageData);

      elements.previewViewport.appendChild(pageElement);
    });

    updateSummary(layout);
    renderCurrentPage();
  } catch (error) {
    state.pages = [];

    elements.previewViewport.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "preview-empty-state";

    const message = document.createElement("p");
    message.textContent = error.message;

    empty.appendChild(message);
    elements.previewViewport.appendChild(empty);

    elements.pageIndicator.textContent = "No preview";

    elements.previousPageBtn.disabled = true;
    elements.nextPageBtn.disabled = true;

    updateSummary({
      total: totalCopies(),
      pages: [],
      photo: getPhotoDimensions(),
      paper: getPaperDimensions(),
    });

    state.lastError = error.message;
  } finally {
    state.rendering = false;
  }
}

/* ============================================
   11. SUMMARY
============================================ */

function updateSummary(layout) {
  elements.summaryTotalPhotos.textContent = layout.total ?? totalCopies();

  elements.summaryPages.textContent = layout.pages?.length ?? 0;

  const photo = layout.photo || getPhotoDimensions();
  const paper = layout.paper || getPaperDimensions();

  elements.summaryPhotoSize.textContent = formatSize(photo.width, photo.height);

  elements.summaryPaperSize.textContent = `${paper.label} (${paper.width} × ${paper.height} mm)`;

  elements.summaryOrientation.textContent =
    paper.orientation === "landscape" ? "Landscape" : "Portrait";
}

/* ============================================
   12. PRINT STYLES
============================================ */

function setDynamicPrintStyle(paper) {
  let style = $("#dynamicPrintStyle");

  if (!style) {
    style = document.createElement("style");
    style.id = "dynamicPrintStyle";
    document.head.appendChild(style);
  }

  style.textContent = `
    @page {
      size: ${paper.width}mm ${paper.height}mm;
      margin: 0;
    }

    @media print {
      .print-page {
        width: ${paper.width}mm !important;
        height: ${paper.height}mm !important;
        min-height: ${paper.height}mm !important;
      }
    }
  `;
}

function prepareAllPagesForPrint() {
  const paper = getPaperDimensions();

  setDynamicPrintStyle(paper);

  const pages = elements.previewViewport.querySelectorAll(".print-page");

  pages.forEach((page) => {
    page.style.display = "block";
    page.style.transform = "none";
    page.style.margin = "0";
    page.style.width = `${paper.width}mm`;
    page.style.height = `${paper.height}mm`;
    page.style.minHeight = `${paper.height}mm`;
  });
}

function restorePreviewAfterPrint() {
  state.pages.forEach((_, index) => {
    const page = elements.previewViewport.querySelector(
      `[data-page-number="${index + 1}"]`,
    );

    if (page) {
      page.style.display = index === state.currentPage ? "block" : "none";

      page.style.transform = `scale(${state.zoom})`;
    }
  });

  renderCurrentPage();
}

function printDocument() {
  if (!state.pages.length) {
    showToast("Generate a valid preview first.", "warning");
    return;
  }

  prepareAllPagesForPrint();

  window.setTimeout(() => {
    window.print();
  }, 100);
}

window.addEventListener("afterprint", restorePreviewAfterPrint);

/* ============================================
   13. PDF EXPORT
============================================ */

async function downloadPDF() {
  if (!state.photos.length) {
    showToast("Upload at least one photo first.", "warning");
    return;
  }

  let layout;

  try {
    layout = calculateLayout();
  } catch (error) {
    showToast(error.message, "error");
    return;
  }

  if (!window.jspdf?.jsPDF) {
    showToast("jsPDF was not loaded. Check lib/jspdf.umd.min.js.", "error");

    return;
  }

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation:
      layout.paper.width > layout.paper.height ? "landscape" : "portrait",

    unit: "mm",

    format: [layout.paper.width, layout.paper.height],

    compress: true,
    putOnlyUsedFonts: true,
  });

  const imageCache = new Map();

  try {
    for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex++) {
      if (pageIndex > 0) {
        pdf.addPage(
          [layout.paper.width, layout.paper.height],
          layout.paper.width > layout.paper.height ? "landscape" : "portrait",
        );
      }

      const pageData = layout.pages[pageIndex];

      for (const photo of pageData.photos) {
        let format = imageCache.get(photo.id);

        if (!format) {
          format = photo.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";

          imageCache.set(photo.id, format);
        }

        pdf.addImage(
          photo.dataUrl,
          format,
          photo.x,
          photo.y,
          photo.width,
          photo.height,
          undefined,
          "FAST",
        );

        if (elements.showCutLines.checked) {
          pdf.setDrawColor(130, 130, 130);
          pdf.setLineWidth(0.1);

          pdf.setLineDash([0.5, 0.5], 0);

          pdf.rect(photo.x, photo.y, photo.width, photo.height);

          pdf.setLineDash([], 0);
        }
      }
    }

    const filename = `photo-print-${new Date().toISOString().slice(0, 10)}.pdf`;

    pdf.save(filename);

    showToast("PDF downloaded successfully.");
  } catch (error) {
    console.error(error);

    showToast("Could not generate PDF. Try fewer or smaller images.", "error");
  }
}

/* ============================================
   14. PROJECT SAVE / LOAD
============================================ */

async function persistProjectSafely() {
  saveSettingsLocally();

  if (!state.db) return;

  try {
    await saveProjectToDB();
  } catch (error) {
    console.warn("Project autosave failed:", error);

    showToast("Project could not be autosaved. Use Save Project.", "warning");
  }
}

async function saveProject() {
  const project = {
    version: 1,
    exportedAt: new Date().toISOString(),
    photos: state.photos.map((photo) => ({
      name: photo.name,
      dataUrl: photo.dataUrl,
      copies: photo.copies,
    })),
    settings: getSettings(),
  };

  const blob = new Blob([JSON.stringify(project)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "photo-print-project.json";
  anchor.click();

  URL.revokeObjectURL(url);

  await persistProjectSafely();

  showToast("Project saved.");
}

async function importProjectFile(file) {
  if (!file) return;

  try {
    if (file.size > 100 * 1024 * 1024) {
      throw new Error("Project file is too large.");
    }

    const text = await file.text();
    const project = JSON.parse(text);

    if (project.version !== 1 || !Array.isArray(project.photos)) {
      throw new Error("Invalid project file.");
    }

    const restored = [];

    for (const item of project.photos) {
      if (
        typeof item.dataUrl !== "string" ||
        !item.dataUrl.startsWith("data:image/")
      ) {
        throw new Error("Project contains an invalid image.");
      }

      const image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = item.dataUrl;
      });

      restored.push({
        id: makeId(),
        name: String(item.name || "Photo"),
        dataUrl: item.dataUrl,
        copies: clamp(
          Math.round(Number(item.copies) || 1),
          1,
          CONFIG.maxCopiesPerPhoto,
        ),
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    }

    if (restored.length > CONFIG.maxFiles) {
      throw new Error("Project contains too many photos.");
    }

    state.photos = restored;
    state.projectId = makeId();

    if (project.settings) {
      applySettings(project.settings);
    }

    renderThumbnails();
    renderPhotoList();

    await regeneratePreview();
    await persistProjectSafely();

    showToast("Project loaded successfully.");
  } catch (error) {
    showToast(error.message || "Could not load project.", "error");
  }
}

async function loadProject() {
  elements.projectFileInput.click();
}

/* ============================================
   15. CLEAR DATA
============================================ */

async function clearAllData() {
  const confirmed = window.confirm(
    "Clear all photos and project data from this app? This cannot be undone.",
  );

  if (!confirmed) return;

  state.photos = [];
  state.pages = [];
  state.currentPage = 0;
  state.projectId = "default";

  renderThumbnails();
  renderPhotoList();

  await regeneratePreview();

  try {
    localStorage.removeItem(CONFIG.settingsKey);

    if (state.db) {
      await deleteProjectFromDB("default");
    }
  } catch (error) {
    console.warn("Could not clear stored project:", error);
  }

  showToast("Current project cleared.");
}

/* ============================================
   16. EVENT LISTENERS
============================================ */

function bindEvents() {
  elements.photoInput.addEventListener("change", async (event) => {
    await addImages(event.target.files);

    // Allow selecting the same file again.
    event.target.value = "";
  });

  elements.addMorePhotosBtn.addEventListener("click", () => {
    elements.photoInput.click();
  });

  elements.uploadDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.uploadDropzone.classList.add("drag-over");
  });

  elements.uploadDropzone.addEventListener("dragleave", () => {
    elements.uploadDropzone.classList.remove("drag-over");
  });

  elements.uploadDropzone.addEventListener("drop", async (event) => {
    event.preventDefault();

    elements.uploadDropzone.classList.remove("drag-over");

    await addImages(event.dataTransfer?.files);
  });

  elements.photoPreset.addEventListener("change", async () => {
    syncPresetFields();
    saveSettingsLocally();
    await regeneratePreview();
  });

  elements.photoWidth.addEventListener("change", async () => {
    elements.photoPreset.value = "custom";
    saveSettingsLocally();
    await regeneratePreview();
  });

  elements.photoHeight.addEventListener("change", async () => {
    elements.photoPreset.value = "custom";
    saveSettingsLocally();
    await regeneratePreview();
  });

  elements.defaultCopies.addEventListener("change", async () => {
    const value = clamp(
      Math.round(numberValue(elements.defaultCopies, 4)),
      1,
      CONFIG.maxCopiesPerPhoto,
    );

    elements.defaultCopies.value = value;

    saveSettingsLocally();
  });

  elements.decreaseCopiesBtn.addEventListener("click", () => {
    elements.defaultCopies.value = clamp(
      numberValue(elements.defaultCopies, 4) - 1,
      1,
      CONFIG.maxCopiesPerPhoto,
    );
  });

  elements.increaseCopiesBtn.addEventListener("click", () => {
    elements.defaultCopies.value = clamp(
      numberValue(elements.defaultCopies, 4) + 1,
      1,
      CONFIG.maxCopiesPerPhoto,
    );
  });

  elements.paperSize.addEventListener("change", async () => {
    syncPaperFields();
    saveSettingsLocally();
    await regeneratePreview();
  });

  elements.previewPaperSize.addEventListener("change", async () => {
    elements.paperSize.value = elements.previewPaperSize.value;

    syncPaperFields();
    saveSettingsLocally();
    await regeneratePreview();
  });

  elements.paperWidth.addEventListener("change", async () => {
    saveSettingsLocally();
    await regeneratePreview();
  });

  elements.paperHeight.addEventListener("change", async () => {
    saveSettingsLocally();
    await regeneratePreview();
  });

  document.querySelectorAll('input[name="orientation"]').forEach((radio) => {
    radio.addEventListener("change", async () => {
      saveSettingsLocally();
      await regeneratePreview();
    });
  });

  [
    elements.margin,
    elements.spacing,
    elements.maxPerRow,
    elements.showCutLines,
  ].forEach((element) => {
    element.addEventListener("change", async () => {
      saveSettingsLocally();
      await regeneratePreview();
    });
  });

  elements.generatePreviewBtn.addEventListener("click", async () => {
    await regeneratePreview();
    showToast("Preview updated.");
  });

  elements.previousPageBtn.addEventListener("click", () => {
    state.currentPage = Math.max(0, state.currentPage - 1);
    renderCurrentPage();
  });

  elements.nextPageBtn.addEventListener("click", () => {
    state.currentPage = Math.min(state.pages.length - 1, state.currentPage + 1);

    renderCurrentPage();
  });

  elements.zoomInBtn.addEventListener("click", () => {
    state.zoom = clamp(state.zoom + 0.1, CONFIG.minZoom, CONFIG.maxZoom);

    renderCurrentPage();
  });

  elements.zoomOutBtn.addEventListener("click", () => {
    state.zoom = clamp(state.zoom - 0.1, CONFIG.minZoom, CONFIG.maxZoom);

    renderCurrentPage();
  });

  elements.downloadPdfBtn.addEventListener("click", downloadPDF);

  elements.printBtn.addEventListener("click", printDocument);

  elements.printPreviewBtn.addEventListener("click", () => {
    if (!state.pages.length) {
      showToast("Generate a preview first.", "warning");
      return;
    }

    elements.previewPanel?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    showToast("Use the preview to review your layout.");
  });

  elements.saveProjectBtn.addEventListener("click", saveProject);

  elements.loadProjectBtn.addEventListener("click", loadProject);

  elements.projectFileInput.addEventListener("change", async (event) => {
    await importProjectFile(event.target.files?.[0]);
    event.target.value = "";
  });

  elements.clearDataBtn.addEventListener("click", clearAllData);
}

/* ============================================
   17. INITIALIZATION
============================================ */

async function init() {
  try {
    loadSettingsLocally();

    try {
      await openDatabase();

      const savedProject = await loadProjectFromDB();

      if (savedProject) {
        state.photos = savedProject.photos.map((photo) => ({
          ...photo,
          width: 0,
          height: 0,
        }));

        // Recover actual image dimensions.
        for (const photo of state.photos) {
          const image = new Image();

          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = photo.dataUrl;
          });

          photo.width = image.naturalWidth;
          photo.height = image.naturalHeight;
        }

        if (savedProject.settings) {
          applySettings(savedProject.settings);
        }

        showToast("Saved project restored.");
      }
    } catch (error) {
      console.warn(
        "Local database unavailable; continuing without persistence.",
        error,
      );
    }

    renderThumbnails();
    renderPhotoList();

    bindEvents();

    state.ready = true;

    await regeneratePreview();
  } catch (error) {
    console.error("Initialization failed:", error);

    showToast("The app could not initialize correctly.", "error");
  }
}

document.addEventListener("DOMContentLoaded", init);
