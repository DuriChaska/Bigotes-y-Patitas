// ============================================
//  Bigotes y Patitas - registro.js
//  Formulario público de registro de clientes.
//  Crea una cuenta REAL en Firebase Authentication (con la
//  contraseña que escribe la persona; Firebase la guarda con
//  hash, nunca en texto), guarda su perfil en Firestore
//  (clientes/{uid}) para que aparezca en el CRM, manda el
//  correo de bienvenida y CIERRA la sesión: la persona entra
//  después con sus datos en login.html.
// ============================================

import { registrarCliente, logoutCliente } from "./firebase-db.js";
import { enviarCorreoBienvenida } from "./email-recibo.js";

const form = document.getElementById("registerForm");
const mensajeExito = document.getElementById("registerMessage");
const mensajeError = document.getElementById("registerError");

const nextParam = new URLSearchParams(window.location.search).get('next');
const linkLogin = document.getElementById("linkLogin");
if (linkLogin) linkLogin.href = 'login.html' + (nextParam ? '?next=' + encodeURIComponent(nextParam) : '');

const ERRORES_FIREBASE = {
  'auth/email-already-in-use': 'Ya existe una cuenta registrada con ese correo. Inicia sesión o usa "¿Olvidaste tu contraseña?". (Si la tienda dio de baja esa cuenta, inicia sesión una vez con la contraseña anterior y se terminará de borrar.)',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña es demasiado débil (usa al menos 6 caracteres).',
  'auth/network-request-failed': 'Sin conexión a internet. Revisa tu conexión e intenta de nuevo.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/operation-not-allowed': 'El registro con correo y contraseña no está activado en Firebase (Authentication → Método de acceso).',
  'permission-denied': 'Tu cuenta se creó, pero Firebase no dejó guardar tu perfil (falta publicar las reglas actualizadas). Avisa a la tienda.',
};

const RE_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// El teléfono solo acepta números.
document.getElementById("reg-telefono").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
});

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.style.display = "block";
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  mensajeError.style.display = "none";

  const nombre = document.getElementById("reg-nombre").value.trim();
  const apellidos = document.getElementById("reg-apellidos").value.trim();
  const correo = document.getElementById("reg-correo").value.trim().toLowerCase();
  const telefono = document.getElementById("reg-telefono").value.trim();
  const mascota = document.getElementById("reg-mascota").value.trim();
  const pass = document.getElementById("reg-pass").value;
  const pass2 = document.getElementById("reg-pass2").value;

  if (!nombre || !RE_NOMBRE.test(nombre)) { mostrarError("Escribe tu nombre (solo letras)."); return; }
  if (!apellidos || !RE_NOMBRE.test(apellidos)) { mostrarError("Escribe tus apellidos (solo letras)."); return; }
  if (!RE_CORREO.test(correo)) { mostrarError("Escribe un correo válido, por ejemplo nombre@correo.com."); return; }
  if (!/^\d{10}$/.test(telefono)) { mostrarError("El teléfono debe tener 10 dígitos."); return; }
  if (pass !== pass2) {
    mostrarError("Las contraseñas no coinciden.");
    return;
  }
  if (pass.length < 6) {
    mostrarError("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  const boton = form.querySelector("button[type=submit]");
  boton.disabled = true;
  boton.textContent = "Registrando...";

  // Firebase inicia sesión solo al crear la cuenta; este aviso hace que el carrito (carrito-sync.js)
  // no se mezcle ni se borre en ese momento, porque enseguida se cierra la sesión.
  try { sessionStorage.setItem("bpRegistrando", "1"); } catch { /* sin almacenamiento */ }

  try {
    await registrarCliente({
      nombre: `${nombre} ${apellidos}`.trim(),
      correo,
      contrasena: pass,
      telefono,
      mascota: mascota || "Sin especificar",
    });

    // Correo de bienvenida con el diseño de la tienda (si la plantilla de EmailJS está configurada).
    // Firebase ya mandó su correo de "confirma tu correo" dentro de registrarCliente().
    try { await enviarCorreoBienvenida({ nombre: `${nombre} ${apellidos}`.trim(), correo }); } catch { /* opcional */ }

    // No se queda con la sesión abierta: la persona inicia sesión con sus datos.
    try { await logoutCliente(); } catch { /* igual se manda al login */ }

    mensajeExito.style.display = "block";
    form.reset();
    const destino = "login.html?registrado=1&correo=" + encodeURIComponent(correo)
      + (nextParam ? "&next=" + encodeURIComponent(nextParam) : "");
    setTimeout(() => { window.location.href = destino; }, 1800);
  } catch (err) {
    try { sessionStorage.removeItem("bpRegistrando"); } catch { /* sin almacenamiento */ }
    mostrarError(ERRORES_FIREBASE[err.code] || ("No se pudo completar el registro: " + (err.message || "revisa tu conexión.")));
    boton.disabled = false;
    boton.textContent = "REGISTRARSE";
  }
});
