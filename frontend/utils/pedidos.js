// utils/pedidos.js

var _pedidos = [];
var _productos = [];
var _filtroEstado = null;
var _pedidoActivo = null; // objeto con id + estado del pedido en el modal

document.addEventListener("DOMContentLoaded", function () {
  if (!redirectIfNotLoggedIn()) return;

  // ── User info ────────────────────────────────────────────────────────
  var user = getUser();
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

  // Admin-only elements
  if (user.rol === "admin") {
    document.querySelectorAll(".admin-only").forEach(function (e) {
      e.classList.remove("d-none");
    });
  }

  // ── Logout ────────────────────────────────────────────────────────────
  el("btn-logout").addEventListener("click", function (e) {
    e.preventDefault();
    logout();
  });

  // ── Botón Nuevo Pedido ────────────────────────────────────────────────
  el("btn-nuevo-pedido").addEventListener("click", openNuevoPedidoModal);

  // ── Form Nuevo Pedido ─────────────────────────────────────────────────
  el("form-nuevo-pedido").addEventListener("submit", function (e) {
    e.preventDefault();
    crearPedido();
  });

  // ── Form Agregar ítem ─────────────────────────────────────────────────
  el("form-agregar-item").addEventListener("submit", function (e) {
    e.preventDefault();
    agregarItem();
  });

  // ── Confirmar cerrar pedido ───────────────────────────────────────────
  el("btn-confirmar-cerrar").addEventListener("click", function () {
    if (_pedidoActivo) {
      cerrarPedido(_pedidoActivo.id);
    }
  });

  // ── Carga inicial ─────────────────────────────────────────────────────
  loadProductos();
  loadPedidos();
});

// ═══════════════════════════════════════════════════════════════════════
// Filtro
// ═══════════════════════════════════════════════════════════════════════
function setFiltro(estado) {
  _filtroEstado = estado;

  // resaltar botón activo
  document
    .querySelectorAll(
      "#btn-filtro-todos, #btn-filtro-abiertos, #btn-filtro-cerrados",
    )
    .forEach(function (b) {
      b.classList.remove("active");
    });

  if (estado === "abierto") {
    document.getElementById("btn-filtro-abiertos").classList.add("active");
  } else if (estado === "cerrado") {
    document.getElementById("btn-filtro-cerrados").classList.add("active");
  } else {
    document.getElementById("btn-filtro-todos").classList.add("active");
  }

  loadPedidos();
}

