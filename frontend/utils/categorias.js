// utils/categorias.js

// Lookup array para editar/eliminar sin pasar JSON en atributos HTML
var _cats = [];

document.addEventListener("DOMContentLoaded", function () {
  if (!redirectIfNotLoggedIn()) return;

  // Solo administradores pueden acceder a este módulo
  var user = getUser();
  if (!redirectIfNotAdmin()) return;

  // ── Populate user info ──────────────────────────────────────────────────
  if (user) {
    var roleCap = user.rol.charAt(0).toUpperCase() + user.rol.slice(1);

    var nameEl = document.getElementById("nav-user-name");
    var nameHdEl = document.getElementById("nav-user-name-header");
    var roleEl = document.getElementById("nav-user-role");
    var sideNameEl = document.getElementById("sidebar-user-name");
    var sideRoleEl = document.getElementById("sidebar-user-role");

    if (nameEl) nameEl.textContent = user.nombre;
    if (nameHdEl) nameHdEl.textContent = user.nombre;
    if (roleEl) roleEl.textContent = roleCap;
    if (sideNameEl) sideNameEl.textContent = user.nombre;
    if (sideRoleEl) sideRoleEl.textContent = roleCap;

    // Show admin-only elements
    if (user.rol === "admin") {
      document.querySelectorAll(".admin-only").forEach(function (el) {
        el.style.display = "";
      });
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────
  var btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function (e) {
      e.preventDefault();
      logout();
    });
  }

  // ── "Nueva Categoría" button ─────────────────────────────────────────────
  var btnNueva = document.getElementById("btn-nueva-categoria");
  if (btnNueva) {
    btnNueva.addEventListener("click", function () {
      openModal(null);
    });
  }

  // ── Form submit (create / edit) ──────────────────────────────────────────
  var formCat = document.getElementById("form-categoria");
  if (formCat) {
    formCat.addEventListener("submit", function (e) {
      e.preventDefault();
      saveCategoria();
    });
  }

  // ── Load data ────────────────────────────────────────────────────────────
  loadCategorias();
});

// ── Load & render categories ─────────────────────────────────────────────────
async function loadCategorias() {
  var tbody = document.getElementById("tbody-categorias");
  var user = getUser();
  var isAdmin = user && user.rol === "admin";

  // Destruir DataTable existente antes de recargar
  if ($.fn.DataTable.isDataTable("#table-categorias")) {
    $("#table-categorias").DataTable().destroy();
  }

  tbody.innerHTML =
    '<tr><td colspan="3" class="text-center text-muted py-4">' +
    '<i class="fas fa-spinner fa-spin mr-2"></i>Cargando...</td></tr>';

  try {
    var resp = await CategoriasAPI.getAll();
    var cats = resp.data || [];
    _cats = cats;

    tbody.innerHTML = cats
      .map(function (cat, idx) {
        var acciones = isAdmin
          ? '<td class="text-center">' +
            '<button class="btn btn-xs btn-info mr-1" onclick="openModalById(' +
            cat.id +
            ')" title="Editar">' +
            '<i class="fas fa-edit"></i></button>' +
            '<button class="btn btn-xs btn-danger" onclick="confirmDelete(' +
            cat.id +
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
          escapeHtml(cat.nombre) +
          "</td>" +
          acciones +
          "</tr>"
        );
      })
      .join("");

    if (cats.length === 0) tbody.innerHTML = "";
    initDataTable("#table-categorias", isAdmin ? 3 : 2);
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-center text-danger py-4">' +
      '<i class="fas fa-exclamation-triangle mr-2"></i>' +
      (err.data && err.data.error
        ? err.data.error
        : "Error al cargar categorías.") +
      "</td></tr>";
  }
}

// Busca la categoría en el array local y abre el modal
function openModalById(id) {
  var cat = null;
  for (var i = 0; i < _cats.length; i++) {
    if (_cats[i].id == id) {
      cat = _cats[i];
      break;
    }
  }
  openModal(cat);
}

