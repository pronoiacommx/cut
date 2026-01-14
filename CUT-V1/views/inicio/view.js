export function initView(root){}

export function renderView(root){
  const rail1 = root.querySelector("#inicioRail1");
  const rail2 = root.querySelector("#inicioRail2");
  const rail3 = root.querySelector("#inicioRail3");
  const rail4 = root.querySelector("#inicioRail4");
  const rail5 = root.querySelector("#inicioRail5");

  rail1.innerHTML =
    mkCard("Cómo organizar tu semana (rápido)", "5:42 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ") +
    mkCard("Tips para estudiar mejor", "8:10 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=ysz5S6PUM-U") +
    mkCard("Matemáticas • Clase 12", "45:00 • Aula",
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=3GwjfUFyY6M");

  rail2.innerHTML =
    mkCard("Cómo organizar tu semana (rápido)", "5:42 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ") +
    mkCard("Tips para estudiar mejor", "8:10 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=ysz5S6PUM-U") +
    mkCard("Matemáticas • Clase 12", "45:00 • Aula",
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=3GwjfUFyY6M");

  rail3.innerHTML =
    mkCard("Cómo organizar tu semana (rápido)", "5:42 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ") +
    mkCard("Tips para estudiar mejor", "8:10 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=ysz5S6PUM-U") +
    mkCard("Matemáticas • Clase 12", "45:00 • Aula",
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=3GwjfUFyY6M");

  rail4.innerHTML =
    mkCard("Cómo organizar tu semana (rápido)", "5:42 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ") +
    mkCard("Tips para estudiar mejor", "8:10 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=ysz5S6PUM-U") +
    mkCard("Matemáticas • Clase 12", "45:00 • Aula",
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=3GwjfUFyY6M");

  rail5.innerHTML =
    mkCard("Cómo organizar tu semana (rápido)", "5:42 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ") +
    mkCard("Tips para estudiar mejor", "8:10 • Canal Ejemplo",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=ysz5S6PUM-U") +
    mkCard("Matemáticas • Clase 12", "45:00 • Aula",
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=60",
      "https://www.youtube.com/watch?v=3GwjfUFyY6M");
}

function mkCard(title, sub, img, href){
  return `
    <a class="videoCard" href="${href}" target="_blank" rel="noopener">
  <img class="thumb" src="${img}" alt="thumb">

  <div class="videoMeta">
    <p class="videoTitle">${title}</p>
    <p class="videoSub">${sub}</p>
  </div>
</a>

  `;
}
