import { state } from "../../assets/js/state.js";
import { uniq } from "../../assets/js/utils.js";

export function initView(root){
  root.querySelector("#periodType").addEventListener("change", ()=> renderView(root));
  root.querySelector("#periodNumber").addEventListener("change", ()=> renderView(root));
}

export function renderView(root){
  const typeSel = root.querySelector("#periodType");
  const numSel  = root.querySelector("#periodNumber");

  // fill numbers based on type
  const nums = uniq(state.calificaciones.filter(x=>x.periodType===typeSel.value).map(x=>x.period))
    .sort((a,b)=>a-b);

  const prev = numSel.value || "ALL";
  numSel.innerHTML = `<option value="ALL">Todos</option>` + nums.map(n=>`<option value="${n}">${n}</option>`).join("");
  numSel.value = nums.includes(Number(prev)) ? prev : "ALL";

  const filtered0 = state.calificaciones.filter(x=>x.periodType===typeSel.value);
  const allAvg = avgFinal(filtered0);
  root.querySelector("#avgAll").textContent = (Math.round(allAvg*10)/10).toFixed(1);
  root.querySelector("#countAll").textContent = String(filtered0.length);

  let filtered = filtered0;
  if(numSel.value !== "ALL"){
    filtered = filtered.filter(x=>String(x.period)===String(numSel.value));
  }
  filtered.sort((a,b)=>(a.period-b.period) || a.materia.localeCompare(b.materia));

  const cont = root.querySelector("#periodsContainer");
  cont.innerHTML = "";
  if(!filtered.length){
    cont.innerHTML = `<span class="badgeX"><span class="dot warn"></span> No hay calificaciones para este filtro</span>`;
    return;
  }

  const groups = groupByPeriod(filtered);
  const accId = "accPeriods";
  const acc = document.createElement("div");
  acc.className = "accordion";
  acc.id = accId;

  Array.from(groups.entries())
    .sort((a,b)=> Number(a[0].split("|")[1]) - Number(b[0].split("|")[1]))
    .forEach(([key, items], idx)=>{
      const [pt, pn] = key.split("|");
      const avg = avgFinal(items);
      const open = (numSel.value !== "ALL") || idx===0;

      const safe = `${pt}_${pn}`.replace(/\W+/g,"_");
      const headerId = `h_${safe}`;
      const bodyId = `b_${safe}`;

      acc.insertAdjacentHTML("beforeend", `
        <div class="accordion-item">
          <h2 class="accordion-header" id="${headerId}">
            <button class="accordion-button ${open ? "" : "collapsed"}" type="button"
              data-bs-toggle="collapse" data-bs-target="#${bodyId}"
              aria-expanded="${open ? "true":"false"}" aria-controls="${bodyId}">
              <div class="w-100 d-flex justify-content-between gap-2 flex-wrap">
                <div class="fw-bold">${pt} ${pn}</div>
                <div class="row-muted" style="font-size:12px;">${items.length} materias • Promedio ${(Math.round(avg*10)/10).toFixed(1)}</div>
              </div>
            </button>
          </h2>
          <div id="${bodyId}" class="accordion-collapse collapse ${open?"show":""}" aria-labelledby="${headerId}" data-bs-parent="#${accId}">
            <div class="accordion-body">
              <div class="d-md-none tableCards" style="display:flex;flex-direction:column;gap:10px;">
                ${items.map(r=>`
                  <div class="item">
                    <div class="d-flex justify-content-between gap-2 flex-wrap">
                      <div class="fw-bold">${r.materia}</div>
                      ${statusBadge(r.final)}
                    </div>
                    <div class="kv"><div class="k">Parcial 1</div><div class="v">${r.p1 ?? "—"}</div></div>
                    <div class="kv"><div class="k">Parcial 2</div><div class="v">${r.p2 ?? "—"}</div></div>
                    <div class="kv"><div class="k">Final</div><div class="v">${r.final ?? "—"}</div></div>
                  </div>
                `).join("")}
              </div>

              <div class="d-none d-md-block">
                <div class="table-responsive">
                  <table class="table table-dark table-borderless align-middle mb-0">
                    <thead><tr><th>Materia</th><th>P1</th><th>P2</th><th>Final</th><th>Estatus</th></tr></thead>
                    <tbody>
                      ${items.map(r=>`
                        <tr>
                          <td><strong>${r.materia}</strong></td>
                          <td class="row-muted">${r.p1 ?? "—"}</td>
                          <td class="row-muted">${r.p2 ?? "—"}</td>
                          <td><strong>${r.final ?? "—"}</strong></td>
                          <td>${statusBadge(r.final)}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      `);
    });

  cont.appendChild(acc);
}

function groupByPeriod(items){
  const map = new Map();
  items.forEach(x=>{
    const k = `${x.periodType}|${x.period}`;
    if(!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  });
  return map;
}
function avgFinal(items){
  const vals = items.map(x=>Number(x.final)).filter(Number.isFinite);
  if(!vals.length) return 0;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}
function statusBadge(final){
  if(final == null) return `<span class="badgeX"><span class="dot warn"></span> Sin final</span>`;
  if(Number(final) < 7) return `<span class="badgeX"><span class="dot bad"></span> En riesgo</span>`;
  return `<span class="badgeX"><span class="dot good"></span> Aprobado</span>`;
}
