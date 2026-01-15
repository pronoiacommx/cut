import { state } from "../../assets/js/state.js";

export function initView(root){}

export function renderView(root){
  const tbody = root.querySelector("#tablaClases tbody");
  if(tbody) tbody.innerHTML = "";

  const cards = root.querySelector("#clasesCards");
  cards.innerHTML = "";
  cards.classList.add("tableCards");
  cards.style.display = "flex";
  cards.style.flexDirection = "column";
  cards.style.gap = "10px";

  state.clases.forEach(c=>{
    const linksHtml = (c.recursos||[]).map(x=>`<a class="badgeX" href="${x.href}">${x.label}</a>`).join(" ");

    if(tbody){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.materia}</strong></td>
        <td class="row-muted">${c.docente}</td>
        <td class="row-muted">${c.aula}</td>
        <td>${linksHtml || "—"}</td>
      `;
      tbody.appendChild(tr);
    }

    cards.insertAdjacentHTML("beforeend", `
      <div class="item">
        <div class="fw-bold">${c.materia}</div>
        <div class="kv"><div class="k">Docente</div><div class="v">${c.docente}</div></div>
        <div class="kv"><div class="k">Aula</div><div class="v">${c.aula}</div></div>
        <div class="mt-2 d-flex gap-2 flex-wrap">${linksHtml || `<span class="row-muted">—</span>`}</div>
      </div>
    `);
  });
}
