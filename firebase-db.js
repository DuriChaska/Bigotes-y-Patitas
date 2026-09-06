// ============================================
//  Bigotes y Patitas - firebase-db.js
//  Funciones reutilizables para hablar con Firestore
//  y con Firebase Authentication desde el panel de
//  administración. Todas las páginas importan de aquí
//  en vez de repetir código de Firebase.
//
//  Colecciones en Firestore:
//    clientes/{id}      { nombre, mascota, correo, telefono,
//                          etapa, estado, fechaRegistro }
//    interacciones/{id} { clienteId, clienteNombre, tipo,
//                          descripcion, fecha, usuario, creadoEn }
//    usuarios/{uid}     { nombre, correo, rol: "administrador"|"vendedor" }
// ============================================

import { auth, db, firebaseConfig } from "./firebase-config.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const clientesRef = collection(db, "clientes");
const interaccionesRef = collection(db, "interacciones");
const usuariosRef = collection(db, "usuarios");

// ---------- Autenticación ----------

export function loginAdmin(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logoutAdmin() {
  return signOut(auth);
}

/** Ejecuta callback(user) cada vez que cambia la sesión (user es null si no hay nadie logueado). */
export function observarSesion(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------- Perfil / roles ----------

/** Trae el documento de perfil (nombre, correo, rol) de un usuario por su uid. */
export async function obtenerPerfilUsuario(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/** Escucha en tiempo real la lista de usuarios (administradores y vendedores). */
export function escucharUsuarios(callback) {
  const q = query(usuariosRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  });
}

/**
 * Crea una cuenta nueva (Authentication) + su perfil con rol (Firestore),
 * sin cerrar la sesión de quien lo está creando.
 * Usa una instancia secundaria de Firebase solo para el alta, porque
 * Firebase Authentication cambia la sesión activa del navegador al usuario
 * recién creado si se usa la instancia principal.
 */
export async function crearUsuarioConRol({ nombre, correo, contrasena, rol }) {
  const appSecundaria = initializeApp(firebaseConfig, "secundaria-" + Date.now());
  const authSecundaria = getAuth(appSecundaria);
  try {
    const credencial = await createUserWithEmailAndPassword(authSecundaria, correo, contrasena);
    await updateProfile(credencial.user, { displayName: nombre });
    await setDoc(doc(db, "usuarios", credencial.user.uid), {
      nombre, correo, rol, creadoEn: serverTimestamp(),
    });
    await signOut(authSecundaria);
  } finally {
    await deleteApp(appSecundaria);
  }
}

export function actualizarRolUsuario(uid, rol) {
  return updateDoc(doc(db, "usuarios", uid), { rol });
}

/**
 * Elimina el PERFIL (Firestore) de un usuario, quitándole el acceso al panel.
 * Nota: esto no borra su cuenta de Firebase Authentication — eso requiere el
 * SDK de administrador desde un backend (p. ej. Cloud Functions), no se puede
 * hacer solo con el SDK del navegador. Sin el perfil en Firestore, el panel
 * lo bloquea igual la próxima vez que intente entrar.
 */
export function eliminarPerfilUsuario(uid) {
  return deleteDoc(doc(db, "usuarios", uid));
}

// ---------- Cuenta propia (Configuración) ----------

function credencialReautenticacion(contrasenaActual) {
  return EmailAuthProvider.credential(auth.currentUser.email, contrasenaActual);
}

/** Reautentica al usuario actual; Firebase lo exige antes de cambiar correo o contraseña. */
export function reautenticar(contrasenaActual) {
  return reauthenticateWithCredential(auth.currentUser, credencialReautenticacion(contrasenaActual));
}

/** Cambia el nombre para mostrar, tanto en Authentication como en el perfil de Firestore. */
export async function cambiarNombrePropio(nombreNuevo) {
  await updateProfile(auth.currentUser, { displayName: nombreNuevo });
  await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { nombre: nombreNuevo });
}

/** Cambia el correo de inicio de sesión (requiere la contraseña actual). */
export async function cambiarCorreoPropio(correoNuevo, contrasenaActual) {
  await reautenticar(contrasenaActual);
  await updateEmail(auth.currentUser, correoNuevo);
  await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { correo: correoNuevo });
}

/** Cambia la contraseña (requiere la contraseña actual). */
export async function cambiarContrasenaPropia(contrasenaNueva, contrasenaActual) {
  await reautenticar(contrasenaActual);
  await updatePassword(auth.currentUser, contrasenaNueva);
}

// ---------- Clientes ----------

/** Escucha la colección "clientes" en tiempo real. callback recibe un arreglo [{id, ...datos}]. */
export function escucharClientes(callback) {
  const q = query(clientesRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function obtenerCliente(id) {
  const snap = await getDoc(doc(db, "clientes", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function crearCliente(datos) {
  return addDoc(clientesRef, {
    ...datos,
    fechaRegistro: datos.fechaRegistro || new Date().toLocaleDateString('es-MX'),
    creadoEn: serverTimestamp(),
  });
}

export function actualizarCliente(id, datos) {
  return updateDoc(doc(db, "clientes", id), datos);
}

export function actualizarEtapaCliente(id, etapa) {
  return updateDoc(doc(db, "clientes", id), { etapa });
}

export function eliminarCliente(id) {
  return deleteDoc(doc(db, "clientes", id));
}

// ---------- Interacciones ----------

/** Escucha TODAS las interacciones (más recientes primero). */
export function escucharTodasInteracciones(callback) {
  const q = query(interaccionesRef, orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** Escucha únicamente las interacciones de un cliente. */
export function escucharInteraccionesDeCliente(clienteId, callback) {
  const q = query(interaccionesRef, where("clienteId", "==", clienteId), orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function crearInteraccion(datos) {
  return addDoc(interaccionesRef, {
    ...datos,
    creadoEn: serverTimestamp(),
  });
}

// ---------- Métricas (dashboard / reportes) ----------

/** Trae clientes e interacciones una sola vez y calcula los contadores del dashboard/reportes. */
export async function calcularMetricas() {
  const [clientesSnap, interaccionesSnap] = await Promise.all([
    getDocs(clientesRef),
    getDocs(interaccionesRef),
  ]);

  const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const interacciones = interaccionesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const hace30dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const totalClientes = clientes.length;
  const activos = clientes.filter(c => c.estado === "Activo").length;
  const inactivos = totalClientes - activos;

  const porEtapa = { Prospecto: 0, Activo: 0, Frecuente: 0, Inactivo: 0 };
  clientes.forEach(c => { if (porEtapa[c.etapa] !== undefined) porEtapa[c.etapa]++; });

  const porTipo = { Llamada: 0, Correo: 0, Reunión: 0 };
  interacciones.forEach(i => { if (porTipo[i.tipo] !== undefined) porTipo[i.tipo]++; });

  const interaccionesPorCliente = {};
  interacciones.forEach(i => {
    interaccionesPorCliente[i.clienteId] = (interaccionesPorCliente[i.clienteId] || 0) + 1;
  });
  const sinInteraccionReciente = clientes.filter(c => !interaccionesPorCliente[c.id]).length;

  return { clientes, interacciones, totalClientes, activos, inactivos, porEtapa, porTipo, sinInteraccionReciente };
}
