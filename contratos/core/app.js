import { getApiBase } from "./api.js";
import { setApiLabel, setStatus } from "./ui.js";
import { getRouteIdFromHash, navigate } from "./router.js";

const ctx = {
  apiBase: getApiBase,
};

function wireSidebar() {
  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const r = btn.dataset.route;
      location.hash = r; // esto dispara el router
    });
  });
}

async function boot() {
  wireSidebar();

  // label API
  setApiLabel(getApiBase());

  window.addEventListener("hashchange", async () => {
    setApiLabel(getApiBase());
    const routeId = getRouteIdFromHash();
    await navigate(routeId, ctx);
  });

  setStatus("Listo", "ok");

  // carga inicial
  const routeId = getRouteIdFromHash();
  await navigate(routeId, ctx);
}

boot();
