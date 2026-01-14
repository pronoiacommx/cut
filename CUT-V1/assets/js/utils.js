export const money = (n) =>
  new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(n);

export const normalizePhoneForTel = (phone) => (phone || "").replace(/[^\d+]/g, "");

export const uniq = (arr) => Array.from(new Set(arr));

export const sortByStartTime = (a, b) => {
  const aT = String(a||"").split(" - ")[0] || "";
  const bT = String(b||"").split(" - ")[0] || "";
  return aT.localeCompare(bT);
};
