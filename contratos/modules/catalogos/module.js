import { apiFetch, getApiBase } from "../../core/api.js";
import { $, toast, setStatus, setApiLabel } from "../../core/ui.js";

console.log("✅ CARGÓ modules/catalogos/module.js");

// ✅ Registrar para el router (tu router busca window.Modules.catalogos.init)
window.Modules = window.Modules || {};
window.Modules.catalogos = { init, destroy };

export async function init({ host }) {
    if (!host) throw new Error("catalogos.init recibió host=undefined. Router debe llamar init({ host: viewHostEl, ctx })");

  // root = contenedor de la vista inyectada (lo manda router.js)
  setApiLabel(getApiBase());

  let catType = "carreras";
  let catPage = 1;
  const catPageSize = 20;
  let catTotalPages = 1;

  // ===== elementos dentro de la VISTA (usar root) =====
  const catBody = $("#catBody", host);
  const catInfo = $("#catInfo", host);
  const catPageEl = $("#catPage", host);
  const catBadge = $("#catBadge", host);

  const catSearch = $("#catSearch", host);
  const btnCatSearch = $("#btnCatSearch", host);
  const btnCatNew = $("#btnCatNew", host);

  const catPrev = $("#catPrev", host);
  const catNext = $("#catNext", host);

  // ===== MODAL (normalmente está GLOBAL en index.html, usar document) =====
  const modal = document.getElementById("catModal");
  const modalTitle = document.getElementById("catModalTitle");
  const modalClose = document.getElementById("catModalClose");
  const catName = document.getElementById("catName");
  const catActive = document.getElementById("catActive");
  const catId = document.getElementById("catId");
  const catSave = document.getElementById("catSave");
  const catDelete = document.getElementById("catDelete");
  const toastCatModal = document.getElementById("toastCatModal");

  // Guardas mínimas (para que si falta algo, lo veas en consola)
  console.log("catalogos init:", {
    host: !!host,
    btnCatNew: !!btnCatNew,
    modal: !!modal,
    catBody: !!catBody
  });

  function catEndpoint() {
    return `/api/catalogos/${catType}`;
  }

  function setCatEmpty(msg = "—") {
    catBody.innerHTML = `<tr><td colspan="4" class="small">${msg}</td></tr>`;
  }

  function openModal(mode = "new", item = null) {
    if (!modal) {
      toast("No existe el modal #catModal en el HTML global.", "err");
      return;
    }
    modal.classList.remove("hidden");
    modal.dataset.mode = mode;

    if (modalTitle) modalTitle.textContent = mode === "edit" ? `Editar • ${catType}` : `Nuevo • ${catType}`;
    if (catId) catId.value = item?.id ?? "";
    if (catName) catName.value = item?.name ?? "";
    if (catActive) catActive.value = String(item?.is_active ?? 1);

    if (catDelete) catDelete.style.display = (mode === "edit") ? "inline-flex" : "none";
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    if (toastCatModal) { toastCatModal.textContent = ""; toastCatModal.classList.remove("show"); }
  }

  // Modal events (si existe)
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Tabs (en vista)
  host.querySelectorAll(".catTab").forEach(btn => {
    btn.addEventListener("click", () => {
      host.querySelectorAll(".catTab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      catType = btn.dataset.cat;
      catPage = 1;
      catBadge.textContent = catType;
      load({ page: 1 });
    });
  });

  // ✅ Botón nuevo
  btnCatNew.addEventListener("click", () => openModal("new"));

  // Buscar
  btnCatSearch.addEventListener("click", () => { catPage = 1; load({ page: 1 }); });
  catSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); catPage = 1; load({ page: 1 }); }
  });

  // Pager
  catPrev.addEventListener("click", () => { if (catPage > 1) load({ page: catPage - 1 }); });
  catNext.addEventListener("click", () => { if (catPage < catTotalPages) load({ page: catPage + 1 }); });

  // Guardar (modal)
  if (catSave) catSave.addEventListener("click", async () => {
    const mode = modal?.dataset.mode || "new";
    const id = catId?.value ? Number(catId.value) : null;
    const name = (catName?.value || "").trim();
    const is_active = Number(catActive?.value || "1");

    if (!name) {
      toast("El nombre es obligatorio.", "err");
      return;
    }

    try {
      setStatus("Guardando...", "info");

      const url = mode === "edit" ? `${catEndpoint()}/${id}` : catEndpoint();
      const method = mode === "edit" ? "PUT" : "POST";

      await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, is_active })
      });

      toast("Guardado ✅", "ok");
      closeModal();
      await load({ page: catPage });
      setStatus("Listo", "ok");
    } catch (e) {
      setStatus("Error", "err");
      toast(e.message, "err");
    }
  });

  // Inactivar (DELETE soft)
  if (catDelete) catDelete.addEventListener("click", async () => {
    const id = catId?.value ? Number(catId.value) : null;
    if (!id) return;

    if (!confirm("¿Inactivar este registro? (No se borra, solo queda como Inactivo)")) return;

    try {
      setStatus("Inactivando...", "info");
      await apiFetch(`${catEndpoint()}/${id}`, { method: "DELETE" });

      toast("Inactivado ✅", "ok");
      closeModal();
      await load({ page: catPage });
      setStatus("Listo", "ok");
    } catch (e) {
      setStatus("Error", "err");
      toast(e.message, "err");
    }
  });

  async function load(opts = {}) {
    const q = (opts.search ?? catSearch.value ?? "").trim();
    const page = opts.page ?? catPage;

    setStatus("Cargando...", "info");
    setCatEmpty("Cargando…");

    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      params.set("page", String(page));
      params.set("page_size", String(catPageSize));

      const j = await apiFetch(`${catEndpoint()}?${params.toString()}`);

      catPage = j.page || page;
      catTotalPages = j.pages || 1;

      catPageEl.textContent = String(catPage);
      catInfo.textContent = `Total: ${j.total} • Páginas: ${catTotalPages} • Mostrando: ${j.items?.length || 0}`;

      const items = j.items || [];
      if (!items.length) {
        setCatEmpty("Sin resultados.");
        setStatus("Listo", "ok");
        return;
      }

      catBody.innerHTML = items.map(it => {
        const status = Number(it.is_active) === 1
          ? `<span class="tagOk">● Activo</span>`
          : `<span class="tagOff">● Inactivo</span>`;

        return `
          <tr>
            <td class="mono">${it.id}</td>
            <td>${it.name}</td>
            <td>${status}</td>
            <td class="actions"><a href="#" data-edit="${it.id}">Editar</a></td>
          </tr>
        `;
      }).join("");

      catBody.querySelectorAll("[data-edit]").forEach(a => {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          const id = Number(a.dataset.edit);
          const item = items.find(x => Number(x.id) === id);
          openModal("edit", item);
        });
      });

      setStatus("Listo", "ok");
    } catch (e) {
      setCatEmpty("Error: " + e.message);
      setStatus("Error", "err");
      toast(e.message, "err");

      toast("Catalogos: " + e.message, "err");
    }
  }

  catBadge.textContent = catType;
  await load({ page: 1 });
}

export async function destroy() {}
