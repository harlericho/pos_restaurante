// utils/usuarios.js

var _usuarios = [];

document.addEventListener("DOMContentLoaded", function () {
  if (!redirectIfNotLoggedIn()) return;

  // Solo admin puede acceder a esta página
  var user = getUser();
  if (!user || user.rol !== "admin") {
    window.location.href = "index.html";
    return;
  }

  // ── User info ───────────────────────────────────────────────────────────
  var roleCap = user.rol.charAt(0).toUpperCase() + user.rol.slice(1);
  var el = function (id) {
    return document.getElementById(id);
  };
  if (el("nav-user-name")) el("nav-user-name").textContent = user.nombre;
  if (el("nav-user-name-header"))
    el("nav-user-name-header").textContent = user.nombre;
  if (el("nav-user-role")) el("nav-user-role").textContent = roleCap;
  if (el("sidebar-user-name"))
    el("sidebar-user-name").textContent = user.nombre;
  if (el("sidebar-user-role")) el("sidebar-user-role").textContent = roleCap;

  // ── Logout ──────────────────────────────────────────────────────────────
  document.getElementById("btn-logout").addEventListener("click", function (e) {
    e.preventDefault();
    logout();
  });

  // ── Toggle password visibility ──────────────────────────────────────────
  document
    .getElementById("btn-toggle-password")
    .addEventListener("click", function () {
      var inp = document.getElementById("usuario-password");
      var ico = document.getElementById("ico-eye");
      if (inp.type === "password") {
        inp.type = "text";
        ico.className = "fas fa-eye-slash";
      } else {
        inp.type = "password";
        ico.className = "fas fa-eye";
      }
    });

  // ── Botones ──────────────────────────────────────────────────────────────
  document
    .getElementById("btn-nuevo-usuario")
    .addEventListener("click", function () {
      openModal(null);
    });

  document
    .getElementById("form-usuario")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      saveUsuario();
    });

  document
    .getElementById("btn-confirmar-desactivar")
    .addEventListener("click", desactivarUsuario);

  loadUsuarios();
});

// ── Carga y renderiza ─────────────────────────────────────────────────────────
async function loadUsuarios() {
  var tbody = document.getElementById("tbody-usuarios");
  var currentUser = getUser();

  if ($.fn.DataTable.isDataTable("#table-usuarios")) {
    $("#table-usuarios").DataTable().destroy();
  }

  tbody.innerHTML =
    '<tr><td colspan="6" class="text-center text-muted py-4">' +
    '<i class="fas fa-spinner fa-spin mr-2"></i>Cargando...</td></tr>';

  try {
    var resp = await UsuariosAPI.getAll();
    var usuarios = resp.data || [];
    _usuarios = usuarios;

    // Stats
    var activos = usuarios.filter(function (u) {
      return String(u.estado) === "1";
    }).length;
    var elTotal = document.getElementById("stat-total");
    var elActivos = document.getElementById("stat-activos");
    if (elTotal) elTotal.textContent = usuarios.length;
    if (elActivos) elActivos.textContent = activos;

    tbody.innerHTML = usuarios
      .map(function (u, idx) {
        var rolBadge =
          u.rol === "admin"
            ? '<span class="badge badge-danger">Admin</span>'
            : '<span class="badge badge-info">Mesero</span>';

        var estadoBadge =
          String(u.estado) === "1"
            ? '<span class="badge badge-success">Activo</span>'
            : '<span class="badge badge-secondary">Inactivo</span>';

        // No permitir desactivar la propia cuenta desde la tabla
        var esPropioUsuario = currentUser && currentUser.id == u.id;

        var acciones =
          '<td class="text-center">' +
          '<button class="btn btn-xs btn-info mr-1" onclick="openModalById(' +
          u.id +
          ')" title="Editar">' +
          '<i class="fas fa-edit"></i></button>' +
          (String(u.estado) === "1" && !esPropioUsuario
            ? '<button class="btn btn-xs btn-warning" onclick="confirmDesactivar(' +
              u.id +
              ')" title="Desactivar">' +
              '<i class="fas fa-user-times"></i></button>'
            : esPropioUsuario
              ? '<button class="btn btn-xs btn-secondary" disabled title="No puedes desactivar tu propia cuenta">' +
                '<i class="fas fa-user-times"></i></button>'
              : '<button class="btn btn-xs btn-success" onclick="openModalById(' +
                u.id +
                ')" title="Activar (editar estado)">' +
                '<i class="fas fa-user-check"></i></button>') +
          "</td>";

        return (
          "<tr>" +
          "<td>" +
          (idx + 1) +
          "</td>" +
          "<td>" +
          escapeHtml(u.nombre) +
          "</td>" +
          "<td><code>" +
          escapeHtml(u.usuario) +
          "</code></td>" +
          "<td>" +
          rolBadge +
          "</td>" +
          "<td>" +
          estadoBadge +
          "</td>" +
          acciones +
          "</tr>"
        );
      })
      .join("");

    if (usuarios.length === 0) tbody.innerHTML = "";
    initDataTable("#table-usuarios", 6);
  } catch (err) {
    console.error("[loadUsuarios]", err);
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al cargar usuarios.";
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger py-4">' +
      '<i class="fas fa-exclamation-triangle mr-2"></i>' +
      escapeHtml(msg) +
      "</td></tr>";
  }
}

