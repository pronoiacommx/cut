import { apiFetch, getApiBase, CONFIG } from "../../core/api.js"; // Ajusta la ruta si es necesario
import { $, toast, setStatus, showLoader, hideLoader, setApiLabel, showErrorPopup, showConfirm } from "../../../ui.js";

// 1. Aseguramos el espacio de nombres
if (!window.Modules) window.Modules = {};

// 2. Definimos el módulo
window.Modules.expedientes = {
    init: async function({ host, ctx }) {
        console.log("🚀 Iniciando Módulo de Expedientes");
        
        // Seteamos la base de la API en la UI
        setApiLabel(getApiBase());

        // Referencias del DOM dentro del módulo
        const searchBox = $("#searchBox", host);
        const btnSearch = $("#btnSearch", host);
        const btnClearSearch = $("#btnClearSearch", host);
        const btnPrev = $("#btnPrev", host);
        const btnNext = $("#btnNext", host);
        const body = $("#tblBody", host);
        const pagerInfo = $("#pagerInfo", host);
        const frm = $("#formNuevoAspirante", host);

        let curPage = 1;
        const pageSize = 20;
        let totalPages = 1;

        // --- LÓGICA DE CARGA ---
        const load = async (opts = {}) => {
            const s = opts.search !== undefined ? opts.search : searchBox.value.trim();
            const page = opts.page ?? curPage;

            showLoader(s ? "Buscando..." : "Cargando...", "Obteniendo información de expedientes");

            try {
                // Adaptado para PHP: enviamos parámetros normales
                const j = await apiFetch("get_expedientes", {
                    method: 'GET',
                    // Suponiendo que tu apiFetch maneja query params o los añades aquí
                });

                curPage = j.page || page;
                totalPages = j.pages || 1;
                window.datosAspirantes = j.items || [];

                if (!window.datosAspirantes.length) {
                    body.innerHTML = '<tr><td colspan="8">Sin resultados.</td></tr>';
                    hideLoader();
                    return;
                }

                renderTable(body, window.datosAspirantes);
                pagerInfo.textContent = `Total: ${j.total} • Páginas: ${j.pages}`;
                
            } catch (e) {
                showErrorPopup("Error de carga", e.message);
            } finally {
                hideLoader();
            }
        };

        // --- EVENTOS ---
        btnSearch.onclick = () => load({ page: 1 });
        
        if(frm) {
            frm.onsubmit = async (e) => {
                e.preventDefault();
                // Tu lógica de guardado en PHP aquí...
                const fd = new FormData(frm);
                await apiFetch("registrar_aspirante", {
                    method: 'POST',
                    body: Object.fromEntries(fd)
                });
                toast("Creado con éxito", "ok");
                load();
            };
        }

        // Carga inicial
        await load();
    },

    destroy: function() {
        console.log("🧹 Módulo de expedientes destruido");
        // Aquí puedes remover el eventListener de Escape si fuera necesario
    }
};

/**
 * FUNCIONES AUXILIARES (Fuera del init para limpieza)
 */

function renderTable(container, items) {
    container.innerHTML = items.map(it => `
        <tr>
            <td class="actions">${window.getAccionesPorEtapa(it)}</td>
            <td>${it.nombre_completo || "—"}</td>
            <td>${window.getEtapaBadge(it.etapa_flujo)}</td>
            <td><div class="flex gap-3">${window.renderDocumentIcons(it)}</div></td>
            <td>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width:${it.percent_complete}%"></div>
                </div>
            </td>
            <td class="actions">
                <a href="#" onclick="resendInvite(${it.aspirante_id})">Reenviar</a>
            </td>
        </tr>
    `).join("");
}

// Hacer globales las funciones que el HTML (onclick) necesita llamar
window.getEtapaBadge = function(etapa) {
    // ... tu lógica de badges ...
    return `<span class="badge">${etapa}</span>`;
};

window.renderDocumentIcons = function(row) {
    // ... tu lógica de carpetas ...
    return `<i class="fas fa-folder"></i>`;
};