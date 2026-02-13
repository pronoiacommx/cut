import { getApiBase, setApiBase, apiFetch } from "../../core/api.js";
import { $, toast, setStatus, setApiLabel } from "../../core/ui.js";


console.log("✅ CARGÓ modules/config/module.js");


// ✅ Registrar para el router (tu router busca window.Modules.catalogos.init)
window.Modules = window.Modules || {};
window.Modules.catalogos = { init, destroy };

export async function init({ host }) {
      if (!host) throw new Error("catalogos.init recibió host=undefined. Router debe llamar init({ host: viewHostEl, ctx })");

  const input = $("#apiBaseInput", host);
  const btnSave = $("#btnSaveCfg", host);
  const btnTest = $("#btnTestCfg", host);

  input.value = getApiBase();
  setApiLabel(getApiBase());

  btnSave.addEventListener("click", () => {
    const v = setApiBase(input.value);
    setApiLabel(v);
    toast("Configuración guardada.", "ok");
  });

  btnTest.addEventListener("click", async () => {
    try {
      setStatus("Probando...", "info");
      const j = await apiFetch("/health");
      setStatus("API OK", "ok");
      toast("API OK ✅ " + JSON.stringify(j), "ok");
    } catch (e) {
      setStatus("API error", "err");
      toast("API error: " + e.message, "err");
    }
  });
}

export async function destroy() {}
