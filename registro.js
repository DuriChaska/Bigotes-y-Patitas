// ============================================
//  Bigotes y Patitas - registro.js
//  Registro de clientes en 4 pasos (pestaña "Registrarme" de login.html):
//    1. Nombre, apellidos y código postal
//    2. Correo y teléfono
//    3. Contraseña (con reglas en vivo) y aviso de privacidad
//    4. Mascota de interés (se puede omitir)
//  Crea una cuenta REAL en Firebase Authentication (Firebase guarda la
//  contraseña con hash, nunca en texto), guarda el perfil en Firestore
//  (clientes/{uid}) para el CRM, manda el correo de bienvenida y CIERRA
//  la sesión: la persona entra después con sus datos.
// ============================================

import { registrarCliente, logoutCliente } from "./firebase-db.js";
import { enviarCorreoBienvenida } from "./email-recibo.js";
import { destinoSeguro } from "./login.js";

const $ = (id) => document.getElementById(id);
const nextParam = destinoSeguro(new URLSearchParams(window.location.search).get('next'), '');

const ERRORES_FIREBASE = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión o usa "¿Olvidaste tu contraseña?". (Si la tienda dio de baja esa cuenta, inicia sesión una vez con la contraseña anterior y se terminará de borrar.)',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña es demasiado débil (usa al menos 6 caracteres).',
  'auth/password-does-not-meet-requirements': 'La contraseña no cumple los requisitos de seguridad.',
  'auth/network-request-failed': 'Sin conexión a internet. Revisa tu conexión e intenta de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/operation-not-allowed': 'El registro con correo y contraseña no está activado en Firebase (Authentication → Método de acceso).',
  'permission-denied': 'Tu cuenta se creó, pero Firebase no dejó guardar tu perfil (falta publicar las reglas actualizadas). Avisa a la tienda.',
};
// En qué paso se corrige cada error de Firebase
const PASO_DEL_ERROR = { 'auth/email-already-in-use': 2, 'auth/invalid-email': 2, 'auth/weak-password': 3, 'auth/password-does-not-meet-requirements': 3 };

const RE_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_PASS_PERMITIDOS = /^[A-Za-z0-9ÑñÁÉÍÓÚáéíóúÜü#@!?¿¡$]*$/;

const NOMBRES_PASO = ['', 'Datos personales', 'Datos de la cuenta', 'Crea tu contraseña', 'Elige tu mascota favorita (este paso puede omitirse)'];

const RAZAS = ['Mixta', 'Affenpinscher', 'Akita', 'Alaskan Malamute', 'Basset Hound', 'Beagle', 'Bichón Frisé', 'Bichón Maltés',
  'Border Collie', 'Boston Terrier', 'Bóxer', 'Bull Terrier', 'Bulldog Francés', 'Bulldog Inglés', 'Cane Corso', 'Cavalier King Charles',
  'Chihuahua', 'Chow Chow', 'Cocker Spaniel', 'Collie', 'Dachshund (Salchicha)', 'Dálmata', 'Dóberman', 'Dogo Argentino',
  'Fox Terrier', 'Golden Retriever', 'Gran Danés', 'Husky Siberiano', 'Jack Russell Terrier', 'Labrador Retriever', 'Lhasa Apso',
  'Mastín', 'Pastor Alemán', 'Pastor Australiano', 'Pastor Belga', 'Pequinés', 'Pinscher Miniatura', 'Pitbull', 'Pomerania',
  'Poodle (Caniche)', 'Pug', 'Rottweiler', 'Samoyedo', 'San Bernardo', 'Schnauzer', 'Shar Pei', 'Shiba Inu', 'Shih Tzu',
  'Weimaraner', 'West Highland Terrier', 'Xoloitzcuintle', 'Yorkshire Terrier'];
const COLORES_GATO = ['Sin especificar', 'Negro', 'Blanco', 'Gris', 'Naranja', 'Marrón', 'Canela', 'Chocolate', 'Crema', 'Plateado',
  'Atigrado', 'Moteado', 'Carey', 'Calicó (tres colores)', 'Bicolor', 'Siamés (puntas de color)'];
const OTRAS = ['Conejo', 'Hámster', 'Cuyo', 'Hurón', 'Ave', 'Pez', 'Tortuga', 'Reptil', 'Otra'];

const DETALLE = {
  'Perro': { titulo: 'Escribe o selecciona la raza del perrito de tu interés', buscar: 'Busca la raza de tu mascota', opciones: RAZAS },
  'Gato': { titulo: 'Escribe o selecciona el color del gatito de tu interés', buscar: 'Busca el color de tu mascota', opciones: COLORES_GATO },
  'Otras mascotas': { titulo: '¿Qué otra mascota te interesa?', buscar: 'Busca tu mascota', opciones: OTRAS },
};

let paso = 1;
let tipoMascota = '';
let detalleMascota = '';

const formPaso = (n) => document.querySelector(`.ac-paso-form[data-paso="${n}"]`);
function errorPaso(n, texto) {
  const p = document.querySelector(`[data-error="${n}"]`);
  p.textContent = texto || '';
  p.hidden = !texto;
}

function irAPaso(n, { enfocar = true } = {}) {
  paso = n;
  document.querySelectorAll('.ac-paso-form').forEach((f) => { f.hidden = Number(f.dataset.paso) !== n; });
  $('paso-num').textContent = n;
  $('paso-nombre').textContent = NOMBRES_PASO[n];
  document.querySelectorAll('.ac-progreso span').forEach((s, i) => s.classList.toggle('hecho', i < n));
  if (n === 2) $('saludo-nombre').textContent = $('reg-nombre').value.trim().split(/\s+/)[0] || 'Hola';
  if (!enfocar) return;
  const panel = $('panel-registro');
  if (panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => formPaso(n).querySelector('input:not([type=checkbox])')?.focus({ preventScroll: true }), 50);
}

document.querySelectorAll('[data-volver]').forEach((b) => b.addEventListener('click', () => irAPaso(Math.max(1, paso - 1))));

// Solo números en código postal y teléfono (se quitan guiones y espacios ANTES de recortar).
[['reg-cp', 5], ['reg-telefono', 10]].forEach(([id, largo]) => $(id).addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, largo);
}));

