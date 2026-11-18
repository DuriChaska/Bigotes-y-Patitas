// =============================================
// producto.js - Página de detalle de producto
// - Trae el producto real de Firestore (scm_productos) según "?id=" de la URL.
// - Galería con varias imágenes (campo "imagenes"; si no hay, usa "img").
// - Talla: otros productos con el mismo nombre y distinta talla aparecen como opciones.
// - Agregar al carrito, Comprar ahora (va directo a pagar) y Favoritos (requiere sesión).
// - Reseñas con huellitas (1 a 5) y preguntas que responde el personal de la tienda.
// =============================================

import {
  escucharProductosScm, observarSesionCliente, obtenerPerfilCliente,
  escucharResenas, guardarResena, eliminarResena,
  escucharPreguntas, crearPregunta, responderPregunta, eliminarPregunta,
  rolDelPanelActual, escucharFavoritos, agregarFavorito, quitarFavorito,
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
  const limpias = lista.filter((u) => typeof u === 'string' && u.trim()).map(urlImagen);
  return limpias.length ? [...new Set(limpias)] : [IMG_VACIA];
}

function mostrarToast(mensaje, tipo = 'success') {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 2800);
}

function obtenerCarrito() { try { return JSON.parse(localStorage.getItem("carrito") || "[]"); } catch { return []; } }
function guardarCarrito(c) {
  localStorage.setItem("carrito", JSON.stringify(c));
  window.dispatchEvent(new Event('actualizarCarrito'));
}

// "Nombre del producto, Talla" → "Nombre del producto"
const nombreBase = (n) => String(n || '').replace(/,\s*[^,]+$/, '').trim().toLowerCase();
function tallaDe(p) {
  if (p.talla) return String(p.talla);
  const m = /,\s*([^,]+)$/.exec(String(p.nombre || ''));
  return m ? m[1].trim() : 'Única';
}

const ORDEN_TALLAS = ['xs', 'extra chico', 'chico', 'mediano', 'grande', 'extra grande', 'xl'];
const ordenTalla = (t) => { const i = ORDEN_TALLAS.indexOf(String(t).toLowerCase()); return i < 0 ? 99 : i; };

function irALogin(mensaje) {
  const next = location.pathname.split('/').pop() + location.search;
  window.bpConfirmar(mensaje, { aceptar: 'Iniciar sesión', cancelar: 'Ahora no' }).then((si) => {
    if (si) location.href = 'login.html?next=' + encodeURIComponent(next);
  });
}

// ─── Estado ───
const productoId = new URLSearchParams(location.search).get('id');
let producto = null;
let todos = [];
let imagenes = [];
let actual = 0;
let usuario = null;
let nombreCliente = 'Cliente';
let rolPanel = '';
let favoritos = new Set();
let resenas = [];
let preguntas = [];
let filtroHuellas = 0;
let cancelarFavoritos = null;
let suscritoAOpiniones = false;

// ─── Galería ───
function pintarGaleria() {
  const lista = $('mini-lista');
  lista.innerHTML = imagenes.map((src, i) => `
    <button type="button" class="pd-mini${i === actual ? ' activa' : ''}" data-i="${i}" aria-label="Ver imagen ${i + 1}">
      <img src="${esc(src)}" alt="" loading="lazy" />
    </button>`).join('');
  lista.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => { img.src = IMG_VACIA; }, { once: true }));
  const varias = imagenes.length > 1;
  $('mini-arriba').hidden = !varias;
  $('mini-abajo').hidden = !varias;
  lista.closest('.pd-miniaturas').classList.toggle('sola', !varias);
  verImagen(actual);
}

function verImagen(i) {
  actual = (i + imagenes.length) % imagenes.length;
  const img = $('imagen-producto');
  img.src = imagenes[actual];
  img.alt = `${producto?.nombre || 'Producto'} - imagen ${actual + 1}`;
  document.querySelectorAll('.pd-mini').forEach((b, n) => b.classList.toggle('activa', n === actual));
  const activa = document.querySelector('.pd-mini.activa');
  activa?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (!$('visor').hidden) pintarVisor();
}

