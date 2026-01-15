import { bindNav, mountAllViews, setActiveView } from "./router.js";

const views = ["inicio","perfil","calificaciones","pagos","clases","horarios"];

bindNav();
await mountAllViews(views);
setActiveView("inicio");
