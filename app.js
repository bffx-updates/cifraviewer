"use strict";

// ---------- Estado ----------
let images = [];        // [{ name, url }]
let current = 0;
let wakeLock = null;
let listeningFor = null; // "next" | "prev" | "home" | null

const DEFAULT_KEYS = { next: "ArrowRight", prev: "ArrowLeft", home: "Escape" };

const settings = {
  keyNext: localStorage.getItem("keyNext") || DEFAULT_KEYS.next,
  keyPrev: localStorage.getItem("keyPrev") || DEFAULT_KEYS.prev,
  keyHome: localStorage.getItem("keyHome") || DEFAULT_KEYS.home,
  wakeLock: localStorage.getItem("wakeLock") !== "off",
};

// ---------- Elementos ----------
const $ = (id) => document.getElementById(id);
const home = $("home");
const viewer = $("viewer");
const cifraImg = $("cifraImg");
const topbar = $("topbar");
const counter = $("counter");
const fileName = $("fileName");
const settingsModal = $("settings");
const keyBtns = { next: $("keyNext"), prev: $("keyPrev"), home: $("keyHome") };
const wakeLockToggle = $("wakeLockToggle");

// ---------- Abrir arquivos ----------
$("filePicker").addEventListener("change", (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return;

  images.forEach((img) => URL.revokeObjectURL(img.url));
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  images = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
  current = 0;

  home.classList.add("hidden");
  viewer.classList.remove("hidden");
  show(current);
  requestWakeLock();
  e.target.value = "";
});

function show(i) {
  current = Math.max(0, Math.min(i, images.length - 1));
  const img = images[current];
  resetZoom();
  cifraImg.src = img.url;
  counter.textContent = `${current + 1} / ${images.length}`;
  fileName.textContent = img.name;
  preload(current + 1);
  preload(current - 1);
}

function preload(i) {
  if (i < 0 || i >= images.length) return;
  const im = new Image();
  im.src = images[i].url;
}

const next = () => { if (current < images.length - 1) show(current + 1); };
const prev = () => { if (current > 0) show(current - 1); };

function goHome() {
  viewer.classList.add("hidden");
  home.classList.remove("hidden");
  resetZoom();
  releaseWakeLock();
}

// ---------- Zoom ----------
let scale = 1, tx = 0, ty = 0;
const MAX_SCALE = 5;

function applyTransform() {
  cifraImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  viewer.classList.toggle("zoomed", scale > 1.01);
}

function resetZoom() {
  scale = 1; tx = 0; ty = 0;
  applyTransform();
}

function clampPan() {
  const maxX = (scale - 1) * viewer.clientWidth / 2;
  const maxY = (scale - 1) * viewer.clientHeight / 2;
  tx = Math.min(maxX, Math.max(-maxX, tx));
  ty = Math.min(maxY, Math.max(-maxY, ty));
}

// Ajusta a escala mantendo o ponto (px, py) da tela fixo na imagem
function zoomAt(px, py, newScale) {
  newScale = Math.min(MAX_SCALE, Math.max(1, newScale));
  const vx = px - viewer.clientWidth / 2;
  const vy = py - viewer.clientHeight / 2;
  const r = newScale / scale;
  tx = vx - r * (vx - tx);
  ty = vy - r * (vy - ty);
  scale = newScale;
  if (scale <= 1.01) { scale = 1; tx = 0; ty = 0; }
  clampPan();
  applyTransform();
}

// ---------- Teclado (teclas configuráveis / pedal Bluetooth) ----------
document.addEventListener("keydown", (e) => {
  // Captura de tecla nas configurações
  if (listeningFor) {
    e.preventDefault();
    const invalid = ["Escape", "Shift", "Control", "Alt", "Meta", ""];
    if (e.key && !invalid.includes(e.key)) {
      setKey(listeningFor, e.key);
      stopListening();
    } else if (e.key === "Escape") {
      stopListening();
    }
    return;
  }

  if (!settingsModal.classList.contains("hidden")) return;
  if (viewer.classList.contains("hidden")) return;

  if (e.key === settings.keyNext) { e.preventDefault(); next(); }
  else if (e.key === settings.keyPrev) { e.preventDefault(); prev(); }
  else if (e.key === settings.keyHome) { e.preventDefault(); goHome(); }
});

// ---------- Toque: pinça = zoom, arrastar = mover/navegar, toque = zonas ----------
let touch = null;
let lastTap = 0;
let tapTimer = null;

viewer.addEventListener("touchstart", (e) => {
  if (e.target.closest(".topbar")) return;
  if (e.touches.length === 2) {
    e.preventDefault();
    if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
    const [a, b] = e.touches;
    touch = {
      pinch: true,
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      midX: (a.clientX + b.clientX) / 2,
      midY: (a.clientY + b.clientY) / 2,
      scale, tx, ty,
    };
  } else if (e.touches.length === 1) {
    const t = e.touches[0];
    touch = { pinch: false, x: t.clientX, y: t.clientY, tx, ty, time: Date.now() };
  }
}, { passive: false });

viewer.addEventListener("touchmove", (e) => {
  if (!touch) return;
  if (touch.pinch && e.touches.length === 2) {
    e.preventDefault();
    const [a, b] = e.touches;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const midX = (a.clientX + b.clientX) / 2;
    const midY = (a.clientY + b.clientY) / 2;
    const newScale = Math.min(MAX_SCALE, Math.max(1, touch.scale * dist / touch.dist));
    const cx = viewer.clientWidth / 2, cy = viewer.clientHeight / 2;
    const r = newScale / touch.scale;
    tx = (midX - cx) - r * ((touch.midX - cx) - touch.tx);
    ty = (midY - cy) - r * ((touch.midY - cy) - touch.ty);
    scale = newScale;
    clampPan();
    applyTransform();
  } else if (!touch.pinch && e.touches.length === 1 && scale > 1) {
    e.preventDefault();
    const t = e.touches[0];
    tx = touch.tx + (t.clientX - touch.x);
    ty = touch.ty + (t.clientY - touch.y);
    clampPan();
    applyTransform();
  }
}, { passive: false });

