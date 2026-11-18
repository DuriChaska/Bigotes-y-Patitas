// ============================================
//  Bigotes y Patitas - login.js
//  Página de cuenta (login.html): pestañas "Iniciar sesión / Registrarme",
//  inicio de sesión con bloqueo tras 5 intentos fallidos y recuperación de
//  contraseña. El registro por pasos vive en registro.js.
//
//  ?modo=registro       abre directamente la pestaña "Registrarme"
//  ?next=pagina.html    a dónde regresar después de iniciar sesión
//  ?registrado=1 | restablecida=1 | verificado=1 | baja=1   avisos de llegada
//  ?correo=...          llena el correo
// ============================================

import { loginCliente, enviarCorreoRecuperacion } from './firebase-db.js';

const $ = (id) => document.getElementById(id);
const parametros = new URLSearchParams(window.location.search);

/** Solo deja regresar a páginas de esta misma tienda (evita redirecciones a otros sitios). */
export function destinoSeguro(valor, porDefecto = 'Interfaz Cliente - Perfil.html') {
  const v = String(valor || '').trim();
  if (!v || /^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//') || v.startsWith('\\')) return porDefecto;
  return /^[\w\-. %()]+\.html([?#].*)?$/i.test(v) ? v : porDefecto;
}
const next = parametros.get('next') ? destinoSeguro(parametros.get('next'), '') : '';

// ---------- Pestañas ----------
const TEXTOS = {
  login: {
    ruta: 'Inicia sesión', titulo: '¡Bienvenido!', doc: 'Iniciar sesión - Bigotes y Patitas',
    texto: 'Ingresa con tu <strong>correo electrónico</strong> para entrar a tu cuenta de <strong>Bigotes y Patitas</strong>.<br>¿Todavía no tienes cuenta? <a href="#" data-ir-tab="registro">Regístrate ahora</a>',
  },
  registro: {
    ruta: 'Crea tu cuenta', titulo: '¡Únete a la manada!', doc: 'Crear cuenta - Bigotes y Patitas',
    texto: 'Crea tu cuenta en <strong>4 pasos</strong> para comprar más rápido, guardar tus favoritos y seguir tus pedidos.<br>¿Ya tienes cuenta? <a href="#" data-ir-tab="login">Inicia sesión</a>',
  },
};

function mostrarTab(cual, { enfocar = true } = {}) {
  const esRegistro = cual === 'registro';
  $('panel-login').hidden = esRegistro;
  $('panel-registro').hidden = !esRegistro;
  $('tab-login').classList.toggle('activa', !esRegistro);
  $('tab-registro').classList.toggle('activa', esRegistro);
  $('tab-login').setAttribute('aria-selected', String(!esRegistro));
  $('tab-registro').setAttribute('aria-selected', String(esRegistro));
  const t = TEXTOS[esRegistro ? 'registro' : 'login'];
  $('ruta-actual').textContent = t.ruta;
  $('bienv-titulo').textContent = t.titulo;
  $('bienv-texto').innerHTML = t.texto;
  document.title = t.doc;
  const url = new URL(window.location.href);
  if (esRegistro) url.searchParams.set('modo', 'registro'); else url.searchParams.delete('modo');
  history.replaceState(null, '', url.pathname.split('/').pop() + url.search);
  if (enfocar) {
    const campo = esRegistro
      ? document.querySelector('.ac-paso-form:not([hidden]) input')
      : $('login-correo');
    campo?.focus();
  }
}
window.acMostrarTab = mostrarTab;

$('tab-login').addEventListener('click', () => mostrarTab('login'));
$('tab-registro').addEventListener('click', () => mostrarTab('registro'));
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-ir-tab]');
  if (a) { e.preventDefault(); mostrarTab(a.dataset.irTab); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});
mostrarTab(parametros.get('modo') === 'registro' ? 'registro' : 'login', { enfocar: false });

// ---------- Mostrar / ocultar contraseña ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ver]');
  if (!b) return;
  const input = $(b.dataset.ver);
  const ver = input.type === 'password';
  input.type = ver ? 'text' : 'password';
  b.querySelector('use').setAttribute('href', ver ? '#ac-ojo' : '#ac-ojo-no');
  b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

// ---------- Avisos al llegar ----------
const AVISOS_LLEGADA = {
  registrado: '✅ ¡Tu cuenta se creó! Te enviamos un correo de bienvenida. Inicia sesión con tu correo y contraseña.',
  restablecida: '✅ Tu contraseña se cambió. Inicia sesión con la nueva.',
  verificado: '✅ Tu correo quedó confirmado. Ya puedes iniciar sesión.',
  baja: 'Tu cuenta fue dada de baja por la tienda y se borró. Si quieres, puedes registrarte de nuevo con el mismo correo.',
};
const llegada = Object.keys(AVISOS_LLEGADA).find(k => parametros.get(k) === '1');
if (llegada) {
  $('aviso-llegada').textContent = AVISOS_LLEGADA[llegada];
  $('aviso-llegada').hidden = false;
}
if (parametros.get('correo')) {
  $('login-correo').value = parametros.get('correo');
  if (!$('panel-login').hidden) $('login-pass').focus();
}

// ---------- Iniciar sesión ----------
const form = $('loginForm');
const error = $('loginError');
const botonLogin = form.querySelector('button[type=submit]');

// Mismo mensaje si el correo no existe o la contraseña está mal: así nadie puede averiguar qué correos tienen cuenta.
const ERRORES_FIREBASE = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento e intenta de nuevo.',
  'auth/network-request-failed': 'Sin conexión a internet. Revisa tu conexión e intenta de nuevo.',
};

