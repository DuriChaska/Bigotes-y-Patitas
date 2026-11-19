// ============================================
//  Bigotes y Patitas - Cloud Functions (Etapa 4)
//  Se ejecutan en los servidores de Google, NO en el navegador. Requieren el plan Blaze.
//
//  eliminarClienteCompleto({ uid })
//    La llama el panel (admin-clientes.html → eliminarClienteCompleto() de firebase-db.js).
//    Una página web no puede borrar la cuenta de acceso de OTRA persona; aquí sí, con el
//    Admin SDK. Borra:
//      - la cuenta de Firebase Authentication (el correo queda libre para registrarse otra vez)
//      - clientes/{uid} con sus direcciones
//      - carritos/{uid} con su detalle
//      - fotos_perfil/{uid}
//    Conserva ventas, pagos, tickets y movimientos del monedero (historial del negocio) y deja
//    un registro en bajas/{uid} con quién y cuándo la eliminó.
//
//  Publicar (desde la carpeta del proyecto):
//    cd functions && npm install && cd ..
//    firebase deploy --only functions
// ============================================

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

exports.eliminarClienteCompleto = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión en el panel para eliminar clientes.");
  }
  const db = getFirestore();

  // Solo el personal de ventas (administrador o vendedor), igual que en las reglas del CRM.
  const quien = await db.doc(`usuarios/${request.auth.uid}`).get();
  const rol = quien.exists ? quien.get("rol") : null;
  if (!["administrador", "vendedor"].includes(rol)) {
    throw new HttpsError("permission-denied", "Tu rol no puede eliminar clientes.");
  }

  const uid = String((request.data && request.data.uid) || "");
  if (!uid || uid.includes("/") || uid.length > 128) {
    throw new HttpsError("invalid-argument", "Falta el cliente a eliminar.");
  }
  if (uid === request.auth.uid) {
    throw new HttpsError("failed-precondition", "No puedes eliminar tu propia cuenta desde aquí.");
  }
  // Las cuentas del personal se manejan en "Usuarios", no aquí.
  if ((await db.doc(`usuarios/${uid}`).get()).exists) {
    throw new HttpsError("failed-precondition", "Esa es una cuenta del personal: quítale el acceso desde Usuarios.");
  }

  const ficha = await db.doc(`clientes/${uid}`).get();

  // 1) Cuenta de acceso. Los clientes que el CRM dio de alta a mano no tienen: no es error.
  let cuentaBorrada = false;
  try {
    await getAuth().deleteUser(uid);
    cuentaBorrada = true;
  } catch (err) {
    if (err.code !== "auth/user-not-found") {
      throw new HttpsError("internal", "No se pudo borrar la cuenta de acceso. Intenta de nuevo.");
    }
  }

  // 2) Datos de la cuenta (con sus subcolecciones).
  await db.recursiveDelete(db.doc(`clientes/${uid}`));
  await db.recursiveDelete(db.doc(`carritos/${uid}`));
  await db.doc(`fotos_perfil/${uid}`).delete();

  // 3) Registro de la eliminación.
  await db.doc(`bajas/${uid}`).set({
    clienteId: uid,
    nombre: ficha.exists ? String(ficha.get("nombre") || "") : "",
    correo: ficha.exists ? String(ficha.get("correo") || "") : "",
    estado: "Completada",
    metodo: "Cloud Function",
    usuarioId: request.auth.uid,
    usuarioNombre: String(quien.get("nombre") || quien.get("correo") || ""),
    fecha: FieldValue.serverTimestamp(),
  });

  return { cuentaBorrada };
});
