// /ui/core/api.js

const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export const CONFIG = {
    // Esto hace que el JS también sepa a qué URL apuntar sin que tú metas mano
    API_BASE: isProduction ? "/api" : "./api",
    URL_BASE: isProduction ? "https://plataforma.cutlaguna.edu.mx" : "/cut/controlescolar"
};

export function getApiBase() {
    return CONFIG.API_BASE;
}
export async function apiFetch(endpoint, options = {}) {
    // 1. Separar la ruta de los posibles parámetros (?id=1)
    let [path, queryString] = endpoint.split('?');
    
    // 2. Limpiar el path y asegurar .php
    let cleanPath = path.startsWith('/') ? path.slice(1) : path;
    if (!cleanPath.endsWith('.php')) {
        cleanPath += '.php';
    }

    // 3. Reconstruir la URL con los parámetros si existen
    const finalEndpoint = queryString ? `${cleanPath}?${queryString}` : cleanPath;
    const url = `${CONFIG.API_BASE}/${finalEndpoint}`;

    // 4. Headers
    const headers = {
        "Content-Type": "application/json"
    };
    
    if (options.headers) {
        Object.assign(headers, options.headers);
    }

    // 5. Configurar el Body
    let finalBody = options.body;
    if (finalBody && typeof finalBody === 'object') {
        finalBody = JSON.stringify(finalBody);
    }

    const config = {
        method: options.method || "GET",
        headers: headers,
        body: (options.method === "GET" || !options.body) ? null : finalBody
    };

    console.log("📡 PHP Fetch:", url);

    try {
        const response = await fetch(url, config);
        const text = await response.text();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("❌ El servidor no devolvió JSON:", text);
            throw new Error("Respuesta inválida del servidor (posible error de PHP)");
        }

        if (!response.ok) {
            throw new Error(data.message || `Error ${response.status}`);
        }

        return data;
    } catch (err) {
        console.error("🚨 Fallo en apiFetch:", err.message);
        throw err;
    }
}