// =============================================
// catalogo.js - Catálogo de la tienda (shop.html)
// - Filtros a la izquierda: buscador por texto, novedades, categorías,
//   para quién, talla, marca, precio (escrito o rápido) y disponibilidad.
// - Vista en cuadrícula o en lista, y orden (destacados, nuevos, calificación,
//   nombre, precio).
// - Tarjetas con varias fotos, favoritos, huellitas de las reseñas,
//   "NUEVO", "Más tallas disponibles" y agregar al carrito.
// Parámetros de la URL: ?categoria=Perros  ?buscar=suéter
// =============================================

import {
  escucharProductosScm, escucharTodasLasResenas, observarSesionCliente,
  escucharFavoritos, agregarFavorito, quitarFavorito,
} from './firebase-db.js';
import { CATEGORIAS } from './scm-config.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const IMG_VACIA = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#f1ece1"/>' +
  '<text x="150" y="155" font-family="sans-serif" font-size="24" font-weight="700" text-anchor="middle" fill="#8a7d6b">Bigotes y Patitas</text></svg>');

const DIAS_NUEVO = 30;

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
  return limpias.length ? limpias.slice(0, 6) : [IMG_VACIA];
}
function fechaAlta(p) {
  const f = p.creadoEn;
  if (!f) return 0;
  if (typeof f.toMillis === 'function') return f.toMillis();
  if (f instanceof Date) return f.getTime();
  if (typeof f.seconds === 'number') return f.seconds * 1000;
  return Number(new Date(f)) || 0;
}
const esNuevo = (p) => fechaAlta(p) > Date.now() - DIAS_NUEVO * 86400000;
const stockDe = (p) => Math.max(0, Number(p.stock) || 0);
const marcaDe = (p) => String(p.marca || '').trim() || 'Bigotes y Patitas';
const paraDe = (p) => (p.paraQuien === 'Ellas' || p.paraQuien === 'Ellos') ? p.paraQuien : 'Ambos';
const nombreBase = (n) => normal(String(n || '').replace(/,\s*[^,]+$/, ''));
const RE_TALLA = /^(x{0,3}-?\s?(chico|grande)|mediano|unica|única|xs|s|m|l|xl|xxl)$/i;
function tallaDe(p) {
  if (p.talla) return String(p.talla).trim();
  const m = /,\s*([^,]+)$/.exec(String(p.nombre || ''));
  return m && RE_TALLA.test(m[1].trim()) ? m[1].trim() : '';
}
const ORDEN_TALLAS = ['xx-chico', 'x-chico', 'chico', 'mediano', 'grande', 'x-grande', 'xx-grande', 'xxx-grande', 'unica', 'única'];
const ordenTalla = (t) => { const i = ORDEN_TALLAS.indexOf(normal(t).replace(/\s/g, '')); return i < 0 ? 50 : i; };
const capital = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;

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

// ─── Estado ───
let productos = [];
let cargado = false;
let calificaciones = new Map();      // productoId → { suma, n }
let usuario = null;
let favoritos = new Set();
let cancelarFavoritos = null;
const fotoActual = new Map();        // productoId → índice de la foto visible

const parametros = new URLSearchParams(location.search);
const filtros = {
  texto: parametros.get('buscar') || '',
  nuevos: false,
  categorias: new Set(CATEGORIAS.includes(parametros.get('categoria')) ? [parametros.get('categoria')] : []),
  para: new Set(),
  tallas: new Set(),
  marcas: new Set(),
  precio: '',
  disponibles: false,
};
let vista = 'cuadros';
try { vista = localStorage.getItem('bpVistaCatalogo') === 'lista' ? 'lista' : 'cuadros'; } catch { /* sin almacenamiento */ }
$('buscar').value = filtros.texto;

// ─── Precio escrito: "299" (hasta), "250-400", "<300", ">=500" ───
function reglaPrecio(raw) {
  const q = String(raw || '').trim().replace(/\s+/g, '').replace(/\$/g, '');
  if (!q) return null;
  let m = q.match(/^(\d+\.?\d*)-(\d+\.?\d*)$/);
  if (m) { const [a, b] = [parseFloat(m[1]), parseFloat(m[2])]; return (p) => p >= Math.min(a, b) && p <= Math.max(a, b); }
  m = q.match(/^-(\d+\.?\d*)$/);
  if (m) { const v = parseFloat(m[1]); return (p) => p <= v; }
  m = q.match(/^(<=|>=|<|>)(\d+\.?\d*)$/);
  if (m) { const v = parseFloat(m[2]); return { '<=': (p) => p <= v, '>=': (p) => p >= v, '<': (p) => p < v, '>': (p) => p > v }[m[1]]; }
  m = q.match(/^(\d+\.?\d*)$/);
  if (m) { const v = parseFloat(m[1]); return (p) => p <= v; }
  return undefined;   // no se entendió
}

