// ============================================
//  Bigotes y Patitas - admin-auth-guard.js
//  Se incluye en TODAS las páginas del panel de
//  administración (excepto admin-login.html).
//  1. Si no hay sesión de Firebase Auth, manda al login.
//  2. Si hay sesión, busca su perfil (nombre + rol) en
//     Firestore y expone window.BP_SESION para que cada
//     página sepa si puede mostrar cosas de administrador.
//  3. Páginas marcadas como <body data-solo-admin> se
//     bloquean automáticamente para el rol "vendedor".
// ============================================

import { observarSesion, obtenerPerfilUsuario, logoutAdmin } from "./firebase-db.js";

window.BP_SESION = null;

observarSesion(async (user) => {
  if (!user) {
    window.location.href = "admin-login.html";
    return;
  }

  const perfil = await obtenerPerfilUsuario(user.uid);

  if (!perfil) {
    // Se pudo iniciar sesión en Authentication, pero no existe su perfil
    // (nombre + rol) en Firestore, así que el panel no sabe qué mostrarle.
    alert(
      "Tu cuenta existe pero no tiene un perfil con rol asignado en Firestore " +
      "(colección \"usuarios\"). Pide a un administrador que te dé de alta desde " +
      "Configuración → Usuarios, o revisa SETUP-FIREBASE.md si eres el primer " +
      "administrador del proyecto."
    );
    await logoutAdmin();
    window.location.href = "admin-login.html";
    return;
  }

  window.BP_SESION = { uid: user.uid, correo: perfil.correo || user.email, nombre: perfil.nombre, rol: perfil.rol };

  document.documentElement.classList.add('admin-autenticado');
  document.documentElement.classList.add('rol-' + perfil.rol);

  // Bloquea páginas marcadas <body data-solo-admin> para quien no sea administrador
  if (document.body.hasAttribute('data-solo-admin') && perfil.rol !== 'administrador') {
    window.location.href = 'admin.html';
    return;
  }

  const chip = document.querySelector('.admin-profile-chip span');
  if (chip) chip.textContent = perfil.nombre || user.email.split('@')[0];

  document.dispatchEvent(new CustomEvent('bp-sesion-lista', { detail: window.BP_SESION }));
});
