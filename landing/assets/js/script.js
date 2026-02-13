function verificarAlumno() {
    const esAlumno = document.getElementById('es_alumno').value;
    document.getElementById('seccion_alumno').classList.toggle('hidden', esAlumno === 'no');
    document.getElementById('seccion_general').classList.toggle('hidden', esAlumno === 'si');
}

function consultarMatricula() {
    const mat = document.getElementById('matricula').value;
    
    // Aquí podrías usar fetch() para ir a un PHP que consulte MySQL
    // Simulando respuesta de BD:
    if(mat === "2024MS") {
        document.getElementById('nombre_auto').value = "Usuario Verificado";
        document.getElementById('email_auto').value = "********@institucion.edu";
        document.getElementById('email_real').value = "correo_real@ejemplo.com"; // Input oculto para el envío
        alert("Matrícula validada correctamente.");
    } else {
        alert("Matrícula no encontrada.");
    }
}
function abrirModal() {
    document.getElementById('modalRegistro').style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalRegistro').style.display = 'none';
}

function alternarTipoUsuario() {
    const seleccion = document.getElementById('es_alumno').value;
    const sAlumno = document.getElementById('seccion_alumno');
    const sExterno = document.getElementById('seccion_externo');
    const sComun = document.getElementById('seccion_comun');

    if (seleccion === 'si') {
        sAlumno.classList.remove('hidden');
        sExterno.classList.add('hidden');
    } else {
        sAlumno.classList.add('hidden');
        sExterno.classList.remove('hidden');
    }
    sComun.classList.remove('hidden');
}

function verificarModalidad() {
    const mod = document.getElementById('modalidad_select').value;
    const pTraslado = document.getElementById('pregunta_traslado');
    
    if (mod === 'presencial') {
        pTraslado.classList.remove('hidden');
    } else {
        pTraslado.classList.add('hidden');
    }
}