$('imagen-producto').addEventListener('error', (e) => { e.target.src = IMG_VACIA; });
$('mini-lista').addEventListener('click', (e) => {
  const b = e.target.closest('.pd-mini');
  if (b) verImagen(Number(b.dataset.i));
});
$('mini-arriba').addEventListener('click', () => verImagen(actual - 1));
$('mini-abajo').addEventListener('click', () => verImagen(actual + 1));

// Visor (imagen ampliada)
function pintarVisor() {
  $('visor-img').src = imagenes[actual];
  $('visor-img').alt = $('imagen-producto').alt;
  $('visor-cont').textContent = `${actual + 1} de ${imagenes.length}`;
  $('visor-izq').hidden = $('visor-der').hidden = imagenes.length < 2;
}
function abrirVisor() { pintarVisor(); $('visor').hidden = false; document.body.classList.add('pd-sin-scroll'); $('visor-cerrar').focus(); }
function cerrarVisor() { $('visor').hidden = true; document.body.classList.remove('pd-sin-scroll'); $('pd-foto').focus(); }
$('pd-foto').addEventListener('click', abrirVisor);
$('visor-cerrar').addEventListener('click', cerrarVisor);
$('visor-izq').addEventListener('click', () => verImagen(actual - 1));
$('visor-der').addEventListener('click', () => verImagen(actual + 1));
$('visor').addEventListener('click', (e) => { if (e.target.id === 'visor') cerrarVisor(); });

// ─── Modales ───
function abrirModal(id) {
  const m = $(id);
  m.hidden = false;
  document.body.classList.add('pd-sin-scroll');
  setTimeout(() => (m.querySelector('input, textarea, select') || m.querySelector('.pd-modal-cerrar'))?.focus(), 30);
}
function cerrarModal(m) { m.hidden = true; if ($('visor').hidden) document.body.classList.remove('pd-sin-scroll'); }
document.querySelectorAll('.pd-modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.pd-modal-cerrar')) cerrarModal(m); });
});
document.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => abrirModal(b.dataset.abrir)));

document.addEventListener('keydown', (e) => {
  if (!$('visor').hidden) {
    if (e.key === 'Escape') cerrarVisor();
    if (e.key === 'ArrowLeft') verImagen(actual - 1);
    if (e.key === 'ArrowRight') verImagen(actual + 1);
    return;
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.pd-modal:not([hidden])').forEach(cerrarModal);
    cerrarMenuCompartir();
  }
});

// Calculadora de talla
const TALLAS = [
  { talla: 'Chico', min: 33, max: 38 },
  { talla: 'Mediano', min: 41, max: 46 },
  { talla: 'Grande', min: 43, max: 48 },
];
$('btn-calcular').addEventListener('click', () => {
  const cm = parseFloat($('medida').value);
  const out = $('calc-resultado');
  if (!(cm > 0)) { out.textContent = 'Escribe la medida en centímetros.'; return; }
  const quedan = TALLAS.filter((t) => cm >= t.min && cm <= t.max).map((t) => t.talla);
  if (quedan.length) {
    out.innerHTML = `Te recomendamos talla <strong>${quedan.join(' o ')}</strong>.` +
      (quedan.length > 1 ? ' Si tu perrito es de pelo abundante, elige la más grande.' : '');
  } else if (cm < 33) {
    out.textContent = 'Es una medida más chica que nuestras tallas. Escríbenos y te ayudamos a encontrar una prenda.';
  } else if (cm > 48) {
    out.textContent = 'Es una medida más grande que nuestras tallas. Escríbenos y te ayudamos a encontrar una prenda.';
  } else {
    const cercana = TALLAS.reduce((a, b) => (Math.min(Math.abs(cm - a.min), Math.abs(cm - a.max)) <= Math.min(Math.abs(cm - b.min), Math.abs(cm - b.max)) ? a : b));
    out.innerHTML = `Queda entre dos tallas: te recomendamos <strong>${cercana.talla}</strong> o la siguiente más grande.`;
  }
});