viewer.addEventListener("touchend", (e) => {
  if (!touch) return;
  if (touch.pinch) {
    if (e.touches.length < 2) {
      if (scale <= 1.01) resetZoom();
      touch = null;
    }
    return;
  }

  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x;
  const dy = t.clientY - touch.y;
  const dt = Date.now() - touch.time;
  touch = null;
  e.preventDefault(); // evita o "click" sintético duplicado no iOS

  if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 350) {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Duplo toque: alterna o zoom
      lastTap = 0;
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
      zoomAt(t.clientX, t.clientY, scale > 1 ? 1 : 2.5);
    } else {
      lastTap = now;
      const x = t.clientX;
      tapTimer = setTimeout(() => { tapTimer = null; handleTap(x); }, 300);
    }
  } else if (scale === 1 && Math.abs(dx) > 60 && Math.abs(dy) < 80) {
    (dx < 0 ? next() : prev());
  }
}, { passive: false });

function handleTap(x) {
  const w = viewer.clientWidth;
  if (scale === 1 && x < w * 0.22) prev();
  else if (scale === 1 && x > w * 0.78) next();
  else topbar.classList.toggle("topbar-hidden");
}

// ---------- Mouse (desktop): zonas de clique, roda = zoom, arrastar = mover ----------
$("tapNext").addEventListener("click", next);
$("tapPrev").addEventListener("click", prev);

let suppressClick = false;
cifraImg.addEventListener("click", () => {
  if (suppressClick) { suppressClick = false; return; }
  topbar.classList.toggle("topbar-hidden");
});

viewer.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  zoomAt(e.clientX, e.clientY, scale * factor);
}, { passive: false });

let mouseDrag = null;
viewer.addEventListener("mousedown", (e) => {
  if (scale > 1 && !e.target.closest(".topbar")) {
    e.preventDefault();
    mouseDrag = { x: e.clientX, y: e.clientY, tx, ty };
  }
});
window.addEventListener("mousemove", (e) => {
  if (!mouseDrag) return;
  const dx = e.clientX - mouseDrag.x, dy = e.clientY - mouseDrag.y;
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) suppressClick = true;
  tx = mouseDrag.tx + dx;
  ty = mouseDrag.ty + dy;
  clampPan();
  applyTransform();
});
window.addEventListener("mouseup", () => { mouseDrag = null; });

// ---------- Tela cheia ----------
$("btnFullscreen").addEventListener("click", () => {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else if (el.requestFullscreen) {
    el.requestFullscreen();
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  }
});

// ---------- Voltar ----------
$("btnBack").addEventListener("click", goHome);

// ---------- Configurações ----------
function openSettings() {
  renderKeys();
  wakeLockToggle.checked = settings.wakeLock;
  settingsModal.classList.remove("hidden");
}

$("btnSettings").addEventListener("click", openSettings);
$("btnSettingsHome").addEventListener("click", openSettings);

$("btnCloseSettings").addEventListener("click", () => {
  stopListening();
  settingsModal.classList.add("hidden");
});

$("btnResetKeys").addEventListener("click", () => {
  setKey("next", DEFAULT_KEYS.next);
  setKey("prev", DEFAULT_KEYS.prev);
  setKey("home", DEFAULT_KEYS.home);
  stopListening();
});

for (const which of Object.keys(keyBtns)) {
  keyBtns[which].addEventListener("click", () => startListening(which));
}

wakeLockToggle.addEventListener("change", () => {
  settings.wakeLock = wakeLockToggle.checked;
  localStorage.setItem("wakeLock", settings.wakeLock ? "on" : "off");
  settings.wakeLock ? requestWakeLock() : releaseWakeLock();
});

function startListening(which) {
  stopListening();
  listeningFor = which;
  keyBtns[which].classList.add("listening");
  keyBtns[which].textContent = "Pressione...";
}

function stopListening() {
  listeningFor = null;
  for (const btn of Object.values(keyBtns)) btn.classList.remove("listening");
  renderKeys();
}

const STORAGE_KEYS = { next: "keyNext", prev: "keyPrev", home: "keyHome" };

function setKey(which, key) {
  settings[STORAGE_KEYS[which]] = key;
  localStorage.setItem(STORAGE_KEYS[which], key);
  renderKeys();
}

const KEY_LABELS = {
  "ArrowRight": "→", "ArrowLeft": "←", "ArrowUp": "↑", "ArrowDown": "↓",
  " ": "Espaço", "Enter": "Enter", "PageDown": "PgDn", "PageUp": "PgUp",
  "Escape": "Esc", "Backspace": "⌫",
};

function keyLabel(k) {
  return KEY_LABELS[k] || (k.length === 1 ? k.toUpperCase() : k);
}

function renderKeys() {
  keyBtns.next.textContent = keyLabel(settings.keyNext);
  keyBtns.prev.textContent = keyLabel(settings.keyPrev);
  keyBtns.home.textContent = keyLabel(settings.keyHome);
}

// ---------- Wake Lock (manter tela ligada) ----------
async function requestWakeLock() {
  if (!settings.wakeLock || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch { /* ignorado: bateria baixa ou não suportado */ }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !viewer.classList.contains("hidden")) {
    requestWakeLock();
  }
});

// ---------- Init ----------
renderKeys();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
