// /ui/core/api.js

const KEY = "cut_api_base";
const DEFAULT_API = "http://localhost:8000";

export function getApiBase() {
  try {
    const v = localStorage.getItem(KEY);
    return (v || DEFAULT_API).replace(/\/$/, "");
  } catch {
    return DEFAULT_API;
  }
}

export function setApiBase(v) {
  try {
    localStorage.setItem(KEY, (v || DEFAULT_API).replace(/\/$/, ""));
  } catch {}
}

/**
 * apiFetch("/api/contracts?...")  => pega a `${getApiBase()}/api/contracts?...`
 * - Si falla, lanza Error con detalle
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : base + path;

  let r; // ✅ definido afuera para que exista en todo el scope
  try {
    r = await fetch(url, {
      cache: "no-store",
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });

    const contentType = r.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    const payload = isJson ? await r.json().catch(() => null) : await r.text().catch(() => "");

    if (!r.ok) {
      const detail =
        (payload && (payload.detail || payload.error || payload.message)) ||
        (typeof payload === "string" ? payload.slice(0, 200) : "") ||
        `HTTP ${r.status}`;

      throw new Error(detail);
    }

    return payload;
  } catch (e) {
    // ✅ aquí r puede ser undefined si ni siquiera conectó, pero no truena
    const code = r ? `HTTP ${r.status}` : "NETWORK";
    throw new Error(`${code}: ${e.message}`);
  }
}
