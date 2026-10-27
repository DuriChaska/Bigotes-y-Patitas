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

// Roles del panel (el menú se arma según el rol de quien inició sesión):
//   administrador -> todo
//   vendedor      -> "Ventas": CRM + órdenes ERP + consulta de productos e inventario
//   logistica     -> SCM completo + órdenes ERP
const R_TODOS   = ['administrador', 'vendedor', 'logistica'];
const R_ADMIN   = ['administrador'];
const R_CRM     = ['administrador', 'vendedor'];
const R_SCM     = ['administrador', 'logistica'];
const R_CONSULTA = ['administrador', 'logistica', 'vendedor']; // Productos e Inventario (el vendedor solo consulta)

// ─── Interruptor "Modo ERP" ────────────────────────────────────────────────
// El ERP no es un apartado aparte: es un INTERRUPTOR del mismo panel.
//   - Apagado: el menú de siempre, según el rol (CRM, SCM, Usuarios, Configuración).
//   - Encendido: vista integrada del negocio. El ERP CONSULTA el CRM y el SCM
//     (clientes, productos, inventario) sin salirse a esos módulos.
// El modo se recuerda en el navegador y las páginas admin-erp-* lo encienden solas.
const adminEsPaginaErp = /^admin-erp/.test(adminPaginaActual);
const adminEsPaginaCompartida = ['admin-usuarios.html', 'admin-configuracion.html'].includes(adminPaginaActual);

function leerModoErp() {
  try { return localStorage.getItem('bpModoErp') === '1'; } catch { return false; }
}
function guardarModoErp(encendido) {
  try { localStorage.setItem('bpModoErp', encendido ? '1' : '0'); } catch { /* sin almacenamiento */ }
}
// Páginas de ERP: encendido. Páginas de CRM/SCM: apagado. Usuarios y Configuración: el modo que ya traías.
const adminModoErp = adminEsPaginaErp ? true : (adminEsPaginaCompartida ? leerModoErp() : false);
if (!adminEsPaginaCompartida) guardarModoErp(adminModoErp);

// Página de inicio al apagar el interruptor: cada rol vuelve a la suya.
function adminInicioNormal(rol) { return rol === 'logistica' ? 'admin-scm.html' : 'admin.html'; }

// "Inicio" cambia según el modo (en modo normal hay uno por rol; aplicarMenuPorRol oculta el que no toca).
const adminInicioItems = adminModoErp
  ? [{ href: 'admin-erp.html', label: 'Inicio', icon: 'home', roles: R_TODOS }]
  : [
      { href: 'admin.html',     label: 'Inicio', icon: 'home', roles: R_CRM },
      { href: 'admin-scm.html', label: 'Inicio', icon: 'home', roles: ['logistica'] },
    ];

// Menú del modo ERP (lista plana): consulta directa, sin salirse al CRM ni al SCM.
const adminErpItems = [
  { href: 'admin-erp-clientes.html',   label: 'Clientes',                icon: 'users',       roles: R_CRM },
  { href: 'admin-erp-productos.html',  label: 'Productos',               icon: 'package',     roles: R_TODOS },
  { href: 'admin-erp-inventario.html', label: 'Inventario',              icon: 'boxes',       roles: R_TODOS },
  { href: 'admin-erp-ordenes.html',    label: 'Órdenes de clientes',     icon: 'clipboard',   roles: R_TODOS },
  { href: 'admin-erp-reportes.html',   label: 'Reportes ERP',            icon: 'chart',       roles: R_TODOS },
  { href: 'admin-erp-madurez.html',    label: 'Nivel de implementación', icon: 'trending_up', roles: R_ADMIN },
  { href: 'admin-usuarios.html',       label: 'Usuarios',                icon: 'shield',      roles: R_ADMIN },
  { href: 'admin-configuracion.html',  label: 'Configuración',           icon: 'settings',    roles: R_TODOS },
];