function cumple(p, ignorar = '') {
  if (filtros.texto && ignorar !== 'texto') {
    const texto = normal([p.nombre, p.descripcion, marcaDe(p), p.categoria, tallaDe(p), ...(p.beneficios || [])].join(' '));
    if (!normal(filtros.texto).split(/\s+/).filter(Boolean).every((w) => texto.includes(w))) return false;
  }
  if (filtros.nuevos && ignorar !== 'nuevos' && !esNuevo(p)) return false;
  if (filtros.categorias.size && ignorar !== 'categoria' && !filtros.categorias.has(p.categoria)) return false;
  if (filtros.para.size && ignorar !== 'para') {
    const q = paraDe(p);
    if (q !== 'Ambos' && !filtros.para.has(q)) return false;
  }
  if (filtros.tallas.size && ignorar !== 'talla' && !filtros.tallas.has(capital(normal(tallaDe(p))))) return false;
  if (filtros.marcas.size && ignorar !== 'marca' && !filtros.marcas.has(marcaDe(p))) return false;
  if (filtros.precio && ignorar !== 'precio') {
    const regla = reglaPrecio(filtros.precio);
    if (regla && !regla(Number(p.precio) || 0)) return false;
  }
  if (filtros.disponibles && ignorar !== 'disponible' && stockDe(p) <= 0) return false;
  return true;
}

function promedio(p) {
  const c = calificaciones.get(p.id);
  return c && c.n ? c.suma / c.n : 0;
}

