import { apiFetch, getApiBase, CONFIG } from "../../core/api.js";
import { $, toast, setStatus, showLoader, hideLoader, setApiLabel, showErrorPopup, showConfirm } from "../../core/ui.js";

console.log("✅ CARGÓ modules/expedientes/module.js");
// Variable global para mantener la referencia de los datos
window.datosAspirantes = [];
//const API_BASE = CONFIG.API_BASE;//"http://localhost";
const URL_BASE = CONFIG.URL_BASE;//"http://localhost";
window.Modules = window.Modules || {};
window.Modules.expedientes = { init, destroy };
// 2. Escuchar la tecla ESCAPE de forma global
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        closemodalpreviewDocumento();
    }
});
window.approveAndSendSignature =  async function(aspiranteId) {
    //if (!confirm("¿Deseas aprobar este expediente y enviar el correo para firma electrónica?")) return;

    showLoader("Procesando", "Generando token de firma");
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
        const response = await apiFetch(`/api/rh/aspirantes/${aspiranteId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // 'Authorization': 'Bearer ' + token // Si usas require_rh con JWT
            }
        });

        const result = await response.json();

        if (response.ok) {
            toast("¡Expediente aprobado! El aspirante recibirá un correo para firmar.", "ok");
            hideLoader();
            showLoader("Procesando", "¡Expediente aprobado! El aspirante recibirá un correo para firmar.");
            setTimeout(() => location.reload(), 2000); // Recargamos para actualizar estatus
        } else {
            hideLoader(); // Ocultar solo si hay error para ver el toast
            throw new Error(response.detail || "Error al aprobar");
        }
    } catch (error) {
        hideLoader();
      showErrorPopup("Error", error.message);
        toast(error.message, "err");
        console.error(error);
    } finally {
        //hideLoader();
    }
}
// window.openPreview = function(url, tipo, aspiranteGuid, estaAprobado) {
//   // Si estaAprobado llega como 1, esta condición será verdadera
//     const aprobado = estaAprobado == "0" ? false: true;
//     window.currentGuid = aspiranteGuid; 
//     const modal = document.getElementById('previewModalRevisarFirmas');
//     const body = document.getElementById('modalBody');
//     const modalTitle = document.getElementById('modalTitle');
//     const isImg = url.match(/\.(jpeg|jpg|png|gif|webp)$/i);


//     if (!modal || !body) return;

//     modalTitle.innerText = `Visualizando: ${tipo}`;
//     modal.style.display = "flex";
//     modal.classList.remove('hidden');

//     if (isImg) {
//         body.innerHTML = `
//             <div class="zoom-container" id="zoomWrapper">
//                 <img src="${url}" id="previewImg" class="zoomable-img" title="Click para aumentar / Arrastrar para ver más">
//             </div>
//             <div style="text-align:center; margin-top:10px; color:#666; font-size:0.85rem;">
//                 💡 Tip: Haz clic en la imagen para activar/desactivar el zoom.
//             </div>
//         `;
        
//         // Agregar evento de zoom simple al hacer clic
//         const img = document.getElementById('previewImg');
//         img.onclick = function() {
//             this.classList.toggle('zoomed');
//         };
//     } else {
//         body.innerHTML = `<iframe src="${url}" style="width:100%; height:75vh; border:none; border-radius:4px;" frameborder="0"></iframe>`;
//     }

//     // Botones de acción inferiores
//     const actions = document.createElement('div');
//     actions.style.cssText = "margin-top:20px; display:flex; justify-content:center; gap:15px;";
//     // 1. Botón de cerrar (siempre visible)
//     const btnClose = `
//         <button id="btnAprobarDoc" class="btn" style="background:#28a745; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">
//                 ✅ Aprobar Documento
//             </button>
//         <button id="btnclose" onclick="closemodalpreviewDocumento()" class="btn" style="background:#6c757d; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;">
//             Cerrar (Esc)
//         </button>`;
//     // 2. Botón de error (SOLO si NO está aprobado)
//     if (!aprobado) {
//       actions.innerHTML = `
//           <button id="btnNotificarError" class="btn-reject" style="color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">
//               ❌ Rechazar
//           </button>
//           ${btnClose}
//       `;
//     } else {
//         // Si está aprobado, solo mostramos el botón de cerrar y quizás un indicador
//         actions.innerHTML = `
//             <span style="color:#28a745; font-weight:bold; align-self:center;">✅ Documento Validado y Bloqueado</span>
//             ${btnClose}
//         `;
//     }
//     body.appendChild(actions);
//     // ASIGNACIÓN DIRECTA DEL EVENTO (Más seguro que el atributo onclick)
//     // ASIGNACIÓN SEGURA
//     const btnRechazo = actions.querySelector('#btnNotificarError');
//     if (btnRechazo) {
//         btnRechazo.onclick = function() {
//             window.notificarErrorDocumento(tipo);
//         };
//     }
// }
//MODAL PARA VALIDAR FIRMAS
window.openModalValidarFirmas = async function(guid) {
    showLoader("Cargando comparación", "Obteniendo documentos de identidad...");
    try {
        const data = await apiFetch(`/api/rh/aspirantes/${guid}/comparison-data`);
        
        const modal = document.getElementById('modalValidarFirmas');
        const modalContent = modal.querySelector('.modal-content') || modal.children[0]; // Buscamos el div interno
        const body = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');

        // AJUSTE DE TAMAÑO: Hacemos el modal más estrecho
        if (modalContent) {
            modalContent.style.maxWidth = "700px"; 
            modalContent.style.width = "90%";
            modalContent.style.margin = "auto";
        }

        modalTitle.innerText = "Verificación de Identidad: Firma vs INE";
        const firmaData = data.path_firma; 
        let firmaSrc = "";

        if (firmaData && firmaData.length > 50) { 
            // Si el texto es largo y no tiene el prefijo, se lo ponemos
            // Esto convierte el "iVBOR..." en algo que el navegador entiende
            firmaSrc = firmaData.startsWith('data:image') 
                      ? firmaData 
                      : `data:image/png;base64,${firmaData}`;
        } else {
            firmaSrc = "https://placehold.co/400x200?text=Sin+Firma+Capturada";
        }

        const ineSrc = data.path_ine_vuelta 
                          ? `${URL_BASE}/${data.path_ine_vuelta}` 
                          : "https://placehold.co/400x200?text=INE+no+encontrada";
        // Función para determinar si es PDF o Imagen
        const renderPreview = (url) => {
            if (!url) return '<p class="text-gray-400">Sin archivo</p>';
            
            const esPDF = url.toLowerCase().endsWith('.pdf');

            if (esPDF) {
                return `
                    <div style="width: 100%; height: 300px; border-radius: 8px; overflow: hidden; border: 1px solid #ddd;">
                        <iframe src="${url}#toolbar=0&navpanes=0" style="width: 100%; height: 100%; border: none;"></iframe>
                    </div>`;
            } else {
                return `
                    <div style="background: white; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd;">
                        <img src="${url}" style="max-width: 100%; height: auto; border-radius: 4px;" 
                            onerror="this.src='https://placehold.co/400x300?text=Error+al+cargar+archivo'">
                    </div>`;
            }
        };
        body.innerHTML = `
            <div style="display: flex; gap: 20px; justify-content: center; align-items: start; padding: 20px;">
                <div style="flex: 1; text-align: center;">
                    <h4 style="color: white; margin-bottom: 10px;">Firma Digital Capturada</h4>
                    <div style="background: white; padding: 10px; border-radius: 8px; min-height: 150px; display: flex; align-items: center;">
                        <img src="${firmaSrc}" style="width: 100%; height: auto; border-radius: 4px;">
                    </div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <h4 style="color: white; margin-bottom: 10px;">INE (Reverso / Firma)</h4>
                    ${renderPreview(ineSrc)}
                </div>
            </div>
            <div style="text-align: center; color: #cbd5e1; margin-top: 15px; font-style: italic;">
                Compare visualmente la rúbrica de la identificación oficial contra la firma digital.
            </div>
            
            <div style="display: flex; justify-content: center; gap: 20px; margin-top: 30px;">
                <button onclick="finalizarAltaDocente('${guid}', true)" class="btn" style="background: #2e7d32; color: white; padding: 12px 30px; border-radius: 8px; font-weight: bold;">
                    ✅ Firma Coincide - Crear Usuario
                </button>
                <button onclick="finalizarAltaDocente('${guid}', false)" class="btn" style="background: #b00020; color: white; padding: 12px 30px; border-radius: 8px; font-weight: bold;">
                    ❌ Rechazar Firma - Solicitar Re-firma
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
        modal.style.display = "flex";
    } catch (e) {
        showErrorPopup ("Error",e.message)
        toast("Error al cargar comparativa: " + e.message, "err");
    } finally {
        hideLoader();
    }
};
window.cerrarModalValidarFirmas = function() {
    const elModal = document.getElementById('modalValidarFirmas');
    if (elModal) elModal.style.display = 'none';
    document.getElementById('visorPDF').src = "";
};



export async function init({ host }) {
  setApiLabel(getApiBase());
const btnClearSearch = $("#btnClearSearch", host);
    const frm = $("#formNuevoAspirante", host);
  const searchBox = $("#searchBox", host);
  const btnSearch = $("#btnSearch", host);
  const btnPrev = $("#btnPrev", host);
  const btnNext = $("#btnNext", host);

  const body = $("#tblBody", host);
  const pagerInfo = $("#pagerInfo", host);
  //const pageBadge = $("#pageBadge", host);

  let curPage = 1;
  const pageSize = 20;
  let totalPages = 1;


  function fmtDate(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("es-MX"); }
    catch { return iso; }
  }

  function setEmpty(msg = "—") {
    body.innerHTML = `<tr><td colspan="8" class="small">${msg}</td></tr>`;
  }
  // Mostrar/Ocultar botón X según el contenido
searchBox.addEventListener("input", () => {
    if (searchBox.value.length > 0) {
        btnClearSearch.classList.remove("hidden");
    } else {
        btnClearSearch.classList.add("hidden");
    }
});
// Acción de limpiar
btnClearSearch.addEventListener("click", () => {
    searchBox.value = "";
    btnClearSearch.classList.add("hidden");
    searchBox.focus();
    load({ page: 1, search: "" }); // Recarga la tabla original
});
  async function resend(id,email) {
    // 1. Usamos el nuevo Confirm elegante
    const confirmed = await showConfirm(
        "Reenviar Invitación", 
        `Se enviará una nueva liga de acceso a: ${email}`, 
        "📩"
    );

    if (!confirmed) return;

    // 2. Si confirmó, mostramos loader
    showLoader("Enviando...", "Procesando correo SMTP");
    try {
      setStatus("Reenviando...", "info");
      const j = await apiFetch(`/api/rh/aspirantes/${id}/resend`, { method: "POST" });
      toast("Invitación reenviada ✅", "ok");
      await load({ page: curPage });
      setStatus("Listo", "ok");
      hideLoader();
      return j.link;
    } catch (e) {
      hideLoader()
      showErrorPopup("Error",e.message);
      setStatus("Error", "err");
      toast(e.message, "err");
    }
  }

  async function load(opts = {}) {
const s = opts.search !== undefined ? opts.search : searchBox.value.trim();
    const page = opts.page ?? curPage;
    // DETERMINAR MENSAJE DEL LOADER
    if (s) {
        showLoader("Buscando...", `Filtrando expedientes por: "${s}"`);
    } else {
        showLoader("Cargando...", "Obteniendo información de aspirantes");
    }

    try {
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const j = await apiFetch("/api/rh/aspirantes?" + params.toString());
      //console.log("Datos recibidos:", j);
      curPage = j.page || page;
      totalPages = j.pages || 1;
      // Guardamos los datos en la variable global
        window.datosAspirantes = j.items;
      //pageBadge.textContent = String(curPage);
      pagerInfo.textContent = `Total: ${j.total} • Páginas: ${j.pages} • Mostrando: ${j.items?.length || 0}`;

      const items = j.items || [];
      if (!items.length) {
        hideLoader();
        setEmpty("Sin resultados.");
        setStatus("Listo", "ok");
        return;
      }

      body.innerHTML = items.map(it => {
        const pct = Number(it.percent_complete || 0);
        const bar = `
          <div class="progress-container">
            <div class="progress-text">${pct}% • etapa ${it.current_step || 0}/5</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        `;
        const link = it.link_contratos || "";
        const sent = `${fmtDate(it.invite_sent_at)} • ${it.invite_sent_count || 0} envíos`;

        return `
          <tr>

            <td id="acciones-${it.guid}" class="actions">${getAccionesPorEtapa(it)}</td>
            
            <!-- <td class="mono">${it.aspirante_id}</td>           
            <td>${it.email || "—"}</td>--> 
            <td>${it.nombre_completo || "—"}</td>
            <td>${getEtapaBadge(it.etapa_flujo)}</td>
            <td class="p-3" id="docs-${it.guid}">
                <div class="flex gap-3">
                    ${renderDocumentIcons(it)}
                </div>
            </td>
            <td>${bar}</td>
            <!--<td class="small">${fmtDate(it.last_saved_at)}</td>
            <td class="small">${sent}</td>-->
            <td class="actions">
              <a href="${link}" target="_blank" rel="noopener">Abrir</a>
              &nbsp;•&nbsp;
              <!--<a href="#" data-copy="${link}">Copiar</a>
              &nbsp;•&nbsp;-->
              <a href="#" data-resend="${it.aspirante_id}" data-email="${it.email}">Reenviar</a>
            </td>
              
          </tr>
        `;
      }).join("");

      // Wire actions
      host.querySelectorAll("[data-copy]").forEach(a => {
        a.addEventListener("click", async (ev) => {
          ev.preventDefault();
          const link = a.dataset.copy || "";
          if (!link) return;
          await navigator.clipboard.writeText(link);
          toast("Liga copiada", "ok");
        });
      });

      host.querySelectorAll("[data-resend]").forEach(a => {
        a.addEventListener("click", async (ev) => {
          ev.preventDefault();
          const id = Number(a.dataset.resend);
          const email = a.dataset.email; // <--- Capturamos el email aquí
          if (!id || !email) return;      
          await resend(id, email);
        });
      });
      hideLoader();
      setStatus("Listo", "ok");
    } catch (e) {
      //setEmpty("Error cargando: " + e.message);
      hideLoader();
      showErrorPopup("Error",e.message);
      setStatus("Error", "err");
      toast("Expedientes: " + e.message, "err");
    }
  }

  btnSearch.addEventListener("click", () => { curPage = 1; load({ page: 1 }); });
  searchBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); curPage = 1; load({ page: 1 }); }
  });

  btnPrev.addEventListener("click", () => { if (curPage > 1) load({ page: curPage - 1 }); });
  btnNext.addEventListener("click", () => { if (curPage < totalPages) load({ page: curPage + 1 }); });
  host.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.approve;
      if (!confirm("¿Autorizar expediente y enviar firma?")) return;

      await apiFetch(`/api/rh/aspirantes/${id}/approve`, {
        method: "POST"
      });

      toast("Expediente aprobado y correo enviado ✅", "ok");
      load(); // recargar tabla
    });
  });

window.toggleNuevoAspirante = function toggleNuevoAspirante() {
    const divfrm = document.getElementById('divNuevoAspirante');
    if (!divfrm) {
        console.error("No se encontró el elemento 'divNuevoAspirante' en el DOM");
        return;
    }
    const isHidden = (divfrm.style.display === "none" || divfrm.style.display === "");    divfrm.style.display = isHidden ? "block" : "none";
    divfrm.style.display = isHidden ? "block" : "none";
    // Solo intentamos el focus si el elemento reg_nombre existe
    if (isHidden) {
        const inputNombre = document.getElementById('reg_nombre');
        if (inputNombre) inputNombre.focus();
    }
}

  frm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = frm.querySelector('button[type="submit"]');
    btnSubmit.classList.add("btn-loading"); // Usar el spinner qu
    btnSubmit.disabled = true; // Evitar doble click
    setStatus("Creando...", "info");
    //setEmpty("Procesando en servidor...");
    showLoader("Procesando", "Creando aspirante");
    await new Promise(resolve => setTimeout(resolve, 1000));


    const fd = new FormData(frm);
    const body = {
      nombre: (fd.get("nombre")||"").toString().trim(),
      apellido_paterno: (fd.get("apellido_paterno")||"").toString().trim(),
      apellido_materno: (fd.get("apellido_materno")||"").toString().trim(),
      email: (fd.get("email")||"").toString().trim(),
    };

    try {
      console.log("🚀 Iniciando petición...");
      console.log("Tipo de dato de body:", typeof body); // Debería decir 'object'
      const j = await apiFetch("/api/rh/aspirantes", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        //body: JSON.stringify(body)
        body: body
      });
      // const res = await j.json();
      // if (!j.ok) {
      //   // Verificamos si el error es de duplicidad (1062)
      //       if (res.error && res.error.includes("1062")) {
      //           throw new Error("Este correo electrónico ya está registrado. Por favor, verifica tus datos o contacta a Recursos Humanos.");
      //       } 
      //       // Aquí capturamos el error 400 que enviamos desde Python
      //       throw new Error(result.detail || "Error al procesar la solicitud");
      //   }
      console.log("✅ Aspirante creado:", j);
      // 1. Notificar éxito
      toast("Aspirante creado e invitado ✅", "ok");
      // 2. Limpiar y cerrar el formulario
      frm.reset();
      if (typeof toggleNuevoAspirante === 'function') {
          toggleNuevoAspirante(); 
      }
// 3. RECARGAR LA TABLA DE ABAJO
      // Asumiendo que tu función de carga se llama loadData() o init()
      if (typeof loadData === 'function') {
          await loadData(); 
      } else {
          // Si no tienes función de carga, recargamos la página como fallback
          window.location.reload();
      }

      setStatus("Listo", "ok");
      //toast("Aspirante creado ✅", "ok");
      frm.reset(); // Opcional: limpiar formulario al terminar
    } catch (err) {
      showErrorPopup("Correo ya registrado", err.message);
      console.error(err);
      setStatus("Error", "err");
      //setEmpty("Error: " + err.message);
      toast(err.message, "err");
    }finally {
      btnSubmit.classList.remove("btn-loading");
      btnSubmit.disabled = false;

        hideLoader();
    }
  });



window.notificarErrorDocumento = async function (tipoDoc) {
    const motivo = prompt(`Escribe el motivo del rechazo para ${tipoDoc}:`, "El documento es ilegible o está vencido.");
    if (!motivo) return;

    // Aquí llamarías a un endpoint que envíe un correo al aspirante
    try {
        const res = await apiFetch(`/api/rh/notificar-error`, {
            method: 'POST',
            body: JSON.stringify({ guid: window.currentGuid, motivo: motivo, documento: tipoDoc })
        });
        if(res.ok) toast("Notificación enviada al aspirante", "ok");
    } catch (e) {
      toast("Error al enviar notificación", "err");
    }
      }
        await load({ page: 1 });
}
/**
 * Renderiza los iconos de carpeta con colores dinámicos
 * @param {Object} docs - Objeto con el estado de cada documento
 */
let docActual = { guid: '', campo: '' };
window.renderDocumentIcons = function (row = {}) {
    // Definimos los documentos que esperamos
    const catalogoDocs = [
        { key: 'ine1', label: 'INE Frente',url:row.path_ine_frente, fileName: "file_ine_frente" },
        { key: 'ine2', label: 'INE atras',url:row.path_ine_vuelta, fileName: "file_ine_vuelta" },
        { key: 'curp', label: 'CURP',url:row.path_curp, fileName: "file_curp" },
        { key: 'dom', label: 'Domicilio',url:row.path_comprobante, fileName: "file_comprobante" },
        { key: 'rfc', label: 'Constancia Fiscal',url:row.path_constancia_fiscal, fileName: "file_constancia_fiscal" }
    ];

    return catalogoDocs.map(doc => {
      // Dentro de tu .map o bucle de la tabla
      const statusObj = typeof row.docs_status === 'string' 
          ? JSON.parse(row.docs_status) 
          : row.docs_status;
        // Obtenemos el estado (puedes ajustarlo según lo que mande tu BD)
        const estado = (statusObj[doc.key] || 'vacio').toLowerCase(); 
        
        let colorHex = '#9ca3af'; // Gris (vacio)
        if (estado === 'cargado')   colorHex = '#eab308'; // Amarillo
        if (estado === 'validado')  colorHex = '#16a34a'; // Verde
        if (estado === 'rechazado') colorHex = '#dc2626'; // Rojo
        const canOpen = estado !== 'vacio';
        return `
            <div ${canOpen ? `onclick="openmodalpreviewDocumento('${row.aspirante_id}','${row.guid}','${doc.key}','${doc.url}', '${doc.label}', '${doc.fileName}')"` : ''} 
                 style="display: inline-flex; flex-direction: column; align-items: center; margin-right: 12px; cursor: pointer;">
                <i class="fas fa-folder" style="color: ${colorHex}; font-size: 24px;"></i>
                <span style="font-size: 9px; font-weight: bold; color: #4b5563;">${doc.key.toUpperCase()}</span>
            </div>
        `;
    }).join('');
}



// Vista Previa documento anexo
window.openmodalpreviewDocumento = async function(aspirante_id, guid, campo, url, titulo, fileName) {
    //const { guid, campo, aspirante_id } = window.docActual;
    window.docActual = { guid, campo, aspirante_id, fileName };

    const elTitulo = document.getElementById('tituloDoc');
    const elModal = document.getElementById('modalpreviewDocumento');
    const elVisor = document.getElementById('visorPDF');

    // Validación de seguridad
    if (!elTitulo || !elModal || !elVisor) {
        console.error("❌ Error: No se encontraron los elementos del modal en el HTML.");
        alert("Error técnico: El modal de revisión no está cargado en la página.");
        return;
    }

    // 1. Seteamos título y URL
    elTitulo.innerText = `Revisando: ${titulo}`;
    
    // Ajusta esta URL a tu ruta real de archivos
    const url_ = `${URL_BASE}/${url}`; 
    // El parámetro #view=FitH hace que el PDF se centre y ajuste al ancho disponible
    if (elVisor) {
        elVisor.src = url_ + "#view=FitH&toolbar=0"; 
    }
    //elVisor.src = url_;

    // 2. Mostramos el modal
    // FORZAR VISIBILIDAD
    elModal.style.setProperty('display', 'flex', 'important');
    console.log("✅ Modal activado");
};
window.aprobarRechazarDocumento = async function(accion) {
    const { guid, campo, aspirante_id, fileName } = window.docActual;

    try {
        const res = await apiFetch(`/api/rh/documento/aprobarRechazar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guid, campo, estado: accion, aspirante_id, fileName })
        });

        //const res = await response.json();

        if (res.ok) {
            // 1. Buscamos al aspirante en nuestro array local de datos
            const aspirante = window.datosAspirantes.find(a => a.guid === guid);
            
            if (aspirante) {
                // Actualizamos el objeto docs_status localmente
                // Recordando tu mapeo: 2 = validado, 3 = rechazado
                let docs = typeof aspirante.docs_status === 'string' 
                    ? JSON.parse(aspirante.docs_status) 
                    : aspirante.docs_status;

                docs[campo] = accion; // e.g., 'validado'
                aspirante.docs_status = docs; 

                // 2. Volvemos a pintar los iconos y el botón de acción para esa fila
                actualizarFilaDocumentoAprobadoRechazado(guid);
            }
            
            // 3. Cerramos modal o pasamos al siguiente automáticamente
            closemodalpreviewDocumento();
        }
    } catch (error) {
        console.error("Error al dictaminar:", error);
    }
};
window.closemodalpreviewDocumento = function () {
    const modal = document.getElementById('modalpreviewDocumento');
    if (modal) {
        modal.style.display = "none";
        modal.classList.add('hidden');
        // Limpiamos el HTML para resetear el estado del zoom
        document.getElementById('modalBody').innerHTML = '';
    }
}
window.actualizarFilaDocumentoAprobadoRechazado = function(guid) {
    const aspirante = datosAspirantes.find(a => a.guid === guid);
    if (!aspirante) return;

    // Buscamos los contenedores específicos mediante un atributo data o ID
    // Suponiendo que tus celdas tienen IDs como `docs-container-GUID`
    const contenedorIconos = document.getElementById(`docs-${guid}`);
    const contenedorAcciones = document.getElementById(`acciones-${guid}`);

    if (contenedorIconos) {
        contenedorIconos.innerHTML = renderDocumentIcons(aspirante);
    }

    if (contenedorAcciones) {
        contenedorAcciones.innerHTML = getAccionesPorEtapa(aspirante);
    }
};



