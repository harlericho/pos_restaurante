// utils/pedidos.js

var _pedidos = [];
var _productos = [];
var _filtroEstado = null;
var _pedidoActivo = null; // objeto con id + estado del pedido en el modal
var _vistaActual = "mapa"; // 'mapa' | 'lista'
var _currentVenta = null; // venta registrada, usada para PDF/ticket/email

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

  // ── Form cobrar pedido (registra venta) ──────────────────────────────
  el("form-cobrar-pedido").addEventListener("submit", function (e) {
    e.preventDefault();
    registrarVentaPedido();
  });

  // ── Cliente search en modal cobrar ────────────────────────────────────
  var _cobrarTimer = null;
  el("cobrar-cliente-buscar").addEventListener("input", function () {
    clearTimeout(_cobrarTimer);
    var q = this.value.trim();
    var lista = el("cobrar-cliente-resultados");
    if (q.length < 2) {
      lista.style.display = "none";
      return;
    }
    _cobrarTimer = setTimeout(function () {
      buscarClienteCobrar(q);
    }, 300);
  });

  el("btn-limpiar-cliente-cobrar").addEventListener("click", function () {
    limpiarClienteCobrar();
  });

  // Cerrar dropdown al hacer click fuera
  document.addEventListener("click", function (e) {
    var lista = el("cobrar-cliente-resultados");
    if (lista && !lista.contains(e.target) && e.target.id !== "cobrar-cliente-buscar") {
      lista.style.display = "none";
    }
  });

  // ── Comprobante de venta ──────────────────────────────────────────────
  el("btn-descargar-factura").addEventListener("click", function () {
    generarFacturaPDF();
  });
  el("btn-imprimir-ticket").addEventListener("click", function () {
    imprimirTicket(_currentVenta);
  });
  el("btn-enviar-email-factura").addEventListener("click", function () {
    abrirModalEmail(_currentVenta);
  });
  el("btn-confirmar-envio-email").addEventListener("click", function () {
    _enviarDesdeModal();
  });

  // ── Confirmar quitar ítem ─────────────────────────────────────────────
  // (listener dinámico, se reconfigura en confirmarQuitarItem)

  // ── Carga inicial ─────────────────────────────────────────────────────
  loadProductos();
  setVista("mapa");
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
  // Siempre consultamos la API para tener el conteo real,
  // independientemente de la vista activa o del filtro aplicado.
  try {
    var all = await PedidosAPI.getAll(null);
    var source = Array.isArray(all.data) ? all.data : [];
    var abiertos = source.filter(function (p) { return p.estado === "abierto"; }).length;
    var cerrados = source.filter(function (p) { return p.estado === "cerrado"; }).length;
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

    _pedidoActivo = { id: p.id, estado: p.estado, detalle: p.detalle || [] };

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
  var $select = $("#item-producto");

  // Destruir instancia previa si existe
  if ($select.hasClass("select2-hidden-accessible")) {
    $select.select2("destroy");
  }

  $select.html(
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
      .join("")
  );

  $select.select2({
    theme: "bootstrap4",
    placeholder: "— Buscar producto —",
    allowClear: true,
    width: "100%",
    language: {
      noResults: function () { return "No se encontraron productos"; },
      searching: function () { return "Buscando…"; },
    },
    dropdownParent: $("#modal-ver-pedido"),
  });

  document.getElementById("item-cantidad").value = "1";
}

