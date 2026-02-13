// import { apiFetch } from "../../core/api.js";
// import { $, toast, setStatus, setApiLabel } from "../../core/ui.js";
// import { getApiBase } from "../../core/api.js";

// console.log("✅ CARGÓ modules/aspirantes/module.js");

// window.Modules = window.Modules || {};
// window.Modules.aspirantes = { init, destroy };

// export async function init({ host }) {
//   setApiLabel(getApiBase());

//   // Referencias a elementos
//   const frm = $("#frmAspirante", host);
//   const out = $("#aspOut", host);
//   const btnCopy = $("#btnCopyLink", host);
//   const btnOpen = $("#btnOpenLink", host);

//   // VALIDACIÓN CRÍTICA:
//   if (!frm) {
//     console.error("❌ ERROR: No se encontró #frmAspirante dentro del host.");
//     return;
//   }

//   let lastUrl = "";

//   function setEmpty(msg="—"){
//     if(out) out.innerHTML = `<tr><td colspan="4" class="small" style="padding:16px; text-align:center;">${msg}</td></tr>`;
//   }

//   frm.addEventListener("submit", async (e) => {
//     e.preventDefault();
//     const btnSubmit = frm.querySelector('button[type="submit"]');
//     btnSubmit.classList.add("btn-loading"); // Usar el spinner qu
//     setStatus("Creando...", "info");
//     setEmpty("Procesando en servidor...");

//     if(btnCopy) btnCopy.disabled = true;
//     if(btnOpen) btnOpen.disabled = true;
//     lastUrl = "";

//     const fd = new FormData(frm);
//     const body = {
//       nombre: (fd.get("nombre")||"").toString().trim(),
//       apellido_paterno: (fd.get("apellido_paterno")||"").toString().trim(),
//       apellido_materno: (fd.get("apellido_materno")||"").toString().trim(),
//       email: (fd.get("email")||"").toString().trim(),
//     };

//     try {
//       console.log("🚀 Iniciando petición...");
//       console.log("Tipo de dato de body:", typeof body); // Debería decir 'object'
//       const j = await apiFetch("/api/rh/aspirantes", {
//         method: "POST",
//         headers: {"Content-Type":"application/json"},
//         //body: JSON.stringify(body)
//         body: body
//       });
//       // const res = await j.json();
//       // if (!j.ok) {
//       //   // Verificamos si el error es de duplicidad (1062)
//       //       if (res.error && res.error.includes("1062")) {
//       //           throw new Error("Este correo electrónico ya está registrado. Por favor, verifica tus datos o contacta a Recursos Humanos.");
//       //       } 
//       //       // Aquí capturamos el error 400 que enviamos desde Python
//       //       throw new Error(result.detail || "Error al procesar la solicitud");
//       //   }
 
//       console.log("✅ Respuesta recibida:", j);
//       lastUrl = j.public_url || "";
      
//       if(out) {
//         out.innerHTML = `
//           <tr>
//             <td style="padding:8px">${j.nombre_completo || "—"}</td>
//             <td style="padding:8px">${j.email || "—"}</td>
//             <td style="padding:8px" class="mono">${j.guid || "—"}</td>
//             <td style="padding:8px">${lastUrl ? `<a href="${lastUrl}" target="_blank" rel="noopener" style="color:var(--accent2)">Abrir Liga</a>` : "—"}</td>
//           </tr>
//         `;
//       }

//       if(btnCopy) btnCopy.disabled = !lastUrl;
//       if(btnOpen) btnOpen.disabled = !lastUrl;

//       setStatus("Listo", "ok");
//       toast("Aspirante creado ✅", "ok");
//       frm.reset(); // Opcional: limpiar formulario al terminar
//     } catch (err) {
//      
//       console.error(err);
//       setStatus("Error", "err");
//       setEmpty("Error: " + err.message);
//       toast(err.message, "err");
//     }
//     btnSubmit.classList.remove("btn-loading");
//   });

//   if(btnCopy) {
//     btnCopy.addEventListener("click", async () => {
//       if(!lastUrl) return;
//       try{
//         await navigator.clipboard.writeText(lastUrl);
//         toast("Liga copiada", "ok");
//       }catch(e){
//         toast("No pude copiar (error de navegador).", "err");
//       }
//     });
//   }

//   if(btnOpen) {
//     btnOpen.addEventListener("click", () => {
//       if(!lastUrl) return;
//       window.open(lastUrl, "_blank", "noopener");
//     });
//   }
// }


//     // Mostramos la pantalla
//     screen.classList.remove("hidden");
// }
// export async function destroy() {
//   console.log("Cleanup aspirantes");
// }