// ─── Compartir ───
function cerrarMenuCompartir() { $('menu-compartir').hidden = true; $('btn-compartir').setAttribute('aria-expanded', 'false'); }
$('btn-compartir').addEventListener('click', async (e) => {
  e.stopPropagation();
  const url = location.href;
  const titulo = producto ? producto.nombre : document.title;
  if (navigator.share && matchMedia('(hover: none)').matches) {
    try { await navigator.share({ title: titulo, text: `Mira esto en Bigotes y Patitas: ${titulo}`, url }); } catch { /* cancelado */ }
    return;
  }
  const texto = encodeURIComponent(`Mira esto en Bigotes y Patitas: ${titulo}`);
  $('sh-whatsapp').href = `https://wa.me/?text=${texto}%20${encodeURIComponent(url)}`;
  $('sh-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  $('sh-x').href = `https://twitter.com/intent/tweet?text=${texto}&url=${encodeURIComponent(url)}`;
  const menu = $('menu-compartir');
  menu.hidden = !menu.hidden;
  $('btn-compartir').setAttribute('aria-expanded', String(!menu.hidden));
});
$('sh-copiar').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); mostrarToast('Enlace copiado'); }
  catch { window.bpPedirTexto ? window.bpPedirTexto('Copia este enlace:', { valor: location.href }) : mostrarToast('No se pudo copiar el enlace', 'error'); }
  cerrarMenuCompartir();
});
document.addEventListener('click', (e) => { if (!e.target.closest('.pd-compartir')) cerrarMenuCompartir(); });

// ─── Cantidad y carrito ───
function stockDe(p) { return Math.max(0, Number(p?.stock) || 0); }

document.querySelectorAll('[data-cant]').forEach((b) => b.addEventListener('click', () => {
  const input = $('cantidad');
  const tope = Math.max(1, stockDe(producto));
  input.value = Math.max(1, Math.min(tope, (parseInt(input.value, 10) || 1) + Number(b.dataset.cant)));
}));
$('cantidad').addEventListener('change', () => {
  const input = $('cantidad');
  input.value = Math.max(1, Math.min(Math.max(1, stockDe(producto)), parseInt(input.value, 10) || 1));
});

/** Devuelve true si se agregó. */
function agregarAlCarrito() {
  if (!producto) { mostrarToast('No se pudo agregar el producto', 'error'); return false; }
  const stock = stockDe(producto);
  if (stock <= 0) { mostrarToast('Ese producto está agotado', 'error'); return false; }
  const cantidad = Math.max(1, parseInt($('cantidad').value, 10) || 1);
  const carrito = obtenerCarrito();
  const existe = carrito.find((i) => i.id === producto.id);
  const ya = existe ? Number(existe.cantidad) || 0 : 0;
  if (ya + cantidad > stock) {
    mostrarToast(ya > 0 ? `Ya tienes ${ya} en tu carrito y solo hay ${stock} disponibles` : `Solo quedan ${stock} disponibles`, 'error');
    return false;
  }
  if (existe) existe.cantidad = ya + cantidad;
  else carrito.push({ id: producto.id, nombre: producto.nombre, precio: Number(producto.precio) || 0, imagen: imagenes[0] || producto.img || '', cantidad });
  guardarCarrito(carrito);
  mostrarToast(`¡Agregado! ${cantidad} × ${producto.nombre}`);
  return true;
}
$('btn-carrito').addEventListener('click', agregarAlCarrito);
$('barra-carrito').addEventListener('click', agregarAlCarrito);
$('btn-comprar').addEventListener('click', () => {
  if (!producto || stockDe(producto) <= 0) { mostrarToast('Ese producto está agotado', 'error'); return; }
  const yaEnCarrito = obtenerCarrito().some((i) => i.id === producto.id);
  if (agregarAlCarrito() || yaEnCarrito) location.href = 'Checkout.html';
});

