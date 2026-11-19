// =============================================
// comunidad.js - Comunidad Peluda (comunidad.html)
// Muro público guardado en Firebase (colección "comunidad"):
// - Quien tiene sesión publica un texto, su calificación con huellitas (1 a 5),
//   el nombre de su mascota y una foto (opcional; se reduce a JPEG ligero).
// - Cualquiera ve las publicaciones; con sesión se da "me gusta".
// - El autor (o el personal de la tienda) puede borrar la publicación.
// =============================================

import {
  escucharComunidad, publicarEnComunidad, darMeGusta, eliminarDeComunidad,
  observarSesionCliente, obtenerPerfilCliente, rolDelPanelActual,
} from './firebase-db.js';
import { reducirFoto } from './foto-perfil.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mostrarToast(mensaje, tipo = 'success') {
  const c = $('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${tipo}`; t.textContent = mensaje;
  c.appendChild(t);
  setTimeout(() => t.classList.add('show'), 80);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2800);
}

function milis(f) {
  if (!f) return Date.now();
  if (typeof f.toMillis === 'function') return f.toMillis();
  if (f instanceof Date) return f.getTime();
  if (typeof f.seconds === 'number') return f.seconds * 1000;
  return Number(new Date(f)) || Date.now();
}
function hace(f) {
  const s = Math.max(0, (Date.now() - milis(f)) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) { const d = Math.floor(s / 86400); return `hace ${d} día${d > 1 ? 's' : ''}`; }
  return new Date(milis(f)).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}
const huellitas = (n) => Array.from({ length: 5 }, (_, i) =>
  `<svg class="cm-h${i < n ? ' llena' : ''}" aria-hidden="true"><use href="#cm-huella"/></svg>`).join('');
const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();
const COLORES = ['#d93359', '#b8603a', '#5f8a68', '#2f4858', '#8c1c2e', '#c48a1d'];
const colorDe = (uid) => COLORES[[...String(uid || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORES.length];

// ─── Estado ───
let posts = [];
let usuario = null;
let nombreUsuario = 'Cliente';
let esPersonal = false;
let filtro = 'todas';
let huellasElegidas = 0;
let fotoLista = '';

// ─── Formulario ───
function pintarHuellasForm() {
  $('p-huellas').innerHTML = [1, 2, 3, 4, 5].map((n) => `
    <button type="button" role="radio" aria-checked="${huellasElegidas === n}" aria-label="${n} huellita${n > 1 ? 's' : ''}" data-n="${n}"
      class="${n <= huellasElegidas ? 'llena' : ''}"><svg><use href="#cm-huella"/></svg></button>`).join('');
}
$('p-huellas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-n]');
  if (b) { huellasElegidas = Number(b.dataset.n); pintarHuellasForm(); }
});
$('p-texto').addEventListener('input', () => { $('contador').textContent = `${$('p-texto').value.length} / 600`; });

$('p-foto').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  try {
    fotoLista = await reducirFoto(archivo, 720);
    $('p-foto-img').src = fotoLista;
    $('vista-foto').hidden = false;
  } catch (err) {
    fotoLista = '';
    mostrarToast(err.message || 'No se pudo usar esa imagen.', 'error');
  }
});
$('quitar-foto').addEventListener('click', () => { fotoLista = ''; $('vista-foto').hidden = true; });

function errorForm(t) { $('p-error').textContent = t || ''; $('p-error').hidden = !t; }

$('form-post').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorForm('');
  const texto = $('p-texto').value.trim();
  if (texto.length < 3) { errorForm('Escribe algo para compartir.'); $('p-texto').focus(); return; }
  if (!huellasElegidas) { errorForm('Elige cuántas huellitas le das a la tienda.'); return; }
  const boton = $('p-enviar');
  boton.disabled = true; boton.textContent = 'Publicando…';
  try {
    await publicarEnComunidad({ nombre: nombreUsuario, mascota: $('p-mascota').value, texto, huellitas: huellasElegidas, foto: fotoLista || undefined });
    $('p-texto').value = ''; $('p-mascota').value = ''; $('contador').textContent = '0 / 600';
    fotoLista = ''; $('vista-foto').hidden = true;
    huellasElegidas = 0; pintarHuellasForm();
    mostrarToast('¡Publicado! Gracias por compartir con la manada 🐾');
    filtro = 'todas'; pintarFiltros();
  } catch (err) {
    errorForm(err.code === 'permission-denied'
      ? 'Firebase no permitió publicar (faltan publicar las reglas actualizadas). Avisa a la tienda.'
      : (err.code?.startsWith('bp/') ? err.message : 'No se pudo publicar. Revisa tu conexión e intenta de nuevo.'));
  } finally {
    boton.disabled = false; boton.textContent = 'Publicar';
  }
});

// ─── Muro ───
function visibles() {
  let lista = posts;
  if (filtro === 'fotos') lista = lista.filter((p) => p.foto);
  if (filtro === 'mias') lista = lista.filter((p) => usuario && p.uid === usuario.uid);
  if (filtro === 'queridas') lista = [...lista].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0) || milis(b.fecha) - milis(a.fecha));
  return lista;
}

