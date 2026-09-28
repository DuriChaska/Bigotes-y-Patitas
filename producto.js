// =============================================
// producto.js - Detalle de producto dinámico
// Trae el producto real de Firestore (scm_productos) según
// el "?id=" de la URL, valida el stock disponible y agrega
// al carrito (localStorage) con datos reales.
// =============================================

import { escucharProductosScm } from './firebase-db.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const IMG_VACIA = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#f1ece1"/>' +
  '<text x="200" y="205" font-family="sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="#8a7d6b">Bigotes y Patitas</text></svg>');

function urlImagen(u) {
  if (typeof u !== 'string' || !u.trim()) return IMG_VACIA;
  const val = u.trim();
  if (/^https?:\/\//i.test(val)) return val;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(val)) return val;
  return IMG_VACIA;
}

function mostrarToast(mensaje, tipo = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 2800);
}

function obtenerCarrito() { return JSON.parse(localStorage.getItem("carrito") || "[]"); }
function guardarCarrito(c) {
  localStorage.setItem("carrito", JSON.stringify(c));
  window.dispatchEvent(new Event('actualizarCarrito'));
}

const params = new URLSearchParams(window.location.search);
const productoId = params.get("id");

let producto = null;
let cantidadInicializada = false;

window.cambiarCantidad = function (delta) {
  if (!producto) return;
  const input = document.getElementById("cantidad");
  if (!input) return;
  const stock = Number(producto.stock) || 0;
  const nuevo = Math.max(1, Math.min(stock || 1, (parseInt(input.value, 10) || 1) + delta));
  input.value = nuevo;
};

window.agregarAlCarrito = function () {
  if (!producto) { mostrarToast("No se pudo agregar el producto", "error"); return; }
  const stock = Number(producto.stock) || 0;
  if (stock <= 0) { mostrarToast("Ese producto está agotado", "error"); return; }

  const cantidadInput = document.getElementById("cantidad");
  const cantidad = Math.max(1, parseInt(cantidadInput?.value, 10) || 1);

  let carrito = obtenerCarrito();
  const existe = carrito.find(item => item.id === producto.id);
  const yaEnCarrito = existe ? existe.cantidad : 0;

  if (yaEnCarrito + cantidad > stock) {
    mostrarToast(`Solo quedan ${stock} disponibles de "${producto.nombre}"`, "error");
    return;
  }

  if (existe) {
    existe.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id, nombre: producto.nombre, precio: Number(producto.precio) || 0,
      imagen: producto.img || '', cantidad,
    });
  }
  guardarCarrito(carrito);
  mostrarToast(`¡Agregado! ${cantidad} × ${producto.nombre}`, "success");
};

window.comprarAhora = function () {
  if (!producto || (Number(producto.stock) || 0) <= 0) {
    mostrarToast("Ese producto está agotado", "error");
    return;
  }
  window.agregarAlCarrito();
  window.location.href = "Carrito.html";
};

function pintarProducto(p, todos) {
  document.title = `Bigotes y Patitas - ${p.nombre}`;

  const stock = Number(p.stock) || 0;
  const stockMin = Number(p.stockMin) || 0;
  const agotado = stock <= 0;

  document.getElementById("nombre-producto").textContent = p.nombre;
  document.getElementById("precio-producto").textContent = `$${(Number(p.precio) || 0).toFixed(2)} MXN`;
  document.getElementById("descripcion-producto").textContent = p.descripcion || '';
  document.getElementById("imagen-producto").src = urlImagen(p.img);
  document.getElementById("imagen-producto").alt = p.nombre;
  document.getElementById("imagen-producto").addEventListener('error', () => {
    document.getElementById("imagen-producto").src = IMG_VACIA;
  }, { once: true });

  const cantidadInput = document.getElementById("cantidad");
  cantidadInput.max = agotado ? 1 : stock;
  if (!cantidadInicializada) {
    cantidadInput.value = 1;
    cantidadInicializada = true;
  } else {
    // No resetea lo que la persona ya escribió; solo evita pedir más de lo que hay.
    cantidadInput.value = Math.max(1, Math.min(parseInt(cantidadInput.value, 10) || 1, agotado ? 1 : stock));
  }

  const avisoStock = document.getElementById("aviso-stock");
  if (avisoStock) {
    if (agotado) {
      avisoStock.textContent = 'Producto agotado por el momento.';
      avisoStock.style.display = '';
      avisoStock.className = 'aviso-stock agotado';
    } else if (stock <= stockMin) {
      avisoStock.textContent = `¡Últimas piezas! Solo quedan ${stock}.`;
      avisoStock.style.display = '';
      avisoStock.className = 'aviso-stock bajo';
    } else {
      avisoStock.style.display = 'none';
    }
  }

  document.querySelectorAll('.actions .add-to-cart, .actions .buy-now').forEach(btn => {
    btn.disabled = agotado;
    btn.style.opacity = agotado ? '.5' : '';
    btn.style.cursor = agotado ? 'not-allowed' : '';
  });

  // Similares: misma categoría, excluyendo el producto actual.
  const contenedor = document.getElementById("articulos-similares");
  const similares = todos
    .filter(x => x.id !== p.id && x.categoria === p.categoria)
    .slice(0, 4);

  contenedor.innerHTML = similares.map(x => `
    <div class="product-card">
      <img src="${esc(urlImagen(x.img))}" alt="${esc(x.nombre)}">
      <h4>${esc(x.nombre)}</h4>
      <p class="price">$${(Number(x.precio) || 0).toFixed(2)} MXN</p>
      <button class="ver-detalles" type="button"
        onclick="window.location.href='Producto.html?id=${encodeURIComponent(x.id)}'">
        Ver detalles
      </button>
    </div>
  `).join('');
  contenedor.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', () => { img.src = IMG_VACIA; }, { once: true });
  });
}

function pintarNoEncontrado() {
  const detalle = document.querySelector(".producto-detalle") || document.body;
  detalle.innerHTML = `
    <div style="text-align:center; padding: 4rem 1rem;">
      <h2>😥 Producto no encontrado</h2>
      <p>El producto que buscas no existe o el enlace está incorrecto.</p>
      <br>
      <button class="regresar" onclick="window.location.href='shop.html'">
        ← Volver al catálogo
      </button>
    </div>
  `;
}

escucharProductosScm(
  (lista) => {
    producto = lista.find(p => p.id === productoId) || null;
    if (producto) pintarProducto(producto, lista);
    else pintarNoEncontrado();
  },
  (err) => {
    console.error(err);
    mostrarToast("No se pudo cargar el producto. Revisa tu conexión.", "error");
  }
);
