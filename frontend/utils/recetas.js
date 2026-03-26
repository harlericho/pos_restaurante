// utils/recetas.js

var _productos = []; // tabla de productos
var _insumos = []; // lista de insumos para el select
var _recetaProductoId = null; // producto activo en el modal
var _recetaProductoNombre = "";

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

  // ── Agregar ingrediente ──────────────────────────────────────────────────
  document
    .getElementById("form-agregar-ingrediente")
    .addEventListener("submit", function (e) {
      e.preventDefault();
      agregarIngrediente();
    });

  // ── Confirmar quitar ─────────────────────────────────────────────────────
  document
    .getElementById("btn-confirmar-quitar")
    .addEventListener("click", quitarIngrediente);

  // ── Resetear estado modal al cerrar ──────────────────────────────────────
  $("#modal-receta").on("hidden.bs.modal", function () {
    _recetaProductoId = null;
    _recetaProductoNombre = "";
  });

  // ── Carga inicial ────────────────────────────────────────────────────────
  loadInsumos().then(function () {
    loadProductos();
  });
});

// ── Cargar insumos para el select ─────────────────────────────────────────────
async function loadInsumos() {
  try {
    var resp = await InsumosAPI.getAll();
    _insumos = resp.data || [];
    var sel = document.getElementById("sel-insumo");
    sel.innerHTML = '<option value="">-- Selecciona un insumo --</option>';
    _insumos.forEach(function (ins) {
      var opt = document.createElement("option");
      opt.value = ins.id;
      opt.textContent =
        escapeHtml(ins.nombre) + " (" + escapeHtml(ins.unidad) + ")";
      sel.appendChild(opt);
    });
  } catch (e) {
    // si falla no bloquea la página
  }
}