// ═══════════════════════════════════════════════════════════════════════
// Agregar ítem al pedido activo
// ═══════════════════════════════════════════════════════════════════════
async function agregarItem() {
  if (!_pedidoActivo) return;

  var productoId = parseInt(document.getElementById("item-producto").value, 10);
  var cantidad = parseInt(document.getElementById("item-cantidad").value, 10);

  if (!productoId) {
    showAlert("warning", "Seleccione un producto.");
    return;
  }
  if (!cantidad || cantidad < 1) {
    showAlert("warning", "La cantidad debe ser al menos 1.");
    return;
  }

  // Si el producto ya está en el pedido, sumar cantidades
  var itemExistente = (_pedidoActivo.detalle || []).find(function (d) {
    return parseInt(d.producto_id) === productoId;
  });

  try {
    if (itemExistente) {
      await PedidosAPI.removeDetalle(_pedidoActivo.id, itemExistente.id);
      await PedidosAPI.addDetalle(_pedidoActivo.id, {
        producto_id: productoId,
        cantidad: parseInt(itemExistente.cantidad) + cantidad,
      });
    } else {
      await PedidosAPI.addDetalle(_pedidoActivo.id, {
        producto_id: productoId,
        cantidad: cantidad,
      });
    }
    // Refrescar el modal con los datos actualizados
    await verPedido(_pedidoActivo.id);
    // Recargar vista en segundo plano para actualizar totales
    if (_vistaActual === "mapa") loadMesasMapa(); else loadPedidos();
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
    if (_vistaActual === "mapa") loadMesasMapa(); else loadPedidos();
  } catch (err) {
    console.error("[quitarItem]", err);
    var msg =
      (err.data && err.data.error) || err.message || "Error al quitar el ítem.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Cobrar pedido (registra venta)
// ═══════════════════════════════════════════════════════════════════════
function confirmarCerrarPedido() {
  if (!_pedidoActivo) return;

  // Poblar resumen
  document.getElementById("cobrar-resumen-mesa").textContent =
    document.getElementById("ver-mesa").textContent;
  document.getElementById("cobrar-resumen-mesero").textContent =
    "Atendido por: " + document.getElementById("ver-mesero").textContent;
  document.getElementById("cobrar-resumen-total").textContent =
    document.getElementById("ver-total").textContent;

  // Reset form
  var radioEfectivo = document.getElementById("cobrar-efectivo");
  if (radioEfectivo) radioEfectivo.checked = true;
  limpiarClienteCobrar();

  $("#modal-cobrar-pedido").modal("show");
}

async function registrarVentaPedido() {
  if (!_pedidoActivo) return;

  var metodoPago = document.querySelector(
    'input[name="cobrar_metodo_pago"]:checked'
  );
  if (!metodoPago) {
    showAlert("warning", "Seleccione un método de pago.");
    return;
  }

  var clienteIdVal = document.getElementById("cobrar-cliente-id").value;
  var clienteId = clienteIdVal ? parseInt(clienteIdVal, 10) : null;

  var btnCobrar = document.getElementById("btn-confirmar-cobro");
  btnCobrar.disabled = true;

  try {
    var ventaData = {
      pedido_id: _pedidoActivo.id,
      metodo_pago: metodoPago.value,
    };
    if (clienteId) ventaData.cliente_id = clienteId;

    var resp = await VentasAPI.create(ventaData);
    var venta = (resp && resp.data) ? resp.data : {};

    _currentVenta = venta;
    $("#modal-cobrar-pedido").modal("hide");
    $("#modal-ver-pedido").modal("hide");
    _pedidoActivo = null;

    // Poblar comprobante
    var metodosLabel = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
    document.getElementById("comp-numero-factura").textContent = venta.numero_factura || "S/N";
    document.getElementById("comp-venta-id").textContent = "#" + (venta.id || "");
    document.getElementById("comp-total").textContent = "$" + parseFloat(venta.total || 0).toFixed(2);
    document.getElementById("comp-metodo").textContent = metodosLabel[venta.metodo_pago] || venta.metodo_pago || "—";

    // Botón email: visible solo si el cliente tiene email
    var emailBtn = document.getElementById("btn-enviar-email-factura");
    emailBtn.disabled = false;
    emailBtn.className = "btn btn-info px-4 mr-2";
    emailBtn.innerHTML = '<i class="fas fa-envelope mr-1"></i> Enviar por Email';
    if (venta.cliente_email) {
      emailBtn.classList.remove("d-none");
    } else {
      emailBtn.classList.add("d-none");
    }

    // Resetear botones de descarga/impresión
    var btnPdf = document.getElementById("btn-descargar-factura");
    btnPdf.disabled = false;
    btnPdf.innerHTML = '<i class="fas fa-file-pdf mr-1"></i> Descargar Factura';
    var btnTicket = document.getElementById("btn-imprimir-ticket");
    btnTicket.disabled = false;
    btnTicket.className = "btn btn-warning px-4 mr-2";
    btnTicket.innerHTML = '<i class="fas fa-print mr-1"></i> Imprimir Ticket';

    $("#modal-comprobante").modal("show");

    // Auto-imprimir si el checkbox está marcado
    var chk = document.getElementById("chk-imprimir-ticket");
    if (chk && chk.checked) {
      imprimirTicket(venta);
    }

    if (_vistaActual === "mapa") loadMesasMapa(); else loadPedidos();
    updateStats();
  } catch (err) {
    console.error("[registrarVentaPedido]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al registrar la venta.";
    showAlert("danger", msg);
  } finally {
    btnCobrar.disabled = false;
  }
}

// ── Búsqueda de cliente en modal cobrar ──────────────────────────────────
async function buscarClienteCobrar(q) {
  var lista = document.getElementById("cobrar-cliente-resultados");
  try {
    var resp = await ClientesAPI.search(q);
    var clientes = Array.isArray(resp.data) ? resp.data : [];

    if (clientes.length === 0) {
      lista.innerHTML =
        '<div class="list-group-item py-1 px-2 text-muted small">Sin resultados</div>';
      lista.style.display = "";
      return;
    }

    lista.innerHTML = clientes
      .slice(0, 6)
      .map(function (c) {
        return (
          "<button type='button' class='list-group-item list-group-item-action py-1 px-2'" +
          " data-id='" + c.id + "' data-nombre='" + escapeHtml(c.nombre) + "'>" +
          "<i class='fas fa-user fa-xs mr-1 text-muted'></i>" +
          escapeHtml(c.nombre) +
          (c.ci_nit
            ? " <small class='text-muted'>CI: " + escapeHtml(c.ci_nit) + "</small>"
            : "") +
          "</button>"
        );
      })
      .join("");

    lista.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        seleccionarClienteCobrar(
          parseInt(this.dataset.id, 10),
          this.dataset.nombre
        );
      });
    });

    lista.style.display = "";
  } catch (_) {
    lista.style.display = "none";
  }
}

