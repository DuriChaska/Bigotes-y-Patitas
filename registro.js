// ============================================
//  Bigotes y Patitas - registro.js
//  Formulario público de registro de clientes.
//  Al registrarse, se crea directo un documento en
//  la colección "clientes" de Firestore, para que
//  aparezca de inmediato en el CRM (admin-clientes.html).
// ============================================

import { crearCliente } from "./firebase-db.js";

const form = document.getElementById("registerForm");
const mensajeExito = document.getElementById("registerMessage");
const mensajeError = document.getElementById("registerError");

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
    await crearCliente({
      nombre: `${nombre} ${apellidos}`.trim(),
      correo,
      telefono,
      mascota: mascota || "Sin especificar",
      etapa: "Prospecto",
      estado: "Activo",
    });

    mensajeExito.style.display = "block";
    form.reset();
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
  } catch (err) {
    mostrarError("No se pudo completar el registro: " + (err.message || "revisa tu conexión."));
    boton.disabled = false;
    boton.textContent = "REGISTRARSE";
  }
});
