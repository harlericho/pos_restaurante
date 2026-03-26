// utils/insumos.js

var _insumos = [];

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
    .getElementById("btn-nuevo-insumo")
    .addEventListener("click", function () {
      openModal(null);
    });

  document
    .getElementById("form-insumo")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      saveInsumo();
    });

  document
    .getElementById("btn-confirmar-eliminar")
    .addEventListener("click", deleteInsumo);

  loadInsumos();
});

// ── Carga y renderiza ─────────────────────────────────────────────────────────
async function loadInsumos() {
  var tbody = document.getElementById("tbody-insumos");
  var user = getUser();
  var isAdmin = user && user.rol === "admin";

  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center text-muted py-4">' +
    '<i class="fas fa-spinner fa-spin mr-2"></i>Cargando...</td></tr>';

  try {
    if ($.fn.DataTable.isDataTable("#table-insumos")) {
      $("#table-insumos").DataTable().destroy();
    }

    var resp = await InsumosAPI.getAll();
    var insumos = resp.data || [];
    _insumos = insumos;

    // Estadísticas
    var sinStock = insumos.filter(function (i) {
      return parseFloat(i.stock) <= 0;
    }).length;
    var elTotal = document.getElementById("stat-total");
    var elSinStock = document.getElementById("stat-sin-stock");
    if (elTotal) elTotal.textContent = insumos.length;
    if (elSinStock) elSinStock.textContent = sinStock;

    tbody.innerHTML = insumos
      .map(function (ins, idx) {
        var stockVal = parseFloat(ins.stock);
        var stockBadge =
          stockVal <= 0
            ? '<span class="badge badge-danger ml-1">Sin stock</span>'
            : "";

        var acciones = isAdmin
          ? '<td class="text-center">' +
            '<button class="btn btn-xs btn-info mr-1" onclick="openModalById(' +
            ins.id +
            ')" title="Editar">' +
            '<i class="fas fa-edit"></i></button>' +
            '<button class="btn btn-xs btn-danger" onclick="confirmDelete(' +
            ins.id +
            ')" title="Eliminar">' +
            '<i class="fas fa-trash"></i></button>' +
            "</td>"
          : "";

        return (
          "<tr>" +
          "<td>" +
          (idx + 1) +
          "</td>" +
          "<td>" +
          escapeHtml(ins.nombre) +
          stockBadge +
          "</td>" +
          "<td>" +
          escapeHtml(ins.unidad) +
          "</td>" +
          "<td>" +
          stockVal.toLocaleString("es-PE", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          }) +
          "</td>" +
          acciones +
          "</tr>"
        );
      })
      .join("");

    if (insumos.length === 0) tbody.innerHTML = "";
    initDataTable("#table-insumos", isAdmin ? 5 : 4);
  } catch (err) {
    console.error("[loadInsumos]", err);
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al cargar insumos.";
    tbody.innerHTML =
      '<tr><td colspan="5" class="text-center text-danger py-4">' +
      '<i class="fas fa-exclamation-triangle mr-2"></i>' +
      escapeHtml(msg) +
      "</td></tr>";
  }
}

// ── Abrir modal ───────────────────────────────────────────────────────────────
function openModalById(id) {
  var insumo = null;
  for (var i = 0; i < _insumos.length; i++) {
    if (_insumos[i].id == id) {
      insumo = _insumos[i];
      break;
    }
  }
  openModal(insumo);
}

function openModal(insumo) {
  var titleEl = document.getElementById("modal-insumo-title");
  var idEl = document.getElementById("insumo-id");
  var nombreEl = document.getElementById("insumo-nombre");
  var unidadEl = document.getElementById("insumo-unidad");
  var stockEl = document.getElementById("insumo-stock");
  var form = document.getElementById("form-insumo");

  form.classList.remove("was-validated");
  [nombreEl, unidadEl, stockEl].forEach(function (el) {
    el.classList.remove("is-invalid");
  });

  if (insumo) {
    titleEl.textContent = "Editar Insumo";
    idEl.value = insumo.id;
    nombreEl.value = insumo.nombre;
    unidadEl.value = insumo.unidad;
    stockEl.value = parseFloat(insumo.stock);
  } else {
    titleEl.textContent = "Nuevo Insumo";
    idEl.value = "";
    nombreEl.value = "";
    unidadEl.value = "";
    stockEl.value = "0";
  }

  $("#modal-insumo").modal("show");
  setTimeout(function () {
    nombreEl.focus();
  }, 400);
}

// ── Guardar ───────────────────────────────────────────────────────────────────
async function saveInsumo() {
  var idEl = document.getElementById("insumo-id");
  var nombreEl = document.getElementById("insumo-nombre");
  var unidadEl = document.getElementById("insumo-unidad");
  var stockEl = document.getElementById("insumo-stock");
  var btnSave = document.getElementById("btn-guardar-insumo");

  var valid = true;

  var nombre = nombreEl.value.trim();
  if (!nombre) {
    nombreEl.classList.add("is-invalid");
    valid = false;
  } else {
    nombreEl.classList.remove("is-invalid");
  }

  var unidad = unidadEl.value.trim();
  if (!unidad) {
    unidadEl.classList.add("is-invalid");
    valid = false;
  } else {
    unidadEl.classList.remove("is-invalid");
  }

  var stock = parseFloat(stockEl.value);
  if (isNaN(stock) || stock < 0) {
    stockEl.classList.add("is-invalid");
    valid = false;
  } else {
    stockEl.classList.remove("is-invalid");
  }

  if (!valid) return;

  btnSave.disabled = true;
  btnSave.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

  try {
    var id = idEl.value;
    if (id) {
      await InsumosAPI.update(id, {
        nombre: nombre,
        unidad: unidad,
        stock: stock,
      });
      showAlert("success", "Insumo actualizado correctamente.");
    } else {
      await InsumosAPI.create({ nombre: nombre, unidad: unidad, stock: stock });
      showAlert("success", "Insumo creado correctamente.");
    }
    $("#modal-insumo").modal("hide");
    loadInsumos();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al guardar el insumo.";
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
  for (var i = 0; i < _insumos.length; i++) {
    if (_insumos[i].id == id) {
      nombre = _insumos[i].nombre;
      break;
    }
  }
  document.getElementById("del-insumo-nombre").textContent = nombre;
  $("#modal-confirmar-eliminar").modal("show");
}

async function deleteInsumo() {
  if (!_deleteId) return;

  var btnConf = document.getElementById("btn-confirmar-eliminar");
  btnConf.disabled = true;
  btnConf.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Eliminando...';

  try {
    await InsumosAPI.remove(_deleteId);
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("success", "Insumo eliminado correctamente.");
    _deleteId = null;
    loadInsumos();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al eliminar el insumo.";
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("danger", msg);
    _deleteId = null;
  } finally {
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
  var box = document.getElementById("alert-box");
  box.className = "alert alert-" + type + " alert-dismissible fade show";
  box.innerHTML =
    msg +
    '<button type="button" class="close" data-dismiss="alert">' +
    "<span>&times;</span></button>";
  setTimeout(function () {
    box.className = "d-none";
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
