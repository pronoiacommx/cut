// /ui/core/api.js

// const KEY = "cut_api_base";
// const DEFAULT_API = "http://localhost:8000";
// 1. Detectar entorno
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
// 2. Definir la base de la API de forma segura
// export const DEFAULT_API = isProduction 
//     ? "https://tu-api-real.com" 
//     : "http://localhost:8000";

export const CONFIG = {
    API_BASE: isProduction ? "https://tu-api-real.com" : "http://localhost:8000",
    URL_BASE: isProduction ? "https://plataforma.cutlaguna.edu.mx" : "http://localhost/cut/contratos"
};
//const token = localStorage.getItem("rh_token"); // O como hayas nombrado la llave al loguear 

const DEFAULT_API = CONFIG.API_BASE;

const DEFAULT_URL = CONFIG.URL_BASE;


export function getApiBase() {
  try {
    const v = DEFAULT_API;
    return (v || DEFAULT_API).replace(/\/$/, "");
  } catch {
    return DEFAULT_API;
  }
}

// export function setApiBase(v) {
//   try {
//     localStorage.setItem(KEY, (v || DEFAULT_API).replace(/\/$/, ""));
//     const label = document.getElementById("apiBaseLabel");
    
//   } catch {}
// }


export async function apiFetch(endpoint, options = {}) {
  // Aseguramos que API_BASE no sea undefined aquí
    const base = CONFIG.API_BASE;
    console.log("API_BASE")
    console.log(CONFIG.API_BASE)
  // Si endpoint ya trae la base por error, la limpiamos
    const cleanEndpoint = endpoint.replace(DEFAULT_API, "");
  //const base =  localStorage.getItem("api_base") || "http://localhost:8000";
  //const url = `${DEFAULT_API}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  // Construimos la URL asegurando que no haya dobles slashes o undefined
    const url = `${DEFAULT_API}${cleanEndpoint.startsWith('/') ? '' : '/'}${cleanEndpoint}`;

  // 1. Preparar Headers como Objeto Literal (más fiable para FastAPI)
  const headers = {
    "Content-Type": "application/json"
  };
  
  const token = localStorage.getItem("rh_token");
  if (token && token !== "null") {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Mezclar con headers personalizados
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  // 2. Configurar el Body (Evitar doble stringify)
  let finalBody = options.body;
  if (finalBody && typeof finalBody === 'object') {
    finalBody = JSON.stringify(finalBody);
  }

  const config = {
    method: options.method || "GET",
    headers: headers,
    body: finalBody
  };

  console.log("📡 Enviando a:", url);
  console.log("📦 Body final:", config.body);

  try {
    const response = await fetch(url, config);
    
    // Si la respuesta es 204 (No Content), no intentamos parsear JSON
    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Si FastAPI devuelve errores de validación (422), extraemos el mensaje
      const msg = data.detail && typeof data.detail === 'object' 
                  ? JSON.stringify(data.detail) 
                  : (data.detail || `Error ${response.status}`);
      throw new Error(msg);
    }

    return data;
  } catch (err) {
    console.error("🚨 Fallo en apiFetch:", err.message);
    throw err;
  }
}