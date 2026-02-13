import { apiFetch, getApiBase } from "../../core/api.js";
import { $, toast, setStatus, showLoader, hideLoader, setApiLabel } from "../../core/ui.js";
console.log("✅ CARGÓ modules/contratos/module.js");

// ✅ Registrar para el router (tu router busca window.Modules.catalogos.init)
window.Modules = window.Modules || {};
window.Modules.contratos = { init, destroy };
export async function init({ host }) {
  setApiLabel(getApiBase());

  const frm = $("#frmContratos", host);
  const btnPing = $("#btnPing", host);
  const btnFill = $("#btnFillDemo", host);

  function clearLinks() {
    $("#docxLink", host).style.display = "none";
    $("#pdfLink", host).style.display = "none";
    $("#docxEmpty", host).style.display = "inline";
    $("#pdfEmpty", host).style.display = "inline";
    $("#driveInfo", host).textContent = "—";
    $("#runBadge", host).textContent = "Sin ejecutar";
  }

  btnPing.addEventListener("click", async () => {
    clearLinks();
    setStatus("Probando...", "info");
    try {
      const j = await apiFetch("/health");
      setStatus("API OK", "ok");
      toast("API respondió: " + JSON.stringify(j), "ok");
    } catch (e) {
      setStatus("API error", "err");
      toast("No pude conectar con la API: " + e.message, "err");
    }
  });

  btnFill.addEventListener("click", () => {
    frm.profesionista_nombre.value = "Hector Antonio Mota Galvan";
    frm.profesionista_rfc.value = "MOGH8703123S8";
    frm.profesionista_curp.value = "MOGH870312HCLTLC08";
    frm.profesionista_email.value = "hectormotagalvan@gmail.com";
    frm.profesionista_telefono.value = "8712312715";
    frm.profesionista_domicilio_fiscal.value = "Av. Ejemplo 123, Col. Centro, Torreón, Coahuila, C.P. 27000";
    frm.servicio_periodo.value = "Otoño 2025";
    frm.servicio_carrera.value = "Licenciatura en Derecho";
    frm.servicio_materia.value = "Derecho Mercantil";
    frm.servicio_categoria.value = "Profesionista A";
    frm.pago_horas.value = "51";
    frm.pago_por_hora.value = "298.04";
    frm.pago_total_semestre.value = "15200";
    frm.pago_total_letra.value = "Quince mil doscientos pesos 00/100 M.N.";
    toast("Datos de ejemplo listos. Adjunta archivos para probar el flujo.", "ok");
  });

  frm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    clearLinks();
    setStatus("Generando...", "info");
    $("#runBadge", host).textContent = "Ejecutando…";

    const fd = new FormData(frm);

    try {
      showLoader("Generando contrato", "Creando DOCX…");
      setTimeout(() => { const m = document.getElementById("loaderMsg"); if (m) m.textContent = "Convirtiendo a PDF…"; }, 1500);
      setTimeout(() => { const m = document.getElementById("loaderMsg"); if (m) m.textContent = "Subiendo a Google Drive…"; }, 3200);

      const res = await fetch(getApiBase() + "/api/contracts/generate", { method: "POST", body: fd });
      const text = await res.text();
      let j = null;
      try { j = JSON.parse(text); } catch { throw new Error("Respuesta no JSON: " + text.slice(0, 200)); }
      if (!res.ok) throw new Error(j.detail || j.error || ("HTTP " + res.status));

      $("#runBadge", host).textContent = j.run_id || "Listo";

      if (j.local_docx_url) {
        const a = $("#docxLink", host);
        a.href = getApiBase() + j.local_docx_url;
        a.style.display = "inline";
        $("#docxEmpty", host).style.display = "none";
      }
      if (j.local_pdf_url) {
        const a = $("#pdfLink", host);
        a.href = getApiBase() + j.local_pdf_url;
        a.style.display = "inline";
        $("#pdfEmpty", host).style.display = "none";
      }

      const di = $("#driveInfo", host);
      if (j.drive) {
        di.innerHTML = "";
        const a = document.createElement("a");
        a.href = j.drive.folder_url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Abrir carpeta en Drive";

        const b = document.createElement("a");
        b.href = j.drive.pdf_view_url;
        b.target = "_blank";
        b.rel = "noopener";
        b.textContent = "Ver PDF en Drive";

        di.appendChild(a);
        di.appendChild(document.createTextNode(" • "));
        di.appendChild(b);
      } else {
        di.textContent = "—";
      }

      setStatus("Listo", "ok");
      hideLoader();
      toast("Contrato generado correctamente.", "ok");
    } catch (e) {
      setStatus("Error", "err");
      hideLoader();
      toast(e.message, "err");
      $("#runBadge", host).textContent = "Error";
    }
  });
}

export async function destroy() {
  // Nada que limpiar por ahora (si luego agregas intervalos/listeners globales, aquí los limpias)
}