// ─── Favoritos ───
function pintarFavorito() {
  const es = producto && favoritos.has(producto.id);
  const b = $('btn-favorito');
  b.classList.toggle('activo', !!es);
  b.setAttribute('aria-pressed', String(!!es));
  b.querySelector('span').textContent = es ? 'En tus favoritos' : 'Agregar a favoritos';
}
$('btn-favorito').addEventListener('click', async () => {
  if (!producto) return;
  if (!usuario) { irALogin('Inicia sesión para guardar tus favoritos.'); return; }
  const b = $('btn-favorito');
  b.disabled = true;
  try {
    if (favoritos.has(producto.id)) { await quitarFavorito(usuario.uid, producto.id); mostrarToast('Se quitó de tus favoritos'); }
    else { await agregarFavorito(usuario.uid, producto.id); mostrarToast('Guardado en tus favoritos ♥'); }
  } catch {
    mostrarToast('No se pudo actualizar tus favoritos. Intenta de nuevo.', 'error');
  } finally { b.disabled = false; }
});

// ─── Pintar producto ───
function pintarProducto() {
  const p = producto;
  const stock = stockDe(p);
  const stockMin = Number(p.stockMin) || 0;
  const agotado = stock <= 0;

  document.title = `${p.nombre} - Bigotes y Patitas`;
  $('pd-cargando').hidden = true;
  ['pd-principal', 'pd-garantias', 'pd-descripcion', 'pd-resenas'].forEach((id) => { $(id).hidden = false; });

  $('ruta-categoria').textContent = p.categoria || 'Productos';
  $('ruta-categoria').href = p.categoria ? `shop.html?categoria=${encodeURIComponent(p.categoria)}` : 'shop.html';
  $('ruta-nombre').textContent = p.nombre;
  $('nombre-producto').textContent = p.nombre;
  const marca = String(p.marca || 'Bigotes y Patitas');
  $('pd-marca').textContent = marca;
  $('precio-producto').textContent = dinero(p.precio);
  $('precio-caja').textContent = dinero(p.precio);

  // Galería (se conserva la imagen vista si el producto se actualiza en vivo)
  const nuevas = imagenesDe(p);
  if (nuevas.join('|') !== imagenes.join('|')) { imagenes = nuevas; actual = Math.min(actual, imagenes.length - 1); pintarGaleria(); }

  // Tallas: este producto y los que se llaman igual en otra talla
  const base = nombreBase(p.nombre);
  const variantes = todos.filter((x) => x.id === p.id || (base && nombreBase(x.nombre) === base && x.categoria === p.categoria));
  variantes.sort((a, b) => ordenTalla(tallaDe(a)) - ordenTalla(tallaDe(b)));
  $('variante').innerHTML = variantes.map((v) => {
    const sinStock = stockDe(v) <= 0 ? ' - Agotado' : '';
    return `<option value="${esc(v.id)}"${v.id === p.id ? ' selected' : ''}>${esc(tallaDe(v))}${sinStock}</option>`;
  }).join('');
  $('variante').disabled = variantes.length < 2;

  // Cantidad
  const input = $('cantidad');
  input.max = Math.max(1, stock);
  input.value = Math.max(1, Math.min(parseInt(input.value, 10) || 1, Math.max(1, stock)));

  // Disponibilidad
  const aviso = $('aviso-stock');
  if (agotado) { aviso.textContent = 'Agotado por el momento'; aviso.className = 'pd-disponible agotado'; }
  else if (stock <= stockMin) { aviso.textContent = `¡Últimas piezas! Solo quedan ${stock}`; aviso.className = 'pd-disponible bajo'; }
  else { aviso.textContent = 'Disponible'; aviso.className = 'pd-disponible'; }
  ['btn-carrito', 'btn-comprar', 'barra-carrito'].forEach((id) => { $(id).disabled = agotado; });
  $('entrega-envio').textContent = agotado ? 'Sin existencias por ahora.' : 'Llega en 3 a 5 días hábiles a todo México.';
  $('entrega-tienda').textContent = agotado ? 'Sin existencias por ahora.' : 'Disponible en: Bigotes y Patitas, Aguascalientes.';

  // Descripción y beneficios
  $('descripcion-producto').textContent = p.descripcion || 'Este producto aún no tiene descripción.';
  const beneficios = Array.isArray(p.beneficios) ? p.beneficios.filter((b) => String(b).trim()) : [];
  $('caja-beneficios').hidden = beneficios.length === 0;
  $('lista-beneficios').innerHTML = beneficios.map((b) => `<li>${esc(b)}</li>`).join('');

  // Barra fija
  $('barra-img').src = imagenes[0];
  $('barra-nombre').textContent = p.nombre;
  $('barra-precio').textContent = dinero(p.precio);

  $('resena-producto').textContent = p.nombre;
  pintarFavorito();
  pintarSimilares();
}

