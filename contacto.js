// =============================================
// contacto.js - Formulario de "Contáctanos" (contact.html)
// El mensaje se guarda como un TICKET de Atención a clientes (mismo sistema que
// atencion-clientes.html y el panel de soporte), así el equipo lo ve y lo contesta.
// Para poder responder hace falta una cuenta: si no hay sesión, el borrador se
// guarda en el navegador, se pide iniciar sesión y al volver se envía con un clic.
// =============================================

import { observarSesionCliente, obtenerPerfilCliente, crearTicket } from './firebase-db.js';

const $ = (id) => document.getElementById(id);
const BORRADOR = 'bpBorradorContacto';
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let usuario = null;

function error(texto) { $('formError').textContent = texto; $('formError').hidden = !texto; }
function contar() { $('contador').textContent = `${$('c-mensaje').value.length} / 1800`; }
$('c-mensaje').addEventListener('input', contar);

function guardarBorrador() {
  try {
    sessionStorage.setItem(BORRADOR, JSON.stringify({
      nombre: $('c-nombre').value, correo: $('c-correo').value, asunto: $('c-asunto').value, mensaje: $('c-mensaje').value,
    }));
  } catch { /* sin almacenamiento */ }
}
function recuperarBorrador() {
  try {
    const b = JSON.parse(sessionStorage.getItem(BORRADOR) || 'null');
    if (!b) return false;
    if (b.nombre && !$('c-nombre').value) $('c-nombre').value = b.nombre;
    if (b.correo && !$('c-correo').value) $('c-correo').value = b.correo;
    if (b.asunto) $('c-asunto').value = b.asunto;
    if (b.mensaje) $('c-mensaje').value = b.mensaje;
    contar();
    return !!b.mensaje;
  } catch { return false; }
}

$('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  error('');
  const nombre = $('c-nombre').value.trim();
  const correo = $('c-correo').value.trim();
  const mensaje = $('c-mensaje').value.trim();
  if (nombre.length < 2) { error('Escribe tu nombre.'); $('c-nombre').focus(); return; }
  if (!RE_CORREO.test(correo)) { error('Escribe un correo válido, por ejemplo nombre@correo.com.'); $('c-correo').focus(); return; }
  if (mensaje.length < 10) { error('Cuéntanos un poco más en tu mensaje (mínimo 10 caracteres).'); $('c-mensaje').focus(); return; }

  if (!usuario) {
    guardarBorrador();
    const si = await window.bpConfirmar(
      'Para poder responderte necesitamos que inicies sesión (o crees tu cuenta). Tu mensaje queda guardado y lo envías al regresar.',
      { aceptar: 'Iniciar sesión', cancelar: 'Ahora no' });
    if (si) location.href = 'login.html?next=' + encodeURIComponent('contact.html') + '&correo=' + encodeURIComponent(correo);
    return;
  }

  const boton = $('sendBtn');
  boton.disabled = true;
  boton.textContent = 'Enviando…';
  try {
    // Si escribió desde otro correo, se agrega al mensaje para que soporte lo vea.
    const extra = correo.toLowerCase() !== String(usuario.email || '').toLowerCase()
      ? `\n\n(Correo de contacto indicado: ${correo})` : '';
    const folio = await crearTicket({
      asunto: $('c-asunto').value,
      mensaje: (mensaje + extra).slice(0, 2000),
      cliente: { uid: usuario.uid, nombre, correo: usuario.email || correo },
    });
    try { sessionStorage.removeItem(BORRADOR); } catch { /* sin almacenamiento */ }
    $('folio').textContent = folio;
    $('contactForm').hidden = true;
    $('exito').hidden = false;
    $('exito').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    error(err.code === 'permission-denied'
      ? 'Firebase no permitió enviar el mensaje (faltan publicar las reglas actualizadas). Avisa a la tienda.'
      : (err.message && !err.code ? err.message : 'No se pudo enviar tu mensaje. Revisa tu conexión e intenta de nuevo.'));
  } finally {
    boton.disabled = false;
    boton.textContent = 'Enviar mensaje';
  }
});

$('otroMensaje').addEventListener('click', () => {
  $('c-mensaje').value = '';
  contar();
  $('exito').hidden = true;
  $('contactForm').hidden = false;
  $('c-mensaje').focus();
});

recuperarBorrador();

observarSesionCliente(async (user) => {
  usuario = user;
  $('aviso-sesion').hidden = !!user;
  if (!user) return;
  if (!$('c-correo').value) $('c-correo').value = user.email || '';
  if (!$('c-nombre').value) {
    let nombre = user.displayName || '';
    try { const p = await obtenerPerfilCliente(user.uid); if (p?.nombre) nombre = p.nombre; } catch { /* sin perfil */ }
    $('c-nombre').value = nombre;
  }
  if (recuperarBorrador()) {
    $('formError').hidden = true;
    window.bpNotificar?.('Recuperamos tu mensaje. Revísalo y dale "Enviar mensaje".', 'ok');
  }
});
