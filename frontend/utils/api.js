const BASE_URL = "http://localhost/pos_restaurante/backend/public";

// ── Tema oscuro / claro — aplicar antes de DOMContentLoaded para evitar flash ─
(function () {
  if (localStorage.getItem("pos_theme") === "light") {
    document.documentElement.classList.add("_theme_light_pending");
  }
})();

// ── Año dinámico en el footer + toggle dark/light mode ───────────────────────
document.addEventListener("DOMContentLoaded", function () {
  // Año en footer
  var currentYear = new Date().getFullYear();
  var el = document.getElementById("footer-year");
  if (el) el.textContent = currentYear;
  var elLogin = document.getElementById("login-footer-year");
  if (elLogin) elLogin.textContent = currentYear;

  // Aplicar tema guardado
  var savedTheme = localStorage.getItem("pos_theme") || "dark";
  var icon = document.getElementById("icon-darkmode");
  if (savedTheme === "light") {
    document.body.classList.remove("dark-mode");
    if (icon) {
      icon.classList.replace("fa-moon", "fa-sun");
    }
  } else {
    document.body.classList.add("dark-mode");
    if (icon) {
      icon.classList.replace("fa-sun", "fa-moon");
    }
  }
  document.documentElement.classList.remove("_theme_light_pending");

  // Botón toggle
  var btn = document.getElementById("btn-toggle-darkmode");
  if (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var icon = document.getElementById("icon-darkmode");
      if (document.body.classList.contains("dark-mode")) {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("pos_theme", "light");
        if (icon) {
          icon.classList.replace("fa-moon", "fa-sun");
        }
      } else {
        document.body.classList.add("dark-mode");
        localStorage.setItem("pos_theme", "dark");
        if (icon) {
          icon.classList.replace("fa-sun", "fa-moon");
        }
      }
    });
  }
});

// ============ Auth Storage ============
function getToken() {
  return localStorage.getItem("pos_token");
}
function setToken(token) {
  localStorage.setItem("pos_token", token);
}
function removeToken() {
  localStorage.removeItem("pos_token");
}
function getUser() {
  var u = localStorage.getItem("pos_user");
  return u ? JSON.parse(u) : null;
}
function setUser(user) {
  localStorage.setItem("pos_user", JSON.stringify(user));
}
function removeUser() {
  localStorage.removeItem("pos_user");
}
function isLoggedIn() {
  return !!getToken();
}
function logout() {
  removeToken();
  removeUser();
  window.location.href = "login.html";
}
function redirectIfNotLoggedIn() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
  }
}