function pintarSimilares() {
  const base = nombreBase(producto.nombre);
  const lista = todos
    .filter((x) => x.id !== producto.id && x.categoria === producto.categoria && nombreBase(x.nombre) !== base)
    .sort((a, b) => (b.destacado === true) - (a.destacado === true) || (stockDe(b) > 0) - (stockDe(a) > 0))
    .slice(0, 8);
  $('pd-similares').hidden = lista.length === 0;
  $('articulos-similares').innerHTML = lista.map((x) => {
    const url = `Producto.html?id=${encodeURIComponent(x.id)}`;
    return `
      <article class="dest-item${stockDe(x) <= 0 ? ' agotado' : ''}">
        <a class="dest-foto" href="${url}" tabindex="-1" aria-hidden="true"><img src="${esc(imagenesDe(x)[0])}" alt="" loading="lazy" /></a>
        <h3 class="dest-nombre"><a href="${url}">${esc(x.nombre)}</a></h3>
        <p class="dest-precio">${dinero(x.precio)}</p>
      </article>`;
  }).join('');
  $('articulos-similares').querySelectorAll('img').forEach((img) => img.addEventListener('error', () => { img.src = IMG_VACIA; }, { once: true }));
}

$('variante').addEventListener('change', (e) => {
  if (e.target.value && e.target.value !== producto?.id) location.href = `Producto.html?id=${encodeURIComponent(e.target.value)}`;
});

function pintarNoEncontrado() {
  $('pd-cargando').innerHTML = `
    <h2>Producto no encontrado</h2>
    <p>El producto que buscas no existe o el enlace está incorrecto.</p>
    <a class="pd-btn pd-btn-carrito" href="shop.html" style="display:inline-block; width:auto; margin-top:16px; padding:12px 28px;">Volver al catálogo</a>`;
  $('pd-cargando').hidden = false;
  ['pd-principal', 'pd-garantias', 'pd-descripcion', 'pd-resenas', 'pd-similares'].forEach((id) => { $(id).hidden = true; });
}

// ─── Reseñas ───
const huellas = (n, clase = '') => Array.from({ length: 5 }, (_, i) =>
  `<svg class="pd-h ${i < Math.round(n) ? 'llena' : ''} ${clase}" aria-hidden="true"><use href="#pd-huella"/></svg>`).join('');
const fecha = (f) => {
  const d = f?.toDate ? f.toDate() : (f instanceof Date ? f : null);
  return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Hace un momento';
};

