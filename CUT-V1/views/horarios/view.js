import { state } from "../../assets/js/state.js";
import { uniq, sortByStartTime } from "../../assets/js/utils.js";

export function initView(root){
  root.querySelector("#btnExportHorarioExcel").addEventListener("click", ()=>{
    exportHorarioToExcel(root);
  });
}

export function renderView(root){
  renderHorarios(root);
}

function renderHorarios(root){
  const tbody = root.querySelector("#tablaHorarioGrid tbody");
  if (tbody) tbody.innerHTML = "";

  const cards = root.querySelector("#horarioCards");
  cards.innerHTML = "";
  cards.classList.add("tableCards");

  const dias = ["Lunes","Martes","Miércoles","Jueves","Viernes"];

  // Móvil: acordeón por día
  const accId = "accHorarioDias";
  const acc = document.createElement("div");
  acc.className = "accordion";
  acc.id = accId;

  dias.forEach((dia, idx) => {
    const items = state.horarios
      .filter(x => x.dia === dia)
      .slice()
      .sort((a,b)=> sortByStartTime(a.hora, b.hora));

    const open = idx === 0;
    const safeId = dia.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\W+/g,"_");
    const headerId = `h_${safeId}`;
    const bodyId = `b_${safeId}`;

    const bodyHtml = items.map(it=>{
      const isReceso = it.tipo === "RECESO" || String(it.materia||"").toUpperCase() === "RECESO";
      if (isReceso){
        return `
          <div class="item" style="background: rgba(255,209,102,.12); border-color: rgba(255,209,102,.25);">
            <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
              <div class="fw-bold">RECESO</div>
              <div class="row-muted" style="font-size:12px;">${it.hora}</div>
            </div>
          </div>
        `;
      }
      return `
        <div class="item">
          <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
            <div class="fw-bold materia">${it.materia}</div>
            <div class="row-muted" style="font-size:12px;">${it.hora}</div>
          </div>
          <div class="row-muted" style="font-size:12px; margin-top:6px;">
            Aula: <strong style="color:var(--text)">${it.aula || "—"}</strong>
          </div>
        </div>
      `;
    }).join("");

    const wrapper = document.createElement("div");
    wrapper.className = "accordion-item";
    wrapper.style.background = "transparent";
    wrapper.style.border = "1px solid rgba(255,255,255,.10)";
    wrapper.style.borderRadius = "14px";
    wrapper.style.overflow = "hidden";
    wrapper.style.marginBottom = "10px";

    wrapper.innerHTML = `
      <h2 class="accordion-header" id="${headerId}">
        <button class="accordion-button ${open ? "" : "collapsed"}"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#${bodyId}"
                aria-expanded="${open ? "true" : "false"}"
                aria-controls="${bodyId}">
          <div class="w-100 d-flex justify-content-between gap-2 flex-wrap">
            <div class="fw-bold">${dia}</div>
            <div class="row-muted" style="font-size:12px;">${items.length} bloques</div>
          </div>
        </button>
      </h2>
      <div id="${bodyId}"
           class="accordion-collapse collapse ${open ? "show" : ""}"
           aria-labelledby="${headerId}"
           data-bs-parent="#${accId}">
        <div class="accordion-body">
          <div class="tableCards" style="display:flex; flex-direction:column; gap:10px;">
            ${bodyHtml || `<div class="row-muted">— Sin horario —</div>`}
          </div>
        </div>
      </div>
    `;

    acc.appendChild(wrapper);
  });

  cards.appendChild(acc);

  // Desktop grid
  if (tbody){
    const horas = uniq(state.horarios.map(h => h.hora)).sort(sortByStartTime);

    horas.forEach(hora=>{
      const tr = document.createElement("tr");

      const tdHora = document.createElement("td");
      tdHora.innerHTML = `<strong>${hora}</strong>`;
      tr.appendChild(tdHora);

      const isReceso = state.horarios.some(h => h.hora === hora && (h.tipo === "RECESO" || String(h.materia||"").toUpperCase()==="RECESO"));
      if(isReceso){
        const td = document.createElement("td");
        td.colSpan = dias.length;
        td.innerHTML = `<strong>RECESO</strong>`;
        td.style.textAlign = "center";
        td.style.background = "rgba(255,209,102,.18)";
        td.style.fontWeight = "900";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }

      dias.forEach(dia=>{
        const td = document.createElement("td");
        const item = state.horarios.find(h => h.hora === hora && h.dia === dia);
        if(item){
          td.innerHTML = `
            <div style="font-weight:800;">${item.materia}</div>
            <div class="row-muted" style="font-size:12px;">Aula: ${item.aula}</div>
          `;
        }else{
          td.textContent = "—";
          td.classList.add("row-muted");
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }
}

function exportHorarioToExcel(root){
  const table = root.querySelector("#tablaHorarioGrid");
  if(!table) return alert("No se encontró la tabla del horario.");

  const clone = table.cloneNode(true);
  clone.style.borderCollapse = "collapse";
  clone.querySelectorAll("th, td").forEach(cell=>{
    cell.style.border = "1px solid #999";
    cell.style.padding = "8px";
    cell.style.verticalAlign = "top";
  });
  clone.querySelectorAll("th").forEach(th=>{
    th.style.background = "#efefef";
    th.style.fontWeight = "700";
  });

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /></head>
    <body>
      <h3>Horario semanal</h3>
      ${clone.outerHTML}
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `horario_${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