function ordenar(lista) {
  const orden = $('orden').value;
  const precio = (p) => Number(p.precio) || 0;
  const porDefecto = (a, b) => (b.destacado === true) - (a.destacado === true)
    || (stockDe(b) > 0) - (stockDe(a) > 0) || fechaAlta(b) - fechaAlta(a);
  const reglas = {
    destacados: porDefecto,
    nuevos: (a, b) => fechaAlta(b) - fechaAlta(a) || porDefecto(a, b),
    calificados: (a, b) => promedio(b) - promedio(a) || (calificaciones.get(b.id)?.n || 0) - (calificaciones.get(a.id)?.n || 0) || porDefecto(a, b),
    'nombre-asc': (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'),
    'nombre-desc': (a, b) => String(b.nombre).localeCompare(String(a.nombre), 'es'),
    'precio-asc': (a, b) => precio(a) - precio(b),
    'precio-desc': (a, b) => precio(b) - precio(a),
  };
  return [...lista].sort(reglas[orden] || porDefecto);
}

// ─── Filtros (lado izquierdo) ───
function casillas(contId, opciones, seleccion, grupo) {
  $(contId).innerHTML = opciones.length ? opciones.map(({ valor, etiqueta, n }) => `
    <label class="cat-casilla${n ? '' : ' vacia'}">
      <input type="checkbox" data-grupo="${grupo}" value="${esc(valor)}" ${seleccion(valor) ? 'checked' : ''} />
      <span class="cat-caja"></span><span class="cat-etiqueta">${esc(etiqueta)}</span><span class="cat-num">(${n})</span>
    </label>`).join('') : '<p class="cat-ayuda">Sin opciones todavía.</p>';
}

function contar(grupo, prueba) { return productos.filter((p) => cumple(p, grupo) && prueba(p)).length; }

function pintarFiltros() {
  casillas('f-novedades', [
    { valor: 'nuevos', etiqueta: `Lo más nuevo (${DIAS_NUEVO} días)`, n: contar('nuevos', esNuevo) },
  ], () => filtros.nuevos, 'nuevos');

  const cats = [...new Set([...CATEGORIAS, ...productos.map((p) => p.categoria).filter(Boolean)])];
  casillas('f-categoria', cats.map((c) => ({ valor: c, etiqueta: c, n: contar('categoria', (p) => p.categoria === c) })),
    (v) => filtros.categorias.has(v), 'categoria');

  casillas('f-para', [
    { valor: 'Ellas', etiqueta: 'Para ellas', n: contar('para', (p) => paraDe(p) !== 'Ellos') },
    { valor: 'Ellos', etiqueta: 'Para ellos', n: contar('para', (p) => paraDe(p) !== 'Ellas') },
  ], (v) => filtros.para.has(v), 'para');

  const tallas = [...new Set(productos.map((p) => capital(normal(tallaDe(p)))).filter(Boolean))].sort((a, b) => ordenTalla(a) - ordenTalla(b));
  casillas('f-talla', tallas.map((t) => ({ valor: t, etiqueta: t, n: contar('talla', (p) => capital(normal(tallaDe(p))) === t) })),
    (v) => filtros.tallas.has(v), 'talla');

  const marcas = [...new Set(productos.map(marcaDe))].sort((a, b) => a.localeCompare(b, 'es'));
  casillas('f-marca', marcas.map((m) => ({ valor: m, etiqueta: m, n: contar('marca', (p) => marcaDe(p) === m) })),
    (v) => filtros.marcas.has(v), 'marca');

  casillas('f-disponible', [
    { valor: 'si', etiqueta: 'Solo con existencias', n: contar('disponible', (p) => stockDe(p) > 0) },
  ], () => filtros.disponibles, 'disponible');

  document.querySelectorAll('#f-precio-rapido [data-precio]').forEach((b) => b.classList.toggle('activa', b.dataset.precio === filtros.precio));
  $('precio').classList.toggle('mal', !!filtros.precio && reglaPrecio(filtros.precio) === undefined);
}

function chipsActivos() {
  const chips = [];
  if (filtros.texto) chips.push(['texto', '', `“${filtros.texto}”`]);
  if (filtros.nuevos) chips.push(['nuevos', '', 'Lo más nuevo']);
  filtros.categorias.forEach((c) => chips.push(['categoria', c, c]));
  filtros.para.forEach((c) => chips.push(['para', c, c === 'Ellas' ? 'Para ellas' : 'Para ellos']));
  filtros.tallas.forEach((c) => chips.push(['talla', c, `Talla ${c}`]));
  filtros.marcas.forEach((c) => chips.push(['marca', c, c]));
  if (filtros.precio) chips.push(['precio', '', `Precio: ${filtros.precio}`]);
  if (filtros.disponibles) chips.push(['disponible', '', 'Con existencias']);
  $('filtros-activos').innerHTML = chips.map(([g, v, t]) =>
    `<button type="button" class="cat-chip" data-quitar="${g}" data-valor="${esc(v)}">${esc(t)} <span aria-hidden="true">×</span><span class="sr-solo">Quitar filtro</span></button>`).join('')
    + (chips.length > 1 ? '<button type="button" class="cat-chip limpiar" data-quitar="todo">Limpiar todo</button>' : '');
  $('num-filtros').textContent = chips.length ? `(${chips.length})` : '';
}

const conjuntos = { categoria: 'categorias', para: 'para', talla: 'tallas', marca: 'marcas' };

document.addEventListener('change', (e) => {
  const c = e.target.closest('input[data-grupo]');
  if (!c) return;
  const g = c.dataset.grupo;
  if (g === 'nuevos') filtros.nuevos = c.checked;
  else if (g === 'disponible') filtros.disponibles = c.checked;
  else if (conjuntos[g]) { const s = filtros[conjuntos[g]]; c.checked ? s.add(c.value) : s.delete(c.value); }
  pintar();
});

$('filtros-activos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-quitar]');
  if (!b) return;
  quitarFiltro(b.dataset.quitar, b.dataset.valor);
});
function quitarFiltro(g, v) {
  if (g === 'todo') return limpiarTodo();
  if (g === 'texto') { filtros.texto = ''; $('buscar').value = ''; }
  else if (g === 'nuevos') filtros.nuevos = false;
  else if (g === 'disponible') filtros.disponibles = false;
  else if (g === 'precio') { filtros.precio = ''; $('precio').value = ''; }
  else if (conjuntos[g]) filtros[conjuntos[g]].delete(v);
  pintar();
}
function limpiarTodo() {
  filtros.texto = ''; filtros.nuevos = false; filtros.precio = ''; filtros.disponibles = false;
  Object.values(conjuntos).forEach((k) => filtros[k].clear());
  $('buscar').value = ''; $('precio').value = '';
  pintar();
}
$('limpiar').addEventListener('click', limpiarTodo);