// 1. Función para pintar la etiqueta de la etapa
window.getEtapaBadge = function (etapa) {
    const etapas = {
        1: { txt: "Datos Personales", cls: "bg-gray-100 text-gray-600" },
        2: { txt: "Servicio y Pago", cls: "bg-blue-100 text-blue-600" },
        3: { txt: "Carga de Anexos", cls: "bg-indigo-100 text-indigo-600" },
        4: { txt: "Por Validar Docs (RH)", cls: "bg-yellow-100 text-yellow-700" },
        5: { txt: "Firma de Contrato", cls: "bg-purple-100 text-purple-600" },
        6: { txt: "Validar Firma/INE", cls: "bg-orange-100 text-orange-700" },
        7: { txt: "Finalizado", cls: "bg-green-100 text-green-700" }
    };

    const config = etapas[etapa] || { txt: "Desconocido", cls: "bg-red-100 text-red-600" };
    return `<span class="px-2 py-1 rounded-full text-xs font-bold ${config.cls}">
                ${etapa}. ${config.txt}
            </span>`;
}

// 2. Función para generar los botones de acción según la etapa
window.getAccionesPorEtapa = function (aspirante) {
    const guid = aspirante.guid;
    const id = aspirante.aspirante_id;
    const etapa = parseInt(aspirante.etapa_flujo);

    // Definimos los botones como componentes limpios
    const btnClass = "btn-modern";
    const todosAprobados = verificarSiTodosDocumentosAprobados(aspirante.docs_status);
    if (etapa === 4) {
        if (todosAprobados) {
            return `
                <button onclick="approveAndSendSignature('${id}')" class="${btnClass} btn-review">
                    <i class="fas fa-search"></i> Aprobar docs
                </button>`;
        }else{
            return `
            <button class="btn-modern" style="background-color: #d1d5db; color: #9ca3af; cursor: not-allowed;" disabled title="Faltan documentos por aprobar">
                    <i class="fas fa-lock"></i> Enviar a Firma
                </button>`;
        }
    }

    if (etapa === 6) {
        return `
            <button onclick="openModalValidarFirmas('${guid}')" class="${btnClass} btn-signature">
                <i class="fas fa-file-contract"></i> Validar Firmas
            </button>`;
    }

    if (etapa === 7) {
        return `
            <div class="status-pill status-complete">
                <i class="fas fa-check-circle"></i> Proceso Completo
            </div>`;
    }

    return `
        <div class="status-pill status-waiting">
            <i class="fas fa-hourglass-half"></i> Esperando docente
        </div>`;
}