// ---------- Paso 1 ----------
formPaso(1).addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = $('reg-nombre').value.trim();
  const paterno = $('reg-paterno').value.trim();
  const materno = $('reg-materno').value.trim();
  const cp = $('reg-cp').value.trim();
  if (!nombre || !RE_NOMBRE.test(nombre)) { errorPaso(1, 'Escribe tu nombre (solo letras).'); $('reg-nombre').focus(); return; }
  if (!paterno || !RE_NOMBRE.test(paterno)) { errorPaso(1, 'Escribe tu apellido paterno (solo letras).'); $('reg-paterno').focus(); return; }
  if (materno && !RE_NOMBRE.test(materno)) { errorPaso(1, 'El apellido materno solo puede llevar letras.'); $('reg-materno').focus(); return; }
  if (!/^\d{5}$/.test(cp)) { errorPaso(1, 'El código postal debe tener 5 dígitos.'); $('reg-cp').focus(); return; }
  errorPaso(1, '');
  irAPaso(2);
});

// ---------- Paso 2 ----------
formPaso(2).addEventListener('submit', (e) => {
  e.preventDefault();
  const correo = $('reg-correo').value.trim().toLowerCase();
  const tel = $('reg-telefono').value.trim();
  if (!RE_CORREO.test(correo)) { errorPaso(2, 'Escribe un correo válido, por ejemplo nombre@correo.com.'); $('reg-correo').focus(); return; }
  if (!/^\d{10}$/.test(tel)) { errorPaso(2, 'El teléfono debe tener 10 dígitos.'); $('reg-telefono').focus(); return; }
  errorPaso(2, '');
  irAPaso(3);
});

// ---------- Paso 3 ----------
function revisarPass() {
  const p = $('reg-pass').value;
  const r = {
    largo: p.length >= 6,
    mayus: /[a-zñáéíóúü]/.test(p) && /[A-ZÑÁÉÍÓÚÜ]/.test(p),
    simbolos: p.length > 0 && RE_PASS_PERMITIDOS.test(p),
  };
  document.querySelectorAll('#reglas-pass li').forEach((li) => {
    const ok = r[li.dataset.regla];
    li.classList.toggle('ok', ok);
    li.classList.toggle('mal', p.length > 0 && !ok);
  });
  return r.largo && r.mayus && r.simbolos;
}
$('reg-pass').addEventListener('input', revisarPass);

formPaso(3).addEventListener('submit', (e) => {
  e.preventDefault();
  if (!revisarPass()) { errorPaso(3, 'Tu contraseña aún no cumple las 3 reglas de abajo.'); $('reg-pass').focus(); return; }
  if ($('reg-pass').value !== $('reg-pass2').value) { errorPaso(3, 'Las contraseñas no coinciden.'); $('reg-pass2').focus(); return; }
  if (!$('reg-aviso').checked) { errorPaso(3, 'Para crear tu cuenta acepta el aviso de privacidad y los términos y condiciones.'); $('reg-aviso').focus(); return; }
  errorPaso(3, '');
  irAPaso(4);
});

// ---------- Paso 4: mascota (opcional) ----------
function pintarOpciones() {
  const cfg = DETALLE[tipoMascota];
  if (!cfg) return;
  const filtro = $('detalle-buscar').value.trim();
  const normal = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let lista = cfg.opciones.filter((o) => normal(o).includes(normal(filtro)));
  // Si no está en la lista, se puede usar lo que escribió.
  const escrito = filtro && lista.length === 0 ? filtro.slice(0, 40) : '';
  if (detalleMascota && !cfg.opciones.includes(detalleMascota) && detalleMascota !== escrito && !lista.includes(detalleMascota)) lista = [detalleMascota, ...lista];
  const items = (escrito ? [escrito] : []).concat(lista);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('detalle-lista').innerHTML = items.length ? items.map((o, i) => `
    <button type="button" role="radio" class="ac-opcion${o === detalleMascota ? ' elegida' : ''}" aria-checked="${o === detalleMascota}" data-valor="${esc(o)}">
      <span class="ac-radio"></span>${i === 0 && escrito ? `Usar “${esc(o)}”` : esc(o)}
    </button>`).join('')
    : '<p class="ac-nota" style="padding:14px;">Sin resultados.</p>';
}

