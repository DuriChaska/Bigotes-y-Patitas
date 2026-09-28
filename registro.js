// ============================================
//  Bigotes y Patitas - registro.js
//  Formulario público de registro de clientes.
//  Crea una cuenta REAL en Firebase Authentication (con la
//  contraseña que escribe la persona) y, ya con la sesión
//  iniciada, guarda su perfil en Firestore (clientes/{uid}),
//  para que también aparezca de inmediato en el CRM.
// ============================================

import { registrarCliente } from "./firebase-db.js";

const form = document.getElementById("registerForm");
const mensajeExito = document.getElementById("registerMessage");
const mensajeError = document.getElementById("registerError");

const nextParam = new URLSearchParams(window.location.search).get('next');
const linkLogin = document.getElementById("linkLogin");
if (linkLogin) linkLogin.href = 'login.html' + (nextParam ? '?next=' + encodeURIComponent(nextParam) : '');

const ERRORES_FIREBASE = {
  'auth/email-already-in-use': 'Ya existe una cuenta registrada con ese correo.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/weak-password': 'La contraseña es demasiado débil (usa al menos 6 caracteres).',
};

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.style.display = "block";
}

form.addEventListener("submit", async function (e) {
  e.preventDefault();
  mensajeError.style.display = "none";

  const nombre = document.getElementById("reg-nombre").value.trim();
  const apellidos = document.getElementById("reg-apellidos").value.trim();
  const correo = document.getElementById("reg-correo").value.trim();
  const telefono = document.getElementById("reg-telefono").value.trim();
  const mascota = document.getElementById("reg-mascota").value.trim();
  const pass = document.getElementById("reg-pass").value;
  const pass2 = document.getElementById("reg-pass2").value;

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

  try {
    await registrarCliente({
      nombre: `${nombre} ${apellidos}`.trim(),
      correo,
      contrasena: pass,
      telefono,
      mascota: mascota || "Sin especificar",
    });

    mensajeExito.style.display = "block";
    form.reset();
    // La cuenta ya quedó con sesión iniciada: se manda directo a la tienda
    // (o de vuelta a donde iba, p. ej. Checkout.html, si venía de ahí).
    setTimeout(() => {
      window.location.href = nextParam || "index.html";
    }, 1500);
  } catch (err) {
    console.error(err);
    mostrarError(ERRORES_FIREBASE[err.code] || ("No se pudo completar el registro: " + (err.message || "revisa tu conexión.")));
    boton.disabled = false;
    boton.textContent = "REGISTRARSE";
  }
});
