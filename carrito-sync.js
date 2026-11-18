// ============================================
//  Bigotes y Patitas - carrito-sync.js  (Etapa 4)
//  Lo carga components.js en TODAS las páginas de la tienda. No cambia cómo las
//  páginas usan el carrito (siguen leyendo/escribiendo localStorage "carrito");
//  solo agrega, por encima:
//
//   1. CADUCIDAD: cada producto guarda cuándo se agregó (agregadoEn) y se quita
//      solo después de CARRITO.horasCaducidad (72 h), con un aviso.
//   2. PERSISTENCIA EN FIREBASE: con sesión de cliente, el carrito se guarda en
//      carritos/{uid} + carritos/{uid}/detalle. Al iniciar sesión se juntan el
//      carrito del navegador y el guardado en la cuenta; cambios hechos en otro
//      dispositivo llegan en vivo. Al cerrar sesión se limpia el del navegador
//      (queda guardado en la cuenta).
//   3. AVISO DE STOCK EN VIVO: si otra persona compra un producto que tienes en
//      el carrito y ya no alcanza, la cantidad se ajusta (o se quita) y se avisa.
//
//  Cuando este archivo cambia el carrito por su cuenta, lanza el evento
//  "carritoCambioExterno" para que Carrito.html y Checkout.html se vuelvan a pintar.
// ============================================

import {
  observarSesionCliente, escucharProductosScm, obtenerCarritoRemoto,
  escucharCarritoRemoto, guardarCarritoRemoto, CARRITO,
} from './firebase-db.js';

const CLAVE = 'carrito';
const CLAVE_DUENO = 'carritoDueno';        // uid del cliente al que pertenece el carrito del navegador
const CLAVE_COMPRADO = 'carritoComprado';  // id de la venta recién pagada (lo pone Checkout.html)
const MS_CADUCIDAD = CARRITO.horasCaducidad * 60 * 60 * 1000;

let usuario = null;
let ultimoSubido = null;      // JSON del último carrito enviado a Firebase (evita escrituras repetidas)
let temporizador = null;
let cancelarRemoto = null;
let pendiente = false;        // hay cambios del navegador que aún no se suben a Firebase
const stockVisto = new Map(); // productoId -> stock ya avisado

// ---------- utilidades ----------

function leer() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) || '[]');
    return Array.isArray(c) ? c : [];
  } catch { return []; }
}

