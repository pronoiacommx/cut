import { state } from "../../assets/js/state.js";
import { normalizePhoneForTel } from "../../assets/js/utils.js";
import { loadAvatar, saveAvatar, clearAvatar, fileToDataURL } from "../../assets/js/storage.js";

export function initView(root){
  root.querySelector("#avatarInput").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const dataUrl = await fileToDataURL(file);
    saveAvatar(dataUrl);
    root.querySelector("#avatar").src = dataUrl;
    e.target.value = "";
  });

  root.querySelector("#btnRemovePhoto").addEventListener("click", ()=>{
    clearAvatar();
    root.querySelector("#avatar").src = defaultAvatarSvg();
  });
}

export function renderView(root){
  root.querySelector("#pNombre").textContent = state.user.nombre;
  root.querySelector("#pMatricula").textContent = state.user.matricula;
  root.querySelector("#pGrupo").textContent = state.user.grupo;
  root.querySelector("#pTurno").textContent = state.user.turno;

  root.querySelector("#pStatusPago").textContent = state.user.status_pago;
  root.querySelector("#pLast").textContent = state.user.last_login;

  // dot status
  const dot = root.querySelector("#pPagoDot");
  dot.classList.remove("good","warn","bad");
  dot.classList.add(statusDot(state.user.status_pago));

  // email
  const email = String(state.user.email||"").trim();
  root.querySelector("#pEmail").textContent = email || "—";
  root.querySelector("#pEmailText").textContent = email || "—";
  const emailLink = root.querySelector("#pEmailLink");
  if(email){
    emailLink.href = `mailto:${email}`;
    emailLink.style.pointerEvents = "auto";
    emailLink.style.opacity = "1";
  }else{
    emailLink.href = "#";
    emailLink.style.pointerEvents = "none";
    emailLink.style.opacity = ".6";
  }

  // tel
  const tel = String(state.user.telefono||"").trim();
  root.querySelector("#pTel").textContent = tel || "—";
  root.querySelector("#pTelText").textContent = tel || "—";
  const telLink = root.querySelector("#pTelLink");
  const telNorm = normalizePhoneForTel(tel);
  if(telNorm){
    telLink.href = `tel:${telNorm}`;
    telLink.style.pointerEvents = "auto";
    telLink.style.opacity = "1";
  }else{
    telLink.href = "#";
    telLink.style.pointerEvents = "none";
    telLink.style.opacity = ".6";
  }

  root.querySelector("#avatar").src = loadAvatar(defaultAvatarSvg());
}

function statusDot(status){
  const s = String(status||"").trim().toUpperCase();
  const good = ["VIGENTE","PAGADO","AL CORRIENTE","ACTIVO","CONFIRMADO","OK"];
  const warn = ["PENDIENTE","POR VENCER","EN PROCESO","REVISION","REVISIÓN","PARCIAL"];
  const bad  = ["VENCIDO","ATRASADO","BLOQUEADO","RECHAZADO","CANCELADO","SUSPENDIDO","MORA"];
  if(bad.includes(s)) return "bad";
  if(warn.includes(s)) return "warn";
  if(good.includes(s)) return "good";
  return "warn";
}

function defaultAvatarSvg(){
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#6ea8fe"/>
          <stop offset="1" stop-color="#39d98a"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="28" fill="url(#g)"/>
      <circle cx="80" cy="64" r="26" fill="rgba(255,255,255,.85)"/>
      <rect x="36" y="98" width="88" height="44" rx="22" fill="rgba(255,255,255,.85)"/>
    </svg>
  `);
  return "data:image/svg+xml;charset=utf-8," + svg;
}
