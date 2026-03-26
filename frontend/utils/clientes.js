// utils/clientes.js

var _clienteEliminarId = null;
var _dtClientes = null;
var _userRol = null;

document.addEventListener("DOMContentLoaded", function () {
  if (!redirectIfNotLoggedIn()) return;

  var user = getUser();
  if (!user) {
    window.location.replace("unauthorized.html");
    return;
  }
  _userRol = user.rol;

  // ── User info ────────────────────────────────────────────────────────
  var el = function (id) {
    return document.getElementById(id);
  };
  var roleCap = user.rol.charAt(0).toUpperCase() + user.rol.slice(1);
  if (el("nav-user-name")) el("nav-user-name").textContent = user.nombre;
  if (el("nav-user-name-header"))
    el("nav-user-name-header").textContent = user.nombre;
  if (el("nav-user-role")) el("nav-user-role").textContent = roleCap;
  if (el("sidebar-user-name"))
    el("sidebar-user-name").textContent = user.nombre;
  if (el("sidebar-user-role")) el("sidebar-user-role").textContent = roleCap;

  // Admin-only elements
  if (user.rol === "admin") {
    document.querySelectorAll(".admin-only").forEach(function (e) {
      e.classList.remove("d-none");
    });
  }

  // ── Logout ───────────────────────────────────────────────────────────
  var btnLogout = el("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function (e) {
      e.preventDefault();
      logout();
    });
  }

  // ── Nuevo cliente ────────────────────────────────────────────────────
  el("btn-nuevo-cliente").addEventListener("click", function () {
    openModal(null);
  });

  // ── Form submit ──────────────────────────────────────────────────────
  el("form-cliente").addEventListener("submit", function (e) {
    e.preventDefault();
    saveCliente();
  });

  // ── Confirmar eliminar ───────────────────────────────────────────────
  el("btn-confirmar-eliminar").addEventListener("click", deleteCliente);

  // ── Carga inicial ────────────────────────────────────────────────────
  loadClientes();
});

// ═══════════════════════════════════════════════════════════════════════
// Cargar tabla
// ═══════════════════════════════════════════════════════════════════════
async function loadClientes() {
  try {
    var resp = await ClientesAPI.getAll();
    var clientes = resp.data || [];

    document.getElementById("stat-total").textContent = clientes.length;

    if (_dtClientes) {
      _dtClientes.destroy();
      _dtClientes = null;
    }

    var tbody = document.getElementById("tbody-clientes");
    tbody.innerHTML = "";

    if (clientes.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-4">No hay clientes registrados.</td></tr>';
      return;
    }

    clientes.forEach(function (c) {
      var accionesTd =
        _userRol === "admin"
          ? "<td class='text-center'>" +
            "<button class='btn btn-xs btn-info mr-1' title='Editar' onclick='openModal(" +
            c.id +
            ")'><i class='fas fa-edit'></i></button>" +
            "<button class='btn btn-xs btn-danger' title='Eliminar' onclick='confirmDelete(" +
            c.id +
            ', "' +
            escapeHtml(c.nombre) +
            "\")'><i class='fas fa-trash'></i></button>" +
            "</td>"
          : "<td class='text-center text-muted'>—</td>";
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        c.id +
        "</td>" +
        "<td>" +
        escapeHtml(c.nombre) +
        "</td>" +
        "<td>" +
        escapeHtml(c.ci_nit || "—") +
        "</td>" +
        "<td>" +
        escapeHtml(c.telefono || "—") +
        "</td>" +
        "<td>" +
        escapeHtml(c.email || "—") +
        "</td>" +
        accionesTd;
      tbody.appendChild(tr);
    });

    _dtClientes = $("#table-clientes").DataTable({
      language: {
        processing: "Procesando...",
        search: "Buscar:",
        lengthMenu: "Mostrar _MENU_ registros",
        info: "Mostrando del _START_ al _END_ de _TOTAL_ registros",
        infoEmpty: "Mostrando 0 registros",
        infoFiltered: "(filtrado de _MAX_ registros totales)",
        loadingRecords: "Cargando...",
        zeroRecords: "No se encontraron resultados",
        emptyTable: "No hay clientes registrados",
        paginate: {
          first: "Primero",
          previous: "Anterior",
          next: "Siguiente",
          last: "\u00DAltimo",
        },
      },
      order: [[1, "asc"]],
      columnDefs: [{ orderable: false, targets: 5 }],
    });
  } catch (err) {
    console.error("[loadClientes]", err);
    showAlert("danger", "Error al cargar clientes.");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Modal
// ═══════════════════════════════════════════════════════════════════════
async function openModal(id) {
  var el = function (i) {
    return document.getElementById(i);
  };

  el("cliente-id").value = "";
  el("cliente-nombre").value = "";
  el("cliente-ci").value = "";
  el("cliente-telefono").value = "";
  el("cliente-email").value = "";
  el("form-cliente").classList.remove("was-validated");

  if (id) {
    el("modal-cliente-title").textContent = "Editar Cliente";
    try {
      var resp = await ClientesAPI.getById(id);
      var c = resp.data;
      el("cliente-id").value = c.id;
      el("cliente-nombre").value = c.nombre;
      el("cliente-ci").value = c.ci_nit || "";
      el("cliente-telefono").value = c.telefono || "";
      el("cliente-email").value = c.email || "";
    } catch (err) {
      showAlert("danger", "Error al cargar el cliente.");
      return;
    }
  } else {
    el("modal-cliente-title").textContent = "Nuevo Cliente";
  }

  $("#modal-cliente").modal("show");
}

async function saveCliente() {
  var form = document.getElementById("form-cliente");
  form.classList.add("was-validated");
  if (!form.checkValidity()) return;

  var el = function (i) {
    return document.getElementById(i);
  };
  var id = el("cliente-id").value;

  var data = {
    nombre: el("cliente-nombre").value.trim(),
    ci_nit: el("cliente-ci").value.trim() || null,
    telefono: el("cliente-telefono").value.trim() || null,
    email: el("cliente-email").value.trim() || null,
  };

  try {
    if (id) {
      await ClientesAPI.update(id, data);
      showAlert("success", "Cliente actualizado correctamente.");
    } else {
      await ClientesAPI.create(data);
      showAlert("success", "Cliente creado correctamente.");
    }
    $("#modal-cliente").modal("hide");
    loadClientes();
  } catch (err) {
    var msg =
      (err.data && err.data.error) || err.message || "Error al guardar.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Eliminar
// ═══════════════════════════════════════════════════════════════════════
function confirmDelete(id, nombre) {
  _clienteEliminarId = id;
  document.getElementById("eliminar-nombre").textContent = nombre;
  $("#modal-eliminar").modal("show");
}

async function deleteCliente() {
  if (!_clienteEliminarId) return;
  try {
    await ClientesAPI.remove(_clienteEliminarId);
    showAlert("success", "Cliente eliminado.");
    $("#modal-eliminar").modal("hide");
    loadClientes();
  } catch (err) {
    var msg =
      (err.data && err.data.error) || err.message || "Error al eliminar.";
    showAlert("danger", msg);
  }
  _clienteEliminarId = null;
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════
function showAlert(type, msg) {
  var box = document.getElementById("alert-box");
  box.className = "alert alert-" + type + " alert-dismissible";
  box.innerHTML =
    msg +
    '<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>';
  box.classList.remove("d-none");
  setTimeout(function () {
    box.classList.add("d-none");
  }, 5000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