let esperaTexto = null;
$('buscar').addEventListener('input', () => {
  clearTimeout(esperaTexto);
  esperaTexto = setTimeout(() => { filtros.texto = $('buscar').value.trim().slice(0, 60); pintar(); }, 180);
});
$('precio').addEventListener('input', () => { filtros.precio = $('precio').value.trim().slice(0, 20); pintar(); });
$('f-precio-rapido').addEventListener('click', (e) => {
  const b = e.target.closest('[data-precio]');
  if (!b) return;
  filtros.precio = filtros.precio === b.dataset.precio ? '' : b.dataset.precio;
  $('precio').value = filtros.precio;
  pintar();
});
$('orden').addEventListener('change', pintarGrid);

// Grupos plegables
document.querySelectorAll('.cat-grupo-cab').forEach((b) => b.addEventListener('click', () => {
  const abierto = b.getAttribute('aria-expanded') === 'true';
  b.setAttribute('aria-expanded', String(!abierto));
  b.closest('.cat-grupo').classList.toggle('cerrado', abierto);
}));

// Filtros en celular (panel deslizable)
function abrirFiltros(abrir) {
  document.body.classList.toggle('cat-filtros-abiertos', abrir);
  $('cat-velo').hidden = !abrir;
  if (abrir) $('buscar').focus({ preventScroll: true });
}
$('abrir-filtros').addEventListener('click', () => abrirFiltros(true));
$('cerrar-filtros').addEventListener('click', () => abrirFiltros(false));
$('ver-resultados').addEventListener('click', () => abrirFiltros(false));
$('cat-velo').addEventListener('click', () => abrirFiltros(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirFiltros(false); });

// Vista cuadrícula / lista
function aplicarVista() {
  $('productsGrid').classList.toggle('lista', vista === 'lista');
  document.querySelectorAll('[data-vista]').forEach((b) => {
    b.classList.toggle('activa', b.dataset.vista === vista);
    b.setAttribute('aria-pressed', String(b.dataset.vista === vista));
  });
}
document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => {
  vista = b.dataset.vista;
  try { localStorage.setItem('bpVistaCatalogo', vista); } catch { /* sin almacenamiento */ }
  aplicarVista();
}));

// ─── Tarjetas ───
const huellitas = (prom) => Array.from({ length: 5 }, (_, i) =>
  `<svg class="cat-h${i < Math.round(prom) ? ' llena' : ''}" aria-hidden="true"><use href="#cat-huella"/></svg>`).join('');

