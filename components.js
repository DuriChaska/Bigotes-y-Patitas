// ============================================
//  Cotton Candy Clothing Store - components.js
//  Inyecta el header y footer en todas las páginas
// ============================================

// Detecta la página actual para marcar el botón activo
const paginaActual = window.location.pathname.split('/').pop();

const navLinks = [
  { href: 'index.html', label: 'Inicio' },
  { href: 'shop.html', label: 'Catálogo' },
  { href: 'carpeta.html', label: 'Carpeta' },
  { href: 'about.html', label: 'Nosotros' },
  { href: 'contact.html', label: 'Contacto' },
  { href: 'promos.html', label: 'Promos' },
  { href: 'comunidad.html', label: 'Comunidad' },
  { href: 'login.html', label: 'Iniciar sesión' },
];

const navHTML = navLinks.map(link => `
  <li>
    <button type="button"
      class="${paginaActual === link.href ? 'active' : ''}"
      onclick="window.location.href='${link.href}'">
      ${link.label}
    </button>
  </li>
`).join('');

// ── HEADER ──
document.getElementById('header').innerHTML = `
  <header>
    <div class="logo">
      <div class="logo-icon">
        <img src="Imagenes/Logo estampa-tla 1.png" alt="Logo Cotton Candy" />
      </div>
      <span>Cotton Candy Clothing Store</span>
    </div>
    <nav>
      <ul>${navHTML}</ul>
    </nav>
    <div class="icons">
      <img src="Imagenes/Iconos/Avatar.png" alt="Perfil" class="icon"
        onclick="window.location.href='Interfaz Cliente - Perfil.html'" />
      
      <div class="cart-icon-wrapper" style="position: relative; display: inline-block; cursor: pointer;" onclick="window.location.href='carrito.html'">
        <img src="Imagenes/Iconos/Shopping cart.png" alt="Carrito" class="icon" />
        <span id="cart-badge" class="cart-badge">0</span>
      </div>
    </div>
  </header>
`;

// ── FOOTER ──
document.getElementById('footer').innerHTML = `
  <footer>
    <div class="left">
      <p><strong>Cotton Candy Clothing Store</strong></p>
      <p>¿Te gustaría colaborar con nosotros?</p>
      <button type="button">ÚNETE →</button>
    </div>
    <div class="center">
      <p><strong>REDES SOCIALES</strong></p>
      <ul>
        <li>
          <img src="Imagenes/Iconos/Facebook.png" alt="Facebook" class="icon" />
          <a href="#">Facebook</a>
        </li>
        <li>
          <img src="Imagenes/Iconos/Twitter.png" alt="Twitter" class="icon" />
          <a href="#">Twitter</a>
        </li>
        <li>
          <img src="Imagenes/Iconos/Instagram.png" alt="Instagram" class="icon" />
          <a href="#">Instagram</a>
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
      Algunas imágenes de modelos utilizadas en este sitio fueron generadas con inteligencia artificial.
      <br>Copyright © 2026 Cotton Candy Clothing Store | All Rights Reserved | Terms and Conditions | Privacy Policy
    </div>
  </footer>
`;

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

// 1. Ejecutar al cargar la página
document.addEventListener("DOMContentLoaded", actualizarBadgeCarrito);

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