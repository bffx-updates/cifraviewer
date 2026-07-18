"use strict";

// ---------- Estado ----------
let images = [];        // [{ name, url }]
let current = 0;
let wakeLock = null;
let listeningFor = null; // "next" | "prev" | null

const DEFAULT_KEYS = { next: "ArrowRight", prev: "ArrowLeft" };

const settings = {
  keyNext: localStorage.getItem("keyNext") || DEFAULT_KEYS.next,
  keyPrev: localStorage.getItem("keyPrev") || DEFAULT_KEYS.prev,
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
const keyNextBtn = $("keyNext");
const keyPrevBtn = $("keyPrev");
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
});

// ---------- Toque: laterais navegam, centro mostra/esconde a barra ----------
$("tapNext").addEventListener("click", next);
$("tapPrev").addEventListener("click", prev);
cifraImg.addEventListener("click", () => topbar.classList.toggle("topbar-hidden"));

// Gesto de arrastar (swipe)
let touchX = null;
viewer.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
viewer.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 60) (dx < 0 ? next() : prev());
}, { passive: true });

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
$("btnBack").addEventListener("click", () => {
  viewer.classList.add("hidden");
  home.classList.remove("hidden");
  releaseWakeLock();
});

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
  stopListening();
});

keyNextBtn.addEventListener("click", () => startListening("next"));
keyPrevBtn.addEventListener("click", () => startListening("prev"));

wakeLockToggle.addEventListener("change", () => {
  settings.wakeLock = wakeLockToggle.checked;
  localStorage.setItem("wakeLock", settings.wakeLock ? "on" : "off");
  settings.wakeLock ? requestWakeLock() : releaseWakeLock();
});

function startListening(which) {
  stopListening();
  listeningFor = which;
  const btn = which === "next" ? keyNextBtn : keyPrevBtn;
  btn.classList.add("listening");
  btn.textContent = "Pressione...";
}

function stopListening() {
  listeningFor = null;
  keyNextBtn.classList.remove("listening");
  keyPrevBtn.classList.remove("listening");
  renderKeys();
}

function setKey(which, key) {
  if (which === "next") {
    settings.keyNext = key;
    localStorage.setItem("keyNext", key);
  } else {
    settings.keyPrev = key;
    localStorage.setItem("keyPrev", key);
  }
  renderKeys();
}

const KEY_LABELS = {
  "ArrowRight": "→", "ArrowLeft": "←", "ArrowUp": "↑", "ArrowDown": "↓",
  " ": "Espaço", "Enter": "Enter", "PageDown": "PgDn", "PageUp": "PgUp",
};

function keyLabel(k) {
  return KEY_LABELS[k] || (k.length === 1 ? k.toUpperCase() : k);
}

function renderKeys() {
  keyNextBtn.textContent = keyLabel(settings.keyNext);
  keyPrevBtn.textContent = keyLabel(settings.keyPrev);
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