function tarjeta(p) {
  const fotos = imagenesDe(p);
  const i = Math.min(fotoActual.get(p.id) || 0, fotos.length - 1);
  const stock = stockDe(p);
  const agotado = stock <= 0;
  const bajo = !agotado && stock <= (Number(p.stockMin) || 0);
  const url = `Producto.html?id=${encodeURIComponent(p.id)}`;
  const cal = calificaciones.get(p.id);
  const base = nombreBase(p.nombre);
  const masTallas = tallaDe(p) && productos.some((x) => x.id !== p.id && nombreBase(x.nombre) === base && x.categoria === p.categoria);
  const fav = favoritos.has(p.id);
  // Etiquetas (mismo estilo): "Agotado" va sola; si no, puede salir "Nuevo" y "¡Últimas piezas!" juntas.
  const etiq = (clase, texto) => `<span class="cat-etiq ${clase}"><svg><use href="#cat-huella"/></svg>${texto}</span>`;
  const etiquetas = agotado ? [etiq('agotado', 'Agotado')]
    : [esNuevo(p) && etiq('nuevo', 'Nuevo'), bajo && etiq('bajo', stock === 1 ? '¡Última pieza!' : `¡Quedan ${stock}!`)].filter(Boolean);
  const etiqueta = etiquetas.length ? `<div class="cat-etiquetas">${etiquetas.join('')}</div>` : '';
  return `
  <article class="cat-card${agotado ? ' agotado' : ''}" data-id="${esc(p.id)}">
    <div class="cat-foto-caja">
      ${etiqueta}
      <button type="button" class="cat-fav${fav ? ' activo' : ''}" data-fav="${esc(p.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
        <svg><use href="#cat-corazon"/></svg>
      </button>
      <a class="cat-foto" href="${url}" tabindex="-1" aria-hidden="true">
        <img src="${esc(fotos[i])}" alt="" loading="lazy" data-fotos="${esc(JSON.stringify(fotos))}" />
      </a>
      ${fotos.length > 1 ? `<div class="cat-puntos">${fotos.map((_, n) =>
        `<button type="button" class="${n === i ? 'activo' : ''}" data-foto="${n}" aria-label="Ver foto ${n + 1}"></button>`).join('')}</div>` : '<div class="cat-puntos"></div>'}
      <p class="cat-envio"><svg><use href="#cat-camion"/></svg><span><strong>Envío a domicilio</strong>a todo México</span></p>
    </div>
    <div class="cat-info">
      <p class="cat-marca">${esc(marcaDe(p))}</p>
      <h3 class="cat-nombre"><a href="${url}">${esc(p.nombre)}</a></h3>
      ${masTallas ? '<p class="cat-tallas"><svg><use href="#cat-cinta"/></svg>Más tallas disponibles</p>' : ''}
      <p class="cat-cal" title="${cal ? `${(cal.suma / cal.n).toFixed(1)} de 5 huellitas` : 'Sin reseñas todavía'}">
        ${huellitas(cal ? cal.suma / cal.n : 0)}${cal ? `<span>(${cal.n})</span>` : ''}
      </p>
      <p class="cat-precio">${dinero(p.precio)}</p>
      <button type="button" class="cat-agregar" data-agregar="${esc(p.id)}" ${agotado ? 'disabled' : ''}>${agotado ? 'Agotado' : 'Agregar al carrito'}</button>
    </div>
  </article>`;
}

function pintarGrid() {
  const grid = $('productsGrid');
  const estado = $('productsState');
  const lista = ordenar(productos.filter((p) => cumple(p)));
  $('resultados').textContent = cargado ? `${lista.length} resultado${lista.length === 1 ? '' : 's'}` : 'Cargando…';
  if (!cargado) return;
  if (!productos.length) {
    grid.innerHTML = ''; estado.hidden = false;
    estado.textContent = 'Todavía no hay productos publicados. ¡Vuelve pronto!';
    return;
  }
  if (!lista.length) {
    grid.innerHTML = ''; estado.hidden = false;
    estado.innerHTML = 'No encontramos productos con esos filtros. <button type="button" class="cat-link" id="estado-limpiar">Limpiar filtros</button>';
    $('estado-limpiar').addEventListener('click', limpiarTodo);
    return;
  }
  estado.hidden = true;
  grid.innerHTML = lista.map(tarjeta).join('');
  grid.querySelectorAll('img').forEach((img) => img.addEventListener('error', () => { img.src = IMG_VACIA; }, { once: true }));
}

function pintarEncabezado() {
  const titulo = filtros.categorias.size === 1 ? [...filtros.categorias][0] : 'Ropa y accesorios';
  $('cat-titulo').textContent = titulo;
  $('ruta-cat').textContent = filtros.categorias.size === 1 ? titulo : 'Catálogo';
  document.title = `${titulo} - Bigotes y Patitas`;
  // La URL guarda la búsqueda y la categoría (para compartir el enlace).
  const url = new URL(location.href);
  url.searchParams.delete('categoria'); url.searchParams.delete('buscar');
  if (filtros.categorias.size === 1) url.searchParams.set('categoria', [...filtros.categorias][0]);
  if (filtros.texto) url.searchParams.set('buscar', filtros.texto);
  history.replaceState(null, '', url.pathname.split('/').pop() + url.search);
}

function pintar() {
  pintarFiltros();
  chipsActivos();
  pintarEncabezado();
  pintarGrid();
}

