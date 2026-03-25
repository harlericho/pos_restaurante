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
    // Establecer fechas por defecto: hoy (usando fecha local, no UTC)
    var _ahora = new Date();
    var hoy =
      _ahora.getFullYear() +
      "-" +
      String(_ahora.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(_ahora.getDate()).padStart(2, "0");
    el("filtro-desde").value = hoy;
    el("filtro-hasta").value = hoy;

    el("btn-buscar-reporte").addEventListener("click", function () {
      loadReporte();
    });

    // Inicializar tabla vacía (limpiar tbody para evitar error _DT_CellIndex)
    document.getElementById("tbody-ventas").innerHTML = "";
    initDataTable("#table-ventas", 7);
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

  // Resetear cliente
  _limpiarClienteCobrar();

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
      cliente_id: _getClienteIdCobrar() || undefined,
    });

    $("#modal-cobrar").modal("hide");

    var venta = resp.data || {};

    // Mostrar comprobante con número de factura
    document.getElementById("comp-numero-factura").textContent =
      venta.numero_factura || "S/N";
    document.getElementById("comp-venta-id").textContent =
      "#" + (venta.id || "");
    document.getElementById("comp-total").textContent =
      "$" + parseFloat(venta.total || 0).toFixed(2);
    var metodosLabel = {
      efectivo: "Efectivo",
      tarjeta: "Tarjeta",
      transferencia: "Transferencia",
    };
    document.getElementById("comp-metodo").textContent =
      metodosLabel[venta.metodo_pago] || venta.metodo_pago || "—";
    $("#modal-comprobante").modal("show");

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
          escapeHtml(v.numero_factura || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(fecha) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    if (ventas.length === 0) tbody.innerHTML = "";

    initDataTable("#table-ventas", 7);
    _reporteCargado = true;
  } catch (err) {
    console.error("[loadReporte]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al cargar el reporte.";
    showAlert("danger", msg);
    tbody.innerHTML = "";
    initDataTable("#table-ventas", 7);
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

// ═══════════════════════════════════════════════════════════════════════
// Búsqueda de cliente en modal cobrar
// ═══════════════════════════════════════════════════════════════════════
var _clienteSearchTimer = null;

document.addEventListener("DOMContentLoaded", function () {
  var inputSearch = document.getElementById("cobrar-cliente-search");
  var btnLimpiar = document.getElementById("btn-limpiar-cliente");
  var resultsBox = document.getElementById("cliente-search-results");

  if (!inputSearch) return;

  inputSearch.addEventListener("input", function () {
    clearTimeout(_clienteSearchTimer);
    var q = this.value.trim();

    if (q.length < 2) {
      if (resultsBox) resultsBox.style.display = "none";
      return;
    }

    _clienteSearchTimer = setTimeout(async function () {
      try {
        var resp = await ClientesAPI.search(q);
        var clientes = resp.data || [];
        resultsBox.innerHTML = "";

        if (clientes.length === 0) {
          resultsBox.innerHTML =
            '<div class="list-group-item text-muted small">Sin resultados</div>';
        } else {
          clientes.forEach(function (c) {
            var item = document.createElement("a");
            item.href = "#";
            item.className = "list-group-item list-group-item-action py-2";
            item.innerHTML =
              "<strong>" +
              escapeHtml(c.nombre) +
              "</strong>" +
              (c.ci_nit
                ? ' <small class="text-muted">CI: ' +
                  escapeHtml(c.ci_nit) +
                  "</small>"
                : "") +
              (c.telefono
                ? ' <small class="text-muted">— Tel: ' +
                  escapeHtml(c.telefono) +
                  "</small>"
                : "");
            item.addEventListener("click", function (e) {
              e.preventDefault();
              _seleccionarCliente(c.id, c.nombre);
            });
            resultsBox.appendChild(item);
          });
        }
        resultsBox.style.display = "block";
      } catch (err) {
        console.error("[clienteSearch]", err);
      }
    }, 300);
  });

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", function () {
      _limpiarClienteCobrar();
    });
  }

  // ── Nuevo cliente rápido ─────────────────────────────────────────────
  var btnNuevoNC = document.getElementById("btn-nuevo-cliente-cobrar");
  var formNC = document.getElementById("form-nuevo-cliente-cobrar");
  var btnCancelarNC = document.getElementById("btn-cancelar-nc");
  var btnGuardarNC = document.getElementById("btn-guardar-nc");

  if (btnNuevoNC && formNC) {
    btnNuevoNC.addEventListener("click", function () {
      formNC.classList.toggle("d-none");
      if (!formNC.classList.contains("d-none")) {
        document.getElementById("nc-nombre").focus();
      }
    });
  }

  if (btnCancelarNC && formNC) {
    btnCancelarNC.addEventListener("click", function () {
      _cerrarFormNuevoCliente();
    });
  }

  if (btnGuardarNC) {
    btnGuardarNC.addEventListener("click", function () {
      _guardarNuevoClienteCobrar();
    });
  }

  // Cerrar resultados al hacer clic fuera
  document.addEventListener("click", function (e) {
    if (
      resultsBox &&
      !resultsBox.contains(e.target) &&
      e.target !== inputSearch
    ) {
      resultsBox.style.display = "none";
    }
  });
});