/** Forma comparable del carrito (para saber si de verdad cambió). */
function huella(items) {
  return JSON.stringify(items.map(i => [i.id, Number(i.cantidad), Number(i.precio), Number(i.agregadoEn) || 0])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

/** Escribe el carrito en el navegador y avisa a la página (badge + pantallas de carrito/checkout). */
function escribirLocal(items, motivo) {
  localStorage.setItem(CLAVE, JSON.stringify(items));
  window.dispatchEvent(new Event('actualizarCarrito'));
  window.dispatchEvent(new CustomEvent('carritoCambioExterno', { detail: { motivo } }));
}

/** Notificación en pantalla (la de components.js). */
function aviso(texto, tipo = 'info') {
  if (typeof window.bpNotificar === 'function') window.bpNotificar('🛒 ' + texto, tipo);
}

// Los errores de conexión se avisan UNA vez (no en cada intento) hasta que vuelva a funcionar.
const erroresAvisados = new Set();
function avisoError(clave, texto) {
  if (erroresAvisados.has(clave)) return;
  erroresAvisados.add(clave);
  aviso(texto, 'error');
}

// ---------- 1. caducidad ----------

/** Pone fecha a los productos nuevos y quita los que ya cumplieron 72 h. Devuelve true si quitó algo. */
function revisarCaducidad() {
  const ahora = Date.now();
  const carrito = leer();
  let sinFecha = false;
  carrito.forEach(i => { if (!Number(i.agregadoEn)) { i.agregadoEn = ahora; sinFecha = true; } });
  const vigentes = carrito.filter(i => ahora - Number(i.agregadoEn) < MS_CADUCIDAD);
  const vencidos = carrito.filter(i => ahora - Number(i.agregadoEn) >= MS_CADUCIDAD);
  if (vencidos.length) {
    escribirLocal(vigentes, 'caducidad');
    aviso(`${vencidos.map(i => `"${i.nombre}"`).join(', ')} se ${vencidos.length === 1 ? 'quitó' : 'quitaron'} de tu carrito porque pasaron ${CARRITO.horasCaducidad} horas desde que lo agregaste. Si aún lo quieres, agrégalo de nuevo.`);
    programarSubida(vigentes.length ? undefined : 'Expirado');
    return true;
  }
  if (sinFecha) localStorage.setItem(CLAVE, JSON.stringify(carrito));   // solo la fecha: no hace falta repintar
  return false;
}

// ---------- 2. persistencia en Firebase ----------

let estadoPendiente;
function programarSubida(estado) {
  if (estado) estadoPendiente = estado;
  if (!usuario) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(subir, 500);
}

async function subir() {
  if (!usuario) return;
  const items = leer();
  const ventaComprada = localStorage.getItem(CLAVE_COMPRADO);
  const estado = ventaComprada && !items.length ? 'Comprado' : estadoPendiente;
  const h = huella(items) + '|' + (estado || '');
  if (h === ultimoSubido) { pendiente = false; return; }
  try {
    await guardarCarritoRemoto(usuario.uid, items, {
      estado,
      ultimaVentaId: ventaComprada || '',
      clienteNombre: usuario.displayName || usuario.email || '',
    });
    ultimoSubido = h;
    pendiente = false;
    estadoPendiente = undefined;
    if (ventaComprada) localStorage.removeItem(CLAVE_COMPRADO);
    erroresAvisados.delete('subir');
  } catch {
    avisoError('subir', 'No se pudo guardar tu carrito en tu cuenta. Revisa tu conexión; mientras tanto se guarda en este navegador.');
  }
}

/** Junta el carrito del navegador con el guardado en la cuenta (por producto, la cantidad mayor). */
function juntar(local, remoto) {
  const porId = new Map();
  remoto.forEach(r => porId.set(r.productoId || r.id, {
    id: r.productoId || r.id, nombre: r.nombre, precio: Number(r.precioUnitario) || 0,
    imagen: r.imagen || '', cantidad: Number(r.cantidad) || 1, agregadoEn: Number(r.agregadoEn) || Date.now(),
  }));
  local.forEach(l => {
    const r = porId.get(l.id);
    if (!r) { porId.set(l.id, { ...l }); return; }
    porId.set(l.id, {
      ...r, ...l,
      cantidad: Math.max(Number(l.cantidad) || 1, r.cantidad),
      agregadoEn: Math.min(Number(l.agregadoEn) || Date.now(), r.agregadoEn),
    });
  });
  return [...porId.values()];
}

async function alIniciarSesion(user) {
  // Si el carrito del navegador era de OTRA cuenta (computadora compartida), no se mezcla.
  const dueno = localStorage.getItem(CLAVE_DUENO);
  if (dueno && dueno !== user.uid) escribirLocal([], 'otra-cuenta');
  localStorage.setItem(CLAVE_DUENO, user.uid);

  let remoto = null;
  try {
    remoto = await obtenerCarritoRemoto(user.uid);
  } catch {
    avisoError('leer', 'No se pudo recuperar el carrito guardado en tu cuenta. Revisa tu conexión.');
  }
  const local = leer();
  const juntos = juntar(local, remoto?.items || []);
  if (huella(juntos) !== huella(local)) {
    escribirLocal(juntos, 'cuenta');
    const nuevos = juntos.length - local.length;
    if (nuevos > 0) aviso(`Recuperamos ${nuevos} producto${nuevos === 1 ? '' : 's'} que tenías guardado${nuevos === 1 ? '' : 's'} en tu carrito.`);
  }
  revisarCaducidad();
  usuario = user;
  pendiente = true;          // lo juntado manda: el primer aviso de Firebase (viejo) no debe pisarlo
  programarSubida();

  // Cambios hechos desde otro dispositivo (celular / otra computadora).
  if (cancelarRemoto) cancelarRemoto();
  cancelarRemoto = escucharCarritoRemoto(user.uid, (lista) => {
    const remotoItems = lista.map(r => ({
      id: r.productoId || r.id, nombre: r.nombre, precio: Number(r.precioUnitario) || 0,
      imagen: r.imagen || '', cantidad: Number(r.cantidad) || 1, agregadoEn: Number(r.agregadoEn) || Date.now(),
    }));
    const h = huella(remotoItems);
    // Si hay cambios locales sin subir, esos son más nuevos; si es igual a lo del navegador, no hay nada que hacer.
    if (pendiente || h === huella(leer())) return;
    ultimoSubido = h + '|';
    escribirLocal(remotoItems, 'otro-dispositivo');
  }, () => avisoError('escuchar', 'Se perdió la conexión con tu cuenta: los cambios de tu carrito en otros dispositivos no se verán aquí.'));
}

function alCerrarSesion() {
  if (cancelarRemoto) { cancelarRemoto(); cancelarRemoto = null; }
  usuario = null;
  ultimoSubido = null;
  // El carrito ya está guardado en la cuenta: se borra del navegador por privacidad.
  if (localStorage.getItem(CLAVE_DUENO)) {
    localStorage.removeItem(CLAVE_DUENO);
    if (leer().length) escribirLocal([], 'cerrar-sesion');
  }
}

// ---------- 3. stock en vivo ----------

function vigilarStock() {
  escucharProductosScm((productos) => {
    const carrito = leer();
    if (!carrito.length) return;
    const porId = new Map(productos.map(p => [p.id, p]));
    const mensajes = [];
    let cambio = false;
    const ajustado = [];
    carrito.forEach(item => {
      const p = porId.get(item.id);
      const stock = p ? Math.max(0, Number(p.stock) || 0) : 0;
      if (!p || stock <= 0) {
        cambio = true;
        if (stockVisto.get(item.id) !== 0) mensajes.push(`"${item.nombre}" se acaba de agotar y se quitó de tu carrito.`);
        stockVisto.set(item.id, 0);
        return;
      }
      if (Number(item.cantidad) > stock) {
        cambio = true;
        if (stockVisto.get(item.id) !== stock) {
          mensajes.push(`Alguien más acaba de comprar "${item.nombre}": solo ${stock === 1 ? 'queda 1' : `quedan ${stock}`}, ajustamos tu carrito.`);
        }
        stockVisto.set(item.id, stock);
        ajustado.push({ ...item, cantidad: stock });
        return;
      }
      ajustado.push(item);
    });
    if (cambio) {
      escribirLocal(ajustado, 'stock');
      programarSubida();
      if (mensajes.length) aviso(mensajes.join(' '));
    }
  }, () => avisoError('stock', 'No se pudo revisar el stock en vivo. Al pagar se vuelve a revisar que haya piezas.'));
}

// ---------- arranque ----------

revisarCaducidad();
setInterval(revisarCaducidad, 60 * 1000);
vigilarStock();

// Cada vez que una página guarda el carrito (todas lanzan "actualizarCarrito"), se le pone fecha
// a lo nuevo y se programa la copia a Firebase.
window.addEventListener('actualizarCarrito', () => {
  revisarCaducidad();
  if (usuario) { pendiente = true; programarSubida(); }
});
// Cambios desde otra pestaña del mismo navegador.
window.addEventListener('storage', (e) => {
  if (e.key === CLAVE) window.dispatchEvent(new CustomEvent('carritoCambioExterno', { detail: { motivo: 'otra-pestana' } }));
});

observarSesionCliente((user) => {
  // Durante el registro Firebase abre y cierra sesión enseguida: el carrito no se toca.
  let registrando = false;
  try { registrando = sessionStorage.getItem('bpRegistrando') === '1'; } catch { /* sin almacenamiento */ }
  if (registrando) {
    if (!user) { try { sessionStorage.removeItem('bpRegistrando'); } catch { /* idem */ } }
    return;
  }
  if (user) alIniciarSesion(user).catch(() => avisoError('sesion', 'No se pudo sincronizar tu carrito con tu cuenta.'));
  else alCerrarSesion();
});
