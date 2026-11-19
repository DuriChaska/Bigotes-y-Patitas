// =============================================
// carpeta.js - Página "Carpeta" (colección exclusiva)
// Muestra el producto marcado en el panel con "Mostrar en Carpeta" (campo carpeta: true).
// Si hay varios, el más reciente sale como pieza principal y los demás abajo.
// Las reseñas son las reales de ese producto (colección "resenas").
// =============================================

import {
  escucharProductosScm, escucharResenas, observarSesionCliente,
  escucharFavoritos, agregarFavorito, quitarFavorito,
} from './firebase-db.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
function imagenesDe(p) {
  const lista = Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : [p.img];
  const limpias = [...new Set(lista.filter((u) => typeof u === 'string' && u.trim()).map(urlImagen))];
  return limpias.length ? limpias : [IMG_VACIA];
}
function fechaAlta(p) {
  const f = p?.creadoEn;
  if (!f) return 0;
  if (typeof f.toMillis === 'function') return f.toMillis();
  if (f instanceof Date) return f.getTime();
  if (typeof f.seconds === 'number') return f.seconds * 1000;
  return Number(new Date(f)) || 0;
}
const fechaTexto = (f) => {
  const d = f?.toDate ? f.toDate() : (f instanceof Date ? f : (f ? new Date(f) : null));
  return d && !isNaN(d) ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
};
const stockDe = (p) => Math.max(0, Number(p?.stock) || 0);
const huellitas = (n, clase = 'cp-h') => Array.from({ length: 5 }, (_, i) =>
  `<svg class="${clase}${i < Math.round(n) ? ' llena' : ''}" aria-hidden="true"><use href="#cp-huella"/></svg>`).join('');

function mostrarToast(mensaje, tipo = 'success') {
  const c = $('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${tipo}`; t.textContent = mensaje;
  c.appendChild(t);
  setTimeout(() => t.classList.add('show'), 80);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2800);
}
function obtenerCarrito() { try { return JSON.parse(localStorage.getItem('carrito') || '[]'); } catch { return []; } }
function guardarCarrito(c) { localStorage.setItem('carrito', JSON.stringify(c)); window.dispatchEvent(new Event('actualizarCarrito')); }

// ─── Estado ───
let productos = [];
let pieza = null;
let fotoActual = 0;
let resenas = [];
let cancelarResenas = null;
let usuario = null;
let favoritos = new Set();
let cancelarFavoritos = null;

function agregar(id, cantidad = 1) {
  const p = productos.find((x) => x.id === id);
  if (!p) { mostrarToast('Producto no encontrado', 'error'); return false; }
  const stock = stockDe(p);
  if (stock <= 0) { mostrarToast('Esta pieza está agotada', 'error'); return false; }
  const carrito = obtenerCarrito();
  const existe = carrito.find((i) => i.id === id);
  const ya = existe ? Number(existe.cantidad) || 0 : 0;
  if (ya + cantidad > stock) { mostrarToast(ya ? `Ya tienes ${ya} en tu carrito y solo hay ${stock}` : `Solo quedan ${stock}`, 'error'); return false; }
  if (existe) existe.cantidad = ya + cantidad;
  else carrito.push({ id: p.id, nombre: p.nombre, precio: Number(p.precio) || 0, imagen: imagenesDe(p)[0], cantidad });
  guardarCarrito(carrito);
  mostrarToast(`¡Agregado! ${cantidad} × ${p.nombre}`);
  return true;
}
window.agregarAlCarrito = (id) => agregar(id);