function _seleccionarCliente(id, nombre) {
  document.getElementById("cobrar-cliente-id").value = id;
  document.getElementById("cobrar-cliente-search").value = nombre;
  document.getElementById("cobrar-cliente-nombre").textContent = nombre;
  document
    .getElementById("cobrar-cliente-seleccionado")
    .classList.remove("d-none");
  var r = document.getElementById("cliente-search-results");
  if (r) r.style.display = "none";
}

function _limpiarClienteCobrar() {
  document.getElementById("cobrar-cliente-id").value = "";
  document.getElementById("cobrar-cliente-search").value = "";
  document
    .getElementById("cobrar-cliente-seleccionado")
    .classList.add("d-none");
  var r = document.getElementById("cliente-search-results");
  if (r) r.style.display = "none";
}

function _cerrarFormNuevoCliente() {
  var formNC = document.getElementById("form-nuevo-cliente-cobrar");
  if (formNC) formNC.classList.add("d-none");
  ["nc-nombre", "nc-ci", "nc-email"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.classList.remove("is-invalid");
    }
  });
}

async function _guardarNuevoClienteCobrar() {
  var nombre = document.getElementById("nc-nombre").value.trim();
  var ciNit = document.getElementById("nc-ci").value.trim();
  var email = document.getElementById("nc-email").value.trim();

  var valid = true;
  if (!nombre) {
    document.getElementById("nc-nombre").classList.add("is-invalid");
    document.getElementById("nc-nombre").focus();
    valid = false;
  } else {
    document.getElementById("nc-nombre").classList.remove("is-invalid");
  }
  if (!ciNit) {
    document.getElementById("nc-ci").classList.add("is-invalid");
    if (valid) document.getElementById("nc-ci").focus();
    valid = false;
  } else {
    document.getElementById("nc-ci").classList.remove("is-invalid");
  }
  if (!email) {
    document.getElementById("nc-email").classList.add("is-invalid");
    if (valid) document.getElementById("nc-email").focus();
    valid = false;
  } else {
    document.getElementById("nc-email").classList.remove("is-invalid");
  }
  if (!valid) return;

  var btnGuardar = document.getElementById("btn-guardar-nc");
  btnGuardar.disabled = true;
  btnGuardar.innerHTML =
    '<i class="fas fa-spinner fa-spin mr-1"></i>Guardando...';

  try {
    var resp = await ClientesAPI.create({
      nombre: nombre,
      ci_nit: ciNit,
      telefono: null,
      email: email,
    });
    var nuevoCliente = resp.data;
    _seleccionarCliente(nuevoCliente.id, nuevoCliente.nombre);
    _cerrarFormNuevoCliente();
  } catch (err) {
    var msg =
      (err.data && err.data.error) || err.message || "Error al crear cliente.";
    alert(msg);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = '<i class="fas fa-save mr-1"></i>Guardar';
  }
}

function _getClienteIdCobrar() {
  var val = document.getElementById("cobrar-cliente-id").value;
  return val ? parseInt(val, 10) : null;
}
