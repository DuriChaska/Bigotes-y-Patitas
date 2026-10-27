// ============================================
//  Bigotes y Patitas - admin-auth-guard.js
//  Se incluye en TODAS las páginas del panel de
//  administración (excepto admin-login.html).
//  1. Si no hay sesión de Firebase Auth, manda al login.
//  2. Si hay sesión, busca su perfil (nombre + rol) en
//     Firestore y expone window.BP_SESION para que cada
//     página sepa quién es y qué rol tiene.
//  3. Cada página declara quién puede entrar en <body>:
//       data-roles="administrador,vendedor"  -> lista exacta de roles (la más precisa)
//       data-seccion="crm" | "scm"           -> clientes/interacciones | cadena de suministros
//       data-solo-admin                      -> solo administradores (p. ej. Usuarios)
//       (sin atributo)                       -> cualquier persona del panel (Configuración)
//     Roles: administrador (todo), vendedor ("Ventas": CRM + órdenes ERP + consulta
//     de productos/inventario) y logistica (SCM + órdenes ERP).
//     Quien entra a una página que no le toca es mandado a su página de inicio.
// ============================================

import { observarSesion, obtenerPerfilUsuario, logoutAdmin } from "./firebase-db.js";

// Secciones a las que puede entrar cada rol ("general" = páginas sin sección).
const SECCIONES_POR_ROL = {
  administrador: ["crm", "scm", "admin", "general"],
  vendedor:      ["crm", "general"],
  logistica:     ["scm", "general"],
};

// Página de inicio de cada rol (modo normal). Si quien entró estaba en una página del
// ERP, lo manda al dashboard ERP, que los tres roles pueden ver.
const INICIO_POR_ROL = {
  administrador: "admin.html",
  vendedor:      "admin.html",
  logistica:     "admin-scm.html",
};
const inicioPara = (rol) =>
  /^admin-erp/.test(window.location.pathname.split("/").pop()) ? "admin-erp.html" : INICIO_POR_ROL[rol];

window.BP_SESION = null;

// Si algo falla al cargar la sesión (sin internet, reglas de Firestore sin publicar,
// etc.) se avisa en pantalla en vez de dejar la página en blanco.
function mostrarErrorDeSesion(err) {
  console.error("[admin-auth-guard] No se pudo cargar la sesión:", err);
  const aviso = document.createElement("div");
  aviso.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;padding:14px 18px;background:#fdecea;color:#7a1c14;font:14px/1.4 sans-serif;border-bottom:2px solid #d93025;";
  const codigo = (err && (err.code || err.message)) || "error desconocido";
  aviso.innerHTML = "<strong>No se pudo cargar tu sesión.</strong> " +
    (String(codigo).includes("permission-denied")
      ? "Firebase negó el permiso: publica <code>firestore.rules</code> en la consola de Firebase (Firestore → Reglas → Publicar)."
      : "Revisa tu conexión y vuelve a intentar.") +
    " <small>(" + String(codigo).replace(/[<>&]/g, "") + ")</small>";
  document.body.appendChild(aviso);
}

async function entrarAlPanel(user) {
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
  const rolesPagina = (document.body.dataset.roles || "").split(",").map(r => r.trim()).filter(Boolean);
  const seccion = document.body.dataset.seccion
    || (document.body.hasAttribute("data-solo-admin") ? "admin" : "general");
  const puedeEntrar = rolesPagina.length > 0
    ? rolesPagina.includes(perfil.rol)
    : permitidas.includes(seccion);
  if (!puedeEntrar) {
    window.location.href = inicioPara(perfil.rol);
    return;
  }

  window.BP_SESION = { uid: user.uid, correo: perfil.correo || user.email, nombre: perfil.nombre, rol: perfil.rol };

  document.documentElement.classList.add("admin-autenticado");
  document.documentElement.classList.add("rol-" + perfil.rol);

  const chip = document.querySelector(".admin-profile-chip span");
  if (chip) chip.textContent = perfil.nombre || user.email.split("@")[0];

  document.dispatchEvent(new CustomEvent("bp-sesion-lista", { detail: window.BP_SESION }));
}

observarSesion((user) => {
  entrarAlPanel(user).catch(mostrarErrorDeSesion);
});