// ── Abrir modal ───────────────────────────────────────────────────────────────
function openModalById(id) {
  var usuario = null;
  for (var i = 0; i < _usuarios.length; i++) {
    if (_usuarios[i].id == id) {
      usuario = _usuarios[i];
      break;
    }
  }
  openModal(usuario);
}

function openModal(usuario) {
  var titleEl = document.getElementById("modal-usuario-title");
  var idEl = document.getElementById("usuario-id");
  var nombreEl = document.getElementById("usuario-nombre");
  var loginEl = document.getElementById("usuario-login");
  var passwordEl = document.getElementById("usuario-password");
  var rolEl = document.getElementById("usuario-rol");
  var estadoEl = document.getElementById("usuario-estado");
  var grupoEstado = document.getElementById("grupo-estado-usuario");
  var hintPassword = document.getElementById("hint-password");
  var lblReq = document.getElementById("lbl-password-req");
  var form = document.getElementById("form-usuario");

  form.classList.remove("was-validated");
  [nombreEl, loginEl, passwordEl].forEach(function (e) {
    e.classList.remove("is-invalid");
  });

  // Restaurar visibilidad contraseña
  passwordEl.type = "password";
  document.getElementById("ico-eye").className = "fas fa-eye";

  if (usuario) {
    titleEl.textContent = "Editar Usuario";
    idEl.value = usuario.id;
    nombreEl.value = usuario.nombre;
    loginEl.value = usuario.usuario;
    passwordEl.value = "";
    rolEl.value = usuario.rol;
    estadoEl.value = String(usuario.estado);
    grupoEstado.classList.remove("d-none");
    hintPassword.classList.remove("d-none");
    lblReq.style.display = "none";
  } else {
    titleEl.textContent = "Nuevo Usuario";
    idEl.value = "";
    nombreEl.value = "";
    loginEl.value = "";
    passwordEl.value = "";
    rolEl.value = "mesero";
    estadoEl.value = "1";
    grupoEstado.classList.add("d-none");
    hintPassword.classList.add("d-none");
    lblReq.style.display = "";
  }

  $("#modal-usuario").modal("show");
  setTimeout(function () {
    nombreEl.focus();
  }, 400);
}