function pintarResenas() {
  const total = resenas.length;
  const suma = resenas.reduce((s, r) => s + (Number(r.huellitas) || 0), 0);
  const promedio = total ? suma / total : 0;
  const promTxt = total ? promedio.toFixed(1).replace('.0', '') : '0';

  $('resumen-linea').innerHTML = `${huellas(promedio)} <span>${promTxt} de 5 huellitas</span> | <a href="#panel-resenas" data-ir="resenas">(${total}) Reseñas</a>`;
  $('mini-resumen').innerHTML = `${huellas(promedio)} <span>${total ? `${promTxt} (${total})` : 'Sé el primero en opinar'}</span>`;
  $('huellas-general').innerHTML = huellas(promedio);
  $('promedio').textContent = promTxt;
  $('circulo').style.setProperty('--pct', `${(promedio / 5) * 100}%`);

  $('barras').innerHTML = [5, 4, 3, 2, 1].map((n) => {
    const c = resenas.filter((r) => Number(r.huellitas) === n).length;
    const pct = total ? Math.round((c / total) * 100) : 0;
    return `<button type="button" class="pd-barra-fila${filtroHuellas === n ? ' activa' : ''}" data-filtro="${n}" ${c ? '' : 'disabled'} aria-label="${n} huellitas: ${c} reseñas">
      <span>${n}</span><span class="pd-barra-pista"><span style="width:${pct}%"></span></span><span>${pct} %</span></button>`;
  }).join('');

  const visibles = filtroHuellas ? resenas.filter((r) => Number(r.huellitas) === filtroHuellas) : resenas;
  $('filtro-activo').hidden = !filtroHuellas;
  $('filtro-activo').innerHTML = filtroHuellas
    ? `Mostrando reseñas de ${filtroHuellas} huellita${filtroHuellas > 1 ? 's' : ''}. <button type="button" id="quitar-filtro">Ver todas</button>` : '';

  $('lista-resenas').innerHTML = visibles.length ? visibles.map((r) => `
    <article class="pd-opinion">
      <div class="pd-opinion-cab">${huellas(r.huellitas)}<strong>${esc(r.titulo || '')}</strong></div>
      <p>${esc(r.texto || '')}</p>
      <small>${esc(r.nombre || 'Cliente')} · ${fecha(r.fecha)}</small>
      ${usuario && (r.uid === usuario.uid || ['administrador', 'vendedor', 'soporte'].includes(rolPanel))
        ? `<button type="button" class="pd-link-borrar" data-borrar-resena="${esc(r.id)}">Eliminar</button>` : ''}
    </article>`).join('')
    : `<p class="pd-vacio">Todavía no hay reseñas. ¡Cuéntanos qué tal le quedó a tu peludito!</p>`;
}

$('barras').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (!b) return;
  const n = Number(b.dataset.filtro);
  filtroHuellas = filtroHuellas === n ? 0 : n;
  mostrarPestana('resenas');
  pintarResenas();
});
document.addEventListener('click', (e) => {
  if (e.target.id === 'quitar-filtro') { filtroHuellas = 0; pintarResenas(); }
  const ir = e.target.closest('[data-ir]');
  if (ir) mostrarPestana(ir.dataset.ir);
});
$('lista-resenas').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-borrar-resena]');
  if (!b) return;
  if (!(await window.bpConfirmar('¿Eliminar esta reseña?', { peligro: true, aceptar: 'Eliminar' }))) return;
  try { await eliminarResena(b.dataset.borrarResena); mostrarToast('Reseña eliminada'); }
  catch { mostrarToast('No se pudo eliminar la reseña.', 'error'); }
});

