document.addEventListener("DOMContentLoaded", function () {
  redirectIfNotLoggedIn();

  // Solo admin puede ver el dashboard
  var user = getUser();
  if (user && user.rol !== "admin") {
    window.location.href = "pedidos.html";
    return;
  }

  if (user) {
    var nameEl = document.getElementById("nav-user-name");
    var nameHdEl = document.getElementById("nav-user-name-header");
    var roleEl = document.getElementById("nav-user-role");
    var sideNameEl = document.getElementById("sidebar-user-name");
    var sideRoleEl = document.getElementById("sidebar-user-role");
    var roleCap = user.rol.charAt(0).toUpperCase() + user.rol.slice(1);
    if (nameEl) nameEl.textContent = user.nombre;
    if (nameHdEl) nameHdEl.textContent = user.nombre;
    if (roleEl) roleEl.textContent = roleCap;
    if (sideNameEl) sideNameEl.textContent = user.nombre;
    if (sideRoleEl) sideRoleEl.textContent = roleCap;

    // Show admin-only sidebar items
    if (user.rol === "admin") {
      document.querySelectorAll(".admin-only").forEach(function (el) {
        el.style.display = "";
      });
    }
  }

  // Logout
  var btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", function (e) {
      e.preventDefault();
      logout();
    });
  }

  loadDashboard();
});

async function loadDashboard() {
  try {
    // Mesas stats
    var mesasResp = await MesasAPI.getAll();
    var mesas = mesasResp.data || [];
    var libres = mesas.filter(function (m) {
      return m.estado === "libre";
    }).length;
    var ocupadas = mesas.filter(function (m) {
      return m.estado === "ocupada";
    }).length;
    document.getElementById("stat-mesas-libres").textContent = libres;
    document.getElementById("stat-mesas-ocupadas").textContent = ocupadas;

    // Pedidos abiertos
    var pedAbiertos = await PedidosAPI.getAll("abierto");
    document.getElementById("stat-pedidos-abiertos").textContent = (
      pedAbiertos.data || []
    ).length;

    // Ventas / ingresos hoy
    var hoy = new Date().toISOString().split("T")[0];
    try {
      var reporteResp = await VentasAPI.getReporte(hoy, hoy);
      var totales =
        reporteResp.data && reporteResp.data.totales
          ? reporteResp.data.totales
          : {};
      document.getElementById("stat-ventas-hoy").textContent =
        totales.total_ventas || 0;
      document.getElementById("stat-ingresos-hoy").textContent =
        "$ " + parseFloat(totales.total_ingresos || 0).toFixed(2);
    } catch (e) {
      // Non-admin roles may not have access to reporte; silently ignore
    }

    // Recent pedidos table
    var todosResp = await PedidosAPI.getAll();
    var todos = (todosResp.data || []).slice(0, 8);
    var tbody = document.getElementById("tbody-pedidos-recientes");
    if (tbody) {
      tbody.innerHTML = todos
        .map(function (p) {
          var badgeClass =
            p.estado === "abierto"
              ? "badge-warning"
              : p.estado === "cerrado"
                ? "badge-success"
                : "badge-secondary";
          var total = "$ " + parseFloat(p.total || 0).toFixed(2);
          return (
            "<tr>" +
            "<td>#" +
            p.id +
            "</td>" +
            "<td>Mesa " +
            (p.numero_mesa || p.mesa_id) +
            "</td>" +
            "<td>" +
            (p.mesero || "") +
            "</td>" +
            '<td><span class="badge ' +
            badgeClass +
            '">' +
            p.estado +
            "</span></td>" +
            "<td>" +
            total +
            "</td>" +
            "</tr>"
          );
        })
        .join("");
    }
  } catch (err) {
    console.error("Error cargando dashboard:", err);
  }
}