// ═══════════════════════════════════════════════════════════════════════
// Cargar pedidos
// ═══════════════════════════════════════════════════════════════════════
async function loadPedidos() {
  showAlert("", "");
  var tbody = document.getElementById("tbody-pedidos");

  try {
    if ($.fn.DataTable.isDataTable("#table-pedidos")) {
      $("#table-pedidos").DataTable().destroy();
    }

    var resp = await PedidosAPI.getAll(_filtroEstado);
    _pedidos = Array.isArray(resp.data) ? resp.data : [];

    // Actualizar stats (siempre con todos los pedidos cuando no hay filtro)
    updateStats();

    tbody.innerHTML = _pedidos
      .map(function (p) {
        var estadoBadge =
          p.estado === "abierto"
            ? '<span class="badge badge-warning">Abierto</span>'
            : '<span class="badge badge-success">Cerrado</span>';

        var fecha = p.fecha ? p.fecha.replace("T", " ").substring(0, 16) : "—";
        var total = parseFloat(p.total || 0).toFixed(2);

        return (
          "<tr>" +
          "<td>" +
          escapeHtml(String(p.id)) +
          "</td>" +
          "<td>" +
          escapeHtml(String(p.mesa_numero || "—")) +
          "</td>" +
          "<td>" +
          escapeHtml(p.usuario_nombre || "—") +
          "</td>" +
          "<td>$" +
          total +
          "</td>" +
          "<td>" +
          estadoBadge +
          "</td>" +
          "<td>" +
          escapeHtml(fecha) +
          "</td>" +
          "<td class='text-center'>" +
          "<button class='btn btn-info btn-xs mr-1' title='Ver detalle' onclick='verPedido(" +
          p.id +
          ")'>" +
          "<i class='fas fa-eye'></i>" +
          "</button>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (_pedidos.length === 0) tbody.innerHTML = "";

    initDataTable("#table-pedidos", 7);
  } catch (err) {
    console.error("[loadPedidos]", err);
    var msg =
      (err.data && err.data.error) || err.message || "Error al cargar pedidos.";
    showAlert("danger", msg);
    tbody.innerHTML = "";
    initDataTable("#table-pedidos", 7);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════════════
async function updateStats() {
  // Si hay filtro activo los datos ya están filtrados, pedimos todos para las stats
  try {
    var source = _pedidos;
    if (_filtroEstado !== null) {
      var all = await PedidosAPI.getAll(null);
      source = Array.isArray(all.data) ? all.data : [];
    }
    var abiertos = source.filter(function (p) {
      return p.estado === "abierto";
    }).length;
    var cerrados = source.filter(function (p) {
      return p.estado === "cerrado";
    }).length;
    document.getElementById("stat-abiertos").textContent = abiertos;
    document.getElementById("stat-cerrados").textContent = cerrados;
  } catch (_) {
    // stats son decorativas, no bloquear
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Cargar productos (para el select de agregar ítem)
// ═══════════════════════════════════════════════════════════════════════
async function loadProductos() {
  try {
    var resp = await ProductosAPI.getAll();
    _productos = Array.isArray(resp.data) ? resp.data : [];
  } catch (_) {
    _productos = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Modal: Nuevo Pedido
// ═══════════════════════════════════════════════════════════════════════
async function openNuevoPedidoModal() {
  var select = document.getElementById("pedido-mesa");
  select.innerHTML = '<option value="">— Cargando mesas… —</option>';
  select.disabled = true;

  $("#modal-nuevo-pedido").modal("show");

  try {
    var resp = await MesasAPI.getAll();
    var mesas = Array.isArray(resp.data) ? resp.data : [];
    var libres = mesas.filter(function (m) {
      return m.estado === "libre";
    });

    if (libres.length === 0) {
      select.innerHTML =
        '<option value="">— No hay mesas disponibles —</option>';
    } else {
      select.innerHTML =
        '<option value="">— Seleccione una mesa libre —</option>' +
        libres
          .map(function (m) {
            return (
              "<option value='" +
              m.id +
              "'>Mesa " +
              escapeHtml(String(m.numero)) +
              (m.capacidad ? " (cap. " + m.capacidad + ")" : "") +
              "</option>"
            );
          })
          .join("");
    }
  } catch (err) {
    console.error("[openNuevoPedidoModal]", err);
    select.innerHTML = '<option value="">— Error al cargar mesas —</option>';
  }

  select.disabled = false;
}

// ═══════════════════════════════════════════════════════════════════════
// Crear pedido
// ═══════════════════════════════════════════════════════════════════════
async function crearPedido() {
  var mesaId = document.getElementById("pedido-mesa").value;
  if (!mesaId) {
    showAlert("warning", "Seleccione una mesa.");
    return;
  }

  try {
    await PedidosAPI.create({ mesa_id: parseInt(mesaId) });
    $("#modal-nuevo-pedido").modal("hide");
    showAlert("success", "Pedido creado correctamente.");
    loadPedidos();
  } catch (err) {
    console.error("[crearPedido]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al crear el pedido.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Ver / gestionar pedido
// ═══════════════════════════════════════════════════════════════════════
async function verPedido(id) {
  try {
    var resp = await PedidosAPI.getById(id);
    var p = resp.data || resp;

    _pedidoActivo = { id: p.id, estado: p.estado };

    // Header
    document.getElementById("modal-ver-pedido-title").innerHTML =
      "<i class='fas fa-receipt mr-2'></i>Pedido #" + escapeHtml(String(p.id));
    document.getElementById("ver-mesa").textContent =
      "Mesa " + (p.mesa_numero || "—");
    document.getElementById("ver-mesero").textContent = p.usuario_nombre || "—";
    document.getElementById("ver-total").textContent =
      "$" + parseFloat(p.total || 0).toFixed(2);

    var estadoBadge =
      p.estado === "abierto"
        ? '<span class="badge badge-warning badge-lg">Abierto</span>'
        : '<span class="badge badge-success badge-lg">Cerrado</span>';
    document.getElementById("ver-estado").innerHTML = estadoBadge;

    // Ítems
    renderDetalle(p.detalle || [], p.estado);

    // Mostrar / ocultar formulario de agregar ítem
    var wrapperAgregar = document.getElementById("form-agregar-item-wrapper");
    var btnCerrarWrapper = document.getElementById("btn-cerrar-pedido-wrapper");

    if (p.estado === "abierto") {
      wrapperAgregar.style.display = "";
      btnCerrarWrapper.style.display = "";
      fillProductosSelect();
    } else {
      wrapperAgregar.style.display = "none";
      btnCerrarWrapper.style.display = "none";
    }

    // Configurar confirmación de cerrar
    document.getElementById("confirmar-pedido-ref").textContent =
      "#" + p.id + " (Mesa " + (p.mesa_numero || "—") + ")";

    $("#modal-ver-pedido").modal("show");
  } catch (err) {
    console.error("[verPedido]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al cargar el pedido.";
    showAlert("danger", msg);
  }
}

function renderDetalle(detalle, estado) {
  var user = getUser();
  var puedeQuitar = estado === "abierto";
  var colQuitarHeader = document.getElementById("col-quitar-header");

  if (puedeQuitar) {
    colQuitarHeader.style.display = "";
  } else {
    colQuitarHeader.style.display = "none";
  }

  var tbody = document.getElementById("tbody-detalle");

  if (!detalle || detalle.length === 0) {
    var cols = puedeQuitar ? 5 : 4;
    tbody.innerHTML =
      "<tr><td colspan='" +
      cols +
      "' class='text-center text-muted py-3'>Sin ítems</td></tr>";
    return;
  }

  tbody.innerHTML = detalle
    .map(function (item) {
      var quitarCell = puedeQuitar
        ? "<td class='text-center'>" +
          "<button class='btn btn-danger btn-xs' title='Quitar ítem' " +
          "onclick='confirmarQuitarItem(" +
          _pedidoActivo.id +
          "," +
          item.id +
          ',"' +
          escapeHtml(item.producto_nombre || "ítem") +
          "\")'>" +
          "<i class='fas fa-times'></i>" +
          "</button></td>"
        : "";

      return (
        "<tr>" +
        "<td>" +
        escapeHtml(item.producto_nombre || "—") +
        "</td>" +
        "<td class='text-center'>" +
        escapeHtml(String(item.cantidad)) +
        "</td>" +
        "<td class='text-right'>$" +
        parseFloat(item.precio || 0).toFixed(2) +
        "</td>" +
        "<td class='text-right'>$" +
        parseFloat(item.subtotal || 0).toFixed(2) +
        "</td>" +
        quitarCell +
        "</tr>"
      );
    })
    .join("");
}

function fillProductosSelect() {
  var select = document.getElementById("item-producto");
  select.innerHTML =
    '<option value="">— Seleccione producto —</option>' +
    _productos
      .map(function (prod) {
        return (
          "<option value='" +
          prod.id +
          "' data-precio='" +
          (prod.precio || 0) +
          "'>" +
          escapeHtml(prod.nombre) +
          " - $" +
          parseFloat(prod.precio || 0).toFixed(2) +
          "</option>"
        );
      })
      .join("");
  document.getElementById("item-cantidad").value = "1";
}

// ═══════════════════════════════════════════════════════════════════════
// Agregar ítem al pedido activo
// ═══════════════════════════════════════════════════════════════════════
async function agregarItem() {
  if (!_pedidoActivo) return;

  var productoId = document.getElementById("item-producto").value;
  var cantidad = parseInt(document.getElementById("item-cantidad").value, 10);

  if (!productoId) {
    showAlert("warning", "Seleccione un producto.");
    return;
  }
  if (!cantidad || cantidad < 1) {
    showAlert("warning", "La cantidad debe ser al menos 1.");
    return;
  }

  try {
    await PedidosAPI.addDetalle(_pedidoActivo.id, {
      producto_id: parseInt(productoId),
      cantidad: cantidad,
    });
    // Refrescar el modal con los datos actualizados
    await verPedido(_pedidoActivo.id);
    // Recargar lista de pedidos en segundo plano para actualizar totales
    loadPedidos();
  } catch (err) {
    console.error("[agregarItem]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al agregar el ítem.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Quitar ítem
// ═══════════════════════════════════════════════════════════════════════
function confirmarQuitarItem(pedidoId, detalleId, nombre) {
  document.getElementById("confirmar-item-nombre").textContent = nombre;

  var btnConfirmar = document.getElementById("btn-confirmar-quitar");
  // Clonar para limpiar listeners anteriores
  var nuevo = btnConfirmar.cloneNode(true);
  btnConfirmar.parentNode.replaceChild(nuevo, btnConfirmar);
  nuevo.addEventListener("click", function () {
    quitarItem(pedidoId, detalleId);
  });

  $("#modal-confirmar-quitar").modal("show");
}

async function quitarItem(pedidoId, detalleId) {
  try {
    await PedidosAPI.removeDetalle(pedidoId, detalleId);
    $("#modal-confirmar-quitar").modal("hide");
    // Refrescar modal
    await verPedido(pedidoId);
    loadPedidos();
  } catch (err) {
    console.error("[quitarItem]", err);
    var msg =
      (err.data && err.data.error) || err.message || "Error al quitar el ítem.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Cerrar pedido
// ═══════════════════════════════════════════════════════════════════════
function confirmarCerrarPedido() {
  if (!_pedidoActivo) return;
  $("#modal-confirmar-cerrar").modal("show");
}

async function cerrarPedido(id) {
  try {
    await PedidosAPI.cerrar(id);
    $("#modal-confirmar-cerrar").modal("hide");
    $("#modal-ver-pedido").modal("hide");
    showAlert("success", "Pedido cerrado correctamente.");
    _pedidoActivo = null;
    loadPedidos();
  } catch (err) {
    console.error("[cerrarPedido]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al cerrar el pedido.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════
function initDataTable(selector, numCols) {
  $(selector).DataTable({
    language: {
      url: false,
      emptyTable: "No hay pedidos registrados",
      zeroRecords: "No se encontraron resultados",
      info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
      infoEmpty: "Mostrando 0 a 0 de 0 registros",
      infoFiltered: "(filtrado de _MAX_ registros en total)",
      search: "Buscar:",
      paginate: { first: "«", last: "»", next: "›", previous: "‹" },
      lengthMenu: "Mostrar _MENU_ registros",
    },
    pageLength: 10,
    responsive: false,
    columnDefs: [{ orderable: false, targets: numCols - 1 }],
    order: [[0, "desc"]],
  });
}

function showAlert(type, msg) {
  var box = document.getElementById("alert-box");
  if (!type || !msg) {
    box.className = "d-none";
    box.innerHTML = "";
    return;
  }
  box.className = "alert alert-" + type + " alert-dismissible fade show";
  box.innerHTML =
    escapeHtml(msg) +
    '<button type="button" class="close" data-dismiss="alert">' +
    "<span>&times;</span></button>";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
