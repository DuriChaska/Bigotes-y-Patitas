// ============================================
//  Bigotes y Patitas - components.js
//  Ropa y accesorios para perritos y gatitos
//  Inyecta el header y footer en todas las páginas.
//
//  El header ahora es dinámico: si hay una cuenta de
//  cliente real con sesión iniciada (Firebase Authentication),
//  el botón "Iniciar sesión" cambia por el nombre del cliente
//  (cerrar sesión se hace desde Mi cuenta). Se pinta primero sin
//  sesión (para no bloquear la carga de la página) y se vuelve
//  a pintar en cuanto Firebase responde.
// ============================================

// Detecta la página actual para marcar el botón activo
const paginaActual = window.location.pathname.split('/').pop();

const NAV_BASE = [
  { href: 'index.html', label: 'Inicio' },
  { href: 'shop.html', label: 'Catálogo' },
  { href: 'carpeta.html', label: 'Carpeta' },
  { href: 'about.html', label: 'Nosotros' },
  { href: 'contact.html', label: 'Contacto' },
  { href: 'promos.html', label: 'Promos' },
  { href: 'comunidad.html', label: 'Comunidad Peluda' },
];

function primerNombre(nombreCompleto) {
  return String(nombreCompleto || 'Cliente').trim().split(' ')[0] || 'Cliente';
}