// ── Guardar ───────────────────────────────────────────────────────────────────
async function saveUsuario() {
  var idEl = document.getElementById("usuario-id");
  var nombreEl = document.getElementById("usuario-nombre");
  var loginEl = document.getElementById("usuario-login");
  var passwordEl = document.getElementById("usuario-password");
  var rolEl = document.getElementById("usuario-rol");
  var estadoEl = document.getElementById("usuario-estado");
  var btnSave = document.getElementById("btn-guardar-usuario");

  var valid = true;
  var id = idEl.value;

  var nombre = nombreEl.value.trim();
  if (!nombre) {
    nombreEl.classList.add("is-invalid");
    valid = false;
  } else {
    nombreEl.classList.remove("is-invalid");
  }

  var login = loginEl.value.trim();
  if (!login) {
    loginEl.classList.add("is-invalid");
    valid = false;
  } else {
    loginEl.classList.remove("is-invalid");
  }

  var password = passwordEl.value;
  if (!id && !password) {
    // Nuevo usuario: contraseña obligatoria
    passwordEl.classList.add("is-invalid");
    document.getElementById("feedback-password").textContent =
      "La contraseña es requerida.";
    valid = false;
  } else {
    passwordEl.classList.remove("is-invalid");
  }

  if (!valid) return;

  var payload = {
    nombre: nombre,
    usuario: login,
    rol: rolEl.value,
  };
  if (password) payload.password = password;
  if (id) payload.estado = parseInt(estadoEl.value);

  btnSave.disabled = true;
  btnSave.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

  try {
    if (id) {
      await UsuariosAPI.update(id, payload);
      showAlert("success", "Usuario actualizado correctamente.");
    } else {
      await UsuariosAPI.create(payload);
      showAlert("success", "Usuario creado correctamente.");
    }
    $("#modal-usuario").modal("hide");
    loadUsuarios();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al guardar el usuario.";
    showAlert("danger", msg);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
  }
}

// ── Desactivar ────────────────────────────────────────────────────────────────
var _deleteId = null;

function confirmDesactivar(id) {
  _deleteId = id;
  var nombre = "";
  for (var i = 0; i < _usuarios.length; i++) {
    if (_usuarios[i].id == id) {
      nombre = _usuarios[i].nombre;
      break;
    }
  }
  document.getElementById("del-usuario-nombre").textContent = nombre;
  $("#modal-confirmar-desactivar").modal("show");
}

async function desactivarUsuario() {
  if (!_deleteId) return;

  var btnConf = document.getElementById("btn-confirmar-desactivar");
  btnConf.disabled = true;
  btnConf.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Desactivando...';

  try {
    await UsuariosAPI.remove(_deleteId);
    $("#modal-confirmar-desactivar").modal("hide");
    showAlert("success", "Usuario desactivado correctamente.");
    _deleteId = null;
    loadUsuarios();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al desactivar el usuario.";
    $("#modal-confirmar-desactivar").modal("hide");
    showAlert("danger", msg);
    _deleteId = null;
  } finally {
    btnConf.disabled = false;
    btnConf.innerHTML = '<i class="fas fa-user-times mr-1"></i> Desactivar';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initDataTable(selector, numCols) {
  var colDefs =
    numCols > 1
      ? [{ orderable: false, searchable: false, targets: numCols - 1 }]
      : [];
  $(selector).DataTable({
    language: {
      processing: "Procesando...",
      search: "Buscar:",
      lengthMenu: "Mostrar _MENU_ registros",
      info: "Mostrando del _START_ al _END_ de _TOTAL_ registros",
      infoEmpty: "Mostrando 0 registros",
      infoFiltered: "(filtrado de _MAX_ registros totales)",
      loadingRecords: "Cargando...",
      zeroRecords: "No se encontraron resultados",
      emptyTable: "No hay datos disponibles",
      paginate: {
        first: "Primero",
        previous: "Anterior",
        next: "Siguiente",
        last: "Último",
      },
    },
    pageLength: 10,
    lengthMenu: [5, 10, 25, 50],
    columnDefs: colDefs,
    responsive: true,
  });
}

function showAlert(type, msg) {
  // 1. Buscar el contenedor de alertas o crearlo si no existe
  var container = document.getElementById("alert-container");
  if (!container) {
    // Si no tienes un contenedor fijo, puedes usar el body o un área específica
    container = document.createElement("div");
    container.id = "alert-container";
    container.style.cssText =
      "position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;";
    document.body.appendChild(container);
  }

  // 2. Crear un NUEVO elemento de alerta para cada mensaje
  var alertDiv = document.createElement("div");
  alertDiv.className = "alert alert-" + type + " alert-dismissible fade show";
  alertDiv.role = "alert";
  alertDiv.innerHTML =
    msg +
    '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
    '<span aria-hidden="true">&times;</span></button>';

  // 3. Agregarlo al contenedor
  container.appendChild(alertDiv);

  // 4. Auto-eliminar solo este mensaje después de 4 segundos
  setTimeout(function () {
    $(alertDiv).alert("close");
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
