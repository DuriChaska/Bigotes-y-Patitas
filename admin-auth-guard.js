// ============================================
//  Bigotes y Patitas - admin-auth-guard.js
//  Se incluye en TODAS las páginas del panel de
//  administración (excepto admin-login.html).
//  1. Si no hay sesión de Firebase Auth, manda al login.
//  2. Si hay sesión, busca su perfil (nombre + rol) en
//     Firestore y expone window.BP_SESION para que cada
//     página sepa quién es y qué rol tiene.
//  3. Cada página declara su sección en <body>:
//       data-seccion="crm"  -> clientes, interacciones, reportes CRM
//       data-seccion="scm"  -> cadena de suministros (inventario, pedidos...)
//       data-solo-admin     -> solo administradores (p. ej. Usuarios)
//       (sin atributo)      -> cualquier persona del panel (Configuración)
//     y aquí se decide, según el rol, quién puede entrar:
//       administrador -> todo
//       vendedor      -> solo CRM
//       logistica     -> solo SCM
//     Quien entra a una sección que no le toca es mandado a su
//     página de inicio.
// ============================================

import { observarSesion, obtenerPerfilUsuario, logoutAdmin } from "./firebase-db.js";

// Secciones a las que puede entrar cada rol ("general" = páginas sin sección).
const SECCIONES_POR_ROL = {
  administrador: ["crm", "scm", "admin", "general"],
  vendedor:      ["crm", "general"],
  logistica:     ["scm", "general"],
};

// Página de inicio de cada rol (siempre dentro de sus secciones permitidas).
const INICIO_POR_ROL = {
  administrador: "admin.html",
  vendedor:      "admin.html",
  logistica:     "admin-scm.html",
};

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

  const permitidas = SECCIONES_POR_ROL[perfil.rol];
  if (!permitidas) {
    // Rol que el panel no conoce (p. ej. mal escrito en Firestore): se corta aquí
    // en vez de dejarlo entrar o caer en un ciclo de redirecciones.
    alert(
      "Tu perfil tiene un rol que el panel no reconoce (\"" + perfil.rol + "\"). " +
      "Pide a un administrador que lo corrija en Usuarios."
    );
    await logoutAdmin();
    window.location.href = "admin-login.html";
    return;
  }

  // Se revisa ANTES de mostrar el panel y de publicar la sesión, para que quien no
  // tenga permiso no llegue a ver ni un parpadeo del contenido y las páginas no
  // arranquen sus consultas.
  const seccion = document.body.dataset.seccion
    || (document.body.hasAttribute("data-solo-admin") ? "admin" : "general");
  if (!permitidas.includes(seccion)) {
    window.location.href = INICIO_POR_ROL[perfil.rol];
    return;
  }

  window.BP_SESION = { uid: user.uid, correo: perfil.correo || user.email, nombre: perfil.nombre, rol: perfil.rol };

  document.documentElement.classList.add("admin-autenticado");
  document.documentElement.classList.add("rol-" + perfil.rol);

  const chip = document.querySelector(".admin-profile-chip span");
  if (chip) chip.textContent = perfil.nombre || user.email.split("@")[0];

  document.dispatchEvent(new CustomEvent("bp-sesion-lista", { detail: window.BP_SESION }));
});
