import { apiFetch } from "../../core/api.js";

if (!window.Modules) window.Modules = {};

// Ajusta esta ruta a donde tengas tu carpeta de archivos PHP
const API_URL = "/login.php"; 

window.Modules.login = {
  init: async function({ host, ctx }) {
    const form = host.querySelector("#loginForm");
    const msg = host.querySelector("#rhMsg");
    const btn = host.querySelector("#btnRhLogin");
    
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      btn.classList.add("btn-loading");
      btn.disabled = true;
      msg.textContent = "";

      const user = host.querySelector("#rhUser").value;
      const pass = host.querySelector("#rhPass").value;

      try {
        // Cambiamos apiFetch por un fetch estándar o tu versión de apiFetch 
        // pero apuntando al archivo PHP
        const response = await apiFetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: { email: user, password: pass }
        });

        const res = await response;

        if (res.status === "success") {
            console.log("✅ Login exitoso, redireccionando por rol...");            
            // Guardamos datos para la interfaz (UI)
            localStorage.setItem("user_email", res.user.email);
            localStorage.setItem("user_name", res.user.nombre_completo);
            localStorage.setItem("rh_user_role", res.user.rol);
            localStorage.setItem("rh_user_initials", res.user.initials);
            
            // Quitamos la clase de login para mostrar el menú
            document.body.classList.remove('is-login');

            // 3. REDIRECCIÓN DINÁMICA
            // En lugar de #expedientes, dejamos el hash vacío para que app.js 
            // al recargar decida la ruta inicial según el rol.
            window.location.hash = ""; 
            
            // 4. Recarga limpia para inicializar todo el sistema con la nueva sesión
            location.reload();

        } else {
            // Si el PHP devuelve error (status: "error")
            throw new Error(res.message || "Usuario o contraseña incorrectos");
        }

      } catch (err) {
          btn.classList.remove("btn-loading");
          btn.disabled = false;
          msg.style.color = "#d32f2f";
          msg.textContent = err.message;
          
          const card = host.querySelector(".card");
          if (card) {
            card.classList.remove("shake-error");
            void card.offsetWidth; 
            card.classList.add("shake-error");
          }
      }
    };
  }
};