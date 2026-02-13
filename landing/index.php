<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Congreso Mazatlán 2026 | Registro Profesional</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
</head>
<body>

    <section class="hero">
        <video autoplay muted loop playsinline id="bg-video">
            <source src="https://vid.cdn-website.com/d1ca00e4/videos/KjwK8RnOQ3CHaUMIxlLW_MAZA+2026%281%29-v.mp4" type="video/mp4">
        </video>
        
        <div class="overlay"></div>

        <div class="hero-content">
            <h1>CONGRESO MAZATLÁN 2026</h1>
            <p>Innovación y Tecnología en la Perla del Pacífico</p>
            <button class="btn-main" onclick="abrirModal()">ADQUIRIR BOLETOS</button>
        </div>
    </section>

    <div id="modalRegistro" class="modal">
        <div class="modal-content">
            <span class="close" onclick="cerrarModal()">&times;</span>
            <h2>Registro de Asistencia</h2>
            <form action="process/registro.php" method="POST" id="formRegistro">
                
                <label>¿Eres alumno de la institución?</label>
                <select name="es_alumno" id="es_alumno" onchange="verificarAlumno()">
                    <option value="no">Público General</option>
                    <option value="si">Soy Alumno</option>
                </select>

                <div id="seccion_alumno" class="hidden animate-in">
                    <div class="input-group">
                        <input type="text" id="matricula" placeholder="Ingresa tu matrícula">
                        <button type="button" onclick="consultarMatricula()" class="btn-check">Validar</button>
                    </div>
                    <input type="text" id="nombre_auto" placeholder="Nombre completo" readonly>
                    <input type="password" id="email_auto" placeholder="******@u***.edu.mx" readonly title="Correo protegido">
                    <input type="hidden" name="email" id="email_real">
                </div>

                <div id="seccion_general" class="animate-in">
                    <input type="text" name="nombre" placeholder="Nombre(s)" required>
                    <div class="row">
                        <input type="text" name="apellido_p" placeholder="Ap. Paterno" required>
                        <input type="text" name="apellido_m" placeholder="Ap. Materno">
                    </div>
                    <input type="email" name="email_gen" placeholder="Correo electrónico">
                </div>

                <label>Modalidad</label>
                <select name="modalidad" id="modalidad" onchange="toggleTraslado()">
                    <option value="linea">En Línea (Streaming)</option>
                    <option value="presencial">Presencial (Mazatlán)</option>
                </select>

                <div id="div_traslado" class="hidden animate-in">
                    <label>¿Ya cuentas con medio de traslado?</label>
                    <select name="traslado">
                        <option value="si">Sí, ya tengo transporte</option>
                        <option value="no">No, requiero información</option>
                    </select>
                </div>

                <button type="submit" class="btn-submit">Pagar y Registrar</button>
            </form>
        </div>
    </div>
    <script src="assets/js/script.js"></script>
</body>
</html>