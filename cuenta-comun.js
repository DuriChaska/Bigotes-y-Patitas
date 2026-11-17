// ============================================
//  Bigotes y Patitas - cuenta-comun.js  (Etapa 4 · integrante 2)
//  Piezas que comparten las pantallas de "Mi cuenta" del cliente
//  (Mis pedidos, Mi monedero, Mis datos, Direcciones):
//    - exigir sesión (si no hay, manda a login y luego regresa),
//    - pintar el menú lateral con la alerta de tickets sin leer,
//    - formato de dinero/fechas, escape de texto y avisos (toast),
//    - validación de tarjeta (Luhn) y de correo para las recargas.
//  Se importa como módulo:  import { iniciarCuenta, dinero } from './cuenta-comun.js';
//  Requiere cuenta-menu.js cargado antes (pintarMenuCuenta).
// ============================================

import { obtenerUsuarioActual, obtenerPerfilCliente, escucharTicketsDeCliente } from './firebase-db.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const dinero = (n) => '$' + (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function aFecha(valor) {
  if (!valor) return null;
  const f = typeof valor.toDate === 'function' ? valor.toDate() : new Date(valor);
  return isNaN(f.getTime()) ? null : f;
}

/** 14 nov 2026 */
export function fechaCorta(valor) {
  const f = aFecha(valor);
  return f ? f.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

/** 14 nov 2026, 15:03 */
export function fechaHora(valor) {
  const f = aFecha(valor);
  return f ? f.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'cta-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 3400);
}

/** Muestra (o esconde con msg vacío) el mensaje de error de un formulario. */
export function avisoError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

/** Traduce los errores de Firebase a algo que el cliente entienda. */
export function mensajeError(err, porDefecto = 'No se pudo completar. Revisa tu conexión e intenta de nuevo.') {
  const codigos = {
    'permission-denied': 'Firebase no permitió el cambio. Avisa a la tienda (faltan publicar las reglas actualizadas).',
    'auth/wrong-password': 'La contraseña actual no es correcta.',
    'auth/invalid-credential': 'La contraseña actual no es correcta.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e intenta de nuevo.',
    'auth/email-already-in-use': 'Ese correo ya pertenece a otra cuenta.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres).',
    'auth/network-request-failed': 'Sin conexión a internet.',
  };
  return codigos[err?.code] || err?.message || porDefecto;
}

/**
 * Exige sesión de cliente y pinta el menú de "Mi cuenta".
 * pagina = archivo actual (para regresar después del login); idMenu = opción activa del menú.
 * Devuelve { usuario, perfil, nombre } o null si se fue a login.
 */
export async function iniciarCuenta(pagina, idMenu) {
  if (typeof pintarMenuCuenta === 'function') pintarMenuCuenta(idMenu, 0);
  const usuario = await obtenerUsuarioActual();
  if (!usuario) {
    window.location.href = 'login.html?next=' + encodeURIComponent(pagina + window.location.search);
    return null;
  }
  let perfil = null;
  try {
    perfil = await obtenerPerfilCliente(usuario.uid);
  } catch {
    toast('No se pudieron cargar los datos de tu perfil. Revisa tu conexión.');
  }
  const nombre = perfil?.nombre || usuario.displayName || usuario.email;
  const chip = document.getElementById('sesion-nombre');
  if (chip) chip.textContent = nombre;

  // Alerta verde de respuestas de soporte sin leer, también desde estas pantallas.
  try {
    escucharTicketsDeCliente(usuario.uid, (lista) => {
      const sinLeer = lista.filter(t => t.leidoCliente === false).length;
      if (typeof pintarMenuCuenta === 'function') pintarMenuCuenta(idMenu, sinLeer);
    }, () => {});
  } catch { /* sin tickets: solo no se muestra la alerta del menú */ }

  return { usuario, perfil, nombre };
}

// ---------- Validaciones de pago (recargas del monedero) ----------

export const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;

function pasaLuhn(numero) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) { d *= 2; if (d > 9) d -= 9; }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

export function marcaTarjeta(numero) {
  if (/^4/.test(numero)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(numero)) return 'Mastercard';
  if (/^3[47]/.test(numero)) return 'American Express';
  return '';
}

/**
 * Revisa los datos de una tarjeta. Devuelve { error } o { marca, ultimos4 } (nunca se guarda
 * el número completo ni el CVV).
 */
export function validarTarjeta({ numero, titular, vencimiento, cvv }) {
  const n = String(numero || '').replace(/\D/g, '');
  const marca = marcaTarjeta(n);
  if (n.length < 15 || n.length > 16) return { error: 'El número de tarjeta debe tener 15 o 16 dígitos.' };
  if (!marca) return { error: 'Solo aceptamos Visa, Mastercard o American Express.' };
  if (!pasaLuhn(n)) return { error: 'El número de tarjeta no es válido. Revísalo.' };
  const t = String(titular || '').trim();
  if (!RE_NOMBRE.test(t) || t.split(/\s+/).length < 2) return { error: 'Escribe el nombre y apellido del titular.' };
  const m = /^(\d{2})\/(\d{2})$/.exec(String(vencimiento || '').trim());
  if (!m) return { error: 'Escribe el vencimiento como MM/AA.' };
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return { error: 'El mes de vencimiento debe estar entre 01 y 12.' };
  if (new Date(anio, mes, 0, 23, 59, 59) < new Date()) return { error: 'Tu tarjeta ya venció.' };
  const largo = marca === 'American Express' ? 4 : 3;
  if (!new RegExp(`^\\d{${largo}}$`).test(String(cvv || ''))) return { error: `El CVV debe tener ${largo} dígitos.` };
  return { marca, ultimos4: n.slice(-4) };
}

export function formatearNumeroTarjeta(input) {
  const v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
  return marcaTarjeta(v);
}

export function formatearVencimiento(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
  input.value = v;
}