// Formulario de reseña
let huellasElegidas = 0;
function pintarElegirHuellas() {
  $('elegir-huellas').innerHTML = [1, 2, 3, 4, 5].map((n) => `
    <button type="button" role="radio" aria-checked="${huellasElegidas === n}" aria-label="${n} huellita${n > 1 ? 's' : ''}" data-n="${n}"
      class="${n <= huellasElegidas ? 'llena' : ''}"><svg><use href="#pd-huella"/></svg></button>`).join('') +
    `<span>${['Elige de 1 a 5', 'No me gustó', 'Regular', 'Está bien', 'Me gustó', '¡Me encantó!'][huellasElegidas]}</span>`;
}
$('elegir-huellas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-n]');
  if (b) { huellasElegidas = Number(b.dataset.n); pintarElegirHuellas(); }
});
$('btn-escribir').addEventListener('click', () => {
  if (!usuario) { irALogin('Inicia sesión para escribir una reseña.'); return; }
  if (resenas.some((r) => r.uid === usuario.uid)) { mostrarToast('Ya escribiste una reseña de este producto', 'error'); return; }
  huellasElegidas = 0; pintarElegirHuellas();
  $('r-titulo').value = ''; $('r-texto').value = ''; $('r-error').textContent = '';
  abrirModal('modal-resena');
});
$('form-resena').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('r-error');
  if (!huellasElegidas) { err.textContent = 'Elige cuántas huellitas le das.'; return; }
  if ($('r-texto').value.trim().length < 5) { err.textContent = 'Cuéntanos un poco más en tu opinión.'; $('r-texto').focus(); return; }
  err.textContent = '';
  $('r-enviar').disabled = true;
  try {
    await guardarResena(producto.id, { nombre: nombreCliente, huellitas: huellasElegidas, titulo: $('r-titulo').value, texto: $('r-texto').value });
    cerrarModal($('modal-resena'));
    mostrarToast('¡Gracias! Tu reseña ya está publicada');
    mostrarPestana('resenas');
  } catch (ex) {
    err.textContent = ex.code?.startsWith('bp/') ? ex.message : 'No se pudo publicar tu reseña. Intenta de nuevo.';
  } finally { $('r-enviar').disabled = false; }
});

// ─── Preguntas ───
function pintarPreguntas() {
  const puedeResponder = ['administrador', 'vendedor', 'soporte'].includes(rolPanel);
  $('tab-preguntas').textContent = `Preguntas${preguntas.length ? ` (${preguntas.length})` : ''}`;
  $('lista-preguntas').innerHTML = preguntas.length ? preguntas.map((q) => `
    <article class="pd-opinion">
      <p class="pd-pregunta-txt"><strong>P:</strong> ${esc(q.texto)}</p>
      <small>${esc(q.nombre || 'Cliente')} · ${fecha(q.fecha)}</small>
      ${q.respuesta
        ? `<div class="pd-respuesta"><strong>R:</strong> ${esc(q.respuesta)}<small>${esc(q.respondidoPor || 'Bigotes y Patitas')} · ${fecha(q.respondidaEn)}</small></div>`
        : (puedeResponder
          ? `<form class="pd-responder" data-responder="${esc(q.id)}"><textarea maxlength="1000" rows="2" placeholder="Escribe la respuesta…"></textarea><button type="submit" class="pd-btn pd-btn-carrito">Responder</button></form>`
          : '<p class="pd-sin-respuesta">Aún sin respuesta. Te avisamos aquí en cuanto la tengamos.</p>')}
      ${usuario && (q.uid === usuario.uid || puedeResponder)
        ? `<button type="button" class="pd-link-borrar" data-borrar-pregunta="${esc(q.id)}">Eliminar</button>` : ''}
    </article>`).join('')
    : '<p class="pd-vacio">Nadie ha preguntado nada todavía. ¿Tienes alguna duda? ¡Pregúntanos!</p>';
}

$('lista-preguntas').addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-responder]');
  if (!f) return;
  e.preventDefault();
  const texto = f.querySelector('textarea').value.trim();
  if (!texto) return;
  f.querySelector('button').disabled = true;
  try { await responderPregunta(f.dataset.responder, texto, 'Bigotes y Patitas'); mostrarToast('Respuesta publicada'); }
  catch { mostrarToast('No se pudo publicar la respuesta.', 'error'); f.querySelector('button').disabled = false; }
});
$('lista-preguntas').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-borrar-pregunta]');
  if (!b) return;
  if (!(await window.bpConfirmar('¿Eliminar esta pregunta?', { peligro: true, aceptar: 'Eliminar' }))) return;
  try { await eliminarPregunta(b.dataset.borrarPregunta); mostrarToast('Pregunta eliminada'); }
  catch { mostrarToast('No se pudo eliminar la pregunta.', 'error'); }
});

