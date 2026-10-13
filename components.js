// ============================================
//  Bigotes y Patitas - components.js
//  Ropa y accesorios para perritos y gatitos
//  Inyecta el header y footer en todas las páginas.
//
//  El header ahora es dinámico: si hay una cuenta de
//  cliente real con sesión iniciada (Firebase Authentication),
//  el botón "Iniciar sesión" cambia por el nombre del cliente
//  y aparece un botón para cerrar sesión. Se pinta primero sin
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

function navLinks(cliente) {
  const links = [...NAV_BASE];
  if (cliente) {
    links.push({ href: 'Interfaz Cliente - Perfil.html', label: `Hola, ${primerNombre(cliente.nombre)}` });
    links.push({ href: '#', label: 'Cerrar sesión', accion: 'cerrarSesionClientePublico' });
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
        <img src="Imagenes/Iconos/Avatar.png" alt="Perfil" class="icon"
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

// Botón "Cerrar sesión" del header (solo aparece con sesión iniciada).
window.cerrarSesionClientePublico = function (e) {
  if (e) e.preventDefault();
  import('./firebase-db.js').then(({ logoutCliente }) => {
    logoutCliente().finally(() => { window.location.href = 'index.html'; });
  });
};

// En cuanto Firebase responda, si hay un cliente con sesión real, se vuelve a
// pintar el header con su nombre. import() dinámico porque este archivo NO es
// un módulo (se usa con <script src="components.js">, no type="module").
import('./firebase-db.js').then(({ observarSesionCliente, obtenerPerfilCliente }) => {
  observarSesionCliente(async (user) => {
    if (!user) { pintarHeaderFooter(null); return; }
    try {
      const perfil = await obtenerPerfilCliente(user.uid);
      pintarHeaderFooter(perfil || { nombre: user.displayName || user.email });
    } catch (err) {
      console.error(err);
      pintarHeaderFooter({ nombre: user.displayName || user.email });
    }
  });
}).catch((err) => console.error('No se pudo cargar la sesión del cliente:', err));

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