// ─── Pieza principal ───
function pintarPieza() {
  const caja = $('cp-pieza');
  if (!pieza) {
    caja.innerHTML = `<div class="cp-vacio">
      <h2 class="cp-titulo">Muy pronto…</h2>
      <p>Estamos preparando nuestra próxima colección exclusiva. Mientras tanto, mira todo el catálogo.</p>
      <a class="cp-btn cp-btn-carrito" href="shop.html">Ver catálogo</a></div>`;
    $('cp-resenas').hidden = true;
    return;
  }
  const p = pieza;
  const fotos = imagenesDe(p);
  fotoActual = Math.min(fotoActual, fotos.length - 1);
  const stock = stockDe(p);
  const agotado = stock <= 0;
  const bajo = !agotado && stock <= (Number(p.stockMin) || 0);
  const url = `Producto.html?id=${encodeURIComponent(p.id)}`;
  const beneficios = (Array.isArray(p.beneficios) ? p.beneficios : []).filter(Boolean);
  const total = resenas.length;
  const prom = total ? resenas.reduce((s, r) => s + (Number(r.huellitas) || 0), 0) / total : 0;
  const fav = favoritos.has(p.id);

  caja.innerHTML = `
    <article class="cp-tarjeta">
      <div class="cp-galeria">
        <div class="cp-foto">
          <span class="cp-sello"><svg><use href="#cp-huella"/></svg>Edición limitada</span>
          <button type="button" class="cat-fav cp-fav${fav ? ' activo' : ''}" id="cp-fav" aria-pressed="${fav}" aria-label="${fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
            <svg><use href="#cp-corazon"/></svg>
          </button>
          <img id="cp-img" src="${esc(fotos[fotoActual])}" alt="${esc(p.nombre)}" />
        </div>
        ${fotos.length > 1 ? `<div class="cp-minis">${fotos.map((f, i) => `
          <button type="button" class="cp-mini${i === fotoActual ? ' activa' : ''}" data-foto="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(f)}" alt="" /></button>`).join('')}</div>` : ''}
      </div>
      <div class="cp-info">
        <p class="cp-marca">${esc(p.marca || 'Bigotes y Patitas')}</p>
        <h2 class="cp-nombre">${esc(p.nombre)}</h2>
        <a class="cp-cal" href="#cp-resenas">${huellitas(prom)}<span>${total ? `${prom.toFixed(1).replace('.0', '')} (${total} reseña${total > 1 ? 's' : ''})` : 'Sé la primera en opinar'}</span></a>
        <p class="cp-precio">${dinero(p.precio)}</p>
        <p class="cp-stock ${agotado ? 'agotado' : bajo ? 'bajo' : ''}">${agotado ? 'Agotado por ahora' : bajo ? `¡Solo quedan ${stock}!` : 'Disponible · pocas unidades'}</p>
        ${p.talla ? `<p class="cp-talla"><strong>Talla:</strong> ${esc(p.talla)} · <a href="${url}">Ver guía de tallas</a></p>` : ''}
        <p class="cp-desc">${esc(p.descripcion || '')}</p>
        ${beneficios.length ? `<ul class="cp-beneficios">${beneficios.slice(0, 5).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        <div class="cp-botones">
          <button type="button" class="cp-btn cp-btn-carrito" id="cp-agregar" ${agotado ? 'disabled' : ''}>Agregar al carrito</button>
          <button type="button" class="cp-btn cp-btn-comprar" id="cp-comprar" ${agotado ? 'disabled' : ''}>Comprar ahora</button>
        </div>
        <a class="cp-detalles" href="${url}">Ver todos los detalles →</a>
      </div>
    </article>`;
  $('cp-img').addEventListener('error', (e) => { e.target.src = IMG_VACIA; }, { once: true });
  $('cp-agregar').addEventListener('click', () => agregar(p.id));
  $('cp-comprar').addEventListener('click', () => {
    const yaEnCarrito = obtenerCarrito().some((i) => i.id === p.id);
    if (agregar(p.id) || yaEnCarrito) location.href = 'Checkout.html';
  });
  caja.querySelectorAll('[data-foto]').forEach((b) => b.addEventListener('click', () => {
    fotoActual = Number(b.dataset.foto);
    $('cp-img').src = fotos[fotoActual];
    caja.querySelectorAll('.cp-mini').forEach((m, i) => m.classList.toggle('activa', i === fotoActual));
  }));
  $('cp-fav').addEventListener('click', alternarFavorito);

  // Portada con la foto de la pieza
  $('hero-img').src = fotos[0];
  $('hero-img').alt = p.nombre;
}

async function alternarFavorito() {
  if (!pieza) return;
  if (!usuario) {
    const si = await window.bpConfirmar('Inicia sesión para guardar tus favoritos.', { aceptar: 'Iniciar sesión', cancelar: 'Ahora no' });
    if (si) location.href = 'login.html?next=carpeta.html';
    return;
  }
  try {
    if (favoritos.has(pieza.id)) { await quitarFavorito(usuario.uid, pieza.id); mostrarToast('Se quitó de tus favoritos'); }
    else { await agregarFavorito(usuario.uid, pieza.id); mostrarToast('Guardado en tus favoritos ♥'); }
  } catch { mostrarToast('No se pudo actualizar tus favoritos', 'error'); }
}

// ─── Reseñas reales ───
function pintarResenas() {
  $('cp-resenas').hidden = !pieza;
  if (!pieza) return;
  const url = `Producto.html?id=${encodeURIComponent(pieza.id)}#pd-resenas`;
  const lista = resenas.slice(0, 6);
  $('lista-resenas').innerHTML = lista.length ? lista.map((r) => `
    <article class="cp-resena">
      <div class="cp-resena-huellas">${huellitas(r.huellitas)}</div>
      ${r.titulo ? `<h3>${esc(r.titulo)}</h3>` : ''}
      <p>“${esc(r.texto)}”</p>
      <span>— ${esc(r.nombre || 'Cliente')}${fechaTexto(r.fecha) ? ` · ${fechaTexto(r.fecha)}` : ''}</span>
    </article>`).join('') + (resenas.length > 6 ? `<a class="cp-detalles cp-todas" href="${url}">Ver las ${resenas.length} reseñas →</a>` : '')
    : `<article class="cp-resena cp-resena-vacia">
        <div class="cp-resena-huellas">${huellitas(0)}</div>
        <p>Todavía no hay reseñas de esta pieza.<br>¿Ya la tiene tu peludita? ¡Cuéntanos cómo le quedó!</p>
        <a class="cp-btn cp-btn-carrito" href="${url}">Escribir una reseña</a>
      </article>`;
}

// ─── Más de la colección ───
function pintarMas() {
  const otros = productos
    .filter((p) => p.id !== pieza?.id && (p.carpeta === true || p.categoria === 'Ediciones limitadas'))
    .sort((a, b) => (b.carpeta === true) - (a.carpeta === true) || fechaAlta(b) - fechaAlta(a))
    .slice(0, 8);
  $('cp-mas').hidden = otros.length === 0;
  $('pista-mas').innerHTML = otros.map((p) => {
    const url = `Producto.html?id=${encodeURIComponent(p.id)}`;
    return `<article class="dest-item${stockDe(p) <= 0 ? ' agotado' : ''}">
      <a class="dest-foto" href="${url}" tabindex="-1" aria-hidden="true"><img src="${esc(imagenesDe(p)[0])}" alt="" loading="lazy" /></a>
      <h3 class="dest-nombre"><a href="${url}">${esc(p.nombre)}</a></h3>
      <p class="dest-precio">${dinero(p.precio)}</p>
      <button type="button" class="dest-agregar" ${stockDe(p) <= 0 ? 'disabled' : ''} onclick="agregarAlCarrito('${esc(p.id)}')">${stockDe(p) <= 0 ? 'Agotado' : 'Agregar al carrito'}</button>
    </article>`;
  }).join('');
}

// ─── Datos ───
escucharProductosScm((lista) => {
  productos = lista;
  const enCarpeta = lista.filter((p) => p.carpeta === true).sort((a, b) => fechaAlta(b) - fechaAlta(a));
  const nueva = enCarpeta[0] || null;
  if (nueva?.id !== pieza?.id) {
    fotoActual = 0;
    resenas = [];
    if (cancelarResenas) { cancelarResenas(); cancelarResenas = null; }
    if (nueva) cancelarResenas = escucharResenas(nueva.id, (l) => { resenas = l; pintarPieza(); pintarResenas(); }, () => {});
  }
  pieza = nueva;
  pintarPieza();
  pintarResenas();
  pintarMas();
}, () => {
  $('cp-pieza').innerHTML = '<p class="cp-cargando">No se pudo cargar la colección. Revisa tu conexión.</p>';
});

observarSesionCliente((user) => {
  usuario = user;
  if (cancelarFavoritos) { cancelarFavoritos(); cancelarFavoritos = null; }
  favoritos = new Set();
  if (user) cancelarFavoritos = escucharFavoritos(user.uid, (l) => { favoritos = new Set(l.map((f) => f.productoId || f.id)); if (pieza) pintarPieza(); }, () => {});
  if (pieza) pintarPieza();
});