// Escapa texto antes de meterlo en el HTML del header (el nombre lo escribió el propio cliente).
function escHeader(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Respuestas de soporte sin leer del cliente con sesión (se actualiza en vivo con sus tickets).
let ticketsSinLeer = 0;

function navLinks(cliente) {
  const links = [...NAV_BASE];
  if (cliente) {
    const aviso = ticketsSinLeer > 0
      ? ` <span class="cart-badge" style="position:static; display:inline-flex; margin-left:4px; background:#2f9e5a;" title="Respuestas de soporte sin leer">${ticketsSinLeer}</span>`
      : '';
    links.push({ href: 'Interfaz Cliente - Perfil.html', label: `Hola, ${escHeader(primerNombre(cliente.nombre))}${aviso}` });
    // Cerrar sesión ya no va en el menú de arriba: está en Mi cuenta (menú lateral y botón del perfil).
  } else {
    links.push({ href: 'login.html', label: 'Iniciar sesión' });
  }
  return links;
}

function navHTML(cliente) {
  return navLinks(cliente).map(link => `
    <li>
      <button type="button"
        class="${paginaActual === link.href ? 'active' : ''}"
        onclick="${link.accion ? link.accion + '(event)' : `window.location.href='${link.href}'`}">
        ${link.label}
      </button>
    </li>
  `).join('');
}

// ── HEADER + FOOTER ──
// cliente: null (sin sesión) o el perfil de Firestore { nombre, correo, ... }.
function pintarHeaderFooter(cliente) {
  document.getElementById('header').innerHTML = `
    <header>
      <div class="logo">
        <div class="logo-icon">
          <img src="Imagenes/Mascotas/logo_huella_sinfondo.png" alt="Logo Bigotes y Patitas" />
        </div>
        <span>Bigotes y Patitas</span>
      </div>
      <nav>
        <ul>${navHTML(cliente)}</ul>
      </nav>
      <div class="icons">
        <img src="${cliente && cliente.foto ? cliente.foto : 'Imagenes/Iconos/Avatar.png'}" alt="Perfil"
          class="icon${cliente && cliente.foto ? ' icon-foto-perfil' : ''}" style="cursor:pointer;"
          title="${cliente ? 'Mi perfil' : 'Iniciar sesión'}"
          onclick="window.location.href='${cliente ? 'Interfaz Cliente - Perfil.html' : 'login.html'}'" />

        <span class="admin-access-icon" title="Panel de administración"
          onclick="window.location.href='admin-login.html'">🔒</span>

        <div class="cart-icon-wrapper" style="position: relative; display: inline-block; cursor: pointer;" onclick="window.location.href='Carrito.html'">
          <img src="Imagenes/Iconos/Shopping cart.png" alt="Carrito" class="icon" />
          <span id="cart-badge" class="cart-badge">0</span>
        </div>
      </div>
    </header>
  `;

  document.getElementById('footer').innerHTML = `
    <footer>
      <div class="left">
        <p><strong>Bigotes y Patitas</strong></p>
        <p>Ropa y accesorios hechos con cariño para perritos y gatitos. ¿Te gustaría colaborar con nosotros?</p>
        <button type="button">ÚNETE →</button>
      </div>
      <div class="center">
        <p><strong>REDES SOCIALES</strong></p>
        <ul>
          <li>
            <img src="Imagenes/Iconos/Facebook.png" alt="Facebook" class="icon" />
            <a href="https://es-la.facebook.com/">Facebook</a>
          </li>
          <li>
            <img src="Imagenes/Iconos/Twitter.png" alt="Twitter" class="icon" />
            <a href="https://x.com/">Twitter</a>
          </li>
          <li>
            <img src="Imagenes/Iconos/Instagram.png" alt="Instagram" class="icon" />
            <a href="https://www.instagram.com/">Instagram</a>
          </li>
          <li>
            <img src="Imagenes/Iconos/Shopping cart.png" alt="Subastas" class="icon" />
            <a href="subastas.html">Subastas</a>
          </li>
        </ul>
      </div>
      <div class="right">
        <p><strong>Horario:</strong><br />
          Lunes a Viernes 7:00 am - 11:00 pm<br />
          Sábado y Domingo 9:00 am - 9:00 pm
        </p>
        <p><strong>Teléfono:</strong><br />(449) 3116529</p>
      </div>
      <div class="bottom-text">
        Bigotes y Patitas: diseños pensados para el bienestar y comodidad de tu mascota.
        <br>Copyright © 2026 Bigotes y Patitas | Todos los derechos reservados | Términos y Condiciones | Aviso de Privacidad
        Algunas imágenes de modelos utilizadas en este sitio fueron generadas con inteligencia artificial.
        <br>Copyright © 2026 Bigotes y Patitas | All Rights Reserved | Terms and Conditions | Privacy Policy
      </div>
    </footer>
  `;

  actualizarBadgeCarrito();
}

// Pinta de inmediato como "sin sesión" para no bloquear la carga de la página.
pintarHeaderFooter(null);

// Cerrar sesión (lo usa el menú lateral de Mi cuenta: cuenta-menu.js).
window.cerrarSesionClientePublico = function (e) {
  if (e) e.preventDefault();
  import('./firebase-db.js').then(({ logoutCliente }) => {
    logoutCliente().finally(() => { window.location.href = 'index.html'; });
  });
};

// En cuanto Firebase responda, si hay un cliente con sesión real, se vuelve a
// pintar el header con su nombre. import() dinámico porque este archivo NO es
// un módulo (se usa con <script src="components.js">, no type="module").
import('./firebase-db.js').then(({ observarSesionCliente, asegurarPerfilCliente, escucharTicketsDeCliente, escucharFotoPerfil }) => {
  let cancelarTickets = null;
  let cancelarFoto = null;
  observarSesionCliente(async (user) => {
    if (cancelarTickets) { cancelarTickets(); cancelarTickets = null; }
    if (cancelarFoto) { cancelarFoto(); cancelarFoto = null; }
    ticketsSinLeer = 0;
    if (!user) { pintarHeaderFooter(null); return; }
    let clienteHeader;
    try {
      const perfil = await asegurarPerfilCliente(user);   // crea el perfil si la cuenta no lo tenía
      clienteHeader = perfil || { nombre: user.displayName || user.email };
    } catch (err) {
      if (err && err.code === 'bp/cuenta-dada-de-baja') {
        // La tienda dio de baja esta cuenta desde el panel: ya se borró y se cerró la sesión.
        pintarHeaderFooter(null);
        window.bpNotificar('Tu cuenta fue dada de baja por la tienda y se borró. Puedes registrarte de nuevo cuando quieras.', 'error');
        return;
      }
      clienteHeader = { nombre: user.displayName || user.email };   // sin perfil: se usa el nombre de la cuenta
    }
    pintarHeaderFooter(clienteHeader);

    // Alerta de respuestas de soporte sin leer junto a "Hola, ...".
    cancelarTickets = escucharTicketsDeCliente(user.uid, (lista) => {
      const n = lista.filter(t => t.leidoCliente === false).length;
      if (n !== ticketsSinLeer) { ticketsSinLeer = n; pintarHeaderFooter(clienteHeader); }
    }, () => { /* sin tickets: solo no se muestra la alerta junto al nombre */ });

    // Etapa 4: foto de perfil en el ícono del menú (sin foto queda el ícono genérico).
    cancelarFoto = escucharFotoPerfil(user.uid, (foto) => {
      if ((clienteHeader.foto || '') !== foto) { clienteHeader.foto = foto; pintarHeaderFooter(clienteHeader); }
    }, () => { /* sin foto: se queda el ícono genérico */ });
  });
}).catch(() => {
  window.bpNotificar('No se pudo conectar con tu cuenta. Revisa tu conexión y recarga la página.', 'error');
});

// Etapa 4: notificación en pantalla para toda la tienda (en lugar de mensajes en la consola).
// tipo: 'info' (café) | 'error' (rojo) | 'ok' (verde). Uso: bpNotificar('Texto', 'error');
window.bpNotificar = function (texto, tipo = 'info') {
  let caja = document.getElementById('bp-notificacion');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'bp-notificacion';
    caja.setAttribute('role', 'status');
    caja.setAttribute('aria-live', 'polite');
    caja.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(92vw,520px);'
      + 'color:#fff;padding:12px 18px;border-radius:12px;font:14px/1.45 "DM Sans",sans-serif;'
      + 'box-shadow:0 8px 20px rgba(0,0,0,.25);z-index:99999;transition:opacity .3s;opacity:0;pointer-events:none;';
    document.body.appendChild(caja);
  }
  caja.style.background = { error: '#a3322a', ok: '#2f6b3a' }[tipo] || '#4a3826';
  caja.textContent = texto;
  caja.style.opacity = '1';
  clearTimeout(window.bpNotificar._t);
  window.bpNotificar._t = setTimeout(() => { caja.style.opacity = '0'; }, 6500);
};