const adminNavGroups = [
  {
    key: 'crm', label: 'CRM', icon: 'users',
    items: [
      { href: 'admin.html',                     label: 'Dashboard CRM',  icon: 'chart',  roles: R_CRM },
      { href: 'admin-clientes.html',             label: 'Clientes',       icon: 'users',  roles: R_CRM },
      { href: 'admin-interacciones-todas.html',  label: 'Interacciones',  icon: 'chat',   roles: R_CRM },
      { href: 'admin-reportes.html',             label: 'Reportes CRM',   icon: 'chart',  roles: R_CRM },
      { href: 'admin-actividad.html',            label: 'Mi actividad',   icon: 'clock',  roles: R_CRM },
    ],
  },
  {
    key: 'scm', label: 'SCM', icon: 'layers',
    items: [
      { href: 'admin-scm.html',             label: 'Resumen SCM',      icon: 'layers',      roles: R_SCM },
      { href: 'admin-scm-productos.html',   label: 'Productos',        icon: 'package',     roles: R_CONSULTA },
      { href: 'admin-scm-proveedores.html', label: 'Proveedores',      icon: 'users',       roles: R_SCM },
      { href: 'admin-scm-inventario.html',  label: 'Inventario',       icon: 'boxes',       roles: R_CONSULTA },
      { href: 'admin-scm-pedidos.html',     label: 'Pedidos',          icon: 'clipboard',   roles: R_SCM },
      { href: 'admin-scm-logistica.html',   label: 'Logística',        icon: 'refresh',     roles: R_SCM },
      { href: 'admin-scm-reportes.html',    label: 'Reportes SCM',     icon: 'chart',       roles: R_SCM },
      { href: 'admin-scm-madurez.html',     label: 'Nivel de madurez', icon: 'trending_up', roles: R_SCM },
    ],
  },
];

// Usuarios y Configuración quedan fuera de los acordeones en el modo normal
// (Usuarios solo para administradores).
const adminStandaloneLinks = [
  { href: 'admin-usuarios.html',      label: 'Usuarios',      icon: 'shield',   roles: R_ADMIN },
  { href: 'admin-configuracion.html', label: 'Configuración', icon: 'settings', roles: R_TODOS },
];

// Páginas de detalle que "activan" el mismo ítem del menú que su listado padre
const adminAliasActivo = {
  'admin-cliente-detalle.html': 'admin-clientes.html',
  'admin-cliente-etapa.html':   'admin-clientes.html',
  'admin-interacciones.html':   'admin-interacciones-todas.html',
  'admin-erp-nueva-orden.html':  'admin-erp-ordenes.html',
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
    <li data-roles="${(link.roles || R_TODOS).join(',')}">
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
    <li class="admin-nav-group${abierto ? ' open' : ''}" data-grupo="${grupo.key}">
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
  const navHTML = adminModoErp
    ? adminInicioItems.map(itemNavHTML).join('') + adminErpItems.map(itemNavHTML).join('')
    : adminInicioItems.map(itemNavHTML).join('') +
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

      <div class="admin-modo-erp">
        <span class="admin-modo-erp-txt">
          <strong>Modo ERP</strong>
          <small>${adminModoErp ? 'Vista integrada: consulta CRM y SCM' : 'Actívalo para ver todo integrado'}</small>
        </span>
        <button type="button" id="switchErp" class="admin-switch" role="switch"
                aria-checked="${adminModoErp}" aria-label="Modo ERP"><span></span></button>
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

  // Interruptor ERP: al encender va al dashboard ERP; al apagar vuelve al inicio de su rol.
  const interruptor = document.getElementById('switchErp');
  if (interruptor) {
    interruptor.addEventListener('click', () => {
      const encender = !adminModoErp;
      guardarModoErp(encender);
      const rol = window.BP_SESION && window.BP_SESION.rol;
      window.location.href = encender ? 'admin-erp.html' : adminInicioNormal(rol);
    });
  }

  // El rol llega un instante después (admin-auth-guard.js lo busca en Firestore):
  // hasta entonces el panel está oculto, y en cuanto se sabe se filtra el menú.
  if (window.BP_SESION) aplicarMenuPorRol(window.BP_SESION.rol);
  else document.addEventListener('bp-sesion-lista', (e) => aplicarMenuPorRol(e.detail.rol), { once: true });
}

/** Menú dinámico: deja solo lo que el rol puede usar y oculta los grupos que quedan vacíos. */
function aplicarMenuPorRol(rol) {
  document.querySelectorAll('.admin-nav li[data-roles]').forEach((li) => {
    li.hidden = !li.dataset.roles.split(',').includes(rol);
  });
  document.querySelectorAll('.admin-nav-group').forEach((grupo) => {
    grupo.hidden = !grupo.querySelector('.admin-nav-sub li:not([hidden])');
  });
}

function cerrarSesionAdmin(e) {
  if (e) e.preventDefault();
  import('./firebase-db.js').then(({ logoutAdmin }) => {
    logoutAdmin().finally(() => { window.location.href = 'admin-login.html'; });
  });
}

document.addEventListener('DOMContentLoaded', renderAdminSidebar);