// ─── Acciones de las tarjetas ───
function obtenerCarrito() { try { return JSON.parse(localStorage.getItem('carrito') || '[]'); } catch { return []; } }
function guardarCarrito(c) {
  localStorage.setItem('carrito', JSON.stringify(c));
  window.dispatchEvent(new Event('actualizarCarrito'));
}
function agregarAlCarrito(id) {
  const p = productos.find((x) => x.id === id);
  if (!p) { mostrarToast('Producto no encontrado', 'error'); return; }
  const stock = stockDe(p);
  if (stock <= 0) { mostrarToast('Ese producto está agotado', 'error'); return; }
  const carrito = obtenerCarrito();
  const existe = carrito.find((i) => i.id === id);
  if ((existe ? existe.cantidad : 0) + 1 > stock) { mostrarToast(`Solo quedan ${stock} de "${p.nombre}"`, 'error'); return; }
  if (existe) existe.cantidad += 1;
  else carrito.push({ id: p.id, nombre: p.nombre, precio: Number(p.precio) || 0, imagen: imagenesDe(p)[0], cantidad: 1 });
  guardarCarrito(carrito);
  mostrarToast(`¡Agregado! 1 × ${p.nombre}`);
}
window.agregarAlCarrito = agregarAlCarrito;

$('productsGrid').addEventListener('click', async (e) => {
  const agregar = e.target.closest('[data-agregar]');
  if (agregar) { agregarAlCarrito(agregar.dataset.agregar); return; }

  const punto = e.target.closest('[data-foto]');
  if (punto) {
    const card = punto.closest('.cat-card');
    const img = card.querySelector('.cat-foto img');
    const fotos = JSON.parse(img.dataset.fotos);
    const n = Number(punto.dataset.foto);
    fotoActual.set(card.dataset.id, n);
    img.src = fotos[n];
    card.querySelectorAll('[data-foto]').forEach((b, k) => b.classList.toggle('activo', k === n));
    return;
  }

  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const id = fav.dataset.fav;
    if (!usuario) {
      const si = await window.bpConfirmar('Inicia sesión para guardar tus favoritos.', { aceptar: 'Iniciar sesión', cancelar: 'Ahora no' });
      if (si) location.href = 'login.html?next=' + encodeURIComponent('shop.html' + location.search);
      return;
    }
    fav.disabled = true;
    try {
      if (favoritos.has(id)) { await quitarFavorito(usuario.uid, id); mostrarToast('Se quitó de tus favoritos'); }
      else { await agregarFavorito(usuario.uid, id); mostrarToast('Guardado en tus favoritos ♥'); }
    } catch { mostrarToast('No se pudo actualizar tus favoritos', 'error'); }
    fav.disabled = false;
  }
});

// Al pasar el mouse sobre la foto se ve la segunda imagen
$('productsGrid').addEventListener('mouseover', (e) => {
  const caja = e.target.closest('.cat-foto');
  if (!caja || caja.contains(e.relatedTarget)) return;
  const img = caja.querySelector('img');
  const fotos = JSON.parse(img.dataset.fotos || '[]');
  const card = caja.closest('.cat-card');
  if (fotos.length > 1 && !fotoActual.get(card.dataset.id)) img.src = fotos[1];
});
$('productsGrid').addEventListener('mouseout', (e) => {
  const caja = e.target.closest('.cat-foto');
  if (!caja || caja.contains(e.relatedTarget)) return;
  const img = caja.querySelector('img');
  const fotos = JSON.parse(img.dataset.fotos || '[]');
  const card = caja.closest('.cat-card');
  img.src = fotos[fotoActual.get(card.dataset.id) || 0] || img.src;
});

// ─── Datos ───
aplicarVista();
pintar();

escucharProductosScm(
  (lista) => { productos = lista; cargado = true; pintar(); },
  () => {
    $('productsState').hidden = false;
    $('productsState').textContent = 'No se pudo cargar el catálogo. Revisa tu conexión.';
    $('productsGrid').innerHTML = '';
    $('resultados').textContent = '';
  }
);

escucharTodasLasResenas((lista) => {
  calificaciones = new Map();
  lista.forEach((r) => {
    const c = calificaciones.get(r.productoId) || { suma: 0, n: 0 };
    c.suma += Number(r.huellitas) || 0; c.n += 1;
    calificaciones.set(r.productoId, c);
  });
  if (cargado) pintarGrid();
}, () => { /* sin reseñas: las tarjetas se ven igual */ });

observarSesionCliente((user) => {
  usuario = user;
  if (cancelarFavoritos) { cancelarFavoritos(); cancelarFavoritos = null; }
  favoritos = new Set();
  if (user) {
    cancelarFavoritos = escucharFavoritos(user.uid, (l) => {
      favoritos = new Set(l.map((f) => f.productoId || f.id));
      if (cargado) pintarGrid();
    }, () => {});
  }
  if (cargado) pintarGrid();
});