// ============ Generic Request ============
async function request(method, endpoint, body) {
  var headers = { "Content-Type": "application/json" };
  var token = getToken();
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }
  var options = { method: method, headers: headers };
  if (body !== undefined && body !== null) {
    options.body = JSON.stringify(body);
  }
  var response = await fetch(BASE_URL + endpoint, options);
  var text = await response.text();
  // Eliminar todos los BOM y espacios iniciales
  text = text.replace(/^[\uFEFF\s]+/, "");
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    var parseErr = new Error("Respuesta inválida del servidor");
    parseErr.status = response.status;
    throw parseErr;
  }
  if (!response.ok) {
    var err = new Error(data.error || "Error en la solicitud");
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ============ API Resources ============
var AuthAPI = {
  login: function (usuario, password) {
    return request("POST", "/api/auth/login", {
      usuario: usuario,
      password: password,
    });
  },
};

var UsuariosAPI = {
  getAll: function () {
    return request("GET", "/api/usuarios");
  },
  getById: function (id) {
    return request("GET", "/api/usuarios/" + id);
  },
  create: function (data) {
    return request("POST", "/api/usuarios", data);
  },
  update: function (id, data) {
    return request("PUT", "/api/usuarios/" + id, data);
  },
  remove: function (id) {
    return request("DELETE", "/api/usuarios/" + id);
  },
};

var CategoriasAPI = {
  getAll: function () {
    return request("GET", "/api/categorias");
  },
  getById: function (id) {
    return request("GET", "/api/categorias/" + id);
  },
  create: function (data) {
    return request("POST", "/api/categorias", data);
  },
  update: function (id, data) {
    return request("PUT", "/api/categorias/" + id, data);
  },
  remove: function (id) {
    return request("DELETE", "/api/categorias/" + id);
  },
};

var ProductosAPI = {
  getAll: function (categoriaId) {
    var qs = categoriaId ? "?categoria_id=" + categoriaId : "";
    return request("GET", "/api/productos" + qs);
  },
  getById: function (id) {
    return request("GET", "/api/productos/" + id);
  },
  create: function (data) {
    return request("POST", "/api/productos", data);
  },
  update: function (id, data) {
    return request("PUT", "/api/productos/" + id, data);
  },
  remove: function (id) {
    return request("DELETE", "/api/productos/" + id);
  },
};

var InsumosAPI = {
  getAll: function () {
    return request("GET", "/api/insumos");
  },
  getById: function (id) {
    return request("GET", "/api/insumos/" + id);
  },
  create: function (data) {
    return request("POST", "/api/insumos", data);
  },
  update: function (id, data) {
    return request("PUT", "/api/insumos/" + id, data);
  },
  remove: function (id) {
    return request("DELETE", "/api/insumos/" + id);
  },
};

var RecetasAPI = {
  getByProducto: function (productoId) {
    return request("GET", "/api/recetas/producto/" + productoId);
  },
  create: function (data) {
    return request("POST", "/api/recetas", data);
  },
  remove: function (id) {
    return request("DELETE", "/api/recetas/" + id);
  },
};

var MesasAPI = {
  getAll: function () {
    return request("GET", "/api/mesas");
  },
  getById: function (id) {
    return request("GET", "/api/mesas/" + id);
  },
  create: function (data) {
    return request("POST", "/api/mesas", data);
  },
  update: function (id, data) {
    return request("PUT", "/api/mesas/" + id, data);
  },
  remove: function (id) {
    return request("DELETE", "/api/mesas/" + id);
  },
};

var PedidosAPI = {
  getAll: function (estado) {
    var qs = estado ? "?estado=" + estado : "";
    return request("GET", "/api/pedidos" + qs);
  },
  getById: function (id) {
    return request("GET", "/api/pedidos/" + id);
  },
  create: function (data) {
    return request("POST", "/api/pedidos", data);
  },
  addDetalle: function (pedidoId, data) {
    return request("POST", "/api/pedidos/" + pedidoId + "/detalle", data);
  },
  removeDetalle: function (pedidoId, detalleId) {
    return request(
      "DELETE",
      "/api/pedidos/" + pedidoId + "/detalle/" + detalleId,
    );
  },
  cerrar: function (id) {
    return request("PATCH", "/api/pedidos/" + id + "/cerrar");
  },
};

var VentasAPI = {
  getAll: function () {
    return request("GET", "/api/ventas");
  },
  getById: function (id) {
    return request("GET", "/api/ventas/" + id);
  },
  create: function (data) {
    return request("POST", "/api/ventas", data);
  },
  getReporte: function (desde, hasta) {
    return request(
      "GET",
      "/api/ventas/reporte?desde=" + desde + "&hasta=" + hasta,
    );
  },
};

var ClientesAPI = {
  getAll: function () {
    return request("GET", "/api/clientes");
  },
  search: function (q) {
    return request("GET", "/api/clientes?q=" + encodeURIComponent(q));
  },
  getById: function (id) {
    return request("GET", "/api/clientes/" + id);
  },
  create: function (data) {
    return request("POST", "/api/clientes", data);
  },
  update: function (id, data) {
    return request("PUT", "/api/clientes/" + id, data);
  },
  remove: function (id) {
    return request("DELETE", "/api/clientes/" + id);
  },
};

var FacturaConfigAPI = {
  get: function () {
    return request("GET", "/api/factura-config");
  },
  update: function (data) {
    return request("PUT", "/api/factura-config", data);
  },
};

var EmpresaAPI = {
  get: function () {
    return fetch(BASE_URL + "/api/empresa").then(function (r) {
      return r.json();
    });
  },
  update: function (data) {
    return request("PUT", "/api/empresa", data);
  },
};
