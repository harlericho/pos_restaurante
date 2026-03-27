// utils/empresa.js

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

  // ── Preview en tiempo real ───────────────────────────────────────────
  [
    "emp-nombre",
    "emp-ruc",
    "emp-direccion",
    "emp-telefono",
    "emp-correo",
  ].forEach(function (id) {
    var input = el(id);
    if (input) input.addEventListener("input", updatePreview);
  });

  // ── Form submit ──────────────────────────────────────────────────────
  el("form-empresa").addEventListener("submit", function (e) {
    e.preventDefault();
    saveEmpresa();
  });

  // ── Carga inicial ────────────────────────────────────────────────────
  loadEmpresa();
});

// ═══════════════════════════════════════════════════════════════════════
// Cargar
// ═══════════════════════════════════════════════════════════════════════
async function loadEmpresa() {
  try {
    var resp = await EmpresaAPI.get();
    var emp = resp.data || {};
    document.getElementById("emp-nombre").value = emp.nombre || "";
    document.getElementById("emp-ruc").value = emp.ruc || "";
    document.getElementById("emp-direccion").value = emp.direccion || "";
    document.getElementById("emp-telefono").value = emp.telefono || "";
    document.getElementById("emp-correo").value = emp.correo || "";
    updatePreview();
  } catch (err) {
    showAlert(
      "danger",
      (err.data && err.data.error) ||
        err.message ||
        "Error al cargar datos de la empresa.",
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Guardar
// ═══════════════════════════════════════════════════════════════════════
async function saveEmpresa() {
  var nombre = document.getElementById("emp-nombre").value.trim();
  var ruc = document.getElementById("emp-ruc").value.trim();
  var direccion = document.getElementById("emp-direccion").value.trim();
  var telefono = document.getElementById("emp-telefono").value.trim();
  var correo = document.getElementById("emp-correo").value.trim();

  var valid = true;
  if (!nombre) {
    document.getElementById("emp-nombre").classList.add("is-invalid");
    valid = false;
  } else {
    document.getElementById("emp-nombre").classList.remove("is-invalid");
  }
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    document.getElementById("emp-correo").classList.add("is-invalid");
    valid = false;
  } else {
    document.getElementById("emp-correo").classList.remove("is-invalid");
  }
  if (!valid) return;

  var btn = document.getElementById("btn-guardar-empresa");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';

  try {
    await EmpresaAPI.update({
      nombre: nombre,
      ruc: ruc,
      direccion: direccion,
      telefono: telefono,
      correo: correo,
    });
    showAlert("success", "Datos de la empresa guardados correctamente.");
    updatePreview();
  } catch (err) {
    showAlert(
      "danger",
      (err.data && err.data.error) || err.message || "Error al guardar.",
    );
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar cambios';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Vista previa
// ═══════════════════════════════════════════════════════════════════════
function updatePreview() {
  var g = function (id) {
    return document.getElementById(id);
  };
  g("prev-nombre").textContent = g("emp-nombre").value.trim() || "—";
  g("prev-ruc").textContent = g("emp-ruc").value.trim() || "—";
  g("prev-direccion").textContent = g("emp-direccion").value.trim() || "—";
  g("prev-telefono").textContent = g("emp-telefono").value.trim() || "—";
  g("prev-correo").textContent = g("emp-correo").value.trim() || "—";
}

// ═══════════════════════════════════════════════════════════════════════
// Alerta
// ═══════════════════════════════════════════════════════════════════════
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
