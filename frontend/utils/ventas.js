// utils/ventas.js

var _isAdmin = false;
var _reporteCargado = false;

document.addEventListener("DOMContentLoaded", function () {
  redirectIfNotLoggedIn();

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

  _isAdmin = user.rol === "admin";

  // Admin-only elements
  if (_isAdmin) {
    document.querySelectorAll(".admin-only").forEach(function (e) {
      e.classList.remove("d-none");
    });
  }

  // ── Logout ────────────────────────────────────────────────────────────
  el("btn-logout").addEventListener("click", function (e) {
    e.preventDefault();
    logout();
  });

  // ── Form cobrar ───────────────────────────────────────────────────────
  el("form-cobrar").addEventListener("submit", function (e) {
    e.preventDefault();
    registrarCobro();
  });

  // ── Reporte (admin) ───────────────────────────────────────────────────
  if (_isAdmin) {
    // Establecer fechas por defecto: hoy
    var hoy = new Date().toISOString().substring(0, 10);
    el("filtro-desde").value = hoy;
    el("filtro-hasta").value = hoy;

    el("btn-buscar-reporte").addEventListener("click", function () {
      loadReporte();
    });

    // Inicializar tabla vacía (limpiar tbody para evitar error _DT_CellIndex)
    document.getElementById("tbody-ventas").innerHTML = "";
    initDataTable("#table-ventas", 6);
    _reporteCargado = true;
  }

  // ── Cargar pedidos abiertos ───────────────────────────────────────────
  loadPedidosAbiertos();
});

