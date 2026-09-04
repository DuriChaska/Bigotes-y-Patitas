// ============================================
//  Bigotes y Patitas - admin-components.js
//  Inyecta el menú lateral (sidebar) del panel
//  de administración en todas sus páginas, para
//  que se vea siempre igual (mismo patrón que
//  components.js usa para el header/footer del
//  sitio público).
//  Requiere admin-icons.js cargado antes (bpIcon).
// ============================================

const adminPaginaActual = window.location.pathname.split('/').pop();

const adminNavLinks = [
  { href: 'admin.html',                     label: 'Dashboard',      icon: 'home' },
  { href: 'admin-clientes.html',             label: 'Clientes',       icon: 'users' },
  { href: 'admin-interacciones-todas.html',  label: 'Interacciones',  icon: 'chat' },
  { href: 'admin-reportes.html',             label: 'Reportes',       icon: 'chart' },
  { href: 'admin-actividad.html',            label: 'Mi actividad',   icon: 'clock' },
  { href: 'admin-configuracion.html',        label: 'Configuración',  icon: 'settings' },
];

// Páginas de detalle que "activan" el mismo ítem del menú que su listado padre
const adminAliasActivo = {
  'admin-cliente-detalle.html': 'admin-clientes.html',
  'admin-cliente-etapa.html':   'admin-clientes.html',
  'admin-interacciones.html':   'admin-interacciones-todas.html',
};
const adminPaginaActiva = adminAliasActivo[adminPaginaActual] || adminPaginaActual;

const adminNavHTML = adminNavLinks.map(link => `
  <li>
    <a href="${link.href}" class="${adminPaginaActiva === link.href ? 'active' : ''}">
      <span class="nav-icon">${bpIcon(link.icon)}</span>
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
          <span class="nav-icon">${bpIcon('logout')}</span><span class="nav-label">Cerrar sesión</span>
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