function seleccionarClienteCobrar(id, nombre) {
  document.getElementById("cobrar-cliente-id").value = id;
  document.getElementById("cobrar-cliente-buscar").value = nombre;
  document.getElementById("cobrar-cliente-nombre").textContent = nombre;
  document.getElementById("cobrar-cliente-seleccionado").classList.remove("d-none");
  document.getElementById("cobrar-cliente-resultados").style.display = "none";
}

function limpiarClienteCobrar() {
  document.getElementById("cobrar-cliente-id").value = "";
  document.getElementById("cobrar-cliente-buscar").value = "";
  document.getElementById("cobrar-cliente-seleccionado").classList.add("d-none");
  document.getElementById("cobrar-cliente-resultados").style.display = "none";
}

// ═══════════════════════════════════════════════════════════════════════
// Vista toggle: Mapa / Lista
// ═══════════════════════════════════════════════════════════════════════
function setVista(vista) {
  _vistaActual = vista;

  var elMapa  = document.getElementById("vista-mapa");
  var elLista = document.getElementById("vista-lista");
  var btnMapa = document.getElementById("btn-vista-mapa");
  var btnLista = document.getElementById("btn-vista-lista");

  if (vista === "mapa") {
    elMapa.style.display  = "";
    elLista.style.display = "none";
    btnMapa.classList.add("active");
    btnLista.classList.remove("active");
    loadMesasMapa();
  } else {
    elMapa.style.display  = "none";
    elLista.style.display = "";
    btnMapa.classList.remove("active");
    btnLista.classList.add("active");
    loadPedidos();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Mapa de Mesas
// ═══════════════════════════════════════════════════════════════════════
async function loadMesasMapa() {
  var grid = document.getElementById("grid-mesas");
  grid.innerHTML =
    '<div class="col-12 text-center py-4">' +
    '<i class="fas fa-spinner fa-spin mr-2"></i>Cargando mesas…</div>';

  try {
    var results = await Promise.all([
      MesasAPI.getAll(),
      PedidosAPI.getAll("abierto"),
    ]);
    var mesas          = Array.isArray(results[0].data) ? results[0].data : [];
    var pedidosAbiertos = Array.isArray(results[1].data) ? results[1].data : [];

    // Actualizar stats con todos los pedidos en segundo plano
    updateStats();

    if (mesas.length === 0) {
      grid.innerHTML =
        '<div class="col-12 mapa-empty">' +
        '<i class="fas fa-chair fa-3x"></i>' +
        "<p>No hay mesas configuradas.<br>" +
        '<small>Ve a <a href="mesas.html">Mesas</a> para agregarlas.</small></p>' +
        "</div>";
      return;
    }

    // Indexar pedidos abiertos por mesa_id y por mesa_numero (fallback)
    var pedidoPorId  = {};
    var pedidoPorNum = {};
    pedidosAbiertos.forEach(function (p) {
      if (p.mesa_id)     pedidoPorId[p.mesa_id]       = p;
      if (p.mesa_numero) pedidoPorNum[p.mesa_numero]  = p;
    });

    grid.innerHTML = mesas
      .map(function (mesa) {
        var pedido = pedidoPorId[mesa.id] || pedidoPorNum[mesa.numero];
        var libre  = !pedido;
        var estadoClass = libre ? "libre" : "ocupada";

        var estadoBadge = libre
          ? '<span class="badge badge-success mt-1">Libre</span>'
          : '<span class="badge badge-danger mt-1">Ocupada</span>';

        var infoExtra = "";
        if (!libre) {
          infoExtra +=
            '<div class="mesa-total">$' +
            parseFloat(pedido.total || 0).toFixed(2) +
            "</div>";
          if (pedido.usuario_nombre) {
            infoExtra +=
              '<div class="mesa-mesero">' +
              '<i class="fas fa-user fa-xs mr-1"></i>' +
              escapeHtml(pedido.usuario_nombre) +
              "</div>";
          }
        }

        var onclickAttr = libre
          ? "clickMesaLibre(" +
            mesa.id +
            "," +
            escapeHtml(String(mesa.numero)) +
            ")"
          : "clickMesaOcupada(" + pedido.id + ")";

        var capInfo = mesa.capacidad
          ? '<div class="mesa-cap">' +
            '<i class="fas fa-users fa-xs mr-1"></i>' +
            mesa.capacidad +
            " pers.</div>"
          : "";

        return (
          '<div class="col-6 col-sm-4 col-md-3 col-xl-2 mb-3">' +
          '<div class="mesa-card ' +
          estadoClass +
          '" onclick="' +
          onclickAttr +
          '" title="' +
          (libre ? "Click para crear pedido" : "Click para ver pedido") +
          '">' +
          '<img src="../dist/img/mesaLogo.png" class="mesa-img" alt="Mesa ' +
          escapeHtml(String(mesa.numero)) +
          '" />' +
          '<div class="mesa-numero">Mesa ' +
          escapeHtml(String(mesa.numero)) +
          "</div>" +
          capInfo +
          estadoBadge +
          infoExtra +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  } catch (err) {
    console.error("[loadMesasMapa]", err);
    grid.innerHTML =
      '<div class="col-12 mapa-empty text-danger">' +
      '<i class="fas fa-exclamation-triangle fa-2x"></i>' +
      "<p>Error al cargar el mapa de mesas.</p></div>";
  }
}

// Clic en mesa LIBRE → confirmación rápida y crea pedido
async function clickMesaLibre(mesaId, mesaNumero) {
  if (typeof Swal === "undefined") {
    // fallback si SweetAlert aún no cargó
    openNuevoPedidoModal();
    return;
  }

  var result = await Swal.fire({
    title: "Mesa " + mesaNumero,
    text: "¿Crear un nuevo pedido para esta mesa?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: '<i class="fas fa-check mr-1"></i> Crear pedido',
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#007bff",
    cancelButtonColor: "#6c757d",
  });

  if (!result.isConfirmed) return;

  try {
    await PedidosAPI.create({ mesa_id: parseInt(mesaId, 10) });
    showAlert("success", "Pedido creado para Mesa " + mesaNumero + ".");
    loadMesasMapa();
    updateStats();
  } catch (err) {
    console.error("[clickMesaLibre]", err);
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al crear el pedido.";
    showAlert("danger", msg);
  }
}

// Clic en mesa OCUPADA → abre detalle del pedido
function clickMesaOcupada(pedidoId) {
  verPedido(pedidoId);
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
  if (!msg) return; // Si no hay mensaje, no hagas nada

  var container = document.getElementById("alert-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "alert-container";
    // Posición fija para que no mueva el contenido de tu página
    container.style.cssText =
      "position: fixed; top: 20px; right: 20px; z-index: 10000; min-width: 300px;";
    document.body.appendChild(container);
  }

  var alertDiv = document.createElement("div");
  // Añadimos 'shadow' para que se vea profesional
  alertDiv.className =
    "alert alert-" + type + " alert-dismissible fade show shadow border-0";
  alertDiv.style.marginBottom = "10px";
  alertDiv.innerHTML =
    msg +
    '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
    '<span aria-hidden="true">&times;</span></button>';

  container.appendChild(alertDiv);

  // Auto-eliminar después de 4 segundos
  setTimeout(function () {
    $(alertDiv).alert("close");
  }, 4000);
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
// Comprobante: PDF, Ticket e Email  (portado desde ventas.js)
// ═══════════════════════════════════════════════════════════════════════

async function _buildPdfDoc() {
  if (!_currentVenta) return null;

  var empResp = await EmpresaAPI.get();
  var empresa = empResp.data || {};

  var pedResp = await PedidosAPI.getById(_currentVenta.pedido_id);
  var pedido = pedResp.data || {};
  var detalle = pedido.detalle || [];

  var logoBase64 = null;
  try {
    var logoResp = await fetch("../dist/img/logoempresa.png");
    if (logoResp.ok) {
      var logoBlob = await logoResp.blob();
      logoBase64 = await new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onloadend = function () { resolve(reader.result); };
        reader.readAsDataURL(logoBlob);
      });
    }
  } catch (_) { /* logo opcional */ }

  var metodosLabel = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
  var fechaVenta = new Date().toLocaleDateString("es-EC");
  var total = parseFloat(_currentVenta.total || 0).toFixed(2);

  var productoRows = detalle.map(function (item) {
    return [
      { text: item.producto_codigo ? String(item.producto_codigo) : "—", fontSize: 9 },
      { text: String(item.cantidad), fontSize: 9, alignment: "center" },
      { text: item.producto_nombre || "—", fontSize: 9 },
      { text: "$" + parseFloat(item.precio || 0).toFixed(2), fontSize: 9, alignment: "right" },
      { text: "$0.00", fontSize: 9, alignment: "right" },
      { text: "$" + parseFloat(item.subtotal || 0).toFixed(2), fontSize: 9, alignment: "right" },
    ];
  });

  var docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 60],
    content: [
      {
        columns: [
          logoBase64
            ? { image: logoBase64, width: 150, margin: [0, -20, 0, 0] }
            : { text: "", width: 10 },
          {
            width: "*", alignment: "right", margin: [16, 0, 0, 0],
            stack: [
              { text: empresa.nombre || "Mi Empresa", fontSize: 16, bold: true, color: "#222" },
              empresa.ruc       ? { text: "RUC: " + empresa.ruc, fontSize: 9, color: "#555" } : {},
              empresa.direccion ? { text: empresa.direccion, fontSize: 9, color: "#555" } : {},
              empresa.telefono  ? { text: "Tel: " + empresa.telefono, fontSize: 9, color: "#555" } : {},
              empresa.correo    ? { text: empresa.correo, fontSize: 9, color: "#555" } : {},
              { text: "FACTURA", fontSize: 22, bold: true, color: "#1a56db", margin: [0, 6, 0, 0] },
              { text: "No. " + (_currentVenta.numero_factura || ""), fontSize: 11, bold: true },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#dee2e6" }],
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: [{ text: "Razón Social: ", bold: true }, _currentVenta.cliente_nombre || "Consumidor Final"], fontSize: 9 },
              { text: [{ text: "RUC / CI: ", bold: true }, _currentVenta.cliente_ci_nit || "—"], fontSize: 9 },
              { text: [{ text: "Condición de Pago: ", bold: true }, metodosLabel[_currentVenta.metodo_pago] || _currentVenta.metodo_pago || "—"], fontSize: 9 },
            ],
            [
              { text: [{ text: "Teléfono: ", bold: true }, _currentVenta.cliente_telefono || "—"], fontSize: 9 },
              { text: [{ text: "Fecha: ", bold: true }, fechaVenta], fontSize: 9 },
              { text: [{ text: "Email: ", bold: true }, _currentVenta.cliente_email || "—"], fontSize: 9 },
            ],
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          headerRows: 1,
          widths: [45, 30, "*", 65, 60, 65],
          body: [
            [
              { text: "Cód.",        bold: true, fontSize: 9, fillColor: "#f1f3f5" },
              { text: "Cant.",       bold: true, fontSize: 9, fillColor: "#f1f3f5", alignment: "center" },
              { text: "Descripción", bold: true, fontSize: 9, fillColor: "#f1f3f5" },
              { text: "P. Unitario", bold: true, fontSize: 9, fillColor: "#f1f3f5", alignment: "right" },
              { text: "Descuento",   bold: true, fontSize: 9, fillColor: "#f1f3f5", alignment: "right" },
              { text: "P. Total",    bold: true, fontSize: 9, fillColor: "#f1f3f5", alignment: "right" },
            ],
          ].concat(
            productoRows.length
              ? productoRows
              : [[{ text: "Sin productos", colSpan: 6, alignment: "center", fontSize: 9, color: "#999" }, {}, {}, {}, {}, {}]]
          ),
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 210,
            table: {
              widths: ["*", 80],
              body: (function () {
                var ivaPct   = parseFloat(_currentVenta.iva_porcentaje || 0);
                var ivaValor = parseFloat(_currentVenta.iva_valor || 0).toFixed(2);
                var subBase  = parseFloat(_currentVenta.subtotal_base || _currentVenta.total || 0).toFixed(2);
                return [
                  [{ text: "Subtotal sin impuestos", fontSize: 9, bold: true }, { text: "$" + subBase, fontSize: 9, alignment: "right" }],
                  [{ text: "Subtotal Exento IVA",    fontSize: 9, bold: true }, { text: ivaPct > 0 ? "$0.00" : "$" + subBase, fontSize: 9, alignment: "right" }],
                  [{ text: "Descuento 0%",           fontSize: 9, bold: true }, { text: "$0.00", fontSize: 9, alignment: "right" }],
                  [{ text: "ICE",                    fontSize: 9, bold: true }, { text: "$0.00", fontSize: 9, alignment: "right" }],
                  [{ text: "IVA " + ivaPct.toFixed(2) + "%", fontSize: 9, bold: true }, { text: "$" + ivaValor, fontSize: 9, alignment: "right" }],
                  [{ text: "VALOR TOTAL", fontSize: 10, bold: true }, { text: "$" + total, fontSize: 10, bold: true, color: "#1a56db", alignment: "right" }],
                ];
              })(),
            },
            layout: "lightHorizontalLines",
          },
        ],
        margin: [0, 0, 0, 16],
      },
      { text: "TÉRMINOS Y CONDICIONES", fontSize: 9, bold: true, alignment: "center", margin: [0, 0, 0, 3] },
      { text: "El proveedor declara que los bienes o servicios entregados cumplen con las especificaciones acordadas. Este documento es válido como comprobante de pago.", fontSize: 8, color: "#6c757d", alignment: "center" },
      { text: "Copyright@ SolucionesITEC", fontSize: 8, color: "#6c757d", alignment: "center", margin: [0, 4, 0, 0] },
    ],
    defaultStyle: { font: "Roboto", fontSize: 10 },
  };

  return pdfMake.createPdf(docDefinition);
}

// ── Descargar PDF ────────────────────────────────────────────────────────
async function generarFacturaPDF() {
  if (!_currentVenta) return;
  var btn = document.getElementById("btn-descargar-factura");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Generando...';
  try {
    var doc = await _buildPdfDoc();
    if (doc) doc.open();
  } catch (err) {
    console.error("[generarFacturaPDF]", err);
    showAlert("danger", "Error al generar el PDF de la factura.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf mr-1"></i> Descargar Factura';
  }
}

// ── Abrir modal email ────────────────────────────────────────────────────
function abrirModalEmail(ventaData) {
  if (!ventaData) return;
  document.getElementById("email-modal-factura").textContent = ventaData.numero_factura || "S/N";
  var inputEmail = document.getElementById("email-modal-input");
  inputEmail.value = ventaData.cliente_email || "";
  inputEmail.classList.remove("is-invalid");
  var btnConf = document.getElementById("btn-confirmar-envio-email");
  btnConf.disabled = false;
  btnConf.className = "btn btn-info px-4";
  btnConf.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Enviar';
  $("#modal-enviar-email").modal("show");
}

async function _enviarDesdeModal() {
  if (!_currentVenta) return;
  var inputEmail = document.getElementById("email-modal-input");
  var email = inputEmail.value.trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    inputEmail.classList.add("is-invalid");
    inputEmail.focus();
    return;
  }
  inputEmail.classList.remove("is-invalid");

  var btnConf = document.getElementById("btn-confirmar-envio-email");
  btnConf.disabled = true;
  btnConf.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Enviando...';

  try {
    var doc = await _buildPdfDoc();
    if (!doc) throw new Error("No se pudo generar el PDF.");
    var b64 = await new Promise(function (resolve) {
      doc.getBase64(function (data) { resolve(data); });
    });
    await VentasAPI.sendEmail(_currentVenta.id, {
      email: email,
      nombre: _currentVenta.cliente_nombre || "Cliente",
      pdf_base64: b64,
    });
    btnConf.className = "btn btn-success px-4";
    btnConf.innerHTML = '<i class="fas fa-check mr-1"></i> ¡Enviado!';
    var btnComp = document.getElementById("btn-enviar-email-factura");
    if (btnComp && !btnComp.classList.contains("d-none")) {
      btnComp.disabled = true;
      btnComp.className = "btn btn-success px-4 mr-2";
      btnComp.innerHTML = '<i class="fas fa-check mr-1"></i> ¡Enviado!';
    }
    setTimeout(function () { $("#modal-enviar-email").modal("hide"); }, 1500);
  } catch (err) {
    console.error("[_enviarDesdeModal]", err);
    var msg = (err.data && err.data.error) || err.message || "Error al enviar el correo.";
    showAlert("danger", msg);
    btnConf.disabled = false;
    btnConf.className = "btn btn-info px-4";
    btnConf.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Enviar';
  }
}

// ── QZ Tray: conectar ────────────────────────────────────────────────────
async function _qzConectar() {
  if (typeof qz === "undefined") return false;
  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 1, delay: 0.5 });
    }
    return true;
  } catch (_) { return false; }
}

