import { state } from "../../assets/js/state.js";
import { money } from "../../assets/js/utils.js";

export function initView(root){}

export function renderView(root){
  const tbody = root.querySelector("#tablaPagos tbody");
  if(tbody) tbody.innerHTML = "";

  const cards = root.querySelector("#pagosCards");
  cards.innerHTML = "";
  cards.classList.add("tableCards");
  cards.style.display = "flex";
  cards.style.flexDirection = "column";
  cards.style.gap = "10px";

  state.pagos.forEach(p=>{
    const dot = p.estado === "CONFIRMADO" ? "good" : (p.estado === "RECHAZADO" ? "bad" : "warn");

    if(tbody){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.fecha}</td>
        <td>${p.concepto}</td>
        <td><strong>${money(p.monto)}</strong></td>
        <td><span class="badgeX"><span class="dot ${dot}"></span> ${p.estado}</span></td>
      `;
      tbody.appendChild(tr);
    }

    cards.insertAdjacentHTML("beforeend", `
      <div class="item">
        <div class="d-flex justify-content-between gap-2 flex-wrap">
          <div class="fw-bold">${p.concepto}</div>
          <span class="badgeX"><span class="dot ${dot}"></span> ${p.estado}</span>
        </div>
        <div class="kv"><div class="k">Fecha</div><div class="v">${p.fecha}</div></div>
        <div class="kv"><div class="k">Monto</div><div class="v">${money(p.monto)}</div></div>
      </div>
    `);
  });
}
