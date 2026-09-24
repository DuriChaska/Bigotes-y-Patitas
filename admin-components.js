// ============================================
//  Bigotes y Patitas - admin-components.js
//  Inyecta el menú lateral (sidebar) del panel
//  de administración en todas sus páginas, para
//  que se vea siempre igual (mismo patrón que
//  components.js usa para el header/footer del
//  sitio público).
// ============================================

const adminPaginaActual = window.location.pathname.split('/').pop();

const adminNavLinks = [
  { href: 'admin.html',              label: 'Dashboard',      icon: '🏠' },
  { href: 'admin-clientes.html',     label: 'Clientes',       icon: '👤' },
  { href: 'editarproducto.html',     label: 'Productos',      icon: '🛍️' },
  { href: 'pedidos.html',            label: 'Pedidos',        icon: '📦' },
  { href: 'promociones.html',        label: 'Promociones',    icon: '🏷️' },
  { href: 'admin-actividad.html',    label: 'Mi actividad',   icon: '🕒' },
  { href: 'admin-reportes.html',     label: 'Reportes',       icon: '📊' },
  { href: 'admin-configuracion.html',label: 'Configuración',  icon: '⚙️' },
];

const adminNavHTML = adminNavLinks.map(link => `
  <li>
    <a href="${link.href}" class="${adminPaginaActual === link.href ? 'active' : ''}">
      <span class="nav-icon">${link.icon}</span>
      <span class="nav-label">${link.label}</span>
    </a>
  </li>
`).join('');

function renderAdminSidebar() {
  const mount = document.getElementById('admin-sidebar');
  if (!mount) return;

  mount.outerHTML = `
    <aside class="admin-sidebar">
      <div class="admin-sidebar-brand">
        <div class="badge-logo">
          <img src="Imagenes/Mascotas/logo_huella_sinfondo.png" alt="Bigotes y Patitas" />
        </div>
        <span>Bigotes y Patitas<small>Panel de administración</small></span>
      </div>

      <ul class="admin-nav">${adminNavHTML}</ul>

      <div class="admin-sidebar-foot">
        <a href="#" onclick="cerrarSesionAdmin(event)">
          <span class="nav-icon">↩</span><span class="nav-label">Cerrar sesión</span>
        </a>
      </div>
    </aside>
  `;
}

function cerrarSesionAdmin(e) {
  if (e) e.preventDefault();
  sessionStorage.removeItem('bp_admin_logueado');
  window.location.href = 'admin-login.html';
}

document.addEventListener('DOMContentLoaded', renderAdminSidebar);