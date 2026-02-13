// 1. REGISTRO DEL MÓDULO PARA EL ROUTER
window.Modules = window.Modules || {};

// Definimos el objeto del módulo
window.Modules.constancias = { 
    init: function(ctx) {
        console.log("Módulo de Constancias Inicializado");
        
        // Referencias a los selectores de filtro
        const selectTipo = document.getElementById('filtroTipo');
        const selectPago = document.getElementById('filtroPago');

        // Escuchar cambios para el filtrado
        if(selectTipo) selectTipo.addEventListener('change', window.Modules.constancias.filtrar);
        if(selectPago) selectPago.addEventListener('change', window.Modules.constancias.filtrar);

        // Cargar datos iniciales de FastAPI
        window.Modules.constancias.cargarDatos();
    },
    
    // Agrupamos las funciones dentro del módulo para que no choquen
    cargarDatos: async function() {

        console.log("Entra a cargar datos!");
        const tabla = document.getElementById('contenedorConstancias');
        if(!tabla) return;

        // Si tienes showLoader en ui.js, lo usamos
        if (typeof showLoader === 'function') showLoader(tabla);

        try {
            // Ajusta a tu URL real de FastAPI
            const respuesta = await fetch('http://localhost:8000/api/constancias/listado'); 
            const datos = await respuesta.json();
            
            tabla.innerHTML = ''; 

            datos.forEach(c => {
              // 1. Formatear la fecha de vigencia (opcional, para que se vea limpia)
                const fechaVigencia = c.fecha_solicitud ? c.fecha_solicitud : "N/A"; 
                
                const barraHTML = generarBarraProgreso(c.fecha_solicitud, c.vigencia_dias || 30); 
                debugger;
                tabla.innerHTML += `
                    <tr class="fila-constancia" data-tipo="${c.nombre_tipo}" data-pago="${c.estatus_pago}">
                        <td>${c.id_registro || c.id_registro}</td>
                        <td>${c.nombre_alumno || c.nombre}</td>
                        <td>${c.nombre_tipo}</td>
                        <td><span class="tag">${c.fecha_solicitud}</span></td>
                        <td>
                            ${barraHTML}
                        </td>
                        <td><span class="tag">${c.estatus_pago}</span></td>
                        <td>
                            <div class="buttons is-compact">
                                <button class="btn-icon" onclick="verPDF(${c.id_registro})" title="Ver PDF">
                                    📄
                                </button>
                                <button class="btn-icon" onclick="enviarCorreo(${c.id_registro})" title="Enviar por correo">
                                    📧
                                </button>
                            </div>
                        </td>
                    </tr>`;
            });
            console.log("Tabla de constancias actualizada.");
        } catch (e) {
            console.error("Error cargando constancias:", e);
            tabla.innerHTML = '<tr><td colspan="3">Error al cargar datos</td></tr>';
        }
    },

    filtrar: function() {
        const t = document.getElementById('filtroTipo').value;
        const p = document.getElementById('filtroPago').value;
        
        document.querySelectorAll('.fila-constancia').forEach(fila => {
            const coincideT = (t === "" || fila.dataset.tipo === t);
            const coincideP = (p === "" || fila.dataset.pago === p);
            fila.style.display = (coincideT && coincideP) ? "" : "none";
        });
    },

    destroy: function() {
        console.log("Limpiando módulo constancias...");
    }
};

/* --- MÉTODOS DEL MODAL (Globales para que el HTML los vea) --- */

window.abrirModalNuevaSolicitud = function() {
    // Tu código del modal se queda igual...
    const modalHTML = `
    <div id="modalConstancia" class="modal">
        <div class="modal-content card" style="max-width: 850px; padding: 0;">
            <div class="cardHd">
                <h2>Nueva Solicitud de Constancia</h2>
                <span class="close-btn" onclick="cerrarModal()">&times;</span>
            </div>
            <div class="cardBd">
                <form id="frmNuevaConstancia">
                    <div class="field">
                         <label>Buscar por Matrícula</label>
                         <div style="display: flex; gap: 5px;">
                             <input type="text" id="busquedaMatricula" placeholder="CUT-2026-000">
                             <button type="button" class="btn-primary" onclick="buscarAlumnoParaConstancia()">🔍</button>
                         </div>
                    </div>
                    <input type="text" id="resNombre" readonly>
                    <input type="text" id="resCarrera" readonly>
                    
                    <button type="submit" class="btn-primary">Registrar Solicitud</button>
                </form>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.buscarAlumnoParaConstancia = async function() {
    const matricula = document.getElementById('busquedaMatricula').value;
    if(!matricula) return alert("Ingresa una matrícula");

    try {
        const response = await fetch(`http://localhost:8000/api/alumnos/buscar/${matricula}`);
        const data = await response.json();

        if(data && data.id) {
            document.getElementById('resNombre').value = `${data.nombre} ${data.apellidos}`;
            document.getElementById('resCarrera').value = `${data.carrera}`;
            document.getElementById('frmNuevaConstancia').dataset.alumnoId = data.id;
        } else {
            alert("Alumno no encontrado");
        }
    } catch (error) {
        console.error("Error al buscar:", error);
    }
};

window.cerrarModal = () => {
    const m = document.getElementById('modalConstancia');
    if(m) m.remove();
};

// Listener global para el formulario (se registra una sola vez)
if (!window.formHandlerRegistered) {
    document.addEventListener('submit', async (e) => {
        if(e.target.id === 'frmNuevaConstancia') {
            e.preventDefault();
            const formData = new FormData(e.target);
            const alumnoId = e.target.dataset.alumnoId;

            if(!alumnoId) return alert("Primero busca un alumno");

            const payload = {
                id_alumno: alumnoId,
                id_tipo: formData.get('id_tipo'),
                estatus_pago: formData.get('estatus_pago'),
                vigencia: formData.get('vigencia')
            };

            const res = await fetch('http://localhost:8000/api/constancias/registrar', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                alert("Solicitud registrada correctamente.");
                cerrarModal();
                // Llamamos a cargarDatos del módulo para refrescar la tabla sin recargar página
                window.Modules.constancias.cargarDatos();
            }
        }
    });
    window.formHandlerRegistered = true;
}
function generarBarraProgreso(fechaEmision, diasVigencia) {
    const inicio = new Date(fechaEmision).getTime();
    const ahora = new Date().getTime();
    const fin = inicio + (diasVigencia * 24 * 60 * 60 * 1000);
    
    const tiempoTotal = fin - inicio;
    const tiempoTrascurrido = ahora - inicio;
    
    // Calcular porcentaje (de 0 a 100)
    let porcentaje = Math.floor((tiempoTrascurrido / tiempoTotal) * 100);
    if (porcentaje > 100) porcentaje = 100;
    if (porcentaje < 0) porcentaje = 0;

    // Determinar color según el tiempo restante
    let color = "#4caf50"; // Verde (bien)
    if (porcentaje > 70) color = "#ff9800"; // Naranja (cerca de vencer)
    if (porcentaje > 90) color = "#f44336"; // Rojo (crítico)

    // Invertimos el porcentaje para la barra de "tiempo restante"
    const restante = 100 - porcentaje;

    return `
        <div style="width: 100px; background: #eee; border-radius: 10px; height: 8px; overflow: hidden; border: 1px solid #ddd;">
            <div style="width: ${restante}%; background: ${color}; height: 100%; transition: width 0.5s;"></div>
        </div>
        <small style="font-size: 10px; color: #666;">${restante}% restante</small>
    `;
}