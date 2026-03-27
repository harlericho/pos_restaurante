// utils/productos.js

// Lookup arrays locales (evita pasar datos en atributos HTML)
var _prods = [];
var _cats = [];

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
  var btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function (e) {
      e.preventDefault();
      logout();
    });
  }

  // ── Nuevo producto ───────────────────────────────────────────────────────
  var btnNuevo = document.getElementById("btn-nuevo-producto");
  if (btnNuevo) {
    btnNuevo.addEventListener("click", function () {
      openModal(null);
    });
  }

  // ── Filtro por categoría ─────────────────────────────────────────────────
  var filtroCat = document.getElementById("filtro-categoria");
  if (filtroCat) {
    filtroCat.addEventListener("change", function () {
      loadProductos(this.value || null);
    });
  }

  // ── Form submit ──────────────────────────────────────────────────────────
  var form = document.getElementById("form-producto");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      saveProducto();
    });
  }

  // ── Confirmar eliminar ───────────────────────────────────────────────────
  var btnConfirmar = document.getElementById("btn-confirmar-eliminar");
  if (btnConfirmar) {
    btnConfirmar.addEventListener("click", deleteProducto);
  }

  // ── Toggle campo stock según tipo ────────────────────────────────────────
  var prodTipoEl = document.getElementById("prod-tipo");
  if (prodTipoEl) {
    prodTipoEl.addEventListener("change", function () {
      var grupoStock = document.getElementById("grupo-stock");
      if (grupoStock) {
        grupoStock.style.display = this.value === "terminado" ? "" : "none";
      }
    });
  }

  // ── Carga inicial ────────────────────────────────────────────────────────
  loadCategorias().then(function () {
    loadProductos();
  });
});

// ── Carga categorías (para filtro y select del modal) ────────────────────────
async function loadCategorias() {
  try {
    var resp = await CategoriasAPI.getAll();
    _cats = resp.data || [];

    var filtroEl = document.getElementById("filtro-categoria");
    var selectModal = document.getElementById("prod-categoria");

    _cats.forEach(function (cat) {
      var opt1 = new Option(cat.nombre, cat.id);
      var opt2 = new Option(cat.nombre, cat.id);
      if (filtroEl) filtroEl.appendChild(opt1);
      if (selectModal) selectModal.appendChild(opt2);
    });
  } catch (e) {
    // Si no se cargan categorías, se sigue mostrando la tabla
  }
}

// ── Carga y renderiza productos ───────────────────────────────────────────────
async function loadProductos(categoriaId) {
  var tbody = document.getElementById("tbody-productos");
  var user = getUser();
  var isAdmin = user && user.rol === "admin";

  // Destruir DataTable existente antes de recargar
  if ($.fn.DataTable.isDataTable("#table-productos")) {
    $("#table-productos").DataTable().destroy();
  }

  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center text-muted py-4">' +
    '<i class="fas fa-spinner fa-spin mr-2"></i>Cargando...</td></tr>';

  try {
    var resp = await ProductosAPI.getAll(categoriaId || null);
    var prods = resp.data || [];
    _prods = prods;

    tbody.innerHTML = prods
      .map(function (p, idx) {
        var cat = p.categoria_nombre
          ? escapeHtml(p.categoria_nombre)
          : '<span class="text-muted">—</span>';
        var desc = p.descripcion
          ? escapeHtml(p.descripcion)
          : '<span class="text-muted">—</span>';
        var precio = "$ " + parseFloat(p.precio || 0).toFixed(2);

        var acciones = isAdmin
          ? '<td class="text-center">' +
            '<button class="btn btn-xs btn-info mr-1" onclick="openModalById(' +
            p.id +
            ')" title="Editar">' +
            '<i class="fas fa-edit"></i></button>' +
            '<button class="btn btn-xs btn-danger" onclick="confirmDelete(' +
            p.id +
            ')" title="Desactivar">' +
            '<i class="fas fa-ban"></i></button>' +
            "</td>"
          : "";

        var tipoCell;
        if (p.tipo === "terminado") {
          var stock = parseFloat(p.stock || 0);
          var stockBadge, stockColor;
          if (stock <= 0) {
            stockBadge = "badge-danger";
            stockColor = "text-danger font-weight-bold";
          } else if (stock < 10) {
            stockBadge = "badge-warning";
            stockColor = "text-warning font-weight-bold";
          } else {
            stockBadge = "badge-success";
            stockColor = "text-success";
          }
          tipoCell =
            '<span class="badge ' +
            stockBadge +
            '">Terminado</span><br>' +
            '<small class="' +
            stockColor +
            '">Stock: ' +
            stock.toFixed(0) +
            "</small>";
        } else {
          tipoCell = '<span class="badge badge-info">Elaborado</span>';
        }

        return (
          "<tr>" +
          "<td>" +
          (idx + 1) +
          "</td>" +
          "<td>" +
          escapeHtml(p.nombre) +
          "</td>" +
          "<td>" +
          cat +
          "</td>" +
          "<td>" +
          desc +
          "</td>" +
          "<td>" +
          precio +
          "</td>" +
          "<td>" +
          tipoCell +
          "</td>" +
          acciones +
          "</tr>"
        );
      })
      .join("");

    if (prods.length === 0) tbody.innerHTML = "";
    initDataTable("#table-productos", isAdmin ? 7 : 6);
  } catch (err) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-danger py-4">' +
      '<i class="fas fa-exclamation-triangle mr-2"></i>' +
      (err.data && err.data.error
        ? err.data.error
        : "Error al cargar productos.") +
      "</td></tr>";
  }
}