// ── Cargar tabla de productos ─────────────────────────────────────────────────
async function loadProductos() {
  var tbody = document.getElementById("tbody-recetas");
  var user = getUser();
  var isAdmin = user && user.rol === "admin";

  if ($.fn.DataTable.isDataTable("#table-recetas")) {
    $("#table-recetas").DataTable().destroy();
  }

  tbody.innerHTML =
    '<tr><td colspan="6" class="text-center text-muted py-4">' +
    '<i class="fas fa-spinner fa-spin mr-2"></i>Cargando...</td></tr>';

  try {
    var resp = await ProductosAPI.getAll();
    var prods = (resp.data || []).filter(function (p) {
      return !p.tipo || p.tipo === "elaborado";
    });
    _productos = prods;

    tbody.innerHTML = prods
      .map(function (p, idx) {
        var cat = p.categoria_nombre
          ? escapeHtml(p.categoria_nombre)
          : '<span class="text-muted">—</span>';
        var precio = "$ " + parseFloat(p.precio || 0).toFixed(2);

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
          precio +
          "</td>" +
          '<td class="text-center">' +
          '<span id="badge-ing-' +
          p.id +
          '" class="badge badge-secondary">—</span>' +
          "</td>" +
          '<td class="text-center">' +
          '<button class="btn btn-xs btn-success" onclick="verReceta(' +
          p.id +
          ')" title="Ver/Gestionar receta">' +
          '<i class="fas fa-book-open mr-1"></i> Ver Receta' +
          "</button>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (prods.length === 0) tbody.innerHTML = "";
    initDataTable("#table-recetas", 6);

    // Cargar conteo de ingredientes por producto en background
    prods.forEach(function (p) {
      cargarConteoIngredientes(p.id);
    });
  } catch (err) {
    console.error("[loadProductos]", err);
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al cargar productos.";
    tbody.innerHTML =
      '<tr><td colspan="6" class="text-center text-danger py-4">' +
      '<i class="fas fa-exclamation-triangle mr-2"></i>' +
      escapeHtml(msg) +
      "</td></tr>";
  }
}

// ── Cargar conteo de ingredientes para el badge ───────────────────────────────
async function cargarConteoIngredientes(productoId) {
  try {
    var resp = await RecetasAPI.getByProducto(productoId);
    var items = resp.data || [];
    var badge = document.getElementById("badge-ing-" + productoId);
    if (!badge) return;
    if (items.length === 0) {
      badge.className = "badge badge-secondary";
      badge.textContent = "Sin ingredientes";
    } else {
      badge.className = "badge badge-success";
      badge.textContent =
        items.length + (items.length === 1 ? " ingrediente" : " ingredientes");
    }
  } catch (e) {
    // silencioso
  }
}

// ── Abrir modal de receta ─────────────────────────────────────────────────────
async function verReceta(productoId) {
  var prod = null;
  for (var i = 0; i < _productos.length; i++) {
    if (_productos[i].id == productoId) {
      prod = _productos[i];
      break;
    }
  }
  if (!prod) return;

  _recetaProductoId = productoId;
  _recetaProductoNombre = prod.nombre;

  document.getElementById("receta-producto-nombre").textContent = prod.nombre;
  document.getElementById("sel-insumo").value = "";
  document.getElementById("input-cantidad").value = "";

  // Mostrar loading, ocultar tabla
  document.getElementById("receta-loading").classList.remove("d-none");
  document.getElementById("table-ingredientes").classList.add("d-none");
  document.getElementById("receta-vacia").classList.add("d-none");

  $("#modal-receta").modal("show");

  await recargarIngredientes();
}

// ── Recargar lista de ingredientes dentro del modal ───────────────────────────
async function recargarIngredientes() {
  var user = getUser();
  var isAdmin = user && user.rol === "admin";

  document.getElementById("receta-loading").classList.remove("d-none");
  document.getElementById("table-ingredientes").classList.add("d-none");
  document.getElementById("receta-vacia").classList.add("d-none");

  try {
    var resp = await RecetasAPI.getByProducto(_recetaProductoId);
    var items = resp.data || [];

    document.getElementById("receta-loading").classList.add("d-none");

    if (items.length === 0) {
      document.getElementById("receta-vacia").classList.remove("d-none");
    } else {
      var tbody = document.getElementById("tbody-ingredientes");
      tbody.innerHTML = items
        .map(function (r, idx) {
          var cantidadFmt = parseFloat(r.cantidad).toLocaleString("es-PE", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
          });
          var accion = isAdmin
            ? '<td class="text-center">' +
              '<button class="btn btn-xs btn-danger" onclick="confirmarQuitarIngrediente(' +
              r.id +
              ",'" +
              escapeHtml(r.insumo_nombre).replace(/'/g, "\\'") +
              '\')" title="Quitar ingrediente">' +
              '<i class="fas fa-trash"></i>' +
              "</button>" +
              "</td>"
            : "";
          return (
            "<tr>" +
            "<td>" +
            (idx + 1) +
            "</td>" +
            "<td>" +
            escapeHtml(r.insumo_nombre) +
            "</td>" +
            "<td>" +
            cantidadFmt +
            "</td>" +
            "<td>" +
            escapeHtml(r.unidad) +
            "</td>" +
            accion +
            "</tr>"
          );
        })
        .join("");

      document.getElementById("table-ingredientes").classList.remove("d-none");
    }

    // Actualizar badge en la tabla principal
    var badge = document.getElementById("badge-ing-" + _recetaProductoId);
    if (badge) {
      if (items.length === 0) {
        badge.className = "badge badge-secondary";
        badge.textContent = "Sin ingredientes";
      } else {
        badge.className = "badge badge-success";
        badge.textContent =
          items.length +
          (items.length === 1 ? " ingrediente" : " ingredientes");
      }
    }
  } catch (err) {
    document.getElementById("receta-loading").classList.add("d-none");
    document.getElementById("receta-vacia").classList.remove("d-none");
    document.getElementById("receta-vacia").innerHTML =
      '<i class="fas fa-exclamation-triangle mr-2 text-danger"></i>' +
      escapeHtml(
        err.data && err.data.error
          ? err.data.error
          : "Error al cargar ingredientes.",
      );
  }
}

// ── Agregar ingrediente ───────────────────────────────────────────────────────
async function agregarIngrediente() {
  var selInsumo = document.getElementById("sel-insumo");
  var inputCant = document.getElementById("input-cantidad");
  var btnAgregar = document.getElementById("btn-agregar-ingrediente");

  var insumoId = selInsumo.value;
  var cantidad = parseFloat(inputCant.value);

  if (!insumoId) {
    selInsumo.classList.add("is-invalid");
    selInsumo.focus();
    return;
  }
  selInsumo.classList.remove("is-invalid");

  if (!cantidad || cantidad <= 0) {
    inputCant.classList.add("is-invalid");
    inputCant.focus();
    return;
  }
  inputCant.classList.remove("is-invalid");

  btnAgregar.disabled = true;
  btnAgregar.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i> Agregando...';

  try {
    await RecetasAPI.create({
      producto_id: _recetaProductoId,
      insumo_id: parseInt(insumoId),
      cantidad: cantidad,
    });
    selInsumo.value = "";
    inputCant.value = "";
    await recargarIngredientes();
    showAlert("success", "Ingrediente agregado a la receta.");
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al agregar ingrediente.";
    showAlert("danger", msg);
  } finally {
    btnAgregar.disabled = false;
    btnAgregar.innerHTML = '<i class="fas fa-plus mr-1"></i> Agregar';
  }
}

// ── Confirmar quitar ──────────────────────────────────────────────────────────
var _quitarId = null;

function confirmarQuitarIngrediente(id, nombre) {
  _quitarId = id;
  document.getElementById("del-ingrediente-nombre").textContent = nombre;
  $("#modal-receta").css("z-index", "1040");
  $("#modal-confirmar-quitar").modal("show");
}

async function quitarIngrediente() {
  if (!_quitarId) return;

  var btnConf = document.getElementById("btn-confirmar-quitar");
  btnConf.disabled = true;
  btnConf.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Quitando...';

  try {
    await RecetasAPI.remove(_quitarId);
    $("#modal-confirmar-quitar").modal("hide");
    $("#modal-receta").css("z-index", "");
    _quitarId = null;
    await recargarIngredientes();
    showAlert("success", "Ingrediente eliminado de la receta.");
  } catch (err) {
    var msg =
      err.data && err.data.error
        ? err.data.error
        : err.message || "Error al quitar ingrediente.";
    $("#modal-confirmar-quitar").modal("hide");
    $("#modal-receta").css("z-index", "");
    showAlert("danger", msg);
    _quitarId = null;
  } finally {
    btnConf.disabled = false;
    btnConf.innerHTML = '<i class="fas fa-trash mr-1"></i> Quitar';
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
