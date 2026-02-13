// ui/vistas/clases/clases.js
import { apiFetch } from "../../core/api.js";
import { $, showLoader, hideLoader, toast } from "../../../ui.js";

window.Modules.clases = {
    init: async function({ host }) {
        const body = $("#tblClases", host);
        const pagerInfo = $("#pagerInfoClases", host);

        const renderClases = async () => {
            showLoader("Consultando Horario", "Obteniendo datos del servidor...");
            try {
                const data = await apiFetch("get_clases_profesor");
                
                if (!data || data.length === 0) {
                    body.innerHTML = `<tr><td colspan="6" class="text-center">No tienes clases asignadas para este ciclo.</td></tr>`;
                    pagerInfo.innerText = "0 clases encontradas";
                    return;
                }

                // Inyectamos las filas con el estilo de Expedientes
                body.innerHTML = data.map(c => `
                    <tr>
                        <td style="font-weight:bold; color: var(--rh-red);">${c.hora_inicio} - ${c.hora_fin}</td>
                        <td>
                            <div style="font-weight:700; color: var(--text-dark);">${c.nombre_materia}</div>
                            <div class="small text-muted">${c.clave}</div>
                        </td>
                        <td><span class="badge-cycle">${c.nombre_grupo}</span></td>
                        <td>${c.dia_nombre}</td>
                        <td><span class="text-muted">📍 ${c.aula || 'S/N'}</span></td>
                        <td style="text-align:right; padding-right: 20px;">
                            <button class="btn-action-clase" onclick="location.hash='#asistencias?id=${c.id}'">
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
    // Dentro de window.Modules.clases en clases.js

    abrirPaseLista: async function (claseId) {
        const modal = document.getElementById('modalAsistencia');
        const bodyAsis = document.getElementById('modalBodyAsis');
        
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        bodyAsis.innerHTML = '<p class="text-center">Cargando lista de alumnos...</p>';

        try {
            const alumnos = await fetch(`./api/get_alumnos_clase.php?clase_id=${claseId}`).then(r => r.json());
            
            if (alumnos.length === 0) {
                bodyAsis.innerHTML = '<p class="text-center">No hay alumnos inscritos en este grupo.</p>';
                return;
            }

            let html = `
                <table class="table-full">
                    <thead>
                        <tr>
                            <th>Alumno</th>
                            <th style="text-align:center">Asistencia</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            alumnos.forEach(al => {
                html += `
                    <tr>
                        <td>${al.nombre} ${al.apellidos}</td>
                        <td style="text-align:center">
                            <input type="checkbox" class="asis-check" data-id="${al.alumno_id}" checked style="transform: scale(1.5);">
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            bodyAsis.innerHTML = html;

            // Configurar el botón de guardar
            document.getElementById('btnGuardarAsistencia').onclick = () => guardarAsistencia(claseId);

        } catch (err) {
            bodyAsis.innerHTML = '<p class="text-center" style="color:red">Error al cargar la lista.</p>';
        }
    },
    procesarGuardado: async function (claseId, alumnos) {
        const listaAsistencia = alumnos.map(al => {
            return {
                alumno_id: al.alumno_id,
                estatus: document.querySelector(`input[name="asis_${al.alumno_id}"]:checked`).value
            };
        });
        // Mostramos el loader global que ya tienes
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
                showModal("¡Éxito!", "La asistencia se ha guardado correctamente. Volviendo a tus clases...");
                // Redirección automática después de 1.5 segundos
                setTimeout(() => {
                    location.hash = '#clases';
                }, 1500);
            } else {
                alert("❌ Error: " + response.message);        
                showModal("Error Crítico", "❌ Error: " + response.message);

            }
        } catch (err) {
            hideLoader();
        showModal("Error Crítico", "Hubo un fallo en la conexión con el servidor.");
        console.error(err);
        }
    },

    destroy: () => {
        console.log("Módulo clases liberado");
    }
};