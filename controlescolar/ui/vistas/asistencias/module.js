import { apiFetch } from "../../core/api.js";
import { $, showLoader, hideLoader, toast, showErrorPopup } from "../../../ui.js";

window.Modules.asistencias = {
    init: async function({ host, ctx }) {
        const claseId = ctx.params.id;
        const body = $("#tblAlumnosAsis", host);
        let btnGuardar = $("#btnGuardarPaseLista", host);
        
        const updateCounters = () => {
            host.querySelector("#countTotal").innerText = host.querySelectorAll("tr[data-al]").length;
            host.querySelector("#countAsis").innerText = host.querySelectorAll("input[value='Asistencia']:checked").length;
            host.querySelector("#countFalt").innerText = host.querySelectorAll("input[value='Falta']:checked").length;
            host.querySelector("#countRet").innerText = host.querySelectorAll("input[value='Retardo']:checked").length;
            host.querySelector("#countJust").innerText = host.querySelectorAll("input[value='Justificada']:checked").length;
        };
        // Dentro de window.Modules.asistencias.init ...
        // Dentro de window.Modules.asistencias.init ...
        btnGuardar = host.querySelector("#btnGuardarPaseLista");
        if (btnGuardar) {
            btnGuardar.onclick = () => this.guardar(claseId, data); 
        }
        // Evento para detectar cambios en los radios
        body.addEventListener('change', (e) => {
            if (e.target.type === 'radio') {
                const fila = e.target.closest('tr'); // Buscamos la fila padre
                const valor = e.target.value;        // Obtenemos: Asistencia, Falta, etc.

                // Limpiamos clases previas
                fila.classList.remove('row-asistencia', 'row-falta', 'row-retardo', 'row-justificada');

                // Aplicamos la nueva clase según el valor
                const claseMapa = {
                    'Asistencia': 'row-asistencia',
                    'Falta': 'row-falta',
                    'Retardo': 'row-retardo',
                    'Justificada': 'row-justificada'
                };

                fila.classList.add(claseMapa[valor]);
            }
        });
        // Mostrar fecha actual
        const hoy = new Date();
        $("#currentDateLabel", host).innerText = `Fecha: ${hoy.toLocaleDateString()}`;

        if (!claseId) {
            toast("No se especificó una clase válida", "err");
            return;
        }

        const cargarAlumnos = async () => {
            showLoader("Cargando Lista");
            try {
                // Aquí podrías llamar a un API que traiga info de la clase + alumnos
                const data = await apiFetch(`get_alumnos_clase?clase_id=${claseId}`);
                
                if (data.length === 0) {
                    body.innerHTML = '<tr><td colspan="5" class="text-center">No hay alumnos inscritos.</td></tr>';
                    return;
                }

               body.innerHTML = data.map(al => `
                    <tr class="row-asistencia">
                        <td>
                            <div class="bold">${al.nombre} ${al.apellidos}</div>
                            <small class="text-muted">${al.matricula}</small>
                        </td>
                        <td class="text-center">
                            <label class="radio-container asis-green">
                                <input type="radio" name="asis_${al.alumno_id}" value="Asistencia" checked>
                                <span class="checkmark"></span>
                            </label>
                        </td>
                        <td class="text-center">
                            <label class="radio-container asis-red">
                                <input type="radio" name="asis_${al.alumno_id}" value="Falta">
                                <span class="checkmark"></span>
                            </label>
                        </td>
                        <td class="text-center">
                            <label class="radio-container asis-orange">
                                <input type="radio" name="asis_${al.alumno_id}" value="Retardo">
                                <span class="checkmark"></span>
                            </label>
                        </td>
                        <td class="text-center">
                            <label class="radio-container asis-blue">
                                <input type="radio" name="asis_${al.alumno_id}" value="Justificada">
                                <span class="checkmark"></span>
                            </label>
                        </td>
                    </tr>
                `).join('');
                updateCounters();
                body.addEventListener('change', (e) => {
                    if (e.target.type === 'radio') {
                        const fila = e.target.closest('tr');
                        fila.className = ''; // Limpiar
                        fila.classList.add(`row-${e.target.value.toLowerCase()}`);
                        updateCounters();
                    }
                });
                btnGuardar.onclick = () => this.guardar(claseId, data);

            } catch (err) {
                toast("Error: " + err.message, "err");
            } finally {
                hideLoader();
            }
        };

        await cargarAlumnos();
    },

    marcarTodos: (valor) => {
        document.querySelectorAll(`.radio-asis[value="${valor}"]`).forEach(input => input.checked = true);
    },

    guardar: async function(claseId, alumnos) {
        const lista = alumnos.map(al => ({
            alumno_id: al.alumno_id,
            estatus: document.querySelector(`input[name="asis_${al.alumno_id}"]:checked`).value
        }));

        showLoader("Guardando");
        // 2. Validación local rápida
        if (!claseId || lista.length === 0) {
            showModal("Atención", "No hay datos para guardar.", "error");
            return;
        }
        try {
           const res = await apiFetch('save_asistencias', {
            method: 'POST',
            body: {
                clase_id: claseId,
                lista: lista
            }
        });

            if (res.status === 'success') {
                toast("Asistencia guardada con éxito");
                window.history.back();
            }
        } catch (err) {
            toast(err.message, "err");
            showErrorPopup("Error",err.message);
        } finally {
            hideLoader();
        }
    }
};