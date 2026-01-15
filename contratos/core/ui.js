export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function toast(msg, kind = "info") {
  const el = document.getElementById("toastGlobal");
  if (!el) return;

  el.textContent = msg || "";
  el.classList.add("show");
  el.style.borderColor =
    kind === "ok"  ? "rgba(46,125,50,.45)" :
    kind === "err" ? "rgba(229,57,53,.55)" :
                     "rgba(18,21,33,.12)";

  clearTimeout(window.__cutToastTimer);
  window.__cutToastTimer = setTimeout(() => el.classList.remove("show"), 5200);
}

export function setStatus(text, kind = "info") {
  const b = document.getElementById("statusBadge");
  if (!b) return;

  b.textContent = text;
  b.style.borderColor =
    kind === "ok"  ? "rgba(46,125,50,.45)" :
    kind === "err" ? "rgba(229,57,53,.55)" :
                     "rgba(18,21,33,.12)";

  b.style.color =
    kind === "ok"  ? "#2e7d32" :
    kind === "err" ? "#b00020" :
                     "#5f667a";
}

/* Loader con progreso “fake” */
let progTimer = null;
let progValue = 0;

function setProgress(v) {
  progValue = Math.max(0, Math.min(100, v));
  const bar = document.getElementById("progressBar");
  const txt = document.getElementById("progressText");
  if (bar) bar.style.width = progValue + "%";
  if (txt) txt.textContent = Math.round(progValue) + "%";
}

function startFakeProgress() {
  stopFakeProgress();
  setProgress(2);
  progTimer = setInterval(() => {
    if (progValue < 60) setProgress(progValue + (2 + Math.random() * 4));
    else if (progValue < 92) setProgress(progValue + (0.4 + Math.random() * 1.2));
    else setProgress(Math.min(92, progValue + 0.1));
  }, 350);
}

function stopFakeProgress() {
  if (progTimer) { clearInterval(progTimer); progTimer = null; }
}

export function showLoader(title = "Procesando…", msg = "Por favor espera") {
  const l = document.getElementById("loader");
  if (!l) return;
  const t = document.getElementById("loaderTitle");
  const m = document.getElementById("loaderMsg");
  if (t) t.textContent = title;
  if (m) m.textContent = msg;
  l.classList.remove("hidden");
  startFakeProgress();
}

export function hideLoader() {
  stopFakeProgress();
  setProgress(100);
  const l = document.getElementById("loader");
  if (!l) return;
  setTimeout(() => {
    l.classList.add("hidden");
    setProgress(0);
  }, 350);
}

/* CSS loader por módulo */
export function ensureModuleCss(id, href) {
  const key = `cut-css-${id}`;
  if (document.getElementById(key)) return;

  const link = document.createElement("link");
  link.id = key;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function setApiLabel(text) {
  const el = document.getElementById("apiBaseLabel");
  if (el) el.textContent = text;
}
