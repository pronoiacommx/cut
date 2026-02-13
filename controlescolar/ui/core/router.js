/**
 * Obtiene el ID de la ruta desde el Hash de la URL (ej: #constancias -> constancias)
 */
export function getRouteIdFromHash() {
    return window.location.hash.slice(1) || "";
}


/**
 * Navega a una ruta específica cargando HTML e inicializando el módulo
 */
export async function navigate(hash, ctx) {
    const host = document.getElementById('viewHost');
    if (!host) return;

    // 1. SEPARAR RUTA DE PARÁMETROS
    // Ejemplo: "asistencias?id=1" -> route: "asistencias", params: "id=1"
    const [route, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString);
    
    // Guardamos los parámetros en el contexto para que el módulo los use
    ctx.params = Object.fromEntries(params.entries());

    try {
        host.innerHTML = '<div style="padding:50px; text-align:center;">Cargando...</div>';

        // 2. CARGAR CSS (Usamos la 'route' limpia)
        const idCss = `style-${route}`;
        if (!document.getElementById(idCss)) {
            const link = document.createElement('link');
            link.id = idCss;
            link.rel = 'stylesheet';
            link.href = `./ui/vistas/${route}/module.css`;
            document.head.appendChild(link);
        }

        // 3. CARGAR HTML (Usamos la 'route' limpia)
        const resHtml = await fetch(`./ui/vistas/${route}/view.html`);
        if (!resHtml.ok) throw new Error(`Vista [${route}] no encontrada`);
        host.innerHTML = await resHtml.text();

        // 4. CARGAR JS
        const idJs = `script-${route}`;
        if (document.getElementById(idJs)) document.getElementById(idJs).remove();
        const script = document.createElement('script');
        script.id = idJs;
        script.src = `./ui/vistas/${route}/module.js`;
        script.type = 'module';
        document.head.appendChild(script);

        // 5. EJECUTAR INIT (Pasando el contexto con los parámetros)
        let intentos = 0;
        const check = setInterval(() => {
            if (window.Modules && window.Modules[route]) {
                clearInterval(check);
                window.Modules[route].init({ host, ctx });
            }
            if (intentos++ > 30) clearInterval(check);
        }, 100);

    } catch (err) {
        console.error(err);
        host.innerHTML = `<h2>Error 404: Vista no encontrada</h2>`;
    }
}

/**
 * Escucha los clics en los botones del menú con atributo [data-route]
 */
export function bindNavEvents() {
    document.querySelectorAll('[data-route]').forEach(btn => {
        // Limpiamos listeners previos para evitar ejecuciones dobles
        btn.onclick = (e) => {
            const route = e.currentTarget.getAttribute('data-route');
            navigate(route, { apiBase: "./api" });
        };
    });
}

/**
 * Escucha el evento de cambio de Hash (por si el usuario usa las flechas del navegador)
 */
window.addEventListener('hashchange', () => {
    const route = getRouteIdFromHash();
    if (route) {
        // Aquí puedes pasar el contexto que necesites
        navigate(route, { apiBase: "./api" });
    }
});