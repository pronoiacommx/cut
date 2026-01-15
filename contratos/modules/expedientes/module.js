import { apiFetch, getApiBase } from "../../core/api.js";
import { $, toast, setStatus, setApiLabel } from "../../core/ui.js";

console.log("✅ CARGÓ modules/expedientes/module.js");

// ✅ Registrar para el router (tu router busca window.Modules.expedientes.init)
window.Modules = window.Modules || {};
window.Modules.expedientes = { init, destroy };

export async function init({ host }) {
  setApiLabel(getApiBase());

  const searchBox = $("#searchBox", host);
  const btnSearch = $("#btnSearch", host);
  const btnRecent = $("#btnRecent", host);
  const btnPrev = $("#btnPrev", host);
  const btnNext = $("#btnNext", host);

  const body = $("#tblExpBody", host);
  const pagerInfo = $("#pagerInfo", host);
  const pageBadge = $("#pageBadge", host);

  let curPage = 1;
  const pageSize = 20;
  let totalPages = 1;

  function fmtDate(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("es-MX"); }
    catch { return iso; }
  }

  function setEmpty(msg = "—") {
    body.innerHTML = `<tr><td colspan="6" class="small">${msg}</td></tr>`;
  }

  async function load(opts = {}) {
    const s = (opts.search ?? searchBox.value ?? "").trim();
    const page = opts.page ?? curPage;

    setStatus("Cargando...", "info");
    setEmpty("Cargando…");

    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const j = await apiFetch("/api/contracts?" + params.toString());

      curPage = j.page || page;
      totalPages = j.pages || 1;

      pageBadge.textContent = String(curPage);
      pagerInfo.textContent = `Total: ${j.total} • Páginas: ${j.pages} • Mostrando: ${j.items?.length || 0}`;

      const items = j.items || [];
      if (!items.length) {
        setEmpty("Sin resultados.");
        setStatus("Listo", "ok");
        return;
      }

      const api = getApiBase().replace(/\/$/, "");

      body.innerHTML = items.map(it => {
        const driveFolder = it.drive_folder_url
          ? `<a href="${it.drive_folder_url}" target="_blank" rel="noopener">Carpeta</a>`
          : `<span class="small">—</span>`;

        const drivePdf = it.drive_pdf_view_url
          ? `<a href="${it.drive_pdf_view_url}" target="_blank" rel="noopener">PDF</a>`
          : `<span class="small">—</span>`;

        const localPdf = it.local_pdf_url
          ? `<a href="${api + it.local_pdf_url}" target="_blank" rel="noopener">PDF local</a>`
          : `<span class="small">—</span>`;

        return `
          <tr>
            <td class="mono">${it.rfc || "—"}</td>
            <td>${it.nombre || "—"}</td>
            <td>${it.servicio_periodo || "—"}</td>
            <td>${it.servicio_materia || "—"}</td>
            <td>${fmtDate(it.created_at)}</td>
            <td class="actions">${drivePdf} ${driveFolder} ${localPdf}</td>
          </tr>
        `;
      }).join("");

      setStatus("Listo", "ok");
    } catch (e) {
      setEmpty("Error cargando: " + e.message);
      setStatus("Error", "err");
      toast("Expedientes: " + e.message, "err");
    }
  }

  btnSearch.addEventListener("click", () => { curPage = 1; load({ page: 1 }); });

  searchBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); curPage = 1; load({ page: 1 }); }
  });

  btnPrev.addEventListener("click", () => { if (curPage > 1) load({ page: curPage - 1 }); });

  btnNext.addEventListener("click", () => { if (curPage < totalPages) load({ page: curPage + 1 }); });

  btnRecent.addEventListener("click", async () => {
    setStatus("Cargando...", "info");
    setEmpty("Cargando recientes…");

    try {
      const j = await apiFetch("/api/contracts/recent?limit=30");
      const items = j.items || [];

      pagerInfo.textContent = `Recientes: ${items.length}`;
      pageBadge.textContent = "—";

      if (!items.length) {
        setEmpty("Sin recientes.");
        setStatus("Listo", "ok");
        return;
      }

      const api = getApiBase().replace(/\/$/, "");

      body.innerHTML = items.map(it => {
        const driveFolder = it.drive_folder_url
          ? `<a href="${it.drive_folder_url}" target="_blank" rel="noopener">Carpeta</a>`
          : `<span class="small">—</span>`;

        const drivePdf = it.drive_pdf_view_url
          ? `<a href="${it.drive_pdf_view_url}" target="_blank" rel="noopener">PDF</a>`
          : `<span class="small">—</span>`;

        const localPdf = it.local_pdf_url
          ? `<a href="${api + it.local_pdf_url}" target="_blank" rel="noopener">PDF local</a>`
          : `<span class="small">—</span>`;

        return `
          <tr>
            <td class="mono">${it.rfc || "—"}</td>
            <td>${it.nombre || "—"}</td>
            <td>${it.servicio_periodo || "—"}</td>
            <td>${it.servicio_materia || "—"}</td>
            <td>${fmtDate(it.created_at)}</td>
            <td class="actions">${drivePdf} ${driveFolder} ${localPdf}</td>
          </tr>
        `;
      }).join("");

      setStatus("Listo", "ok");
    } catch (e) {
      setEmpty("Error: " + e.message);
      setStatus("Error", "err");
      toast("Recientes: " + e.message, "err");
    }
  });

  await load({ page: 1 });
}

export async function destroy() {}
