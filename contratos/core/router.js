// router.js
import { setStatus } from "./ui.js";

const UI_BASE = "/ui/";

const ROUTES = {
  contratos:   { module: "contratos",   view: "modules/contratos/view.html" },
  expedientes: { module: "expedientes", view: "modules/expedientes/view.html" },
  catalogos:   { module: "catalogos",   view: "modules/catalogos/view.html" },
  config:      { module: "config",      view: "modules/config/view.html" },
};

export function getRouteIdFromHash() {
  const h = (location.hash || "").replace("#", "").trim();
  return h || "contratos";
}

export async function navigate(routeId, ctx) {
  const def = ROUTES[routeId] || ROUTES.contratos;

  const viewHostEl = document.getElementById("viewHost");
  if (!viewHostEl) {
    console.error("No existe #viewHost en el HTML principal.");
    return;
  }

  try {
    setStatus("Cargando...", "info");

    // 1) Cargar vista HTML
    const viewUrl = UI_BASE + def.view;
    const r = await fetch(viewUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`No pude cargar vista (${r.status}): ${viewUrl}`);
    const html = await r.text();

    // 2) Inyectar vista
    viewHostEl.innerHTML = html;

    // 3) nav activo
    document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(`.navBtn[data-route="${routeId}"]`).forEach(b => b.classList.add("active"));

    // 4) CSS
    await ensureModuleCss(def.module);

    // 5) JS
    await ensureModuleJs(def.module);

    // 6) init
    const mod = window.Modules?.[def.module];
    if (!mod?.init) {
      console.warn("❌ No existe window.Modules." + def.module + ".init");
      return;
    }

    // ✅ IMPORTANTE: lo pasamos como {host: viewHostEl}
    await mod.init({ host: viewHostEl, ctx });

    setStatus("Listo", "ok");
  } catch (e) {
    console.error(e);
    viewHostEl.innerHTML = `
      <div class="card">
        <div class="cardHd"><h2>Error</h2></div>
        <div class="cardBd">
          <div class="hint">${escapeHtml(String(e.message || e))}</div>
          <div class="small">Revisa rutas /ui/modules/... y consola.</div>
        </div>
      </div>
    `;
    setStatus("Error", "err");
  }
}

async function ensureModuleCss(moduleName) {
  const id = `mod-css-${moduleName}`;
  if (document.getElementById(id)) return;

  const href = `${UI_BASE}modules/${moduleName}/module.css`;
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => { link.remove(); resolve(); };
    document.head.appendChild(link);
  });
}

async function ensureModuleJs(moduleName) {
  const id = `mod-js-${moduleName}`;
  if (document.getElementById(id)) return;

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = id;
    s.type = "module";
    s.src = `${UI_BASE}modules/${moduleName}/module.js?v=${Date.now()}`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No pude cargar module.js: ${s.src}`));
    document.head.appendChild(s);
  });
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
