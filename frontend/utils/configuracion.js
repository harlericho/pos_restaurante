// utils/configuracion.js

document.addEventListener("DOMContentLoaded", function () {
  if (!redirectIfNotLoggedIn()) return;

  var user = getUser();
  if (!redirectIfNotAdmin()) return;

  // ── User info ────────────────────────────────────────────────────────
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

  // ── Logout ───────────────────────────────────────────────────────────
  el("btn-logout").addEventListener("click", function (e) {
    e.preventDefault();
    logout();
  });

  // ── Preview update ───────────────────────────────────────────────────
  el("cfg-establecimiento").addEventListener("input", updatePreview);
  el("cfg-punto-emision").addEventListener("input", updatePreview);

  // ── Form submit ──────────────────────────────────────────────────────
  el("form-factura-config").addEventListener("submit", function (e) {
    e.preventDefault();
    saveConfig();
  });

  // ── Impresora térmica ─────────────────────────────────────────────────
  _initPrinterConfig();

  // ── Cargar configuración inicial ─────────────────────────────────────
  loadConfig();
});

// ═══════════════════════════════════════════════════════════════════════
// Cargar configuración
// ═══════════════════════════════════════════════════════════════════════
async function loadConfig() {
  try {
    var resp = await FacturaConfigAPI.get();
    var cfg = resp.data || {};

    document.getElementById("cfg-establecimiento").value =
      cfg.establecimiento || "001";
    document.getElementById("cfg-punto-emision").value =
      cfg.punto_emision || "001";
    document.getElementById("cfg-secuencial").value = cfg.secuencial || 0;
    document.getElementById("cfg-iva").value = parseFloat(
      cfg.iva_porcentaje ?? 0,
    ).toFixed(2);

    updatePreview();
  } catch (err) {
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al cargar la configuración.";
    showAlert("danger", msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Guardar configuración
// ═══════════════════════════════════════════════════════════════════════
async function saveConfig() {
  var estab = document.getElementById("cfg-establecimiento").value.trim();
  var punto = document.getElementById("cfg-punto-emision").value.trim();
  var valid = true;

  if (!estab || !/^\d+$/.test(estab)) {
    document.getElementById("cfg-establecimiento").classList.add("is-invalid");
    valid = false;
  } else {
    document
      .getElementById("cfg-establecimiento")
      .classList.remove("is-invalid");
  }

  if (!punto || !/^\d+$/.test(punto)) {
    document.getElementById("cfg-punto-emision").classList.add("is-invalid");
    valid = false;
  } else {
    document.getElementById("cfg-punto-emision").classList.remove("is-invalid");
  }

  if (!valid) return;

  var btn = document.getElementById("btn-guardar-config");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

  var iva = parseFloat(document.getElementById("cfg-iva").value || "0");
  if (isNaN(iva) || iva < 0 || iva > 100) iva = 0;

  try {
    await FacturaConfigAPI.update({
      establecimiento: estab,
      punto_emision: punto,
      iva_porcentaje: iva,
    });
    showAlert("success", "Configuración guardada correctamente.");
    updatePreview();
  } catch (err) {
    var msg =
      (err.data && err.data.error) ||
      err.message ||
      "Error al guardar la configuración.";
    showAlert("danger", msg);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar cambios';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Actualizar preview
// ═══════════════════════════════════════════════════════════════════════
function updatePreview() {
  var estab =
    document.getElementById("cfg-establecimiento").value.trim() || "001";
  var punto =
    document.getElementById("cfg-punto-emision").value.trim() || "001";
  var secuencial =
    parseInt(document.getElementById("cfg-secuencial").value, 10) || 0;
  var nextNum = String(secuencial + 1).padStart(9, "0");
  document.getElementById("preview-factura").textContent =
    estab + "-" + punto + "-" + nextNum;
}

// ═══════════════════════════════════════════════════════════════════════
// Alerta
// ═══════════════════════════════════════════════════════════════════════
function showAlert(type, msg) {
  var box = document.getElementById("alert-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "alert-box";
    var cf = document.querySelector(".container-fluid");
    if (cf) cf.insertBefore(box, cf.firstChild);
    else document.body.insertBefore(box, document.body.firstChild);
  }
  box.className = "alert alert-" + type + " alert-dismissible";
  box.innerHTML =
    msg +
    '<button type="button" class="close" data-dismiss="alert"><span>&times;</span></button>';
  box.classList.remove("d-none");
  setTimeout(function () {
    box.classList.add("d-none");
  }, 5000);
}

// ═══════════════════════════════════════════════════════════════════════
// Impresora térmica (QZ Tray + localStorage)
// ═══════════════════════════════════════════════════════════════════════
var LS_PRINTER_KEY = "thermal_printer_name";

function _initPrinterConfig() {
  var selectImp = document.getElementById("select-impresora");
  var btnDetect = document.getElementById("btn-detectar-impresoras");
  var btnGuardar = document.getElementById("btn-guardar-impresora");
  var statusDiv = document.getElementById("impresora-status");

  if (!selectImp || !btnDetect || !btnGuardar) return;

  // Mostrar impresora guardada
  var saved = localStorage.getItem(LS_PRINTER_KEY);
  if (saved) {
    var opt = document.createElement("option");
    opt.value = saved;
    opt.textContent = saved;
    opt.selected = true;
    selectImp.appendChild(opt);
    _setImpresoraStatus(
      "info",
      '<i class="fas fa-check-circle mr-1"></i>Impresora guardada: <strong>' +
        _escHtml(saved) +
        "</strong>",
    );
  }

  btnDetect.addEventListener("click", function () {
    _detectarImpresoras(selectImp, statusDiv);
  });

  btnGuardar.addEventListener("click", function () {
    var val = selectImp.value.trim();
    if (!val) {
      _setImpresoraStatus("warning", "Seleccione una impresora de la lista.");
      return;
    }
    localStorage.setItem(LS_PRINTER_KEY, val);
    _setImpresoraStatus(
      "success",
      '<i class="fas fa-check-circle mr-1"></i>Impresora <strong>' +
        _escHtml(val) +
        "</strong> guardada correctamente.",
    );
    showAlert("success", "Impresora térmica guardada: " + val);
  });
}

async function _detectarImpresoras(selectEl, statusDiv) {
  var btnDetect = document.getElementById("btn-detectar-impresoras");
  if (btnDetect) {
    btnDetect.disabled = true;
    btnDetect.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }

  try {
    if (typeof qz === "undefined") {
      _setImpresoraStatus(
        "danger",
        '<i class="fas fa-exclamation-triangle mr-1"></i>' +
          "QZ Tray no está disponible. " +
          '<a href="https://qz.io/download/" target="_blank" rel="noopener">Descargar QZ Tray</a>',
      );
      return;
    }

    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 2, delay: 0.5 });
    }

    var printers = await qz.printers.find();
    if (!Array.isArray(printers) || printers.length === 0) {
      _setImpresoraStatus(
        "warning",
        "No se encontraron impresoras en el equipo.",
      );
      return;
    }

    var saved = localStorage.getItem(LS_PRINTER_KEY) || "";

    // Limpiar opciones previas
    selectEl.innerHTML =
      '<option value="">— Seleccione una impresora —</option>';
    printers.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      if (p === saved) opt.selected = true;
      selectEl.appendChild(opt);
    });

    _setImpresoraStatus(
      "success",
      '<i class="fas fa-check-circle mr-1"></i>Se encontraron <strong>' +
        printers.length +
        "</strong> impresora(s). Seleccione la térmica y haga clic en Guardar.",
    );
  } catch (err) {
    _setImpresoraStatus(
      "danger",
      '<i class="fas fa-exclamation-triangle mr-1"></i>No se pudo conectar a QZ Tray: ' +
        _escHtml(err.message || String(err)) +
        ". Verifique que QZ Tray esté iniciado.",
    );
  } finally {
    if (btnDetect) {
      btnDetect.disabled = false;
      btnDetect.innerHTML = '<i class="fas fa-sync-alt"></i>';
    }
  }
}

function _setImpresoraStatus(type, html) {
  var div = document.getElementById("impresora-status");
  if (!div) return;
  div.className = "alert alert-" + type + " py-2 mb-0";
  div.innerHTML = html;
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