$('btn-preguntar').addEventListener('click', () => {
  if (!usuario) { irALogin('Inicia sesión para hacer una pregunta.'); return; }
  $('p-texto').value = ''; $('p-error').textContent = '';
  abrirModal('modal-pregunta');
});
$('form-pregunta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = $('p-texto').value.trim();
  if (texto.length < 5) { $('p-error').textContent = 'Escribe tu pregunta.'; return; }
  $('p-enviar').disabled = true;
  try {
    await crearPregunta(producto.id, { nombre: nombreCliente, texto });
    cerrarModal($('modal-pregunta'));
    mostrarToast('¡Listo! Te responderemos pronto');
    mostrarPestana('preguntas');
  } catch (ex) {
    $('p-error').textContent = ex.code?.startsWith('bp/') ? ex.message : 'No se pudo enviar tu pregunta. Intenta de nuevo.';
  } finally { $('p-enviar').disabled = false; }
});

// Pestañas
function mostrarPestana(cual) {
  const res = cual === 'resenas';
  $('panel-resenas').hidden = !res;
  $('panel-preguntas').hidden = res;
  $('tab-resenas').classList.toggle('activa', res);
  $('tab-preguntas').classList.toggle('activa', !res);
  $('tab-resenas').setAttribute('aria-selected', String(res));
  $('tab-preguntas').setAttribute('aria-selected', String(!res));
}
$('tab-resenas').addEventListener('click', () => mostrarPestana('resenas'));
$('tab-preguntas').addEventListener('click', () => mostrarPestana('preguntas'));

function suscribirOpiniones() {
  if (suscritoAOpiniones) return;
  suscritoAOpiniones = true;
  escucharResenas(producto.id, (l) => { resenas = l; pintarResenas(); }, () => { $('lista-resenas').innerHTML = '<p class="pd-vacio">No se pudieron cargar las reseñas.</p>'; });
  escucharPreguntas(producto.id, (l) => { preguntas = l; pintarPreguntas(); }, () => { $('lista-preguntas').innerHTML = '<p class="pd-vacio">No se pudieron cargar las preguntas.</p>'; });
}

// ─── Barra fija ───
const barra = $('pd-barra');
new IntersectionObserver(([entrada]) => {
  const ver = !entrada.isIntersecting && entrada.boundingClientRect.top < 0 && !!producto;
  barra.classList.toggle('visible', ver);
  document.body.classList.toggle('pd-con-barra', ver);
  barra.setAttribute('aria-hidden', String(!ver));
  $('barra-carrito').tabIndex = ver ? 0 : -1;
}).observe($('pd-compra'));

// ─── Sesión ───
observarSesionCliente(async (user) => {
  usuario = user;
  if (cancelarFavoritos) { cancelarFavoritos(); cancelarFavoritos = null; }
  favoritos = new Set();
  rolPanel = '';
  nombreCliente = user?.displayName || 'Cliente';
  if (user) {
    rolPanel = await rolDelPanelActual();
    if (!rolPanel) {
      try { const perfil = await obtenerPerfilCliente(user.uid); if (perfil?.nombre) nombreCliente = perfil.nombre; } catch { /* sin perfil */ }
    }
    if (usuario === user) {
      cancelarFavoritos = escucharFavoritos(user.uid, (l) => { favoritos = new Set(l.map((f) => f.productoId || f.id)); pintarFavorito(); }, () => {});
    }
  }
  pintarFavorito();
  if (producto) { pintarResenas(); pintarPreguntas(); }
});

// ─── Catálogo ───
escucharProductosScm(
  (lista) => {
    todos = lista;
    producto = lista.find((p) => p.id === productoId) || null;
    if (!producto) { pintarNoEncontrado(); return; }
    pintarProducto();
    suscribirOpiniones();
  },
  () => { mostrarToast('No se pudo cargar el producto. Revisa tu conexión.', 'error'); }
);
