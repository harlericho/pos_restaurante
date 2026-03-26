document.addEventListener("DOMContentLoaded", function () {
  // api.js puede haber ocultado el html — mostrarlo si la sesión no es válida
  if (isLoggedIn()) {
    window.location.replace("index.html");
    return;
  }
  document.documentElement.style.visibility = "";

  var form = document.getElementById("form-login");
  var errorEl = document.getElementById("error-msg");
  var btnEl = document.getElementById("btn-login");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    var usuario = document.getElementById("usuario").value.trim();
    var password = document.getElementById("password").value;

    if (!usuario || !password) {
      errorEl.textContent = "Por favor complete todos los campos.";
      errorEl.classList.remove("d-none");
      return;
    }

    btnEl.disabled = true;
    btnEl.textContent = "Iniciando...";
    errorEl.classList.add("d-none");

    try {
      var resp = await AuthAPI.login(usuario, password);
      setToken(resp.token);
      setUser(resp.usuario);
      // Redirigir según rol: admin → dashboard, mesero → pedidos
      if (resp.usuario && resp.usuario.rol === "admin") {
        window.location.href = "index.html";
      } else {
        window.location.href = "pedidos.html";
      }
    } catch (err) {
      var msg =
        err.data && err.data.error
          ? err.data.error
          : err.message || "Error al conectar con el servidor.";
      errorEl.textContent = msg;
      errorEl.classList.remove("d-none");
      btnEl.disabled = false;
      btnEl.textContent = "Iniciar sesión";
    }
  });
});
