export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function toast(message, type = 'ok') {
    asegurarComponentesUI();
    const statusLabel = document.getElementById('toastGlobal');
    if (!statusLabel) return;

    // 1. Guardar el estado original para volver después
    const originalText = "SISTEMA ONLINE";
    const originalColor = "#2e7d32"; // Verde estándar

    // 2. Aplicar el nuevo mensaje y color según el tipo
    statusLabel.textContent = (type === 'ok' ? '✅ ' : '❌ ') + message.toUpperCase();
    //statusLabel.style.color = (type === 'ok' ? '#fff' : '#fff');
    statusLabel.style.color = (type === 'ok' ? '#2e7d32' : '#d32f2f');
    statusLabel.style.padding = "2px 8px";
    statusLabel.style.borderRadius = "4px";

    // 3. Temporizador para regresar al estado inicial tras 4 segundos
    setTimeout(() => {
        statusLabel.textContent = originalText;
        statusLabel.style.background = "transparent"; // O el fondo que tenga tu sidemenu
        statusLabel.style.color = originalColor;
        statusLabel.style.padding = "0";
    }, 4000);
};
// core/ui.js

export function showConfirm(titulo, mensaje, icono = "❓") {
    asegurarComponentesUI(); // Nos asegura que el HTML esté inyectado
    const dialog = document.getElementById("confirmDialog");
    
    document.getElementById("confirmTitle").textContent = titulo;
    document.getElementById("confirmText").textContent = mensaje;
    document.getElementById("confirmIcon").textContent = icono;

    dialog.classList.remove("hidden");

    return new Promise((resolve) => {
        document.getElementById("btnConfirmOk").onclick = () => {
            dialog.classList.add("hidden");
            resolve(true);
        };
        document.getElementById("btnConfirmCancel").onclick = () => {
            dialog.classList.add("hidden");
            resolve(false);
        };
    });
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
function asegurarComponentesUI() {
    if (!document.getElementById("loader")) {
        const loaderHTML = `
            <div id="loader" class="loader hidden">
                <div class="loaderBox">
                    <div class="spinner"></div>
                    <div style="font-weight:900" id="loaderTitle">Procesando…</div>
                    <div class="small" id="loaderMsg">Por favor espera</div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', loaderHTML);
    }

    if (!document.getElementById("errorScreen")) {
        const errorHTML = `
            <div id="errorScreen" class="error-screen hidden">
                <div class="error-card">
                    <div id="errorIcon" class="error-icon">🚫</div>
                    <h2 id="errorTitle" class="error-title">Error</h2>
                    <p id="errorText" class="error-text"></p>
                    <div id="errorAction"></div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', errorHTML);
    }
    // ASEGURAR TOAST GLOBAL
    if (!document.getElementById("toastGlobal")) {
        const toastHTML = `
            <div id="toastGlobal" class="badge-status toast-hidden" 
                 style="position: fixed; bottom: 20px; right: 20px; z-index: 10001;">
            </div>`;
        document.body.insertAdjacentHTML('beforeend', toastHTML);
    }
    // 3. ASEGURAR CONFIRM DIALOG (Lo que faltaba)
    if (!document.getElementById("confirmDialog")) {
        const confirmHTML = `
            <div id="confirmDialog" class="error-screen hidden" style="z-index: 20002;">
              <div class="error-card" style="border-top: 5px solid #0288d1;">
                <div id="confirmIcon" class="error-icon" style="font-size: 3rem; margin-bottom: 15px; text-align:center;">📧</div>
                <h2 id="confirmTitle" class="error-title" style="text-align:center;">¿Estás seguro?</h2>
                <p id="confirmText" class="error-text" style="text-align:center;">Esta acción enviará un correo electrónico.</p>
                <div id="confirmActions" style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                  <button id="btnConfirmCancel" class="btn btnGhost">Cancelar</button>
                  <button id="btnConfirmOk" class="btn btnPrimary">Confirmar</button>
                </div>
              </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', confirmHTML);
    }
}
export function showLoader(title, msg) {
    asegurarComponentesUI(); // <--- La clave está aquí
    const l = document.getElementById("loader");
    document.getElementById("loaderTitle").textContent = title;
    document.getElementById("loaderMsg").textContent = msg;
    // Aseguramos que esté limpio de clases de salida
    l.classList.remove("hidden", "fade-out");
}

export function showErrorPopup(titulo, mensaje, icono = "🚫") {
    asegurarComponentesUI(); // <--- Y aquí
    const screen = document.getElementById("errorScreen");
    document.getElementById("errorTitle").textContent = titulo;
    document.getElementById("errorText").innerHTML = mensaje;
    document.getElementById("errorIcon").textContent = icono;
    
    // Botón por defecto
    document.getElementById("errorAction").innerHTML = `
        <button onclick="document.getElementById('errorScreen').classList.add('hidden')" class="btn-primary">
            Entendido
        </button>`;
        
    screen.classList.remove("hidden");
}
// core/ui.js

export function hideLoader() {
  asegurarComponentesUI(); // <--- La clave está aquí
  //stopFakeProgress();
  //setProgress(100);
  const l = document.getElementById("loader");
  if (!l) return;
  // 1. Iniciamos la transición suave
    l.classList.add("fade-out");
  setTimeout(() => {// 1. Iniciamos la transición suave
    // Solo lo ponemos en hidden si sigue en modo fade-out
        if (l.classList.contains("fade-out")) {
            l.classList.add("hidden");
        }
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