// ── Imprimir ticket térmico ──────────────────────────────────────────────
async function imprimirTicket(venta) {
  if (!venta) return;
  var btn = document.getElementById("btn-imprimir-ticket");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Imprimiendo...';
  }

  try {
    var conectado = await _qzConectar();
    if (!conectado) {
      showAlert("warning",
        'QZ Tray no está activo. Instale y ejecute QZ Tray para imprimir tickets. ' +
        '<a href="https://qz.io/download/" target="_blank" rel="noopener">Descargar QZ Tray</a>');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-print mr-1"></i> Imprimir Ticket'; }
      return;
    }

    var printerName = localStorage.getItem("thermal_printer_name") || null;
    if (!printerName) {
      var printers = await qz.printers.find();
      printerName = printers[0] || null;
    }
    if (!printerName) {
      showAlert("warning",
        'No hay impresora configurada. Configure una en ' +
        '<a href="configuracion.html">Configuración → Impresora Térmica</a>.');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-print mr-1"></i> Imprimir Ticket'; }
      return;
    }
    var config = qz.configs.create(printerName);

    var empresa = {};
    try { var empResp = await EmpresaAPI.get(); empresa = empResp.data || {}; } catch (_) {}

    var detalle = [];
    try {
      var pedResp = await PedidosAPI.getById(venta.pedido_id);
      detalle = (pedResp.data || {}).detalle || [];
    } catch (_) {}

    // Comandos ESC/POS
    var ESC = "\x1B", GS = "\x1D";
    var INIT = ESC + "@", CODEPAGE = ESC + "t\x02";
    var BOLD_ON = ESC + "E\x01", BOLD_OFF = ESC + "E\x00";
    var CENTER = ESC + "a\x01", LEFT = ESC + "a\x00";
    var CUT = GS + "V\x41\x00", LF = "\n";

    function ascii(str) {
      return String(str || "")
        .replace(/[\u00e1\u00e0\u00e2\u00e4]/g, "a").replace(/[\u00e9\u00e8\u00ea\u00eb]/g, "e")
        .replace(/[\u00ed\u00ec\u00ee\u00ef]/g, "i").replace(/[\u00f3\u00f2\u00f4\u00f6]/g, "o")
        .replace(/[\u00fa\u00f9\u00fb\u00fc]/g, "u").replace(/[\u00c1\u00c0\u00c2\u00c4]/g, "A")
        .replace(/[\u00c9\u00c8\u00ca\u00cb]/g, "E").replace(/[\u00cd\u00cc\u00ce\u00cf]/g, "I")
        .replace(/[\u00d3\u00d2\u00d4\u00d6]/g, "O").replace(/[\u00da\u00d9\u00db\u00dc]/g, "U")
        .replace(/\u00f1/g, "n").replace(/\u00d1/g, "N")
        .replace(/[\u00a1\u00bf]/g, "").replace(/[^\x00-\xFF]/g, "?");
    }
    var W = 42;
    function line(c) { return c.repeat(W) + LF; }
    function pad(l, r, w) {
      w = w || W;
      var sp = w - l.length - r.length;
      return l + (sp > 0 ? " ".repeat(sp) : " ") + r + LF;
    }

    var _ahora = new Date();
    var fecha =
      String(_ahora.getDate()).padStart(2, "0") + "/" +
      String(_ahora.getMonth() + 1).padStart(2, "0") + "/" +
      _ahora.getFullYear() + " " +
      String(_ahora.getHours()).padStart(2, "0") + ":" +
      String(_ahora.getMinutes()).padStart(2, "0");

    var totalStr = parseFloat(venta.total || 0).toFixed(2);
    var ivaPct   = parseFloat(venta.iva_porcentaje || 0);
    var ivaValor = parseFloat(venta.iva_valor || 0).toFixed(2);
    var subBase  = parseFloat(venta.subtotal_base || venta.total || 0).toFixed(2);
    var metodos  = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
    var metodo   = metodos[venta.metodo_pago] || venta.metodo_pago || "-";
    var cliente  = ascii(venta.cliente_nombre || "Consumidor Final");
    var factura  = venta.numero_factura || "S/N";

    var data = [INIT, CODEPAGE, CENTER, BOLD_ON, ascii(empresa.nombre || "MI RESTAURANTE") + LF, BOLD_OFF];
    if (empresa.ruc)       data.push("RUC: " + empresa.ruc + LF);
    if (empresa.direccion) data.push(ascii(empresa.direccion) + LF);
    if (empresa.telefono)  data.push("Tel: " + empresa.telefono + LF);

    data.push(
      LF, BOLD_ON + "TICKET DE VENTA" + BOLD_OFF + LF, LF,
      LEFT, line("-"),
      pad("Factura No.:", factura),
      pad("Fecha:", fecha),
      pad("Cajero:", ascii(venta.usuario_nombre || "-")),
      pad("Cliente:", cliente.substring(0, W - 10)),
      pad("Metodo:", metodo),
      line("-"),
      BOLD_ON, pad("DESCRIPCION", "TOTAL"), BOLD_OFF,
      line("-")
    );

    detalle.forEach(function (item) {
      var nombre   = ascii(item.producto_nombre || "-").substring(0, 20);
      var subtotal = "$" + parseFloat(item.subtotal || 0).toFixed(2);
      data.push(pad(String(item.cantidad) + "x " + nombre, subtotal));
      data.push("    $" + parseFloat(item.precio || 0).toFixed(2) + " c/u" + LF);
    });

    data.push(
      line("-"),
      pad("Subtotal:", "$" + subBase),
      pad("IVA " + ivaPct.toFixed(0) + "%:", "$" + ivaValor),
      BOLD_ON, pad("TOTAL:", "$" + totalStr), BOLD_OFF,
      line("="),
      CENTER, "Gracias por su visita!" + LF,
      LF, LF, LF, CUT
    );

    await qz.print(config, [{ type: "raw", format: "plain", data: data.join("") }]);

    if (btn) {
      btn.innerHTML = '<i class="fas fa-check mr-1"></i> Impreso';
      btn.classList.remove("btn-warning");
      btn.classList.add("btn-success");
    }
  } catch (err) {
    console.error("[imprimirTicket]", err);
    showAlert("danger", "Error al imprimir: " + (err.message || err));
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-print mr-1"></i> Imprimir Ticket'; }
  }
}
