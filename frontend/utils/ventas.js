// utils/ventas.js

var _isAdmin = false;
var _reporteCargado = false;
var _currentVenta = null;

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

  // ── Descargar factura PDF ─────────────────────────────────────────────
  el("btn-descargar-factura").addEventListener("click", function () {
    generarFacturaPDF();
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
    initDataTable("#table-ventas", 8);
    _reporteCargado = true;

    // Delegar click en botones PDF del reporte
    document
      .getElementById("tbody-ventas")
      .addEventListener("click", function (e) {
        var btn = e.target.closest(".btn-pdf-reporte");
        if (!btn) return;
        var ventaData = {
          id: btn.dataset.ventaId,
          pedido_id: btn.dataset.pedidoId,
          numero_factura: btn.dataset.factura,
          total: btn.dataset.total,
          cliente_nombre: btn.dataset.cliente,
          cliente_ci_nit: btn.dataset.ci,
          cliente_telefono: btn.dataset.telefono,
          cliente_email: btn.dataset.email,
          metodo_pago: btn.dataset.metodo,
        };
        _currentVenta = ventaData;
        generarFacturaPDF();
      });
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
    _currentVenta = venta;
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
          '<td class="text-center"><button class="btn btn-xs btn-outline-primary btn-pdf-reporte" ' +
          'data-venta-id="' +
          v.id +
          '" ' +
          'data-pedido-id="' +
          (v.pedido_id || "") +
          '" ' +
          'data-factura="' +
          escapeHtml(v.numero_factura || "") +
          '" ' +
          'data-total="' +
          parseFloat(v.total || 0).toFixed(2) +
          '" ' +
          'data-cliente="' +
          escapeHtml(v.cliente_nombre || "Consumidor Final") +
          '" ' +
          'data-ci="' +
          escapeHtml(v.cliente_ci_nit || "") +
          '" ' +
          'data-telefono="' +
          escapeHtml(v.cliente_telefono || "") +
          '" ' +
          'data-email="' +
          escapeHtml(v.cliente_email || "") +
          '" ' +
          'data-metodo="' +
          escapeHtml(v.metodo_pago || "") +
          '" ' +
          'title="Ver Factura PDF"><i class="fas fa-file-pdf"></i></button></td>' +
          "</tr>"
        );
      })
      .join("");

    if (ventas.length === 0) tbody.innerHTML = "";

    initDataTable("#table-ventas", 8);
    _reporteCargado = true;
  } catch (err) {
    console.error("[loadReporte]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al cargar el reporte.";
    showAlert("danger", msg);
    tbody.innerHTML = "";
    initDataTable("#table-ventas", 8);
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

// ═══════════════════════════════════════════════════════════════════════
// Generar factura PDF (pdfmake local)
// ═══════════════════════════════════════════════════════════════════════
async function generarFacturaPDF() {
  if (!_currentVenta) return;

  var btn = document.getElementById("btn-descargar-factura");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generando...';

  try {
    var empResp = await EmpresaAPI.get();
    var empresa = empResp.data || {};

    var pedResp = await PedidosAPI.getById(_currentVenta.pedido_id);
    var pedido = pedResp.data || {};
    var detalle = pedido.detalle || [];

    // Cargar logo como base64
    var logoBase64 = null;
    try {
      var logoResp = await fetch("../dist/img/logoempresa.png");
      if (logoResp.ok) {
        var logoBlob = await logoResp.blob();
        logoBase64 = await new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onloadend = function () {
            resolve(reader.result);
          };
          reader.readAsDataURL(logoBlob);
        });
      }
    } catch (_) {
      /* logo opcional, continúa sin él */
    }

    var metodosLabel = {
      efectivo: "Efectivo",
      tarjeta: "Tarjeta",
      transferencia: "Transferencia",
    };
    var fechaVenta = new Date().toLocaleDateString("es-EC");
    var total = parseFloat(_currentVenta.total || 0).toFixed(2);

    var productoRows = detalle.map(function (item) {
      return [
        { text: String(item.producto_id || ""), fontSize: 9 },
        { text: String(item.cantidad), fontSize: 9, alignment: "center" },
        { text: item.producto_nombre || "—", fontSize: 9 },
        {
          text: "$" + parseFloat(item.precio || 0).toFixed(2),
          fontSize: 9,
          alignment: "right",
        },
        { text: "$0.00", fontSize: 9, alignment: "right" },
        {
          text: "$" + parseFloat(item.subtotal || 0).toFixed(2),
          fontSize: 9,
          alignment: "right",
        },
      ];
    });

    var docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 60],
      content: [
        // ── Encabezado: logo izquierda | datos empresa + factura derecha ─
        {
          columns: [
            // Izquierda: solo logo
            logoBase64
              ? { image: logoBase64, width: 150, margin: [0, -20, 0, 0] }
              : { text: "", width: 10 },
            // Derecha: nombre, RUC, dirección, tel, correo, FACTURA, No.
            {
              width: "*",
              alignment: "right",
              margin: [16, 0, 0, 0],
              stack: [
                {
                  text: empresa.nombre || "Mi Empresa",
                  fontSize: 16,
                  bold: true,
                  color: "#222",
                },
                empresa.ruc
                  ? { text: "RUC: " + empresa.ruc, fontSize: 9, color: "#555" }
                  : {},
                empresa.direccion
                  ? { text: empresa.direccion, fontSize: 9, color: "#555" }
                  : {},
                empresa.telefono
                  ? {
                      text: "Tel: " + empresa.telefono,
                      fontSize: 9,
                      color: "#555",
                    }
                  : {},
                empresa.correo
                  ? { text: empresa.correo, fontSize: 9, color: "#555" }
                  : {},
                {
                  text: "FACTURA",
                  fontSize: 22,
                  bold: true,
                  color: "#1a56db",
                  margin: [0, 6, 0, 0],
                },
                {
                  text: "No. " + (_currentVenta.numero_factura || ""),
                  fontSize: 11,
                  bold: true,
                },
              ],
            },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 1,
              lineColor: "#dee2e6",
            },
          ],
          margin: [0, 0, 0, 8],
        },
        // ── Datos del cliente ────────────────────────────────────────────
        {
          table: {
            widths: ["*", "*", "*"],
            body: [
              [
                {
                  text: [
                    { text: "Razón Social: ", bold: true },
                    _currentVenta.cliente_nombre || "Consumidor Final",
                  ],
                  fontSize: 9,
                },
                {
                  text: [
                    { text: "RUC / CI: ", bold: true },
                    _currentVenta.cliente_ci_nit || "—",
                  ],
                  fontSize: 9,
                },
                {
                  text: [
                    { text: "Condición de Pago: ", bold: true },
                    metodosLabel[_currentVenta.metodo_pago] ||
                      _currentVenta.metodo_pago ||
                      "—",
                  ],
                  fontSize: 9,
                },
              ],
              [
                {
                  text: [
                    { text: "Teléfono: ", bold: true },
                    _currentVenta.cliente_telefono || "—",
                  ],
                  fontSize: 9,
                },
                {
                  text: [{ text: "Fecha: ", bold: true }, fechaVenta],
                  fontSize: 9,
                },
                {
                  text: [
                    { text: "Email: ", bold: true },
                    _currentVenta.cliente_email || "—",
                  ],
                  fontSize: 9,
                },
              ],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10],
        },
        // ── Tabla de productos ───────────────────────────────────────────
        {
          table: {
            headerRows: 1,
            widths: [45, 30, "*", 65, 60, 65],
            body: [
              [
                {
                  text: "Cód.",
                  bold: true,
                  fontSize: 9,
                  fillColor: "#f1f3f5",
                },
                {
                  text: "Cant.",
                  bold: true,
                  fontSize: 9,
                  fillColor: "#f1f3f5",
                  alignment: "center",
                },
                {
                  text: "Descripción",
                  bold: true,
                  fontSize: 9,
                  fillColor: "#f1f3f5",
                },
                {
                  text: "P. Unitario",
                  bold: true,
                  fontSize: 9,
                  fillColor: "#f1f3f5",
                  alignment: "right",
                },
                {
                  text: "Descuento",
                  bold: true,
                  fontSize: 9,
                  fillColor: "#f1f3f5",
                  alignment: "right",
                },
                {
                  text: "P. Total",
                  bold: true,
                  fontSize: 9,
                  fillColor: "#f1f3f5",
                  alignment: "right",
                },
              ],
            ].concat(
              productoRows.length
                ? productoRows
                : [
                    [
                      {
                        text: "Sin productos",
                        colSpan: 6,
                        alignment: "center",
                        fontSize: 9,
                        color: "#999",
                      },
                      {},
                      {},
                      {},
                      {},
                      {},
                    ],
                  ],
            ),
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 10],
        },
        // ── Totales ──────────────────────────────────────────────────────
        {
          columns: [
            { width: "*", text: "" },
            {
              width: 210,
              table: {
                widths: ["*", 80],
                body: [
                  [
                    { text: "Subtotal sin impuestos", fontSize: 9, bold: true },
                    {
                      text: "$" + total,
                      fontSize: 9,
                      alignment: "right",
                    },
                  ],
                  [
                    {
                      text: "Subtotal Exento IVA",
                      fontSize: 9,
                      bold: true,
                    },
                    { text: "$0.00", fontSize: 9, alignment: "right" },
                  ],
                  [
                    { text: "Descuento 0%", fontSize: 9, bold: true },
                    { text: "$0.00", fontSize: 9, alignment: "right" },
                  ],
                  [
                    { text: "ICE", fontSize: 9, bold: true },
                    { text: "$0.00", fontSize: 9, alignment: "right" },
                  ],
                  [
                    { text: "IVA 0.00%", fontSize: 9, bold: true },
                    { text: "$0.00", fontSize: 9, alignment: "right" },
                  ],
                  [
                    {
                      text: "VALOR TOTAL",
                      fontSize: 10,
                      bold: true,
                    },
                    {
                      text: "$" + total,
                      fontSize: 10,
                      bold: true,
                      color: "#1a56db",
                      alignment: "right",
                    },
                  ],
                ],
              },
              layout: "lightHorizontalLines",
            },
          ],
          margin: [0, 0, 0, 16],
        },
        // ── Pie de página ────────────────────────────────────────────────
        {
          text: "TÉRMINOS Y CONDICIONES",
          fontSize: 9,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 3],
        },
        {
          text: "El proveedor declara que los bienes o servicios entregados cumplen con las especificaciones acordadas. Este documento es válido como comprobante de pago.",
          fontSize: 8,
          color: "#6c757d",
          alignment: "center",
        },
        {
          text: "Copyright@ SolucionesITEC",
          fontSize: 8,
          color: "#6c757d",
          alignment: "center",
          margin: [0, 4, 0, 0],
        },
      ],
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
      },
    };

    pdfMake.createPdf(docDefinition).open();
  } catch (err) {
    console.error("[generarFacturaPDF]", err);
    showAlert("danger", "Error al generar el PDF de la factura.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf mr-1"></i> Descargar Factura';
  }
}
