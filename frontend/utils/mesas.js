// utils/mesas.js

var _mesas = [];

document.addEventListener("DOMContentLoaded", function () {
  if (!redirectIfNotLoggedIn()) return;

  // Solo administradores pueden acceder a este módulo
  var user = getUser();
  if (!redirectIfNotAdmin()) return;

  // ── User info ───────────────────────────────────────────────────────────
  if (user) {
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

    if (user.rol === "admin") {
      document.querySelectorAll(".admin-only").forEach(function (e) {
        e.style.display = "";
      });
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────
  document.getElementById("btn-logout").addEventListener("click", function (e) {
    e.preventDefault();
    logout();
  });

  // ── Botones ──────────────────────────────────────────────────────────────
  document
    .getElementById("btn-nueva-mesa")
    .addEventListener("click", function () {
      openModal(null);
    });

  document.getElementById("form-mesa").addEventListener("submit", function (e) {
    e.preventDefault();
    saveMesa();
  });

  document
    .getElementById("btn-confirmar-eliminar")
    .addEventListener("click", deleteMesa);

  loadMesas();
});

// ── Carga y renderiza ─────────────────────────────────────────────────────────
async function loadMesas() {
  var tbody = document.getElementById("tbody-mesas");
  var user = getUser();
  var isAdmin = user && user.rol === "admin";

  if ($.fn.DataTable.isDataTable("#table-mesas")) {
    $("#table-mesas").DataTable().destroy();
  }

  tbody.innerHTML =
    '<tr><td colspan="4" class="text-center text-muted py-4">' +
    '<i class="fas fa-spinner fa-spin mr-2"></i>Cargando...</td></tr>';

  try {
    var resp = await MesasAPI.getAll();
    var mesas = resp.data || [];
    _mesas = mesas;

    // Estadísticas
    var libres = mesas.filter(function (m) {
      return m.estado === "libre";
    }).length;
    var ocupadas = mesas.filter(function (m) {
      return m.estado === "ocupada";
    }).length;
    document.getElementById("stat-libres").textContent = libres;
    document.getElementById("stat-ocupadas").textContent = ocupadas;

    tbody.innerHTML = mesas
      .map(function (m, idx) {
        var badge =
          m.estado === "libre"
            ? '<span class="badge badge-success">Libre</span>'
            : '<span class="badge badge-warning">Ocupada</span>';

        var acciones = isAdmin
          ? '<td class="text-center">' +
            '<button class="btn btn-xs btn-info mr-1" onclick="openModalById(' +
            m.id +
            ')" title="Editar">' +
            '<i class="fas fa-edit"></i></button>' +
            (m.estado === "libre"
              ? '<button class="btn btn-xs btn-danger" onclick="confirmDelete(' +
                m.id +
                ')" title="Eliminar">' +
                '<i class="fas fa-trash"></i></button>'
              : '<button class="btn btn-xs btn-secondary" disabled title="No se puede eliminar una mesa ocupada">' +
                '<i class="fas fa-trash"></i></button>') +
            "</td>"
          : "";

        return (
          "<tr>" +
          "<td>" +
          (idx + 1) +
          "</td>" +
          "<td>Mesa " +
          m.numero +
          "</td>" +
          "<td>" +
          badge +
          "</td>" +
          acciones +
          "</tr>"
        );
      })
      .join("");

    if (mesas.length === 0) tbody.innerHTML = "";
    initDataTable("#table-mesas", isAdmin ? 4 : 3);
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="4" class="text-center text-danger py-4">' +
      '<i class="fas fa-exclamation-triangle mr-2"></i>' +
      (err.data && err.data.error ? err.data.error : "Error al cargar mesas.") +
      "</td></tr>";
  }
}

// ── Abrir modal ───────────────────────────────────────────────────────────────
function openModalById(id) {
  var mesa = null;
  for (var i = 0; i < _mesas.length; i++) {
    if (_mesas[i].id == id) {
      mesa = _mesas[i];
      break;
    }
  }
  openModal(mesa);
}

function openModal(mesa) {
  var titleEl = document.getElementById("modal-mesa-title");
  var idEl = document.getElementById("mesa-id");
  var numeroEl = document.getElementById("mesa-numero");
  var estadoEl = document.getElementById("mesa-estado");
  var grupoEstado = document.getElementById("grupo-estado");
  var form = document.getElementById("form-mesa");

  form.classList.remove("was-validated");
  numeroEl.classList.remove("is-invalid");

  if (mesa) {
    titleEl.textContent = "Editar Mesa";
    idEl.value = mesa.id;
    numeroEl.value = mesa.numero;
    estadoEl.value = mesa.estado;
    grupoEstado.style.display = ""; // mostrar select de estado solo al editar
  } else {
    titleEl.textContent = "Nueva Mesa";
    idEl.value = "";
    numeroEl.value = "";
    estadoEl.value = "libre";
    grupoEstado.style.display = "none";
  }

  $("#modal-mesa").modal("show");
  setTimeout(function () {
    numeroEl.focus();
  }, 400);
}

// ── Guardar ───────────────────────────────────────────────────────────────────
async function saveMesa() {
  var idEl = document.getElementById("mesa-id");
  var numeroEl = document.getElementById("mesa-numero");
  var estadoEl = document.getElementById("mesa-estado");
  var btnSave = document.getElementById("btn-guardar-mesa");

  var numero = parseInt(numeroEl.value);
  if (!numero || numero < 1) {
    numeroEl.classList.add("is-invalid");
    numeroEl.focus();
    return;
  }
  numeroEl.classList.remove("is-invalid");

  btnSave.disabled = true;
  btnSave.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

  try {
    var id = idEl.value;
    if (id) {
      await MesasAPI.update(id, {
        numero: numero,
        estado: estadoEl.value,
      });
      showAlert("success", "Mesa actualizada correctamente.");
    } else {
      await MesasAPI.create({ numero: numero });
      showAlert("success", "Mesa creada correctamente.");
    }
    $("#modal-mesa").modal("hide");
    loadMesas();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al guardar la mesa.";
    showAlert("danger", msg);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
  }
}

// ── Eliminar ──────────────────────────────────────────────────────────────────
var _deleteId = null;

function confirmDelete(id) {
  _deleteId = id;
  var nombre = "";
  for (var i = 0; i < _mesas.length; i++) {
    if (_mesas[i].id == id) {
      nombre = "Mesa " + _mesas[i].numero;
      break;
    }
  }
  document.getElementById("del-mesa-nombre").textContent = nombre;
  $("#modal-confirmar-eliminar").modal("show");
}

async function deleteMesa() {
  if (!_deleteId) return;

  var btnConf = document.getElementById("btn-confirmar-eliminar");
  btnConf.disabled = true;
  btnConf.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Eliminando...';

  try {
    await MesasAPI.remove(_deleteId);
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("success", "Mesa eliminada correctamente.");
    loadMesas();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al eliminar la mesa.";
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("danger", msg);
  } finally {
    _deleteId = null;
    btnConf.disabled = false;
    btnConf.innerHTML = '<i class="fas fa-trash mr-1"></i> Eliminar';
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