function mostrarError(texto) { error.textContent = texto; error.hidden = false; }
function reactivar() { botonLogin.disabled = false; botonLogin.textContent = 'Iniciar sesión'; }

// Bloqueo de 5 minutos tras 5 intentos fallidos (cuenta regresiva en pantalla)
let relojBloqueo = null;
function mostrarBloqueo(restanteMs) {
  const fin = Date.now() + restanteMs;
  clearInterval(relojBloqueo);
  const pintar = () => {
    const ms = fin - Date.now();
    if (ms <= 0) { clearInterval(relojBloqueo); error.hidden = true; reactivar(); return; }
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    mostrarError(`🔒 Por seguridad bloqueamos el acceso a esta cuenta después de 5 intentos fallidos. Podrás intentar de nuevo en ${m}:${String(s).padStart(2, '0')}.`);
    botonLogin.disabled = true;
    botonLogin.textContent = 'Bloqueado';
  };
  pintar();
  relojBloqueo = setInterval(pintar, 1000);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  const correo = $('login-correo').value.trim();
  const pass = $('login-pass').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { mostrarError('Escribe un correo válido.'); $('login-correo').focus(); return; }
  if (!pass) { mostrarError('Escribe tu contraseña.'); $('login-pass').focus(); return; }

  botonLogin.disabled = true;
  botonLogin.textContent = 'Entrando...';
  try {
    await loginCliente(correo, pass);
    window.location.href = next || 'Interfaz Cliente - Perfil.html';
  } catch (err) {
    if (err.code === 'bp/cuenta-bloqueada') { mostrarBloqueo(err.restanteMs); return; }
    if (err.code === 'bp/cuenta-dada-de-baja') { mostrarError(err.message); reactivar(); return; }
    let texto = ERRORES_FIREBASE[err.code] || 'No se pudo iniciar sesión. Revisa tu conexión.';
    if (typeof err.intentosRestantes === 'number') {
      texto += err.intentosRestantes === 1
        ? ' Te queda 1 intento antes de que la cuenta se bloquee 5 minutos.'
        : ` Te quedan ${err.intentosRestantes} intentos.`;
    }
    mostrarError(texto);
    reactivar();
  }
});

// ---------- ¿Olvidaste tu contraseña? ----------
const olvideForm = $('olvideForm');
const olvideMsg = $('olvideMsg');
function verOlvide(ver) {
  olvideForm.hidden = !ver;
  form.hidden = ver;
  $('pie-olvide').hidden = ver;
  olvideMsg.hidden = true;
  if (ver) { $('olvide-correo').value = $('login-correo').value.trim(); $('olvide-correo').focus(); }
  else $('login-correo').focus();
}
$('linkOlvide').addEventListener('click', (e) => { e.preventDefault(); verOlvide(true); });
$('olvideVolver').addEventListener('click', () => verOlvide(false));

olvideForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const correo = $('olvide-correo').value.trim();
  const boton = olvideForm.querySelector('button[type=submit]');
  const pintar = (texto, ok) => { olvideMsg.textContent = texto; olvideMsg.className = ok ? 'ac-exito' : 'ac-error'; olvideMsg.hidden = false; };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { pintar('Escribe un correo válido.', false); return; }
  boton.disabled = true;
  try {
    await enviarCorreoRecuperacion(correo);
    // Por seguridad no se dice si el correo existe o no.
    pintar(`Si ${correo} tiene una cuenta, te llegará un enlace en unos minutos (revisa también spam). Abre el correo MÁS RECIENTE: el enlace sirve una sola vez y por 1 hora.`, true);
  } catch (err) {
    pintar(err.code === 'bp/espera-reenvio' ? err.message
      : err.code === 'auth/too-many-requests' ? 'Demasiados intentos. Espera un momento.'
      : err.code === 'auth/invalid-email' ? 'El correo no es válido.' : 'No se pudo enviar el enlace. Revisa tu conexión.', false);
  }
  boton.disabled = false;
});

// ---------- Aviso de privacidad ----------
const modalAviso = $('modal-aviso');
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-abrir-aviso]')) { e.preventDefault(); modalAviso.hidden = false; $('aceptar-aviso').focus(); }
});
modalAviso.addEventListener('click', (e) => {
  if (e.target === modalAviso || e.target.closest('.pd-modal-cerrar')) modalAviso.hidden = true;
});
$('aceptar-aviso').addEventListener('click', () => { modalAviso.hidden = true; $('reg-aviso').checked = true; $('reg-aviso').focus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modalAviso.hidden = true; });
