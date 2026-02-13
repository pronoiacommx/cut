import { apiFetch } from "../../core/api.js";
import { $, showLoader, hideLoader, toast } from "../../../ui.js";

window.Modules.clases = {
    init: async function({ host }) {
        const body = $("#tblClases", host);
        const pagerInfo = $("#pagerInfoClases", host);

        const renderClases = async () => {
            showLoader("Consultando Horario", "Obteniendo datos del servidor...");
            try {
                // Obtenemos los datos con las nuevas columnas: hora_inicio, hora_fin, dia_nombre
                const data = await apiFetch("get_clases_profesor");
                
                if (!data || data.length === 0) {
                    body.innerHTML = `<tr><td colspan="6" class="text-center">No tienes clases asignadas para este ciclo.</td></tr>`;
                    pagerInfo.innerText = "0 clases encontradas";
                    return;
                }

                body.innerHTML = data.map(c => `
                    <tr>
                        <td style="font-weight:bold; color: var(--rh-red);">
                            ${c.hora_inicio.substring(0,5)} - ${c.hora_fin.substring(0,5)}
                        </td>
                        <td>
                            <div style="font-weight:700; color: var(--text-dark);">${c.nombre_materia}</div>
                            <div class="small text-muted">${c.clave || 'S/C'}</div>
                        </td>
                        <td><span class="badge-cycle">${c.nombre_grupo}</span></td>
                        <td>${c.nombre_dia}</td> <td><span class="text-muted">📍 ${c.aula || 'Aula 101'}</span></td>
                        <td style="text-align:right; padding-right: 20px;">
                            <button class="btn-action-clase" onclick="window.Modules.clases.abrirPaseLista(${c.carga_id})">
                                📝 Pasar Lista
                            </button>
                        </td>
                    </tr>
                `).join('');

                pagerInfo.innerText = `${data.length} clases asignadas esta semana`;

            } catch (err) {
                toast("Error al cargar clases: " + err.message, "err");
                body.innerHTML = `<tr><td colspan="6" class="text-center" style="color:red;">Error de conexión con la base de datos.</td></tr>`;
            } finally {
                hideLoader();
            }
        };

        await renderClases();
    },

    abrirPaseLista: async function (claseId) {
        const modal = document.getElementById('modalAsistencia');
        const bodyAsis = document.getElementById('modalBodyAsis');
        
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        bodyAsis.innerHTML = '<p class="text-center">Cargando lista de alumnos...</p>';

        try {
            // Buscamos los alumnos inscritos en esta carga académica específica
            const response = await fetch(`./api/get_alumnos_clase.php?clase_id=${claseId}`).then(r => r.json());
            const alumnos = response.data || [];
            
            if (alumnos.length === 0) {
                bodyAsis.innerHTML = '<p class="text-center">No hay alumnos inscritos en este grupo.</p>';
                return;
            }

            let html = `
                <table class="table-full" style="width:100%">
                    <thead>
                        <tr>
                            <th style="text-align:left; padding:10px;">Alumno</th>
                            <th style="text-align:center">Asistencia</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            alumnos.forEach(al => {
                html += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding:10px;">${al.nombre} ${al.apellidos}</td>
                        <td style="text-align:center">
                            <input type="checkbox" class="asis-check" data-id="${al.alumno_id}" checked style="transform: scale(1.5); accent-color: var(--rh-red);">
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            bodyAsis.innerHTML = html;

            document.getElementById('btnGuardarAsistencia').onclick = () => this.procesarGuardado(claseId);

        } catch (err) {
            bodyAsis.innerHTML = '<p class="text-center" style="color:red">Error al cargar la lista.</p>';
        }
    },

    procesarGuardado: async function (claseId) {
        const checks = document.querySelectorAll('.asis-check');
        const listaAsistencia = Array.from(checks).map(ch => ({
            alumno_id: ch.dataset.id,
            presente: ch.checked ? 1 : 0
        }));

        showLoader("Guardando asistencia...");
        try {
            const response = await fetch('./api/save_asistencias.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clase_id: claseId,
                    lista: listaAsistencia
                })
            }).then(r => r.json());

            if (response.status === 'success') {
                hideLoader();
                toast("Asistencia guardada con éxito", "success");
                document.getElementById('modalAsistencia').classList.add('hidden');
                document.getElementById('modalAsistencia').style.display = 'none';
            } else {
                toast("Error: " + response.message, "err");
            }
        } catch (err) {
            hideLoader();
            toast("Fallo de conexión", "err");
        }
    },

    destroy: () => {
        console.log("Módulo clases liberado");
    }
};