// ── Abre modal por ID (editar) ────────────────────────────────────────────────
function openModalById(id) {
  var prod = null;
  for (var i = 0; i < _prods.length; i++) {
    if (_prods[i].id == id) {
      prod = _prods[i];
      break;
    }
  }
  openModal(prod);
}

// ── Abre modal nuevo / editar ─────────────────────────────────────────────────
function openModal(prod) {
  var titleEl = document.getElementById("modal-producto-title");
  var idEl = document.getElementById("prod-id");
  var nombreEl = document.getElementById("prod-nombre");
  var catEl = document.getElementById("prod-categoria");
  var precioEl = document.getElementById("prod-precio");
  var descEl = document.getElementById("prod-descripcion");
  var codigoEl = document.getElementById("prod-codigo");
  var tipoEl = document.getElementById("prod-tipo");
  var stockEl = document.getElementById("prod-stock");
  var grupoStock = document.getElementById("grupo-stock");
  var form = document.getElementById("form-producto");

  // Limpiar validación
  form.classList.remove("was-validated");
  [nombreEl, precioEl].forEach(function (el) {
    el.classList.remove("is-invalid");
  });

  if (prod) {
    titleEl.textContent = "Editar Producto";
    idEl.value = prod.id;
    nombreEl.value = prod.nombre;
    precioEl.value = parseFloat(prod.precio).toFixed(2);
    descEl.value = prod.descripcion || "";
    catEl.value = prod.categoria_id || "";
    codigoEl.value = prod.codigo || "";
    tipoEl.value = prod.tipo || "elaborado";
    stockEl.value = parseFloat(prod.stock || 0).toFixed(0);
    grupoStock.style.display = prod.tipo === "terminado" ? "" : "none";
  } else {
    titleEl.textContent = "Nuevo Producto";
    idEl.value = "";
    nombreEl.value = "";
    precioEl.value = "";
    descEl.value = "";
    catEl.value = "";
    codigoEl.value = "";
    tipoEl.value = "elaborado";
    stockEl.value = "0";
    grupoStock.style.display = "none";
  }

  $("#modal-producto").modal("show");
  setTimeout(function () {
    nombreEl.focus();
  }, 400);
}

// ── Guardar (crear o actualizar) ──────────────────────────────────────────────
async function saveProducto() {
  var idEl = document.getElementById("prod-id");
  var nombreEl = document.getElementById("prod-nombre");
  var catEl = document.getElementById("prod-categoria");
  var precioEl = document.getElementById("prod-precio");
  var descEl = document.getElementById("prod-descripcion");
  var codigoEl = document.getElementById("prod-codigo");
  var tipoEl = document.getElementById("prod-tipo");
  var stockEl = document.getElementById("prod-stock");
  var btnSave = document.getElementById("btn-guardar-producto");

  var valid = true;

  var nombre = nombreEl.value.trim();
  if (!nombre) {
    nombreEl.classList.add("is-invalid");
    valid = false;
  } else {
    nombreEl.classList.remove("is-invalid");
  }

  var precio = precioEl.value.trim();
  if (precio === "" || isNaN(precio) || parseFloat(precio) < 0) {
    precioEl.classList.add("is-invalid");
    valid = false;
  } else {
    precioEl.classList.remove("is-invalid");
  }

  if (!valid) {
    nombreEl.focus();
    return;
  }

  btnSave.disabled = true;
  btnSave.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

  var payload = {
    nombre: nombre,
    precio: parseFloat(precio),
    descripcion: descEl.value.trim() || null,
    categoria_id: catEl.value ? parseInt(catEl.value) : null,
    codigo: codigoEl.value.trim() || null,
    tipo: tipoEl.value || "elaborado",
    stock: parseFloat(stockEl.value || 0),
  };

  try {
    var id = idEl.value;
    if (id) {
      await ProductosAPI.update(id, payload);
      showAlert("success", "Producto actualizado correctamente.");
    } else {
      await ProductosAPI.create(payload);
      showAlert("success", "Producto creado correctamente.");
    }

    $("#modal-producto").modal("hide");
    var filtroVal = document.getElementById("filtro-categoria").value;
    loadProductos(filtroVal || null);
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al guardar el producto.";
    showAlert("danger", msg);
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar';
  }
}

// ── Confirmar desactivar ──────────────────────────────────────────────────────
var _deleteId = null;

function confirmDelete(id) {
  _deleteId = id;
  var nombre = "";
  for (var i = 0; i < _prods.length; i++) {
    if (_prods[i].id == id) {
      nombre = _prods[i].nombre;
      break;
    }
  }
  document.getElementById("del-prod-nombre").textContent = nombre;
  $("#modal-confirmar-eliminar").modal("show");
}

async function deleteProducto() {
  if (!_deleteId) return;

  var btnConf = document.getElementById("btn-confirmar-eliminar");
  btnConf.disabled = true;
  btnConf.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Desactivando...';

  try {
    await ProductosAPI.remove(_deleteId);
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("success", "Producto desactivado correctamente.");
    var filtroVal = document.getElementById("filtro-categoria").value;
    loadProductos(filtroVal || null);
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al desactivar el producto.";
    $("#modal-confirmar-eliminar").modal("hide");
    showAlert("danger", msg);
  } finally {
    _deleteId = null;
    btnConf.disabled = false;
    btnConf.innerHTML = '<i class="fas fa-ban mr-1"></i> Desactivar';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Helper DataTable ─────────────────────────────────────────────────────────
function initDataTable(selector, numCols) {
  var colDefs = [];
  if (numCols > 1) {
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
