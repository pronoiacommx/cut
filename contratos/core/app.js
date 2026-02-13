import { getApiBase,apiFetch, CONFIG } from "./api.js";
import { setApiLabel, setStatus } from "./ui.js";
import { getRouteIdFromHash, navigate, bindNavEvents } from "./router.js";


const ctx = { apiBase: getApiBase() };
const DEFAULT_API = CONFIG.API_BASE;

const DEFAULT_URL = CONFIG.URL_BASE;

// Validar sesión antes de hacer cualquier otra cosa
(function comprobarSesion() {
    const sesionActiva = localStorage.getItem('user_email'); // Ajusta a tu lógica
    if (!sesionActiva) {
         navigate("login",ctx)
    }
})();
const MENU_ROLES = {
    "Recursos Humanos": [
        //{ route: 'aspirantes', label: 'Registro Aspirantes', sub: 'Generación de liga RH', ico: 'A', color: '#4f46e5' },
        { route: 'expedientes', label: 'Expedientes', sub: 'Administración de Aspirantes', ico: 'E', color: '#b00020' },
        //{ route: 'contratos', label: 'Contratos', sub: 'Alta + generar PDF', ico: 'C', color: '#b00020' },
        { route: 'catalogos', label: 'Catálogos', sub: 'Carreras y materias', ico: 'K', color: '#7c3aed' },
        { route: 'empleados', label: 'Empleados', sub: 'Alta de empleados', ico: 'E', color: '#4f46e5' },
        { route: 'config', label: 'Configuración', sub: 'Perzonaliza mi sistema', ico: 'C', color: '#0891b2' },
        { route: 'constancias', label: 'Constancias', sub: 'Lista de constancias', ico: 'C', color: '#7c3aed' }
    ]
    // Agregar más roles aquí...
};


async function boot() {
    
    // Definir la variable session ANTES de usarla
    const session = localStorage.getItem('user_email');
    const currentRoute = getRouteIdFromHash();

    if (!session) {
        document.body.classList.add('is-login'); // Esto oculta el menú como querías
        //renderLoginView(); 
        // Cargar vista de login
        await navigate("login", ctx);
        return;
    } 

    document.body.classList.remove('is-login');
    document.body.classList.remove("auth-mode");
    updateUserInfo();

    const rol = localStorage.getItem("rh_user_role") || "Recursos Humanos";
    renderMenuByRole(rol);

    // TOGGLE SIDEBAR (Seguro: Usamos un solo listener)
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
    window.onclick = () => dropdown.classList.remove('active');

    // LOGOUT
    document.getElementById('btnLogout').onclick = async () => {
        e.preventDefault();
        
        // 1. Limpiar rastro de sesión
        localStorage.clear();
        
        // 2. Preparar la UI para el modo Login
        document.body.classList.add('is-login');
        
        // 3. Usar tu router para ir al login sin recargar la página
        await navigate("login", ctx);
        
        // Opcional: Si quieres limpiar el host de vista manualmente
        // document.getElementById('viewHost').innerHTML = '';
        
        console.log("Sesión cerrada y navegando a login...");
    };

    await navigate(currentRoute === "login" ? "expedientes" : currentRoute, ctx);
}

function renderMenuByRole(rol) {
    const navContainer = document.getElementById('navContainer');
    const opciones = MENU_ROLES[rol] || [];
    if (!navContainer) return;

    navContainer.innerHTML = opciones.map(item => `
        <button class="navBtn" data-route="${item.route}" type="button" title="${item.label}">
            <div class="ico" style="--bg-ico: ${item.color}">${item.ico}</div>
            <div class="navTxt">
                <b>${item.label}</b>
                <span>${item.sub}</span>
            </div>
        </button>
    `).join('');

    bindNavEvents(); 
}
function updateUserInfo() {
    // Obtenemos los datos guardados en el paso anterior
    const name = localStorage.getItem("user_name") || "Usuario";
    const role = localStorage.getItem("rh_user_role") || "Personal";
    const initials = localStorage.getItem("rh_user_initials") || "U";
    const email = localStorage.getItem("user_email") || "";

    // Actualizamos la Topbar (La "píldora" visible)
    if (document.getElementById('topUserName')) 
        document.getElementById('topUserName').textContent = name;
    
    if (document.getElementById('topUserRole')) 
        document.getElementById('topUserRole').textContent = role;
    
    if (document.getElementById('topAvatar')) 
        document.getElementById('topAvatar').textContent = initials;

    // Actualizamos el Dropdown (El menú que se despliega)
    if (document.getElementById('dropAvatar')) 
        document.getElementById('dropAvatar').textContent = initials;
    
    if (document.getElementById('dropUserName')) 
        document.getElementById('dropUserName').textContent = name;
    
    if (document.getElementById('dropUserEmail')) 
        document.getElementById('dropUserEmail').textContent = email;
}
// Esta función se ejecuta tras recibir la respuesta exitosa del API
function saveSession(data) {
    const { token, user } = data;

    // 1. Guardar el token para futuras peticiones
    localStorage.setItem("rh_session", token);

    // 2. Guardar datos formateados para el perfil (Topbar)
    localStorage.setItem("user_name", user.nombre_completo); // Héctor Mota
    localStorage.setItem("rh_user_role", user.rol);             // Administrador
    localStorage.setItem("user_email", user.email);          // hector.mota@cut.edu.mx
    localStorage.setItem("rh_user_initials", user.initials);    // HM

    // 3. Redirigir al inicio del sistema
    window.location.href = "/"; 
}
function renderLoginView() {
    const host = document.getElementById('viewHost');
    host.innerHTML = `
        <div class="login-bg"></div>
        <div class="login-card">
            <img src="./assets/img/logo.png" class="login-logo">
            <h2>Acceso al Sistema</h2>
            <input type="text" placeholder="Usuario">
            <input type="password" placeholder="Contraseña">
            <button class="btn btnPrimary">Iniciar Sesión</button>
        </div>
    `;
}
document.addEventListener("DOMContentLoaded", boot);