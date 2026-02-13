import { getApiBase, CONFIG } from "./ui/core/api.js";
import { getRouteIdFromHash, navigate, bindNavEvents } from "./ui/core/router.js";

const ctx = { apiBase: getApiBase() };
 const MENU_ROLES = {
        "admin": [
            { route: 'expedientes', label: 'Expedientes', sub: 'Administración', ico: 'E', color: '#b00020' },
            { route: 'catalogos', label: 'Catálogos', sub: 'Carreras y materias', ico: 'K', color: '#7c3aed' },
            { route: 'empleados', label: 'Empleados', sub: 'Alta de personal', ico: 'E', color: '#4f46e5' },
            { route: 'constancias', label: 'Constancias', sub: 'Lista de trámites', ico: 'C', color: '#7c3aed' }
        ],
        "Profesor": [
        { route: 'clases', label: 'Mis Clases', sub: 'Horarios y Grupos', ico: 'C', color: '#16a34a' },
        { route: 'asistencias', label: 'Asistencias', sub: 'Pase de lista', ico: 'A', color: '#2563eb' },
        { route: 'calificaciones', label: 'Evaluaciones', sub: 'Captura de Notas', ico: 'N', color: '#eab308' }
    ],
        "Alumno":[
            { route: 'pagos', label: 'Pagos', sub: 'Información de pagos', ico: 'C', color: '#7c3aed' },
            { route: 'papeleria', label: 'Papeleria', sub: 'Informacion personal', ico: 'C', color: '#7c3aed' },
            { route: 'clases', label: 'Clases', sub: 'Mis clases', ico: 'A', color: '#b00020' }
        ] 
    };
/**
 * BOOT: Función de arranque principal
 */
async function boot() {
    const session = localStorage.getItem('user_email');
    const rol = localStorage.getItem("rh_user_role");
    // Obtenemos el hash actual (quitando el #)
    let currentRoute = window.location.hash.slice(1);

    // 1. Si no hay sesión, todos van al login
    if (!session) {
        document.body.classList.add('is-login'); 
        window.location.hash = "#login"; // Forzamos el hash visualmente
        await navigate("login", ctx);
        return;
    } 

    document.body.classList.remove('is-login');
    updateUserInfo();

    // 2. Obtener las opciones permitidas para ESTE rol
    const opciones = MENU_ROLES[rol] || [];
    
    // 3. Verificamos si la ruta actual es permitida para el rol
    const esPermitida = opciones.some(opt => opt.route === currentRoute);

    // 4. LÓGICA DE REDIRECCIÓN DINÁMICA
    // Si la URL es solo "#", o es "#login", o es una ruta prohibida para el rol...
    if (!currentRoute || currentRoute === "login" || !esPermitida) {
        if (opciones.length > 0) {
            // Tomamos la primera opción del array (ej: 'clases' para Profesor)
            const defaultRoute = opciones[0].route;
            console.log(`🔀 Redirigiendo ${rol} a su inicio: ${defaultRoute}`);
            
            // IMPORTANTE: Cambiamos el hash y terminamos la ejecución aquí
            // El evento 'hashchange' o el siguiente ciclo se encargará del resto
            window.location.hash = `#${defaultRoute}`;
            await navigate(defaultRoute, ctx);
        } else {
            await navigate("403", ctx);
        }
    } else {
        // Si la ruta ya era válida (ej: el usuario escribió #asistencias), solo navegamos
        await navigate(currentRoute, ctx);
    }

    renderMenuByRole(rol);
    setupGlobalEvents();
}

/**
 * Agrupa los eventos de la interfaz principal
 */
function setupGlobalEvents() {
    // TOGGLE SIDEBAR
    const btnToggle = document.getElementById('toggleSidebar');
    const sidebar = document.getElementById("mainSidebar");
    if (btnToggle && sidebar) {
        btnToggle.onclick = (e) => {
            e.preventDefault();
            sidebar.classList.toggle('collapsed');
        };
    }

    // DROPDOWN PERFIL
    const trigger = document.getElementById('avatarTrigger');
    const dropdown = document.getElementById('userDropdown');
    if (trigger) {
        trigger.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        };
    }
    window.onclick = () => {
        if (dropdown) dropdown.classList.remove('active');
    };

    // LOGOUT (Corregido para PHP)
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.onclick = async (e) => {
            e.preventDefault();
            
            // Llamamos al backend para destruir la sesión en PHP
            try {
                await fetch('./api/logout.php'); 
            } catch (err) {
                console.warn("Error al avisar al servidor del logout");
            }

            localStorage.clear();
            document.body.classList.add('is-login');
            
            // Navegamos al login y limpiamos la URL
            window.location.hash = "login";
            await navigate("login", ctx);
        };
    }
}

/**
 * Renderiza el menú dinámico según el rol
 */
function renderMenuByRole(rol) {
   //debugger;

    const navContainer = document.getElementById('navContainer');
    if (!navContainer) return;

    const opciones = MENU_ROLES[rol] || [];
    navContainer.innerHTML = opciones.map(item => `
        <button class="navBtn" data-route="${item.route}" type="button">
            <div class="ico" style="--bg-ico: ${item.color}">${item.ico}</div>
            <div class="navTxt">
                <b>${item.label}</b>
                <span>${item.sub}</span>
            </div>
        </button>
    `).join('');

    bindNavEvents(); 
}

/**
 * Actualiza los datos visuales del usuario en la Topbar
 */
function updateUserInfo() {
    const name = localStorage.getItem("user_name") || "Usuario";
    const role = localStorage.getItem("rh_user_role") || "Personal";
    const initials = localStorage.getItem("rh_user_initials") || "U";
    const email = localStorage.getItem("user_email") || "";

    const elements = {
        'topUserName': name,
        'topUserRole': role,
        'topAvatar': initials,
        'dropAvatar': initials,
        'dropUserName': name,
        'dropUserEmail': email
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

document.addEventListener("DOMContentLoaded", boot);