window.finalizarAltaDocente = async function(aspiranteId, guid) {
    //const confirmar = confirm("¿Estás seguro de finalizar el alta? Esto notificará al docente y cerrará el expediente.");
    
    //if (!confirmar) return;

    try {
        const response = await apiFetch(`/api/rh/finalizar-alta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                aspirante_id: parseInt(aspiranteId),
                guid: guid
            })
        });

        //const res = await response.json();

        if (response.ok) {
          showConfirm("Exito","✅ Alta finalizada con éxito. Se ha enviado el correo de confirmación.")
            //alert("✅ Alta finalizada con éxito. Se ha enviado el correo de confirmación.");
            // Recargamos la tabla o actualizamos la fila
            if (window.recargarTablaAspirantes) window.recargarTablaAspirantes();
        } else {
          showErrorPopup("❌ Error: " + response.error)
            //alert("❌ Error: " + res.error);
        }
    } catch (error) {
        console.error("Error al finalizar:", error);

          showErrorPopup("❌ Error: " + error.message)
        //alert("Ocurrió un error en la comunicación con el servidor.");
    }
};
window.verificarSiTodosDocumentosAprobados = function(docsRaw) {
    let docs = {};
    try {
        docs = typeof docsRaw === 'string' ? JSON.parse(docsRaw) : docsRaw;
    } catch (e) {
        return false;
    }

    // Lista de llaves obligatorias que definimos en tu SQL
    const requeridos = ['ine1', 'ine2', 'curp', 'rfc', 'dom'];
    
    // Verificamos que TODOS tengan el valor 'validado'
    return requeridos.every(key => docs[key] === 'validado');
};
export async function destroy() {}
