import { apiFetch } from "../../core/api.js";
if (!window.Modules) window.Modules = {};

const URL_BASE = "http://localhost";
window.Modules.login = {
  init: async function({ host, ctx }) {
    const form = host.querySelector("#loginForm");
    const msg = host.querySelector("#rhMsg");
    const btn = host.querySelector("#btnRhLogin");
    const userInput = host.querySelector("#rhUser");
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      btn.classList.add("btn-loading");
      btn.disabled = true;
      msg.textContent = "";

      const user = host.querySelector("#rhUser").value;
      const pass = host.querySelector("#rhPass").value;
      try{
      const res = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: user, password: pass })
      });

      if (res ) {
        document.body.classList.remove('is-login');
        console.log("✅ Login exitoso, guardando sesión...");
        localStorage.setItem("rh_session", "active");
        localStorage.setItem("user_email", res.user.email);
          //localStorage.setItem("rh_token", res.token); // EL TOKEN REAL DEL SERVIDOR
          localStorage.setItem("user_name", res.user.nombre_completo);
          localStorage.setItem("rh_user_initials", res.user.nombre_completo.substring(0,2).toUpperCase());
        // Ejemplo en el Login de la plataforma
            if (res.user.force_change === 1) {
                // Redirigir a una pantalla especial
                window.location.href = "/cut/contratos/public/actualizar_password.html";
            } else {                    
                window.location.href =  URL_BASE  + "/cut/contratos/#expedientes";
                
          location.reload();
            }
      }
      }catch (err) {
        // Si no hay token, algo salió mal
          //throw new Error("No se recibió el token de acceso");
          btn.classList.remove("btn-loading");
          btn.disabled = false;
          msg.style.color = "#d32f2f";
          msg.textContent = err.message || "Usuario o contraseña incorrectos";
          
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