// Etapa 4: carrito guardado en la cuenta (Firebase), caducidad de 72 h y aviso de stock en vivo.
import('./carrito-sync.js').catch(() => {
  window.bpNotificar('No se pudo conectar tu carrito con tu cuenta. Tu carrito se sigue guardando en este navegador.', 'error');
});

// ── LÓGICA DEL BADGE DEL CARRITO ──

/**
 * Calcula el total de prendas en el carrito y actualiza el número en el header.
 */
function actualizarBadgeCarrito() {
  const carrito = JSON.parse(localStorage.getItem("carrito") || "[]");

  // Suma las cantidades de todos los productos
  const totalPrendas = carrito.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);

  const badge = document.getElementById("cart-badge");

  if (badge) {
    badge.textContent = totalPrendas;

    // Si no hay nada, lo ocultamos para que se vea más limpio
    if (totalPrendas > 0) {
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }
}

// ── ESCUCHADORES DE EVENTOS (REAL-TIME) ──

// 2. Escuchar cambios manuales desde el mismo documento (sin recargar)
window.addEventListener('actualizarCarrito', actualizarBadgeCarrito);

// 3. Escuchar cambios desde otras pestañas/ventanas
window.addEventListener('storage', (event) => {
  if (event.key === 'carrito') {
    actualizarBadgeCarrito();
  }
});

// CSS inyectado dinámicamente para el Badge
const style = document.createElement('style');
style.innerHTML = `
  .cart-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background-color: #ff4d4d;
    color: white;
    font-size: 11px;
    font-weight: bold;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
    pointer-events: none;
    z-index: 10;
  }
`;
document.head.appendChild(style);

// Ícono de la pestaña del navegador (logo de la tienda) en todas las páginas.
(function ponerFavicon() {
  if (document.querySelector('link[rel~="icon"]')) return;
  [
    ['icon', 'favicon.ico', null, 'any'],
    ['icon', 'Imagenes/Iconos/favicon-32.png', 'image/png', '32x32'],
    ['icon', 'Imagenes/Iconos/favicon-192.png', 'image/png', '192x192'],
    ['apple-touch-icon', 'Imagenes/Iconos/apple-touch-icon.png', null, null],
  ].forEach(([rel, href, type, sizes]) => {
    const l = document.createElement('link');
    l.rel = rel; l.href = href;
    if (type) l.type = type;
    if (sizes) l.sizes = sizes;
    document.head.appendChild(l);
  });
})();

