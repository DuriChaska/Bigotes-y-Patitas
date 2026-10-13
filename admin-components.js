// ============================================
//  Bigotes y Patitas - admin-components.js
//  Inyecta el menú lateral (sidebar) del panel
//  de administración en todas sus páginas, para
//  que se vea siempre igual (mismo patrón que
//  components.js usa para el header/footer del
//  sitio público).
//  Requiere admin-icons.js cargado antes (bpIcon).
//
//  El menú tiene dos secciones plegables tipo acordeón
//  (CRM y SCM); Usuarios y Configuración quedan fuera,
//  como enlaces sueltos. Cada sección lleva la clase
//  "sec-crm" / "sec-scm" / "sec-admin" y styles.css la
//  oculta según el rol (vendedor: solo CRM; logística:
//  solo SCM; administrador: todo). El estado abierto/cerrado de
//  cada sección se recuerda en localStorage, y la sección
//  de la página en la que estás siempre se muestra abierta.
// ============================================

const adminPaginaActual = window.location.pathname.split('/').pop();

const adminNavGroups = [
  {
    key: 'crm', label: 'CRM', icon: 'home', seccion: 'crm',
    items: [
      { href: 'admin.html',                     label: 'Dashboard',      icon: 'home' },
      { href: 'admin-clientes.html',             label: 'Clientes',       icon: 'users' },
      { href: 'admin-interacciones-todas.html',  label: 'Interacciones',  icon: 'chat' },
      { href: 'admin-reportes.html',             label: 'Reportes',       icon: 'chart' },
      { href: 'admin-actividad.html',            label: 'Mi actividad',   icon: 'clock' },
    ],
  },
  {
    key: 'scm', label: 'SCM', icon: 'layers', seccion: 'scm',
    items: [
      { href: 'admin-scm.html',             label: 'Resumen',          icon: 'layers' },
      { href: 'admin-scm-productos.html',   label: 'Productos',        icon: 'package' },
      { href: 'admin-scm-proveedores.html', label: 'Proveedores',      icon: 'users' },
      { href: 'admin-scm-inventario.html',  label: 'Inventario',       icon: 'boxes' },
      { href: 'admin-scm-pedidos.html',     label: 'Pedidos',          icon: 'clipboard' },
      { href: 'admin-scm-logistica.html',   label: 'Logística',        icon: 'refresh' },
      { href: 'admin-scm-reportes.html',    label: 'Reportes SCM',     icon: 'chart' },
      { href: 'admin-scm-madurez.html',     label: 'Nivel de madurez', icon: 'trending_up' },
    ],
  },
];

// Usuarios y Configuración quedan fuera de los acordeones, siempre visibles.
const adminStandaloneLinks = [
  { href: 'admin-usuarios.html',      label: 'Usuarios',      icon: 'shield', seccion: 'admin' },
  { href: 'admin-configuracion.html', label: 'Configuración', icon: 'settings' },
];

// Páginas de detalle que "activan" el mismo ítem del menú que su listado padre
const adminAliasActivo = {
  'admin-cliente-detalle.html': 'admin-clientes.html',
  'admin-cliente-etapa.html':   'admin-clientes.html',
  'admin-interacciones.html':   'admin-interacciones-todas.html',
};
const adminPaginaActiva = adminAliasActivo[adminPaginaActual] || adminPaginaActual;

function grupoTieneActiva(grupo) {
  return grupo.items.some(it => it.href === adminPaginaActiva);
}

function leerMenuAbierto() {
  try { return JSON.parse(localStorage.getItem('bpAdminMenuAbierto') || '{}'); }
  catch { return {}; }
}
function guardarMenuAbierto(estado) {
  try { localStorage.setItem('bpAdminMenuAbierto', JSON.stringify(estado)); } catch { /* localStorage no disponible */ }
}

function itemNavHTML(link) {
  return `
    <li${link.seccion ? ` class="sec-${link.seccion}"` : ''}>
      <a href="${link.href}" class="${adminPaginaActiva === link.href ? 'active' : ''}">
        <span class="nav-icon">${bpIcon(link.icon)}</span>
        <span class="nav-label">${link.label}</span>
      </a>
    </li>
  `;
}

function grupoNavHTML(grupo, estadoGuardado) {
  const abierto = grupoTieneActiva(grupo) || estadoGuardado[grupo.key] === true;
  return `
    <li class="admin-nav-group${grupo.seccion ? ' sec-' + grupo.seccion : ''}${abierto ? ' open' : ''}" data-grupo="${grupo.key}">
      <button type="button" class="admin-nav-group-btn" aria-expanded="${abierto}">
        <span class="nav-icon">${bpIcon(grupo.icon)}</span>
        <span class="nav-label">${grupo.label}</span>
        <span class="nav-chevron">${bpIcon('arrow_right')}</span>
      </button>
      <ul class="admin-nav-sub">${grupo.items.map(itemNavHTML).join('')}</ul>
    </li>
  `;
}

function activarAcordeonSidebar() {
  document.querySelectorAll('.admin-nav-group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.admin-nav-group');
      const abierto = !li.classList.contains('open');
      li.classList.toggle('open', abierto);
      btn.setAttribute('aria-expanded', String(abierto));
      const estado = leerMenuAbierto();
      estado[li.dataset.grupo] = abierto;
      guardarMenuAbierto(estado);
    });
  });
}

function renderAdminSidebar() {
  const mount = document.getElementById('admin-sidebar');
  if (!mount) return;

  const estadoGuardado = leerMenuAbierto();
  const navHTML =
    adminNavGroups.map(g => grupoNavHTML(g, estadoGuardado)).join('') +
    adminStandaloneLinks.map(itemNavHTML).join('');

  mount.outerHTML = `
    <aside class="admin-sidebar">
      <div class="admin-sidebar-brand">
        <div class="badge-logo">
          <img src="Imagenes/Mascotas/logo_huella_sinfondo.png" alt="Bigotes y Patitas" />
        </div>
        <span>Bigotes y Patitas<small>Panel de administración</small></span>
      </div>

      <ul class="admin-nav">${navHTML}</ul>

      <div class="admin-sidebar-foot">
        <a href="#" onclick="cerrarSesionAdmin(event)">
          <span class="nav-icon">${bpIcon('logout')}</span><span class="nav-label">Cerrar sesión</span>
        </a>
      </div>
    </aside>
  `;

  activarAcordeonSidebar();
}

function cerrarSesionAdmin(e) {
  if (e) e.preventDefault();
  import('./firebase-db.js').then(({ logoutAdmin }) => {
    logoutAdmin().finally(() => { window.location.href = 'admin-login.html'; });
  });
}

document.addEventListener('DOMContentLoaded', renderAdminSidebar);