function pintarMuro() {
  const lista = visibles();
  if (!lista.length) {
    $('muro').innerHTML = `<div class="cm-vacio"><svg aria-hidden="true"><use href="#cm-huella"/></svg>
      <p>${filtro === 'todas' ? '¡Sé el primero en presumir a tu peludito!' : 'No hay publicaciones con este filtro todavía.'}</p></div>`;
    return;
  }
  $('muro').innerHTML = lista.map((p) => {
    const likes = Array.isArray(p.likes) ? p.likes : [];
    const meGusta = usuario && likes.includes(usuario.uid);
    const puedeBorrar = usuario && (p.uid === usuario.uid || esPersonal);
    return `
    <article class="cm-post" data-id="${esc(p.id)}">
      ${p.foto ? `<img class="cm-post-foto" src="${esc(p.foto)}" alt="Foto de ${esc(p.mascota || 'la mascota')} compartida por ${esc(p.nombre)}" loading="lazy" />` : ''}
      <div class="cm-post-cuerpo">
        <div class="cm-post-cab">
          <span class="cm-avatar" style="background:${colorDe(p.uid)}">${esc(inicial(p.nombre))}</span>
          <div>
            <strong>${esc(p.nombre)}</strong>
            <small>${p.mascota ? `con <b>${esc(p.mascota)}</b> · ` : ''}${esc(hace(p.fecha))}</small>
          </div>
        </div>
        <div class="cm-post-huellas" title="${p.huellitas} de 5 huellitas">${huellitas(Number(p.huellitas) || 0)}</div>
        <p class="cm-post-texto">${esc(p.texto)}</p>
        <div class="cm-post-pie">
          <button type="button" class="cm-like${meGusta ? ' activo' : ''}" data-like="${esc(p.id)}" aria-pressed="${!!meGusta}" aria-label="Me gusta">
            <svg><use href="#cm-corazon"/></svg><span>${likes.length}</span>
          </button>
          ${puedeBorrar ? `<button type="button" class="cm-borrar" data-borrar="${esc(p.id)}">Eliminar</button>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}

function pintarResumen() {
  $('st-posts').textContent = posts.length;
  const conFoto = posts.filter((p) => p.foto);
  $('st-fotos').textContent = conFoto.length;
  const prom = posts.length ? posts.reduce((s, p) => s + (Number(p.huellitas) || 0), 0) / posts.length : 0;
  $('st-prom').textContent = posts.length ? prom.toFixed(1).replace('.0', '') : '–';
  // Las fotos más recientes de la comunidad en la portada
  const imgs = [...$('collage').querySelectorAll('img')];
  conFoto.slice(0, imgs.length).forEach((p, i) => { imgs[i].src = p.foto; });
}

$('muro').addEventListener('click', async (e) => {
  const like = e.target.closest('[data-like]');
  if (like) {
    if (!usuario) {
      const si = await window.bpConfirmar('Inicia sesión para dar "me gusta".', { aceptar: 'Iniciar sesión', cancelar: 'Ahora no' });
      if (si) location.href = 'login.html?next=comunidad.html';
      return;
    }
    const p = posts.find((x) => x.id === like.dataset.like);
    const ya = (p?.likes || []).includes(usuario.uid);
    like.disabled = true;
    try { await darMeGusta(like.dataset.like, usuario.uid, !ya); }
    catch { mostrarToast('No se pudo guardar tu "me gusta".', 'error'); }
    like.disabled = false;
    return;
  }
  const borrar = e.target.closest('[data-borrar]');
  if (borrar) {
    if (!(await window.bpConfirmar('¿Eliminar esta publicación?', { peligro: true, aceptar: 'Eliminar' }))) return;
    try { await eliminarDeComunidad(borrar.dataset.borrar); mostrarToast('Publicación eliminada'); }
    catch { mostrarToast('No se pudo eliminar la publicación.', 'error'); }
  }
});

function pintarFiltros() {
  document.querySelectorAll('[data-filtro]').forEach((b) => {
    b.classList.toggle('activa', b.dataset.filtro === filtro);
    b.setAttribute('aria-selected', String(b.dataset.filtro === filtro));
  });
  pintarMuro();
}
document.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.filtro; pintarFiltros(); }));

// ─── Datos y sesión ───
pintarHuellasForm();

escucharComunidad((lista) => { posts = lista; pintarResumen(); pintarMuro(); }, () => {
  $('muro').innerHTML = '<p class="cm-cargando">No se pudo cargar la comunidad. Revisa tu conexión.</p>';
});

observarSesionCliente(async (user) => {
  usuario = user;
  $('sin-sesion').hidden = !!user;
  $('form-post').hidden = !user;
  $('filtro-mias').hidden = !user;
  esPersonal = false;
  nombreUsuario = user?.displayName || 'Cliente';
  if (user) {
    const rol = await rolDelPanelActual();
    esPersonal = ['administrador', 'vendedor', 'soporte'].includes(rol);
    if (!rol) {
      try { const p = await obtenerPerfilCliente(user.uid); if (p?.nombre) nombreUsuario = p.nombre; } catch { /* sin perfil */ }
    }
    // Solo el primer nombre y la inicial del apellido, por privacidad.
    const partes = String(nombreUsuario).trim().split(/\s+/);
    nombreUsuario = partes.length > 1 ? `${partes[0]} ${partes[1][0]}.` : partes[0];
  }
  if (filtro === 'mias' && !user) filtro = 'todas';
  pintarFiltros();
});