document.querySelectorAll('.ac-mascota').forEach((b) => b.addEventListener('click', () => {
  const tipo = b.dataset.tipo;
  tipoMascota = tipoMascota === tipo ? '' : tipo;     // un segundo clic la deselecciona (el paso es opcional)
  detalleMascota = '';
  document.querySelectorAll('.ac-mascota').forEach((x) => {
    const sel = x.dataset.tipo === tipoMascota;
    x.classList.toggle('elegida', sel);
    x.setAttribute('aria-checked', String(sel));
  });
  const cfg = DETALLE[tipoMascota];
  $('caja-detalle').hidden = !cfg;
  if (cfg) {
    $('detalle-titulo').textContent = cfg.titulo;
    $('detalle-buscar').placeholder = cfg.buscar;
    $('detalle-buscar').value = '';
    pintarOpciones();
  }
}));
$('detalle-buscar').addEventListener('input', pintarOpciones);
$('detalle-buscar').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
$('detalle-lista').addEventListener('click', (e) => {
  const b = e.target.closest('[data-valor]');
  if (!b) return;
  detalleMascota = b.dataset.valor;
  pintarOpciones();
});

function textoMascota() {
  if (!tipoMascota) return 'Sin especificar';
  if (!detalleMascota || detalleMascota === 'Sin especificar') return tipoMascota;
  return `${tipoMascota} · ${detalleMascota}`.slice(0, 60);
}

// ---------- Crear cuenta ----------
formPaso(4).addEventListener('submit', async (e) => {
  e.preventDefault();
  errorPaso(4, '');
  const nombre = $('reg-nombre').value.trim();
  const paterno = $('reg-paterno').value.trim();
  const materno = $('reg-materno').value.trim();
  const nombreCompleto = [nombre, paterno, materno].filter(Boolean).join(' ');
  const correo = $('reg-correo').value.trim().toLowerCase();

  const boton = $('btn-crear');
  boton.disabled = true;
  boton.textContent = 'Creando tu cuenta...';

  // Firebase inicia sesión solo al crear la cuenta; este aviso hace que el carrito (carrito-sync.js)
  // y el perfil (components.js) no se toquen en ese momento, porque enseguida se cierra la sesión.
  try { sessionStorage.setItem('bpRegistrando', '1'); } catch { /* sin almacenamiento */ }

  try {
    await registrarCliente({
      nombre: nombreCompleto,
      correo,
      contrasena: $('reg-pass').value,
      telefono: $('reg-telefono').value.trim(),
      mascota: textoMascota(),
      apellidoPaterno: paterno,
      apellidoMaterno: materno,
      codigoPostal: $('reg-cp').value.trim(),
      aceptaPromociones: $('reg-promos').checked,
    });

    // Correo de bienvenida con el diseño de la tienda (si la plantilla de EmailJS está configurada).
    try { await enviarCorreoBienvenida({ nombre: nombreCompleto, correo }); } catch { /* opcional */ }

    // No se queda con la sesión abierta: la persona inicia sesión con sus datos.
    try { await logoutCliente(); } catch { /* igual se manda al login */ }

    const msg = $('registerMessage');
    msg.textContent = '¡Cuenta creada! Te enviamos un correo de bienvenida. Ahora inicia sesión con tu correo y contraseña…';
    msg.hidden = false;
    const destino = 'login.html?registrado=1&correo=' + encodeURIComponent(correo)
      + (nextParam ? '&next=' + encodeURIComponent(nextParam) : '');
    setTimeout(() => { window.location.href = destino; }, 1800);
  } catch (err) {
    try { sessionStorage.removeItem('bpRegistrando'); } catch { /* sin almacenamiento */ }
    const texto = ERRORES_FIREBASE[err.code] || ('No se pudo completar el registro: ' + (err.message || 'revisa tu conexión.'));
    const volverA = PASO_DEL_ERROR[err.code];
    if (volverA) { irAPaso(volverA); errorPaso(volverA, texto); }
    else errorPaso(4, texto);
    boton.disabled = false;
    boton.textContent = 'Crear cuenta';
  }
});

// Si llega con ?modo=registro&correo=... (desde "Únete a la manada"), el correo ya va escrito en el paso 2.
{
  const p = new URLSearchParams(window.location.search);
  if (p.get('modo') === 'registro' && p.get('correo')) $('reg-correo').value = p.get('correo').trim().slice(0, 120);
}
irAPaso(1, { enfocar: false });
