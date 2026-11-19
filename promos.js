// =============================================
// promos.js - Página "Promociones" (promos.html)
// - Los cupones salen de Firebase (colección "promociones"): solo los que en el panel
//   tienen "Mostrar en la página Promos" y siguen vigentes. Ya no están escritos aquí.
// - "Usar cupón" / "Aplicar" validan el código y lo dejan listo para el carrito
//   (localStorage "cuponAplicado", el mismo que usan Carrito.html y Checkout.html).
// =============================================

import { escucharPromocionesPublicas, validarCupon, escucharProductosScm } from './firebase-db.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fecha = (iso) => {
  const [a, m, d] = String(iso || '').split('-').map(Number);
  return a ? new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
};

function mostrarToast(mensaje, tipo = 'success') {
  const c = $('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${tipo}`; t.textContent = mensaje;
  c.appendChild(t);
  setTimeout(() => t.classList.add('show'), 80);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2800);
}

function cuponActual() { try { return JSON.parse(localStorage.getItem('cuponAplicado') || 'null'); } catch { return null; } }

let promos = [];

function infoTipo(p) {
  if (p.tipo === 'envio_gratis') return { etiqueta: 'Envío gratis', valor: 'GRATIS', sub: 'envío a domicilio', clase: 'envio' };
  if (p.tipo === 'tercera_prenda') return { etiqueta: 'En tu 3ª prenda', valor: `${Number(p.valor) || 0}%`, sub: 'en la tercera prenda', clase: 'tercera' };
  return { etiqueta: 'Descuento', valor: `${Number(p.valor) || 0}%`, sub: 'en tu compra', clase: 'porcentaje' };
}

function pintarCupones() {
  const caja = $('lista-cupones');
  const aplicado = cuponActual()?.codigo;
  if (!promos.length) {
    caja.innerHTML = `<div class="pr-vacio">
      <svg aria-hidden="true"><use href="#pr-huella"/></svg>
      <p><strong>Por ahora no hay promociones abiertas.</strong><br>Síguenos en redes o crea tu cuenta para enterarte primero de las próximas.</p>
      <a class="cp-btn cp-btn-carrito" href="login.html?modo=registro">Crear mi cuenta</a></div>`;
    $('hero-valor').textContent = '%';
    return;
  }
  const mayor = Math.max(0, ...promos.filter((p) => p.tipo !== 'envio_gratis').map((p) => Number(p.valor) || 0));
  $('hero-valor').textContent = mayor ? `${mayor}%` : 'Envío';
  document.querySelector('.pr-hero-hasta').hidden = !mayor;
  document.querySelector('.pr-hero-desc').textContent = mayor ? 'de descuento' : 'gratis';

  caja.innerHTML = promos.map((p) => {
    const t = infoTipo(p);
    const minimo = Number(p.minimoCompra) || 0;
    const usado = aplicado === p.codigo;
    const titulo = p.descripcion || (p.tipo === 'envio_gratis' ? 'Envío gratis' : `${t.valor} ${t.sub}`);
    return `
    <article class="pr-cupon ${t.clase}${usado ? ' aplicado' : ''}">
      <div class="pr-cupon-valor">
        ${p.tipo === 'envio_gratis' ? '<svg><use href="#pr-camion"/></svg>' : ''}
        <strong>${esc(t.valor)}</strong>
        <span>${esc(t.sub)}</span>
      </div>
      <div class="pr-cupon-info">
        <p class="pr-cupon-tipo">${esc(t.etiqueta)}</p>
        <h3>${esc(titulo)}</h3>
        <p class="pr-cupon-cond">${minimo ? `En compras desde ${dinero(minimo)} · ` : ''}Válido hasta el ${esc(fecha(p.vigenciaHasta))}</p>
        <div class="pr-cupon-acciones">
          <button type="button" class="pr-cupon-codigo" data-copiar="${esc(p.codigo)}" title="Copiar código">
            <span>${esc(p.codigo)}</span><svg><use href="#pr-copiar"/></svg>
          </button>
          <button type="button" class="pr-cupon-usar" data-usar="${esc(p.codigo)}">${usado ? '✓ Aplicado' : 'Usar cupón'}</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

async function aplicar(codigo, { desdeCaja = false } = {}) {
  const msg = $('codigo-msg');
  const mostrar = (texto, ok) => {
    if (!desdeCaja) { mostrarToast(texto, ok ? 'success' : 'error'); return; }
    msg.innerHTML = texto; msg.className = 'pr-codigo-msg ' + (ok ? 'ok' : 'mal'); msg.hidden = false;
  };
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) { mostrar('Escribe un código.', false); return; }
  try {
    const r = await validarCupon(c);
    if (!r.ok) { mostrar(r.motivo || 'Ese código no es válido.', false); return; }
    localStorage.setItem('cuponAplicado', JSON.stringify(r.cupon));
    mostrar(desdeCaja
      ? `✓ Cupón <strong>${esc(r.cupon.codigo)}</strong> listo. Se descontará en tu <a href="Carrito.html">carrito</a>.`
      : `Cupón ${r.cupon.codigo} listo: se aplicará en tu carrito`, true);
    pintarCupones();
  } catch {
    mostrar('No se pudo validar el cupón. Revisa tu conexión e inténtalo de nuevo.', false);
  }
}

$('lista-cupones').addEventListener('click', async (e) => {
  const copiar = e.target.closest('[data-copiar]');
  if (copiar) {
    try { await navigator.clipboard.writeText(copiar.dataset.copiar); mostrarToast(`Código ${copiar.dataset.copiar} copiado`); }
    catch { mostrarToast(`Tu código es ${copiar.dataset.copiar}`); }
    return;
  }
  const usar = e.target.closest('[data-usar]');
  if (usar) aplicar(usar.dataset.usar);
});

$('form-codigo').addEventListener('submit', (e) => {
  e.preventDefault();
  aplicar($('codigoPromo').value, { desdeCaja: true });
});
$('codigoPromo').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/\s/g, ''); });

// Productos destacados para aprovechar el descuento
function pintarProductos(lista) {
  const elegidos = [...lista]
    .filter((p) => (Number(p.stock) || 0) > 0)
    .sort((a, b) => (b.destacado === true) - (a.destacado === true))
    .slice(0, 8);
  $('pr-productos').hidden = !elegidos.length;
  $('pista-productos').innerHTML = elegidos.map((p) => {
    const url = `Producto.html?id=${encodeURIComponent(p.id)}`;
    const img = (Array.isArray(p.imagenes) && p.imagenes[0]) || p.img || '';
    return `<article class="dest-item">
      <a class="dest-foto" href="${url}" tabindex="-1" aria-hidden="true"><img src="${esc(img)}" alt="" loading="lazy" /></a>
      <h3 class="dest-nombre"><a href="${url}">${esc(p.nombre)}</a></h3>
      <p class="dest-precio">$${(Number(p.precio) || 0).toFixed(2)}</p>
    </article>`;
  }).join('');
}

escucharPromocionesPublicas((lista) => { promos = lista; pintarCupones(); }, () => {
  $('lista-cupones').innerHTML = '<p class="pr-cargando">No se pudieron cargar las promociones. Revisa tu conexión.</p>';
});
escucharProductosScm(pintarProductos, () => {});
window.addEventListener('storage', (e) => { if (e.key === 'cuponAplicado') pintarCupones(); });
