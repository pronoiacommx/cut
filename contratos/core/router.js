// core/router.js
import { setStatus } from "./ui.js";

const UI_BASE = "./";

// Configuración de rutas (Mapeo de ID a archivos)
const ROUTES = {
  login:           { module: "login",           view: "modules/login/view.html" },
  //contratos:       { module: "contratos",       view: "modules/contratos/view.html" },
  expedientes:     { module: "expedientes",     view: "modules/expedientes/view.html" },
  catalogos:       { module: "catalogos",       view: "modules/catalogos/view.html" },
  config:          { module: "config",          view: "modules/config/view.html" },
  //aspirantes:      { module: "aspirantes",      view: "modules/aspirantes/view.html" },
  empleados: { module: "empleados", view: "modules/empleados/view.html"},
  constancias: { module: "constancias", view: "modules/constancias/view.html"
  },
};

/**
 * Función principal de navegación
 * Carga el HTML, CSS y JS del módulo y lo inicializa
 */
export async function navigate(routeId, ctx) {
  const def = ROUTES[routeId];
  
  if (!def) {
    console.error(`La ruta "${routeId}" no está definida en ROUTES.`);
    return;
  }

  const viewHostEl = document.getElementById("viewHost");
  if (!viewHostEl) {
    console.error("No existe #viewHost en el HTML principal.");
    return;
  }

  try {
    setStatus("Cargando...", "info");

    // 1) Cargar vista HTML del módulo
    const viewUrl = UI_BASE + def.view;
    const r = await fetch(viewUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`No pude cargar vista (${r.status}): ${viewUrl}`);
    const html = await r.text();

    // 2) Inyectar HTML y aplicar clase de animación
    viewHostEl.innerHTML = html;
    viewHostEl.className = "stack active-view"; // Reinicia animación

    // 3) Actualizar estado visual de los botones del menú lateral
    updateNavUI(routeId);

    // 4) Cargar CSS del módulo de forma dinámica
    await ensureModuleCss(def.module);

    // 5) Cargar JS del módulo de forma dinámica
    await ensureModuleJs(def.module);

    // 6) Ejecutar el método init del módulo cargado
    const mod = window.Modules?.[def.module];
    if (!mod?.init) {
      console.warn(`❌ El módulo "${def.module}" no tiene un método init definido.`);
    } else {
      await mod.init({ host: viewHostEl, ctx });
    }

    setStatus("Sistema Listo", "ok");
    
    // Sincronizar el Hash de la URL sin recargar
    if (location.hash !== `#${routeId}`) {
        history.pushState(null, "", `#${routeId}`);
    }

  } catch (e) {
    console.error("Error en navegación:", e);
    viewHostEl.innerHTML = `
      <div class="card p-4">
        <h2 class="text-danger">Error de Carga</h2>
        <p class="hint">${escapeHtml(String(e.message || e))}</p>
        <small class="text-muted">Verifica la consola para más detalles.</small>
      </div>
    `;
    setStatus("Error", "err");
  }
}

/**
 * Actualiza la clase 'active' en los botones de navegación
 */
function updateNavUI(routeId) {
    document.querySelectorAll(".navBtn").forEach(b => {
        b.classList.remove("active");
        if (b.dataset.route === routeId) {
            b.classList.add("active");
        }
    });
}

/**
 * Vincula los eventos de clic a los botones del menú lateral
 * Se llama cada vez que el menú se renderiza dinámicamente
 */
export function bindNavEvents() {
    const botones = document.querySelectorAll(".navBtn");
    botones.forEach(btn => {
        // Clonar para eliminar listeners previos y evitar ejecuciones dobles
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener("click", () => {
            const route = newBtn.dataset.route;
            if (route) navigate(route);
        });
    });
}

/**
 * Carga dinámica de CSS
 */
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

/**
 * Carga dinámica de JS (Módulos)
 */
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

/**
 * Helper para limpiar el Hash
 */
export function getRouteIdFromHash() {
  const h = (location.hash || "").replace("#", "").trim();
  return h || "login";
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}