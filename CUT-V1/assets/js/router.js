import { $, $$ } from "./dom.js";

const loaded = new Map();
const cssLoaded = new Set();

function ensureCss(href){
  if(cssLoaded.has(href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  cssLoaded.add(href);
}

async function loadView(viewName){
  if(loaded.has(viewName)) return loaded.get(viewName);

  const html = await fetch(`views/${viewName}/view.html`).then(r=>r.text());
  const wrap = document.createElement("section");
  wrap.className = "view";
  wrap.id = `view-${viewName}`;
  wrap.innerHTML = html;

  ensureCss(`views/${viewName}/view.css`);

  const mod = await import(`../../views/${viewName}/view.js`);
  const init = mod?.initView || (()=>{});
  const render = mod?.renderView || (()=>{});

  loaded.set(viewName, { rootEl: wrap, initFn: init, renderFn: render });
  return loaded.get(viewName);
}

export async function mountAllViews(viewNames){
  const host = $("#viewHost");
  host.innerHTML = "";
  for(const name of viewNames){
    const v = await loadView(name);
    host.appendChild(v.rootEl);
    v.initFn(v.rootEl);
    v.renderFn(v.rootEl);
  }
}

export function setActiveView(view){
  $$(".navBtn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach(v => v.classList.remove("active"));
  const el = $(`#view-${view}`);
  (el || $("#view-inicio"))?.classList.add("active");
  window.scrollTo({top:0, behavior:"smooth"});
}

export function bindNav(){
  $$(".navBtn").forEach(b => b.addEventListener("click", ()=> setActiveView(b.dataset.view)));
}