// ── Open modal (new or edit) ──────────────────────────────────────────────────
function openModal(cat) {
  var titleEl = document.getElementById("modal-categoria-title");
  var idEl = document.getElementById("cat-id");
  var nombreEl = document.getElementById("cat-nombre");
  var form = document.getElementById("form-categoria");

  // Reset validation state
  form.classList.remove("was-validated");
  nombreEl.classList.remove("is-invalid");

  if (cat) {
    titleEl.textContent = "Editar Categoría";
    idEl.value = cat.id;
    nombreEl.value = cat.nombre;
  } else {
    titleEl.textContent = "Nueva Categoría";
    idEl.value = "";
    nombreEl.value = "";
  }

  $("#modal-categoria").modal("show");
  setTimeout(function () {
    nombreEl.focus();
  }, 400);
}

// ── Save (create or update) ───────────────────────────────────────────────────
async function saveCategoria() {
  var idEl = document.getElementById("cat-id");
  var nombreEl = document.getElementById("cat-nombre");
  var btnSave = document.getElementById("btn-guardar-categoria");

  var nombre = nombreEl.value.trim();
  if (!nombre) {
    nombreEl.classList.add("is-invalid");
    nombreEl.focus();
    return;
  }
  nombreEl.classList.remove("is-invalid");

  btnSave.disabled = true;
  btnSave.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

  try {
    var id = idEl.value;
    if (id) {
      await CategoriasAPI.update(id, { nombre: nombre });
      showAlert("success", "Categoría actualizada correctamente.");
    } else {
      await CategoriasAPI.create({ nombre: nombre });
      showAlert("success", "Categoría creada correctamente.");
    }

    $("#modal-categoria").modal("hide");
    loadCategorias();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al guardar la categoría.";
    showAlert("danger", msg);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
  }
}

// ── Confirm delete ────────────────────────────────────────────────────────────
var _deleteId = null;

function confirmDelete(id) {
  _deleteId = id;
  var nombre = "";
  for (var i = 0; i < _cats.length; i++) {
    if (_cats[i].id == id) {
      nombre = _cats[i].nombre;
      break;
    }
  }
  document.getElementById("del-cat-nombre").textContent = nombre;
  $("#modal-confirmar-eliminar").modal("show");
}

document.addEventListener("DOMContentLoaded", function () {
  var btnConfirmar = document.getElementById("btn-confirmar-eliminar");
  if (btnConfirmar) {
    btnConfirmar.addEventListener("click", deleteCategoria);
  }
});

async function deleteCategoria() {
  if (!_deleteId) return;

  var btnConfirmar = document.getElementById("btn-confirmar-eliminar");
  btnConfirmar.disabled = true;
  btnConfirmar.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Eliminando...';

  try {
    await CategoriasAPI.remove(_deleteId);
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("success", "Categoría eliminada correctamente.");
    loadCategorias();
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al eliminar la categoría.";
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("danger", msg);
  } finally {
    _deleteId = null;
    btnConfirmar.disabled = false;
    btnConfirmar.innerHTML = '<i class="fas fa-trash mr-1"></i> Eliminar';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showAlert(type, msg) {
  var box = document.getElementById("alert-box");
  if (!box) return;

  box.className = "alert alert-" + type + " alert-dismissible fade show";
  box.innerHTML =
    msg +
    '<button type="button" class="close" data-dismiss="alert">' +
    "<span>&times;</span></button>";

  // Auto-hide after 4 seconds
  setTimeout(function () {
    $(box).alert("close");
  }, 4000);
}

// ── Helper DataTable ─────────────────────────────────────────────────────────
function initDataTable(selector, numCols) {
  // La última columna (Acciones) no debe ser ordenable ni buscable
  var colDefs = [];
  if (numCols > 2) {
    colDefs = [{ orderable: false, searchable: false, targets: numCols - 1 }];
  }
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
        last: "\u00DAltimo",
      },
    },
    pageLength: 10,
    lengthMenu: [5, 10, 25, 50],
    columnDefs: colDefs,
    responsive: true,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