// ═══════════════════════════════════════════════════════════════════════
// Pedidos abiertos
// ═══════════════════════════════════════════════════════════════════════
async function loadPedidosAbiertos() {
  var tbody = document.getElementById("tbody-pedidos-abiertos");

  try {
    if ($.fn.DataTable.isDataTable("#table-pedidos-abiertos")) {
      $("#table-pedidos-abiertos").DataTable().destroy();
    }
    tbody.innerHTML = "";

    var resp = await PedidosAPI.getAll("abierto");
    var pedidos = Array.isArray(resp.data) ? resp.data : [];

    tbody.innerHTML = pedidos
      .map(function (p) {
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
          escapeHtml(fecha) +
          "</td>" +
          "<td class='text-center'>" +
          "<button class='btn btn-success btn-xs' title='Cobrar' " +
          "onclick='abrirModalCobrar(" +
          p.id +
          "," +
          p.mesa_numero +
          ',"' +
          escapeHtml(p.usuario_nombre || "—") +
          '",' +
          total +
          ")'>" +
          "<i class='fas fa-cash-register'></i>" +
          "</button>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (pedidos.length === 0) tbody.innerHTML = "";

    initDataTable("#table-pedidos-abiertos", 6);
  } catch (err) {
    console.error("[loadPedidosAbiertos]", err);
    var msg =
      (err.data && err.data.error) || err.message || "Error al cargar pedidos.";
    showAlert("danger", msg);
    tbody.innerHTML = "";
    initDataTable("#table-pedidos-abiertos", 6);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Modal cobrar
// ═══════════════════════════════════════════════════════════════════════
function abrirModalCobrar(pedidoId, mesaNumero, mesero, total) {
  document.getElementById("cobrar-pedido-id").value = pedidoId;
  document.getElementById("cobrar-resumen-mesa").textContent =
    "Pedido #" + pedidoId + " — Mesa " + mesaNumero;
  document.getElementById("cobrar-resumen-mesero").textContent =
    "Atendido por: " + mesero;
  document.getElementById("cobrar-resumen-total").textContent =
    "$" + parseFloat(total).toFixed(2);

  // Resetear a efectivo
  document.getElementById("metodo-efectivo").checked = true;

  $("#modal-cobrar").modal("show");
}

// ═══════════════════════════════════════════════════════════════════════
// Registrar cobro
// ═══════════════════════════════════════════════════════════════════════
async function registrarCobro() {
  var pedidoId = parseInt(
    document.getElementById("cobrar-pedido-id").value,
    10,
  );
  var metodoPago = document.querySelector('input[name="metodo_pago"]:checked');

  if (!metodoPago) {
    showAlert("warning", "Seleccione un método de pago.");
    return;
  }

  try {
    var resp = await VentasAPI.create({
      pedido_id: pedidoId,
      metodo_pago: metodoPago.value,
    });

    $("#modal-cobrar").modal("hide");

    var venta = resp.data || {};
    showAlert(
      "success",
      "Venta registrada correctamente. ID Venta: #" +
        (venta.id || "") +
        " — Total: $" +
        parseFloat(venta.total || 0).toFixed(2),
    );

    // Recargar pedidos abiertos
    loadPedidosAbiertos();

    // Si el admin tiene el reporte visible y ya se cargó, refrescarlo
    if (_isAdmin && _reporteCargado) {
      loadReporte();
    }
  } catch (err) {
    console.error("[registrarCobro]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al registrar la venta.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Reporte (admin)
// ═══════════════════════════════════════════════════════════════════════
async function loadReporte() {
  if (!_isAdmin) return;

  var desde = document.getElementById("filtro-desde").value;
  var hasta = document.getElementById("filtro-hasta").value;

  if (!desde || !hasta) {
    showAlert("warning", "Ingrese un rango de fechas válido.");
    return;
  }
  if (desde > hasta) {
    showAlert("warning", "La fecha 'desde' no puede ser mayor que 'hasta'.");
    return;
  }

  var tbody = document.getElementById("tbody-ventas");

  try {
    if ($.fn.DataTable.isDataTable("#table-ventas")) {
      $("#table-ventas").DataTable().destroy();
    }

    var resp = await VentasAPI.getReporte(desde, hasta);
    var ventas = Array.isArray(resp.data && resp.data.ventas)
      ? resp.data.ventas
      : Array.isArray(resp.ventas)
        ? resp.ventas
        : [];
    var resumen = Array.isArray(resp.data && resp.data.resumen)
      ? resp.data.resumen
      : Array.isArray(resp.resumen)
        ? resp.resumen
        : [];
    var totales = (resp.data && resp.data.totales) || resp.totales || {};

    // Stats
    document.getElementById("stat-total-ventas").textContent =
      totales.total_ventas || 0;
    document.getElementById("stat-total-ingresos").textContent =
      "$" + parseFloat(totales.total_ingresos || 0).toFixed(2);

    // Stats por método
    var efectivo = 0;
    var digital = 0;
    resumen.forEach(function (r) {
      if (r.metodo_pago === "efectivo") {
        efectivo += parseFloat(r.subtotal || 0);
      } else {
        digital += parseFloat(r.subtotal || 0);
      }
    });
    document.getElementById("stat-efectivo").textContent =
      "$" + efectivo.toFixed(2);
    document.getElementById("stat-digital").textContent =
      "$" + digital.toFixed(2);

    // Tabla
    var metodoBadge = {
      efectivo: '<span class="badge badge-success">Efectivo</span>',
      tarjeta: '<span class="badge badge-primary">Tarjeta</span>',
      transferencia: '<span class="badge badge-info">Transferencia</span>',
    };

    tbody.innerHTML = ventas
      .map(function (v) {
        var fecha = v.fecha ? v.fecha.replace("T", " ").substring(0, 16) : "—";
        var badge =
          metodoBadge[v.metodo_pago] ||
          '<span class="badge badge-secondary">' +
            escapeHtml(v.metodo_pago) +
            "</span>";
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(String(v.id)) +
          "</td>" +
          "<td>" +
          escapeHtml(String(v.mesa_numero || "—")) +
          "</td>" +
          "<td>" +
          escapeHtml(v.usuario_nombre || "—") +
          "</td>" +
          "<td>$" +
          parseFloat(v.total || 0).toFixed(2) +
          "</td>" +
          "<td>" +
          badge +
          "</td>" +
          "<td>" +
          escapeHtml(fecha) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (ventas.length === 0) tbody.innerHTML = "";

    initDataTable("#table-ventas", 6);
    _reporteCargado = true;
  } catch (err) {
    console.error("[loadReporte]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al cargar el reporte.";
    showAlert("danger", msg);
    tbody.innerHTML = "";
    initDataTable("#table-ventas", 6);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════
function initDataTable(selector, numCols) {
  $(selector).DataTable({
    language: {
      url: false,
      emptyTable: "No hay registros en este período",
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
