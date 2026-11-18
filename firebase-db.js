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
//                          Los clientes que se registran de verdad en la
//                          tienda tienen id == su uid de Authentication;
//                          los que el CRM agrega a mano tienen un id al azar.
//    interacciones/{id} { clienteId, clienteNombre, tipo,
//                          descripcion, fecha, usuario, creadoEn }
//    usuarios/{uid}     { nombre, correo, rol: "administrador"|"vendedor"|"logistica"|"soporte" }
//    ventas/{id}        { clienteId (uid), clienteNombre, clienteCorreo,
//                          items: [{ productoId, nombre, precio, cantidad }],
//                          subtotal, descuento, cupon, envio, iva, tasaIva, ivaIncluido,
//                          total, folio, direccionEnvio, metodoPago, metodoPagoClave,
//                          pagoDetalle, estadoPago, referenciaPago, estado, historial, creadoEn }
//    impuestos/iva      { nombre, tasa, activo, incluidoEnPrecio, actualizadoPor, actualizadoEn }
//                          (una compra real de un cliente; descuenta stock)
//    scm_productos/{id} { nombre, descripcion, categoria, proveedor, proveedorId,
//                          stock, stockMin, estrategia: "PUSH"|"PULL", costo, img }
//    scm_proveedores/{id} { nombre, contacto, correo, telefono, direccion }
//    scm_pedidos/{id}    { folio, productoId, producto, cantidad, tipo: "Reposición"|"Venta",
//                          proveedorId, proveedor, fecha, estado: "Pendiente"|"En proceso"|
//                          "Surtido"|"Cancelado", notas }
//    scm_movimientos/{id} { productoId, producto, tipo: "Entrada"|"Salida", cantidad,
//                          motivo, fecha, usuario }
//    scm_estado/madurez  { items: { <idDelPunto>: true|false }, actualizadoEn }
//                          (todas las colecciones SCM: administradores y logística, ver firestore.rules)
//    Etapa 4 · cuenta y monedero (integrante 2):
//    monederos/{uid}     { clienteId, clienteNombre, saldo, totalRecargado, totalGastado,
//                          ultimoMovimientoId, creadoEn, actualizadoEn }
//    monedero_movimientos/{id} { clienteId, clienteNombre, tipo: "Recarga"|"Pago"|"Ajuste"|"Reembolso",
//                          efecto: "abono"|"cargo", monto, saldoAnterior, saldoNuevo, metodo,
//                          detalle, ventaId, folio, motivo, usuarioId, usuarioNombre, fecha, creadoEn }
//    clientes/{uid}/direcciones/{id} { alias, nombre, apellido, pais, calle, ciudad, estado, cp,
//                          telefono, referencias, predeterminada, creadoEn, actualizadoEn }
//    carritos/{uid}      { clienteId, clienteNombre, estado, numProductos, totalPiezas, subtotal,
//                          resumen, ultimaVentaId, actualizadoEn }
//    carritos/{uid}/detalle/{productoId} { productoId, nombre, cantidad, precioUnitario, imagen, agregadoEn }
// ============================================

import { auth, db, firebaseConfig, firebaseApp } from "./firebase-config.js";
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
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
  sendEmailVerification,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc,
  addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, runTransaction,
  arrayUnion, increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const clientesRef = collection(db, "clientes");
const interaccionesRef = collection(db, "interacciones");
const usuariosRef = collection(db, "usuarios");

// ---------- Autenticación ----------

export function loginAdmin(email, password) {
  return iniciarSesionProtegida(email, password);
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

/** Escucha en tiempo real la lista de usuarios (administradores, vendedores y logística). */
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

// ---------- Clientes: cuentas reales (tienda pública) ----------
// A diferencia de crearUsuarioConRol (panel admin), aquí SÍ queremos que la
// sesión recién creada quede activa: es el flujo normal de registro de un
// cliente en la tienda. El documento de "clientes" se crea con el mismo id
// que el uid de su cuenta, para poder distinguirlo de los que agrega el CRM.

export async function registrarCliente({ nombre, correo, contrasena, telefono, mascota,
                                         apellidoPaterno, apellidoMaterno, codigoPostal, aceptaPromociones }) {
  const credencial = await createUserWithEmailAndPassword(auth, correo, contrasena);
  await updateProfile(credencial.user, { displayName: nombre });
  const refCliente = doc(db, "clientes", credencial.user.uid);
  // Datos extra del registro por pasos (solo se guardan los que vienen).
  const extra = {};
  if (apellidoPaterno) extra.apellidoPaterno = String(apellidoPaterno).slice(0, 60);
  if (apellidoMaterno) extra.apellidoMaterno = String(apellidoMaterno).slice(0, 60);
  if (codigoPostal) extra.codigoPostal = String(codigoPostal).slice(0, 5);
  if (typeof aceptaPromociones === "boolean") extra.aceptaPromociones = aceptaPromociones;
  if ((await getDoc(refCliente)).exists()) {
    // Ya la creó otra parte de la página: se completan solo los datos que el cliente sí puede cambiar.
    await updateDoc(refCliente, { nombre, telefono: telefono || "", mascota: mascota || "Sin especificar", ...extra, actualizadoEn: serverTimestamp() });
  } else {
    await setDoc(refCliente, {
      nombre, correo,
      telefono: telefono || "",
      mascota: mascota || "Sin especificar",
      ...extra,
      etapa: "Prospecto",
      estado: "Activo",
      fechaRegistro: new Date().toLocaleDateString('es-MX'),
      creadoEn: serverTimestamp(),
    });
  }
  // Correo de bienvenida de Firebase ("confirma tu correo"): siempre funciona, sin configurar nada.
  // Si falla (sin internet), la cuenta ya quedó creada igual.
  try { await enviarCorreoConEnlace((ajustes) => sendEmailVerification(credencial.user, ajustes), "login.html?verificado=1"); } catch { /* opcional */ }
  return credencial.user;
}

/**
 * Dirección completa de una página de esta misma tienda (sirve con Live Server, en una subcarpeta
 * o ya publicada). Se usa como "continueUrl": a dónde regresa la persona después de usar un enlace.
 */
function urlDeLaTienda(pagina) {
  const carpeta = window.location.href.replace(/[^/]*([?#].*)?$/, "");
  return carpeta + pagina;
}

/**
 * Manda un correo de Firebase con botón para regresar a la tienda. Si el dominio no está
 * autorizado en Firebase (auth/unauthorized-continue-uri), lo manda sin ese botón.
 */
async function enviarCorreoConEnlace(enviar, paginaRegreso) {
  auth.languageCode = "es";
  try {
    await enviar({ url: urlDeLaTienda(paginaRegreso) });
  } catch (err) {
    if (["auth/unauthorized-continue-uri", "auth/invalid-continue-uri", "auth/missing-continue-uri"].includes(err.code)) await enviar(undefined);
    else throw err;
  }
}

export async function loginCliente(correo, contrasena) {
  const cred = await iniciarSesionProtegida(correo, contrasena);
  // Si la tienda dio de baja esta cuenta, aquí se termina de borrar (ver completarBajaSiCorresponde).
  if (await completarBajaSiCorresponde(cred.user)) {
    const err = new Error("Esta cuenta fue dada de baja por la tienda y ya se borró. Si quieres, puedes registrarte de nuevo con el mismo correo.");
    err.code = "bp/cuenta-dada-de-baja";
    throw err;
  }
  return cred;
}

export function logoutCliente() {
  return signOut(auth);
}

/** Ejecuta callback(user) cada vez que cambia la sesión del sitio público (user es null si no hay nadie). */
export function observarSesionCliente(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Devuelve una promesa con el usuario actual (o null) sin dejar un listener activo. Útil para
 *  páginas que solo necesitan saber, una vez, si hay alguien con sesión (p. ej. antes de pagar). */
export function obtenerUsuarioActual() {
  return new Promise((resolve) => {
    const cancelar = onAuthStateChanged(auth, (user) => { cancelar(); resolve(user); });
  });
}

/** Trae el perfil (Firestore) del cliente con sesión iniciada, por su uid. */
export async function obtenerPerfilCliente(uid) {
  const snap = await getDoc(doc(db, "clientes", uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

/** El cliente edita sus propios datos de contacto (nombre, teléfono, mascota, dirección). */
export function actualizarPerfilCliente(uid, datos) {
  return updateDoc(doc(db, "clientes", uid), { ...datos, actualizadoEn: serverTimestamp() });
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
// Igual que las ventas: se ordena aquí para no necesitar un índice compuesto en Firebase.
export function escucharInteraccionesDeCliente(clienteId, callback, onError) {
  const q = query(interaccionesRef, where("clienteId", "==", clienteId));
  return onSnapshot(q, (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => milisDe(b.creadoEn) - milisDe(a.creadoEn));
    callback(lista);
  }, onError);
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

// ---------- SCM: productos (solo administradores) ----------

const scmProductosRef = collection(db, "scm_productos");

/** Escucha en tiempo real el catálogo del SCM. onError recibe el error (p. ej. permission-denied). */
export function escucharProductosScm(callback, onError) {
  const q = query(scmProductosRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/** Trae el catálogo una sola vez (sin listener); útil para validar stock antes de una compra. */
export async function obtenerProductosScm() {
  const snap = await getDocs(scmProductosRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function crearProductoScm(datos) {
  return addDoc(scmProductosRef, { ...datos, creadoEn: serverTimestamp() });
}

export function actualizarProductoScm(id, datos) {
  return updateDoc(doc(db, "scm_productos", id), { ...datos, actualizadoEn: serverTimestamp() });
}

export function eliminarProductoScm(id) {
  return deleteDoc(doc(db, "scm_productos", id));
}

/** Carga una lista de productos de ejemplo (para arrancar con datos). */
export function cargarProductosScmEjemplo(lista) {
  return Promise.all(lista.map(crearProductoScm));
}

// ---------- SCM: proveedores (solo administradores) ----------

const scmProveedoresRef = collection(db, "scm_proveedores");

/** Escucha en tiempo real la lista de proveedores. */
export function escucharProveedoresScm(callback, onError) {
  const q = query(scmProveedoresRef, orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

export function crearProveedorScm(datos) {
  return addDoc(scmProveedoresRef, { ...datos, creadoEn: serverTimestamp() });
}

/**
 * Productos que dependen de un proveedor: los que guardan su id y, por compatibilidad,
 * los productos antiguos que solo guardaron el NOMBRE del proveedor (sin proveedorId).
 */
async function productosDeProveedorScm(id, nombre) {
  const consultas = [getDocs(query(scmProductosRef, where("proveedorId", "==", id)))];
  if (nombre) consultas.push(getDocs(query(scmProductosRef, where("proveedor", "==", nombre))));
  const resultados = await Promise.all(consultas);
  const unicos = new Map();
  resultados.forEach((snap, i) => snap.docs.forEach(d => {
    // Los encontrados por nombre solo cuentan si no apuntan ya a otro proveedor por id
    if (i === 0 || !d.data().proveedorId) unicos.set(d.id, d);
  }));
  return [...unicos.values()];
}

/** Cuántos productos usan este proveedor (para impedir borrarlo si aún tiene productos). */
export async function contarProductosDeProveedorScm(id, nombre) {
  return (await productosDeProveedorScm(id, nombre)).length;
}

/**
 * Guarda los cambios del proveedor. Si cambió su nombre, actualiza también el nombre
 * guardado en sus productos para que nada quede desincronizado.
 */
export async function actualizarProveedorScm(id, datos, nombreAnterior) {
  await updateDoc(doc(db, "scm_proveedores", id), { ...datos, actualizadoEn: serverTimestamp() });
  if (!nombreAnterior || nombreAnterior === datos.nombre) return;
  const productos = await productosDeProveedorScm(id, nombreAnterior);
  if (productos.length === 0) return;
  const lote = writeBatch(db);
  productos.forEach(d => lote.update(d.ref, { proveedor: datos.nombre, proveedorId: id }));
  await lote.commit();
}

export function eliminarProveedorScm(id) {
  return deleteDoc(doc(db, "scm_proveedores", id));
}

/** Carga proveedores de ejemplo. Devuelve [{ id, nombre }] con los ids recién creados. */
export function cargarProveedoresScmEjemplo(lista) {
  return Promise.all(lista.map(async (p) => {
    const ref = await crearProveedorScm(p);
    return { id: ref.id, nombre: p.nombre };
  }));
}

// ---------- SCM: pedidos (reposición / suministro, solo administradores) ----------

const scmPedidosRef = collection(db, "scm_pedidos");

/** Escucha en tiempo real la lista de pedidos (más recientes primero). */
export function escucharPedidosScm(callback, onError) {
  const q = query(scmPedidosRef, orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * Crea un pedido nuevo con folio autogenerado tipo "PC-001", consecutivo según
 * cuántos pedidos existen ya (suficiente para el volumen de este panel; en un
 * sistema con altísima concurrencia se usaría un contador transaccional aparte).
 */
export async function crearPedidoScm(datos, productoActual) {
  const totalSnap = await getDocs(scmPedidosRef);
  const folio = "PC-" + String(totalSnap.size + 1).padStart(3, "0");
  const estado = datos.estado || "Pendiente";

  // Un pedido que se registra YA como "Surtido" también mueve el inventario
  // (necesita el producto para saber su stock actual).
  if (estado === "Surtido" && !productoActual) {
    throw new Error("Falta el producto para poder ajustar su stock.");
  }

  const pedidoRef = doc(scmPedidosRef);
  const lote = writeBatch(db);
  lote.set(pedidoRef, { ...datos, folio, estado, creadoEn: serverTimestamp() });
  if (estado === "Surtido") {
    ajustarStockPorPedidoSurtido(lote, datos, folio, productoActual.stock, "Sistema (pedido surtido)");
  }
  await lote.commit();
  return pedidoRef;
}

/**
 * Agrega a un writeBatch el ajuste de inventario de un pedido surtido:
 *  - Reposición: llegó mercancía -> SUMA stock y registra una "Entrada".
 *  - Venta: se entregó al cliente -> RESTA stock (sin bajar de 0) y registra una "Salida".
 */
function ajustarStockPorPedidoSurtido(lote, pedido, folio, stockActual, usuario) {
  const esVenta = pedido.tipo === "Venta";
  const cantidad = Number(pedido.cantidad) || 0;
  const base = Number(stockActual) || 0;

  lote.update(doc(db, "scm_productos", pedido.productoId), {
    stock: esVenta ? Math.max(0, base - cantidad) : base + cantidad,
    actualizadoEn: serverTimestamp(),
  });
  lote.set(doc(collection(db, "scm_movimientos")), {
    productoId: pedido.productoId,
    producto: pedido.producto,
    tipo: esVenta ? "Salida" : "Entrada",
    cantidad,
    motivo: esVenta ? `Pedido de venta surtido (${folio})` : `Pedido de reposición surtido (${folio})`,
    fecha: new Date().toISOString().slice(0, 10),
    usuario,
    creadoEn: serverTimestamp(),
  });
}

export function actualizarPedidoScm(id, datos) {
  return updateDoc(doc(db, "scm_pedidos", id), { ...datos, actualizadoEn: serverTimestamp() });
}

export function actualizarEstadoPedidoScm(id, estado) {
  return updateDoc(doc(db, "scm_pedidos", id), { estado, actualizadoEn: serverTimestamp() });
}

export function eliminarPedidoScm(id) {
  return deleteDoc(doc(db, "scm_pedidos", id));
}

/**
 * Marca un pedido (de Reposición o de Venta) como "Surtido" y, en la MISMA
 * operación atómica, ajusta el stock del producto y registra el movimiento
 * correspondiente (ver ajustarStockPorPedidoSurtido).
 * Si el pedido YA estaba surtido (se vuelve a guardar el formulario sin
 * cambiar el estado), no se vuelve a mover el stock ni se duplica el
 * movimiento -- solo se guardan los demás campos que se hayan editado.
 */
export async function marcarPedidoSurtido(id, datosPedido, estadoAnterior, productoActual) {
  const lote = writeBatch(db);
  lote.update(doc(db, "scm_pedidos", id), { ...datosPedido, estado: "Surtido", actualizadoEn: serverTimestamp() });

  if (estadoAnterior !== "Surtido") {
    ajustarStockPorPedidoSurtido(lote, datosPedido, datosPedido.folio || id, productoActual?.stock, "Sistema (pedido surtido)");
  }

  await lote.commit();
}

/**
 * Qué pasa con el pedido que genera solo un producto PUSH:
 *  - false (actual): el pedido nace "Pendiente"; el stock NO cambia hasta que
 *    alguien lo marque "Surtido" en Pedidos (ahí sí suma el stock y registra
 *    la Entrada). Mientras tanto Inventario lo muestra como "en camino".
 *  - true: el pedido se SURTE solo: queda "Surtido" y el stock sube en ese
 *    mismo momento, sin que nadie intervenga.
 */
const PUSH_SURTIR_AUTOMATICO = false;

/**
 * Estrategia PUSH: revisa el catálogo y, para cada producto PUSH cuyo stock
 * ya llegó a su mínimo (o menos), genera solo el pedido de reposición y --con
 * PUSH_SURTIR_AUTOMATICO-- también rellena el stock hasta el doble del mínimo,
 * registrando el pedido (estado Surtido) y el movimiento de "Entrada".
 *
 * Se hace dentro de una transacción por producto: si dos pestañas/usuarios
 * detectan el mismo producto al mismo tiempo, solo la primera lo repone (la
 * segunda vuelve a leer el stock, ve que ya está arriba del mínimo y no hace
 * nada), así no se duplica la reposición.
 * Si el producto ya tiene un pedido de reposición abierto (Pendiente o En
 * proceso, p. ej. uno hecho a mano que viene en camino) se respeta y no se
 * genera otro.
 * Devuelve cuántos productos repuso/pidió (para avisar en la interfaz).
 */
export async function generarReposicionesAutomaticas(productos, pedidos) {
  const conPedidoAbierto = new Set(
    (pedidos || [])
      .filter(p => p.tipo === "Reposición" && (p.estado === "Pendiente" || p.estado === "En proceso"))
      .map(p => p.productoId)
  );

  const candidatos = (productos || []).filter(p =>
    p.estrategia === "PUSH" &&
    Number(p.stock) <= Number(p.stockMin) &&
    !conPedidoAbierto.has(p.id)
  );
  if (candidatos.length === 0) return 0;

  const totalSnap = await getDocs(scmPedidosRef);
  let siguiente = totalSnap.size + 1;
  let generados = 0;

  for (const p of candidatos) {
    const productoRef = doc(db, "scm_productos", p.id);
    const folio = "PC-" + String(siguiente).padStart(3, "0");
    const hoy = new Date().toISOString().slice(0, 10);

    const repuesto = await runTransaction(db, async (tx) => {
      const snap = await tx.get(productoRef);
      if (!snap.exists()) return false;
      const actual = snap.data();
      const stock = Number(actual.stock) || 0;
      const minimo = Number(actual.stockMin) || 0;
      if (actual.estrategia !== "PUSH" || stock > minimo) return false; // ya lo repuso otra pestaña

      const surtir = PUSH_SURTIR_AUTOMATICO;

      // Con el pedido "Pendiente" el stock no cambia, así que no basta con mirar el
      // stock para evitar duplicados si dos pestañas lo detectan a la vez: el
      // producto recuerda cuál fue su último pedido automático y, si ese sigue
      // abierto (Pendiente / En proceso), no se genera otro.
      if (!surtir && actual.pedidoAutoId) {
        const previo = await tx.get(doc(db, "scm_pedidos", actual.pedidoAutoId));
        if (previo.exists() && ["Pendiente", "En proceso"].includes(previo.data().estado)) return false;
      }

      const objetivo = Math.max(minimo * 2, minimo + 1);
      const cantidad = Math.max(1, objetivo - stock);
      const pedidoRef = doc(scmPedidosRef);

      tx.set(pedidoRef, {
        folio,
        productoId: p.id,
        producto: actual.nombre,
        cantidad,
        tipo: "Reposición",
        estado: surtir ? "Surtido" : "Pendiente",
        proveedorId: actual.proveedorId || "",
        proveedor: actual.proveedor || "",
        fecha: hoy,
        notas: surtir
          ? `Reposición automática PUSH: el stock llegó al mínimo (${stock}/${minimo}) y se repuso solo hasta ${stock + cantidad}.`
          : "Generado automáticamente: producto con estrategia PUSH en su stock mínimo.",
        automatico: true,
        creadoEn: serverTimestamp(),
      });

      if (!surtir) {
        tx.update(productoRef, { pedidoAutoId: pedidoRef.id, actualizadoEn: serverTimestamp() });
      } else {
        tx.update(productoRef, { stock: stock + cantidad, actualizadoEn: serverTimestamp() });
        tx.set(doc(collection(db, "scm_movimientos")), {
          productoId: p.id,
          producto: actual.nombre,
          tipo: "Entrada",
          cantidad,
          motivo: `Reposición automática PUSH (${folio})`,
          fecha: hoy,
          usuario: "Sistema (PUSH automático)",
          creadoEn: serverTimestamp(),
        });
      }
      return true;
    });

    if (repuesto) { generados++; siguiente++; }
  }

  return generados;
}

// ---------- SCM: movimientos de inventario (solo administradores) ----------

const scmMovimientosRef = collection(db, "scm_movimientos");

/** Escucha en tiempo real el historial de movimientos (más recientes primero). */
export function escucharMovimientosScm(callback, onError) {
  const q = query(scmMovimientosRef, orderBy("fecha", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * Registra un movimiento y ajusta el stock del producto en la misma operación
 * (writeBatch: o se guardan las dos cosas o ninguna). stockActual es el stock
 * del producto ANTES del movimiento (se lee en la página desde el listener de
 * escucharProductosScm, no hace falta volver a pedirlo aquí).
 */
export async function crearMovimientoScm(datos, stockActual) {
  const cantidad = Number(datos.cantidad) || 0;
  const nuevoStock = Math.max(0, stockActual + (datos.tipo === "Entrada" ? cantidad : -cantidad));
  const lote = writeBatch(db);
  lote.set(doc(scmMovimientosRef), { ...datos, cantidad, creadoEn: serverTimestamp() });
  lote.update(doc(db, "scm_productos", datos.productoId), { stock: nuevoStock, actualizadoEn: serverTimestamp() });
  await lote.commit();
}

// ---------- Ventas: compras reales hechas por clientes desde la tienda ----------

const ventasRef = collection(db, "ventas");

/** Escucha en tiempo real las ventas de UN cliente (para su historial de compras). */
// Solo filtra por cliente y ordena aquí (más nueva primero): where + orderBy en campos distintos
// obligaba a crear un índice compuesto en Firebase y, sin él, "Mis pedidos" no cargaba.
export function escucharVentasDeCliente(uid, callback, onError) {
  const q = query(ventasRef, where("clienteId", "==", uid));
  return onSnapshot(q, (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => milisDe(b.creadoEn) - milisDe(a.creadoEn));
    callback(lista);
  }, onError);
}

// ---------- Impuestos (Etapa 4): configuración del IVA ----------
//    impuestos/iva { nombre: "IVA", tasa: 16, activo: true, incluidoEnPrecio: false,
//                    actualizadoPor, actualizadoPorId, actualizadoEn }
//    - incluidoEnPrecio = false -> el IVA se SUMA al total (subtotal - descuento + envío + IVA).
//    - incluidoEnPrecio = true  -> los precios ya traen IVA: solo se desglosa, el total no cambia.
// Lo lee el checkout (público) y solo el administrador lo cambia (ver firestore.rules).

export const IVA_POR_DEFECTO = Object.freeze({ id: "iva", nombre: "IVA", tasa: 16, activo: true, incluidoEnPrecio: false });

// Notificación en pantalla (la define components.js en la tienda); en páginas sin ella no hace nada.
const notificar = (texto, tipo = "error") => {
  if (typeof window !== "undefined" && typeof window.bpNotificar === "function") window.bpNotificar(texto, tipo);
};
const redondear2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dineroTxt = (n) => `$${redondear2(n).toFixed(2)}`;

/** Lee la configuración del IVA. Si no existe todavía (o no hay internet) usa 16% sumado al total. */
export async function obtenerImpuestoIva() {
  try {
    const snap = await getDoc(doc(db, "impuestos", "iva"));
    return snap.exists() ? { ...IVA_POR_DEFECTO, ...snap.data(), id: "iva" } : { ...IVA_POR_DEFECTO };
  } catch {
    notificar("No se pudo leer el IVA configurado; se calcula con 16%.");
    return { ...IVA_POR_DEFECTO };
  }
}

/** Escucha en tiempo real la configuración del IVA (pantalla de administración). */
export function escucharImpuestoIva(callback, onError) {
  return onSnapshot(doc(db, "impuestos", "iva"), (snap) => {
    callback(snap.exists() ? { ...IVA_POR_DEFECTO, ...snap.data(), id: "iva" } : null);
  }, onError);
}

/** Guarda la configuración del IVA (solo administrador). usuario = window.BP_SESION. */
export function guardarImpuestoIva({ tasa, activo, incluidoEnPrecio }, usuario) {
  const t = Number(tasa);
  if (!Number.isFinite(t) || t < 0 || t > 30) throw new Error("La tasa debe estar entre 0 y 30%.");
  return setDoc(doc(db, "impuestos", "iva"), {
    nombre: "IVA",
    tasa: redondear2(t),
    activo: !!activo,
    incluidoEnPrecio: !!incluidoEnPrecio,
    actualizadoPor: usuario?.nombre || usuario?.correo || "",
    actualizadoPorId: usuario?.uid || "",
    actualizadoEn: serverTimestamp(),
  });
}

/**
 * Calcula el IVA sobre la base gravable (subtotal - descuento + envío).
 * Devuelve { tasa, iva, incluido, totalConIva }.
 */
export function calcularIva(base, config = IVA_POR_DEFECTO) {
  const b = Math.max(0, Number(base) || 0);
  if (!config || config.activo === false) return { tasa: 0, iva: 0, incluido: false, totalConIva: redondear2(b) };
  const tasa = Number(config.tasa) || 0;
  if (config.incluidoEnPrecio) {
    const iva = redondear2(b - b / (1 + tasa / 100));
    return { tasa, iva, incluido: true, totalConIva: redondear2(b) };
  }
  const iva = redondear2(b * tasa / 100);
  return { tasa, iva, incluido: false, totalConIva: redondear2(b + iva) };
}

// ---------- Referencias de pago (OXXO / SPEI) ----------

/** Dígito verificador de una CLABE (pesos 3,7,1 sobre los primeros 17 dígitos). */
function digitoVerificadorClabe(clabe17) {
  const pesos = [3, 7, 1];
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += (Number(clabe17[i]) * pesos[i % 3]) % 10;
  return (10 - (suma % 10)) % 10;
}

/** Números "aleatorios" pero repetibles a partir del folio (la misma venta = la misma referencia). */
function digitosDesdeTexto(texto, largo) {
  let h = 2166136261;
  let salida = "";
  while (salida.length < largo) {
    for (const ch of texto + salida.length) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    salida += String(h % 10);
  }
  return salida.slice(0, largo);
}

/**
 * Genera la referencia de pago de un pedido según el método:
 *   SPEI -> CLABE interbancaria válida de 18 dígitos (banco 646 STP, plaza 180) única por pedido.
 *   OXXO -> referencia de 14 dígitos.
 * Ambas vencen en 72 horas. Para tarjeta/PayPal/Puntos devuelve null (se paga al momento).
 */
export function generarReferenciaPago(folio, metodoClave, ahora = new Date()) {
  const vence = new Date(ahora.getTime() + 72 * 60 * 60 * 1000).toISOString();
  if (metodoClave === "spei") {
    const base = "646" + "180" + digitosDesdeTexto(folio, 11);
    return { tipo: "SPEI", banco: "STP", clabe: base + digitoVerificadorClabe(base), concepto: folio, vence };
  }
  if (metodoClave === "oxxo") {
    return { tipo: "OXXO", referencia: "9300" + digitosDesdeTexto(folio, 10), vence };
  }
  return null;
}

/** Lee una venta por su id (el cliente solo puede leer las suyas; ver firestore.rules). */
export async function obtenerVenta(id) {
  const snap = await getDoc(doc(db, "ventas", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Crea una venta real dentro de una TRANSACCIÓN de Firestore:
 *   1) lee el stock y el precio MÁS RECIENTES de cada producto (no los de la pantalla),
 *   2) si falta stock o cambió el precio, cancela todo con un mensaje claro,
 *   3) guarda la venta, descuenta el stock y registra la "Salida" de inventario.
 * Si dos clientes compran el último producto al mismo tiempo, Firestore detecta que el
 * documento cambió, repite la transacción del segundo, ve stock 0 y la rechaza: así
 * nunca se vende algo que ya no existe.
 *
 * datosVenta: { clienteId, clienteNombre, clienteCorreo, items: [{ productoId, nombre,
 *   precio, cantidad }], subtotal, descuento, cupon, envio, iva, tasaIva, ivaIncluido,
 *   total, direccionEnvio, metodoPago, metodoPagoClave, pagoDetalle }
 * productosActuales: ya no se usa para validar (se lee dentro de la transacción); se deja
 *   el parámetro para no romper a quien lo llame.
 * Devuelve { id, folio, referenciaPago, estadoPago }.
 */
export async function crearVenta(datosVenta, productosActuales) { // eslint-disable-line no-unused-vars
  const items = datosVenta.items || [];
  if (items.length === 0) throw new Error("El carrito está vacío.");

  // Une líneas repetidas del mismo producto y descarta cantidades inválidas.
  const porProducto = new Map();
  for (const i of items) {
    const cantidad = Math.floor(Number(i.cantidad));
    if (!i.productoId || !Number.isFinite(cantidad) || cantidad < 1) {
      throw new Error(`La cantidad de "${i.nombre || "un producto"}" no es válida.`);
    }
    const previo = porProducto.get(i.productoId);
    porProducto.set(i.productoId, { ...i, cantidad: (previo ? previo.cantidad : 0) + cantidad });
  }

  // Etapa 4: los cupones viven en Firestore con vigencia; se revisa otra vez justo antes de
  // cobrar por si venció o se desactivó mientras estaba en el carrito.
  if (datosVenta.cupon) {
    const promo = await obtenerPromocion(datosVenta.cupon);
    if (!promocionVigente(promo)) {
      throw new Error(`El cupón ${datosVenta.cupon} ya no está vigente. Quítalo del carrito para continuar.`);
    }
  }

  // El IVA se vuelve a calcular con la configuración actual: si el administrador la cambió
  // mientras el cliente estaba en el checkout, se le pide revisar su resumen.
  const configIva = await obtenerImpuestoIva();
  const base = (Number(datosVenta.subtotal) || 0) - (Number(datosVenta.descuento) || 0) + (Number(datosVenta.envio) || 0);
  const ivaCalc = calcularIva(base, configIva);
  if (Math.abs(ivaCalc.iva - (Number(datosVenta.iva) || 0)) > 0.01
      || Math.abs(ivaCalc.totalConIva - (Number(datosVenta.total) || 0)) > 0.01) {
    throw new Error("El IVA o el total de tu pedido cambiaron. Recarga la página para ver el resumen actualizado.");
  }

  // El folio NO se genera contando los documentos existentes: un cliente no tiene permiso para
  // leer TODAS las ventas, así que se arma con la fecha y un sufijo aleatorio.
  const ahora = new Date();
  const fechaFolio = ahora.toISOString().slice(2, 10).replace(/-/g, "");
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
  const folio = `CC-${fechaFolio}-${sufijo}`;
  const hoy = hoyISO(ahora);

  const referenciaPago = generarReferenciaPago(folio, datosVenta.metodoPagoClave, ahora);
  const estadoPago = referenciaPago ? "Pendiente" : "Pagado";
  const quien = datosVenta.clienteNombre || datosVenta.clienteCorreo || "Cliente";
  const ventaRef = doc(ventasRef);

  // Etapa 4 (integrante 2): pago con Monedero. El saldo se lee y se descuenta DENTRO de la
  // misma transacción que la venta y el stock: o se cobra todo junto, o no pasa nada.
  const pagaConMonedero = datosVenta.metodoPagoClave === "monedero";
  const monederoRef = pagaConMonedero ? doc(db, "monederos", datosVenta.clienteId) : null;
  const movMonederoRef = pagaConMonedero ? doc(collection(db, "monedero_movimientos")) : null;
  let saldoMonedero = null;   // { anterior, nuevo } si se pagó con monedero

  await runTransaction(db, async (tx) => {
    // 1) Todas las lecturas primero (Firestore exige leer antes de escribir).
    const lecturas = [];
    for (const [productoId, item] of porProducto) {
      const ref = doc(db, "scm_productos", productoId);
      lecturas.push({ ref, item, snap: await tx.get(ref) });
    }
    let monederoSnap = null;
    if (pagaConMonedero) {
      monederoSnap = await tx.get(monederoRef);
      const saldo = monederoSnap.exists() ? Number(monederoSnap.data().saldo) || 0 : 0;
      if (saldo + 0.001 < ivaCalc.totalConIva) {
        throw new Error(`Saldo insuficiente en tu monedero: tienes ${dineroTxt(saldo)} y el total es ${dineroTxt(ivaCalc.totalConIva)}. Recarga ${dineroTxt(ivaCalc.totalConIva - saldo)} o elige otro método de pago.`);
      }
      saldoMonedero = { anterior: redondear2(saldo), nuevo: redondear2(saldo - ivaCalc.totalConIva) };
    }

    // 2) Validar con el stock y el precio de este instante.
    for (const { item, snap } of lecturas) {
      if (!snap.exists()) throw new Error(`El producto "${item.nombre}" ya no está disponible en el catálogo.`);
      const p = snap.data();
      const stock = Number(p.stock) || 0;
      if (stock < item.cantidad) {
        throw new Error(stock <= 0
          ? `Lo sentimos, "${p.nombre}" se acaba de agotar. Quítalo de tu carrito para continuar.`
          : `Solo quedan ${stock} de "${p.nombre}" (alguien más acaba de comprar). Ajusta tu carrito.`);
      }
      if (Math.abs((Number(p.precio) || 0) - (Number(item.precio) || 0)) > 0.009) {
        throw new Error(`El precio de "${p.nombre}" cambió. Regresa al carrito y dale "Actualizar carrito".`);
      }
    }

    // 3) Guardar la venta.
    tx.set(ventaRef, {
      ...datosVenta,
      items: [...porProducto.values()].map(i => ({
        productoId: i.productoId, nombre: i.nombre, precio: Number(i.precio), cantidad: i.cantidad,
      })),
      iva: ivaCalc.iva,
      tasaIva: ivaCalc.tasa,
      ivaIncluido: ivaCalc.incluido,
      total: ivaCalc.totalConIva,
      folio,
      origen: "Tienda web",
      estado: "Confirmada",
      estadoPago,
      referenciaPago: referenciaPago || null,
      ...(saldoMonedero ? { pagoDetalle: { ...(datosVenta.pagoDetalle || {}), saldoAnterior: saldoMonedero.anterior, saldoNuevo: saldoMonedero.nuevo, movimientoId: movMonederoRef.id } } : {}),
      historial: [{ estado: "Confirmada", usuario: quien, fecha: ahora.toISOString() }],
      creadoEn: serverTimestamp(),
    });

    // 3b) Monedero: descuenta el saldo y deja el movimiento "Pago" ligado a esta venta.
    if (saldoMonedero) {
      const m = monederoSnap.data();
      tx.update(monederoRef, {
        saldo: saldoMonedero.nuevo,
        totalGastado: redondear2((Number(m.totalGastado) || 0) + ivaCalc.totalConIva),
        ultimoMovimientoId: movMonederoRef.id,
        actualizadoEn: serverTimestamp(),
      });
      tx.set(movMonederoRef, {
        clienteId: datosVenta.clienteId,
        clienteNombre: quien,
        tipo: "Pago",
        efecto: "cargo",
        monto: ivaCalc.totalConIva,
        saldoAnterior: saldoMonedero.anterior,
        saldoNuevo: saldoMonedero.nuevo,
        metodo: "Monedero",
        detalle: `Compra ${folio}`,
        ventaId: ventaRef.id,
        folio,
        motivo: "",
        usuarioId: datosVenta.clienteId,
        usuarioNombre: quien,
        fecha: hoy,
        creadoEn: serverTimestamp(),
      });
    }

    // 4) Descontar stock + registrar la salida de inventario de cada producto.
    for (const { ref, item, snap } of lecturas) {
      tx.update(ref, { stock: (Number(snap.data().stock) || 0) - item.cantidad, actualizadoEn: serverTimestamp() });
      tx.set(doc(collection(db, "scm_movimientos")), {
        productoId: item.productoId,
        producto: item.nombre,
        tipo: "Salida",
        cantidad: item.cantidad,
        motivo: `Venta ${folio}`,
        fecha: hoy,
        usuario: quien,
        creadoEn: serverTimestamp(),
      });
    }
  });

  // Etapa 4: pagos + CRM + erp_operaciones. La venta ya quedó guardada; si esta sincronización
  // fallara (p. ej. sin internet justo ahora) NO se le cobra dos veces ni se pierde la compra.
  try {
    await registrarIntegracionCompra({
      ventaId: ventaRef.id,
      folio,
      clienteId: datosVenta.clienteId,
      clienteNombre: datosVenta.clienteNombre,
      total: ivaCalc.totalConIva,
      metodoPago: datosVenta.metodoPago,
      estadoPago,
      referenciaPago,
      iva: ivaCalc.iva,
    });
  } catch {
    // La compra ya quedó guardada (venta + stock); lo que falló es el registro en pagos/CRM/ERP.
    notificar("Tu compra quedó registrada. Algunos datos de tu cuenta se actualizarán más tarde.", "info");
  }
  return { id: ventaRef.id, folio, referenciaPago, estadoPago, total: ivaCalc.totalConIva, iva: ivaCalc.iva, tasaIva: ivaCalc.tasa, ivaIncluido: ivaCalc.incluido, saldoMonedero };
}

// ---------- ERP: órdenes empresariales (Etapa 3) ----------
// Una "orden" del ERP es un documento de la colección "ventas" (la misma donde
// quedan las compras que los clientes hacen en la tienda), así que el ERP
// INTEGRA CRM (cliente) + SCM (producto y stock) sin duplicar información.
//
// Flujo automático al crear una orden (todo en UNA transacción: o pasa todo o nada):
//   validar stock -> crear orden -> reducir stock -> registrar movimiento de
//   inventario -> guardar historial (erp_operaciones) -> actualizar al cliente en el CRM
//
//    erp_operaciones/{id} { tipo, descripcion, ordenId, folio, clienteId, clienteNombre,
//                           total, usuarioId, usuarioNombre, creadoEn }
//                         (historial de operaciones empresariales: solo se agregan)
//    ventas/{id} (orden ERP) además lleva: origen "ERP", usuarioId/usuarioNombre
//                         (quién la registró) e historial [{ estado, usuario, fecha }]

export const ESTADOS_ORDEN_ERP = ["Confirmada", "En proceso", "Enviada", "Entregada", "Cancelada"];

/** A qué estados puede pasar una orden desde su estado actual (PUT /ordenes/{id}/estado). */
export const TRANSICIONES_ORDEN_ERP = {
  "Confirmada": ["En proceso", "Enviada", "Cancelada"],
  "En proceso": ["Enviada", "Cancelada"],
  "Enviada":    ["Entregada", "Cancelada"],
  "Entregada":  [],
  "Cancelada":  [],
};

const erpOperacionesRef = collection(db, "erp_operaciones");

/** Escucha en tiempo real TODAS las órdenes (ERP + compras de la tienda), más recientes primero. */
export function escucharOrdenesErp(callback, onError) {
  const q = query(ventasRef, orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/** Escucha el historial de operaciones empresariales (las más recientes primero). */
export function escucharOperacionesErp(callback, onError, maximo = 15) {
  const q = query(erpOperacionesRef, orderBy("creadoEn", "desc"), limit(maximo));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/** Primera compra: Prospecto/Inactivo pasa a Activo; con 3 compras o más pasa a Frecuente. */
function etapaTrasCompra(etapa, numCompras) {
  if (numCompras >= 3) return "Frecuente";
  return (!etapa || etapa === "Prospecto" || etapa === "Inactivo") ? "Activo" : etapa;
}

/**
 * POST /ordenes + POST /ordenes/procesar: registra una orden empresarial y
 * dispara toda la automatización. Lee el stock MÁS RECIENTE dentro de la
 * transacción (no el de la pantalla), así que si otra persona vendió lo mismo
 * hace un segundo, la orden se rechaza con un mensaje claro en vez de dejar
 * el inventario en negativo.
 *   cliente: { id, nombre, correo }  items: [{ productoId, cantidad }]
 *   usuario: { uid, nombre, correo } (quién registra la orden = usuario_id)
 * Devuelve { id, folio, total }.
 */
export async function crearOrdenErp({ cliente, items, metodoPago, direccionEnvio, usuario }) {
  if (!cliente || !cliente.id) throw new Error("Selecciona un cliente.");
  if (!usuario || !usuario.uid) throw new Error("No se pudo identificar quién registra la orden.");

  // Une líneas repetidas del mismo producto en una sola.
  const porProducto = new Map();
  (items || []).forEach((i) => {
    const cantidad = Math.floor(Number(i.cantidad)) || 0;
    if (!i.productoId || cantidad < 1) return;
    porProducto.set(i.productoId, (porProducto.get(i.productoId) || 0) + cantidad);
  });
  if (porProducto.size === 0) throw new Error("La orden no tiene productos.");

  // Folio consecutivo "OR-001": el personal sí puede leer todas las órdenes.
  const todas = await getDocs(ventasRef);
  let ultimo = 0;
  todas.forEach((d) => {
    const m = /^OR-(\d+)$/.exec(String(d.data().folio || ""));
    if (m) ultimo = Math.max(ultimo, Number(m[1]));
  });
  const folio = "OR-" + String(ultimo + 1).padStart(3, "0");

  const ahora = new Date();
  const hoy = ahora.toISOString().slice(0, 10);
  const quien = usuario.nombre || usuario.correo || "";
  const ordenRef = doc(ventasRef);
  const clienteRef = doc(db, "clientes", cliente.id);

  return runTransaction(db, async (tx) => {
    // 1) Todas las lecturas primero (Firestore exige leer antes de escribir).
    const lecturas = [];
    for (const [productoId, cantidad] of porProducto) {
      const ref = doc(db, "scm_productos", productoId);
      lecturas.push({ ref, cantidad, snap: await tx.get(ref) });
    }
    const clienteSnap = await tx.get(clienteRef);

    // 2) Validar con el stock y el precio actuales.
    const lineas = lecturas.map(({ ref, cantidad, snap }) => {
      if (!snap.exists()) throw new Error("Uno de los productos ya no existe en el catálogo.");
      const p = snap.data();
      const stock = Number(p.stock) || 0;
      if (stock < cantidad) {
        throw new Error(`Ya no hay suficiente stock de "${p.nombre}" (disponible: ${stock}).`);
      }
      const precio = Number(p.precio) || 0;
      return { ref, productoId: ref.id, nombre: p.nombre, precio, cantidad, stock, subtotal: precio * cantidad };
    });
    const total = lineas.reduce((s, l) => s + l.subtotal, 0);

    // 3) Crear la orden.
    tx.set(ordenRef, {
      folio,
      origen: "ERP",
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      clienteCorreo: cliente.correo || "",
      items: lineas.map(l => ({ productoId: l.productoId, nombre: l.nombre, precio: l.precio, cantidad: l.cantidad })),
      subtotal: total,
      descuento: 0,
      cupon: "",
      total,
      direccionEnvio: direccionEnvio || "",
      metodoPago: metodoPago || "Efectivo",
      estado: "Confirmada",
      usuarioId: usuario.uid,
      usuarioNombre: quien,
      historial: [{ estado: "Confirmada", usuario: quien, fecha: ahora.toISOString() }],
      creadoEn: serverTimestamp(),
    });

    // 4) Reducir stock + registrar el movimiento de inventario de cada producto.
    lineas.forEach((l) => {
      tx.update(l.ref, { stock: l.stock - l.cantidad, actualizadoEn: serverTimestamp() });
      tx.set(doc(collection(db, "scm_movimientos")), {
        productoId: l.productoId,
        producto: l.nombre,
        tipo: "Salida",
        cantidad: l.cantidad,
        motivo: `Orden ${folio}`,
        fecha: hoy,
        usuario: quien,
        creadoEn: serverTimestamp(),
      });
    });

    // 5) Guardar historial (operación empresarial).
    const piezas = lineas.reduce((s, l) => s + l.cantidad, 0);
    tx.set(doc(erpOperacionesRef), {
      tipo: "Orden de cliente",
      descripcion: `Orden ${folio} de ${cliente.nombre || "cliente"}: ${piezas} pieza${piezas === 1 ? "" : "s"}, total $${total.toFixed(2)}`,
      ordenId: ordenRef.id,
      folio,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      total,
      usuarioId: usuario.uid,
      usuarioNombre: quien,
      creadoEn: serverTimestamp(),
    });

    // 5b) Etapa 4: documento independiente del pago (mismo id que la orden).
    tx.set(doc(db, "pagos", ordenRef.id), {
      pedidoId: ordenRef.id,
      folio,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre || "",
      monto: total,
      metodoPago: metodoPago || "Efectivo",
      estado: "Pagado",
      origen: "ERP",
      usuarioId: usuario.uid,
      usuarioNombre: quien,
      fecha: hoy,
      creadoEn: serverTimestamp(),
    });

    // 6) Registrar la compra en el CRM (si el cliente existe en la colección de clientes).
    if (clienteSnap.exists()) {
      const c = clienteSnap.data();
      const numCompras = (Number(c.numCompras) || 0) + 1;
      tx.update(clienteRef, {
        numCompras,
        totalComprado: (Number(c.totalComprado) || 0) + total,
        ultimaCompra: hoy,
        etapa: etapaTrasCompra(c.etapa, numCompras),
        actualizadoEn: serverTimestamp(),
      });
    }

    return { id: ordenRef.id, folio, total };
  });
}

/**
 * PUT /ordenes/{id}/estado: cambia el estado de una orden siguiendo
 * TRANSICIONES_ORDEN_ERP y guarda el cambio en su historial. Si se CANCELA,
 * el stock de sus productos se devuelve al inventario y se registra una
 * "Entrada" por cada uno (en la misma operación atómica).
 * orden: la orden completa (con id, folio, estado, items).
 */
export async function cambiarEstadoOrdenErp(orden, estadoNuevo, usuario) {
  const actual = orden.estado || "Confirmada";
  if (!(TRANSICIONES_ORDEN_ERP[actual] || []).includes(estadoNuevo)) {
    throw new Error(`Una orden "${actual}" no puede pasar a "${estadoNuevo}".`);
  }
  const quien = usuario?.nombre || usuario?.correo || "";
  const hoy = new Date().toISOString().slice(0, 10);
  const lote = writeBatch(db);

  lote.update(doc(db, "ventas", orden.id), {
    estado: estadoNuevo,
    historial: arrayUnion({ estado: estadoNuevo, usuario: quien, fecha: new Date().toISOString() }),
    actualizadoEn: serverTimestamp(),
  });

  if (estadoNuevo === "Cancelada") {
    // Etapa 4: si la orden tiene su pago en "pagos", se marca como Cancelado.
    const pagoRef = doc(db, "pagos", orden.id);
    // Pagada con monedero: el dinero regresa al saldo del cliente (y el pago queda "Reembolsado").
    const reembolsar = orden.metodoPagoClave === "monedero" && !!orden.clienteId && orden.estadoPago !== "Pendiente";
    if ((await getDoc(pagoRef)).exists()) {
      lote.update(pagoRef, { estado: reembolsar ? "Reembolsado" : "Cancelado", actualizadoEn: serverTimestamp() });
    }
    if (reembolsar) await agregarReembolsoMonedero(lote, orden, usuario);
    for (const item of (orden.items || [])) {
      const cantidad = Math.floor(Number(item.cantidad)) || 0;
      if (!item.productoId || cantidad < 1) continue;
      const refProducto = doc(db, "scm_productos", item.productoId);
      // Si el producto se borró del catálogo después de la orden, no hay stock que devolver.
      if (!(await getDoc(refProducto)).exists()) continue;
      lote.update(refProducto, { stock: increment(cantidad), actualizadoEn: serverTimestamp() });
      lote.set(doc(collection(db, "scm_movimientos")), {
        productoId: item.productoId,
        producto: item.nombre || "",
        tipo: "Entrada",
        cantidad,
        motivo: `Orden ${orden.folio || orden.id} cancelada: se devuelve el stock`,
        fecha: hoy,
        usuario: quien,
        creadoEn: serverTimestamp(),
      });
    }
  }

  lote.set(doc(erpOperacionesRef), {
    tipo: estadoNuevo === "Cancelada" ? "Orden cancelada" : "Cambio de estado",
    descripcion: `Orden ${orden.folio || orden.id}: ${actual} → ${estadoNuevo}`,
    ordenId: orden.id,
    folio: orden.folio || "",
    clienteId: orden.clienteId || "",
    clienteNombre: orden.clienteNombre || "",
    total: Number(orden.total) || 0,
    usuarioId: usuario?.uid || "",
    usuarioNombre: quien,
    creadoEn: serverTimestamp(),
  });

  await lote.commit();
}

/**
 * GET /erp/metricas: los indicadores del dashboard empresarial. Las órdenes
 * canceladas no cuentan como venta. Si la cuenta no tiene acceso al CRM
 * (p. ej. logística), clientesActivos viene en null en vez de fallar todo.
 */
export async function calcularMetricasErp() {
  const [ventasSnap, productosSnap] = await Promise.all([
    getDocs(query(ventasRef, orderBy("creadoEn", "desc"))),
    getDocs(scmProductosRef),
  ]);
  const ordenes = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let clientesActivos = null;
  try {
    const clientesSnap = await getDocs(clientesRef);
    clientesActivos = clientesSnap.docs.filter(d => String(d.data().estado || "").toLowerCase() === "activo").length;
  } catch (e) {
    clientesActivos = null;
  }

  const validas = ordenes.filter(o => o.estado !== "Cancelada");
  const ventasTotales = validas.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const ordenesEnProceso = validas.filter(o => o.estado !== "Entregada").length;

  const vendidasPorProducto = {};
  let productosVendidos = 0;
  validas.forEach((o) => (o.items || []).forEach((it) => {
    const cant = Number(it.cantidad) || 0;
    productosVendidos += cant;
    const llave = it.productoId || it.nombre;
    vendidasPorProducto[llave] = (vendidasPorProducto[llave] || 0) + cant;
  }));

  const porNombre = {};
  validas.forEach((o) => (o.items || []).forEach((it) => {
    porNombre[it.nombre] = (porNombre[it.nombre] || 0) + (Number(it.cantidad) || 0);
  }));
  const topProductos = Object.entries(porNombre).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));

  const ahora = new Date();
  const ventasPorMes = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    ventasPorMes.push({
      llave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: d.toLocaleDateString("es-MX", { month: "short" }),
      total: 0,
    });
  }
  validas.forEach((o) => {
    if (!o.creadoEn) return;
    const f = o.creadoEn.toDate ? o.creadoEn.toDate() : new Date(o.creadoEn);
    const llave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
    const mes = ventasPorMes.find(m => m.llave === llave);
    if (mes) mes.total += Number(o.total) || 0;
  });

  // Rotación: de lo que hubo (vendido + en bodega), qué proporción ya se vendió.
  const rotacion = { alta: 0, media: 0, baja: 0 };
  let unidades = 0;
  let valor = 0;
  productos.forEach((p) => {
    const stock = Number(p.stock) || 0;
    unidades += stock;
    valor += stock * (Number(p.costo) || 0);
    const vendidas = vendidasPorProducto[p.id] || vendidasPorProducto[p.nombre] || 0;
    const ratio = (vendidas + stock) > 0 ? vendidas / (vendidas + stock) : 0;
    rotacion[ratio >= 0.5 ? "alta" : ratio >= 0.2 ? "media" : "baja"]++;
  });
  const conMovimiento = productos.length ? Math.round(((rotacion.alta + rotacion.media) / productos.length) * 100) : 0;

  return {
    ventasTotales,
    ordenesTotal: ordenes.length,
    ordenesProcesadas: validas.length,
    ordenesEnProceso,
    ordenesCanceladas: ordenes.length - validas.length,
    productosVendidos,
    clientesActivos,
    ventasPorMes,
    topProductos,
    inventario: {
      productos: productos.length,
      unidades,
      valor,
      stockBajo: productos.filter(p => Number(p.stock) <= Number(p.stockMin)).length,
      rotacion,
      conMovimiento,
    },
  };
}

// ---------- SCM: nivel de madurez (checklist manual, solo administradores) ----------
// Un solo documento ("scm_estado/madurez") con el mapa { itemId: true|false }.
// El nivel (Inicial / En desarrollo / Optimizado) y la barra de avance se
// calculan en la página a partir de cuántos puntos están marcados: NO se
// calculan solos a partir de los datos del negocio, los marca la persona.

const scmEstadoMadurezRef = doc(db, "scm_estado", "madurez");

/** Escucha en tiempo real qué puntos del checklist de madurez están marcados. */
export function escucharMadurezScm(callback, onError) {
  return onSnapshot(scmEstadoMadurezRef, (snap) => {
    callback(snap.exists() ? (snap.data().items || {}) : {});
  }, onError);
}

/** Marca o desmarca un punto del checklist (merge: no toca los demás puntos). */
export function marcarItemMadurezScm(itemId, completado) {
  return setDoc(scmEstadoMadurezRef, {
    items: { [itemId]: completado },
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

// ---------- SCM: métricas para Reportes ----------

/**
 * Trae productos, proveedores, pedidos y movimientos una sola vez y calcula
 * los indicadores que usan admin-scm-reportes.html (dashboard y checklist
 * de madurez).
 */
export async function calcularMetricasScm() {
  const [productosSnap, proveedoresSnap, pedidosSnap, movimientosSnap] = await Promise.all([
    getDocs(scmProductosRef),
    getDocs(scmProveedoresRef),
    getDocs(scmPedidosRef),
    getDocs(scmMovimientosRef),
  ]);

  const productos = productosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const proveedores = proveedoresSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pedidos = pedidosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const movimientos = movimientosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const stockBajo = productos.filter(p => Number(p.stock) <= Number(p.stockMin));
  const pedidosEnProceso = pedidos.filter(p => p.estado === "Pendiente" || p.estado === "En proceso");
  const push = productos.filter(p => p.estrategia === "PUSH").length;
  const pull = productos.filter(p => p.estrategia === "PULL").length;

  // Productos con más salidas (ventas/reposición despachada) = "más vendidos"
  const salidasPorProducto = {};
  movimientos.filter(m => m.tipo === "Salida").forEach(m => {
    salidasPorProducto[m.producto] = (salidasPorProducto[m.producto] || 0) + (Number(m.cantidad) || 0);
  });
  const productosMasVendidos = Object.entries(salidasPorProducto)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([producto, cantidad]) => ({ producto, cantidad }));

  // Rotación de inventario: % de productos con al menos un movimiento registrado
  const productosConMovimiento = new Set(movimientos.map(m => m.productoId)).size;
  const rotacion = productos.length ? Math.round((productosConMovimiento / productos.length) * 100) : 0;

  // Comparativa PUSH vs PULL: pedidos de reposición agrupados por mes y por
  // la estrategia del producto al momento del pedido.
  const porMes = {};
  pedidos.forEach(p => {
    if (!p.fecha) return;
    const mes = p.fecha.slice(0, 7); // "YYYY-MM"
    const prod = productos.find(x => x.id === p.productoId);
    const estrategia = prod ? prod.estrategia : null;
    if (!estrategia) return;
    porMes[mes] = porMes[mes] || { PUSH: 0, PULL: 0 };
    porMes[mes][estrategia]++;
  });
  const comparativaPushPull = Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes, ...v }));

  return {
    productos, proveedores, pedidos, movimientos,
    totalProductos: productos.length,
    totalProveedores: proveedores.length,
    pedidosEnProceso: pedidosEnProceso.length,
    stockBajo,
    push, pull,
    productosMasVendidos,
    rotacion,
    comparativaPushPull,
  };
}

// ============================================================================
//  ETAPA 4 — Soporte e integraciones
//  Colecciones nuevas (reglas en firestore.rules, explicadas en DOCUMENTACION-TECNICA.md §11):
//    tickets/{folio}        { folio, clienteId, clienteNombre, clienteCorreo, asunto, mensaje,
//                             estado: "En proceso"|"Solucionado"|"Cerrado", esperaSoporte,
//                             respuesta, agente, agenteId, leidoCliente,
//                             hilo: [{ de: "cliente"|"soporte", nombre, texto, fecha }], creadoEn }
//    contadores/tickets     { ultimo }   (solo para el folio consecutivo T-101, T-102...)
//    promociones/{CODIGO}   { codigo, descripcion, tipo: "porcentaje"|"tercera_prenda"|"envio_gratis",
//                             valor, minimoCompra, vigenciaHasta "AAAA-MM-DD", activa, creadoPor }
//    pagos/{ventaId}        { pedidoId, folio, clienteId, clienteNombre, monto, iva, metodoPago,
//                             estado: "Pagado"|"Pendiente"|"Cancelado"|"Reembolsado", referencia, origen, usuarioId,
//                             usuarioNombre, fecha, creadoEn }
// ============================================================================

/** Fecha local de hoy como "AAAA-MM-DD" (la vigencia de un cupón se compara con esta). */
export function hoyISO(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

// ---------- Promociones (cupones con vigencia) ----------

const promocionesRef = collection(db, "promociones");

export const TIPOS_PROMOCION = {
  porcentaje:     "Porcentaje sobre el subtotal",
  tercera_prenda: "Porcentaje en la tercera prenda",
  envio_gratis:   "Envío gratis (compra mínima)",
};

/** Un cupón sirve si está activo y su fecha de vigencia no ha pasado (el último día aún cuenta). */
export function promocionVigente(promo, hoy = hoyISO()) {
  return !!promo && promo.activa === true
    && typeof promo.vigenciaHasta === "string" && promo.vigenciaHasta >= hoy;
}

/** Busca un cupón por su código (el código es el id del documento). Devuelve null si no existe. */
export async function obtenerPromocion(codigo) {
  const id = String(codigo || "").trim().toUpperCase();
  if (!id || id.includes("/")) return null;
  const snap = await getDoc(doc(db, "promociones", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Valida un código escrito por el cliente. Devuelve { ok, cupon, motivo }.
 * "cupon" tiene la misma forma que ya usan Carrito.html y Checkout.html
 * ({ codigo, tipo, valor }) más "minimo" y "vigenciaHasta".
 */
export async function validarCupon(codigo) {
  const promo = await obtenerPromocion(codigo);
  if (!promo) return { ok: false, motivo: "Código inválido." };
  if (promo.activa !== true) return { ok: false, motivo: "Ese cupón está desactivado." };
  if (!promocionVigente(promo)) return { ok: false, motivo: "Ese cupón ya venció." };
  return {
    ok: true,
    cupon: {
      codigo: promo.codigo, tipo: promo.tipo, valor: Number(promo.valor) || 0,
      minimo: Number(promo.minimoCompra) || 0, vigenciaHasta: promo.vigenciaHasta,
    },
  };
}

/** Escucha en tiempo real todas las promociones (solo personal de ventas). */
export function escucharPromociones(callback, onError) {
  return onSnapshot(query(promocionesRef, orderBy("vigenciaHasta", "desc")), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * Crea o actualiza un cupón. usuario = window.BP_SESION (queda registrado quién lo creó).
 * esNuevo = true la primera vez (guarda quién y cuándo lo creó); al editar solo se actualiza lo demás.
 */
export function guardarPromocion(datos, usuario, esNuevo = true) {
  const codigo = String(datos.codigo || "").trim().toUpperCase();
  const doc_ = {
    codigo,
    descripcion: String(datos.descripcion || "").trim(),
    tipo: datos.tipo,
    valor: Number(datos.valor) || 0,
    minimoCompra: Number(datos.minimoCompra) || 0,
    vigenciaHasta: datos.vigenciaHasta,
    activa: datos.activa !== false,
    actualizadoEn: serverTimestamp(),
  };
  if (esNuevo) {
    doc_.creadoPor = usuario?.nombre || usuario?.correo || "";
    doc_.creadoPorId = usuario?.uid || "";
    doc_.creadoEn = serverTimestamp();
  }
  return setDoc(doc(db, "promociones", codigo), doc_, { merge: true });
}

export function cambiarActivaPromocion(codigo, activa) {
  return updateDoc(doc(db, "promociones", codigo), { activa: !!activa, actualizadoEn: serverTimestamp() });
}

export function eliminarPromocion(codigo) {
  return deleteDoc(doc(db, "promociones", codigo));
}

/** Carga los 3 cupones que antes estaban escritos en el código, con vigencia de un año. */
export async function cargarPromocionesEjemplo(usuario) {
  const hasta = new Date();
  hasta.setFullYear(hasta.getFullYear() + 1);
  const vigenciaHasta = hoyISO(hasta);
  const ejemplos = [
    { codigo: "CUTECANDY50", descripcion: "2 x 1 en blusas (50% de descuento)", tipo: "porcentaje", valor: 50, minimoCompra: 0 },
    { codigo: "CUTECANDY10", descripcion: "10% en tu tercera prenda", tipo: "tercera_prenda", valor: 10, minimoCompra: 0 },
    { codigo: "CUTENVIO1", descripcion: "Envío gratis en compras mayores a $2000", tipo: "envio_gratis", valor: 0, minimoCompra: 2000 },
  ];
  await Promise.all(ejemplos.map(p => guardarPromocion({ ...p, vigenciaHasta, activa: true }, usuario)));
  return ejemplos.length;
}

// ---------- Tickets de atención a clientes ----------

const ticketsRef = collection(db, "tickets");

export const ASUNTOS_TICKET = ["Duda sobre mi pedido", "Cambio de producto", "Facturación", "Problema con monedero"];
export const ESTADOS_TICKET = ["En proceso", "Solucionado", "Cerrado"];

function milisTicket(t) {
  const c = t.creadoEn;
  if (!c) return Date.now();                 // recién creado: el servidor aún no le pone fecha
  return c.toMillis ? c.toMillis() : new Date(c).getTime();
}

/**
 * Crea un ticket a nombre del cliente con sesión iniciada. El folio (T-101, T-102...) sale de un
 * contador dentro de una TRANSACCIÓN, así que dos clientes que escriben al mismo tiempo nunca
 * reciben el mismo folio. cliente = { uid, nombre, correo }.
 */
export async function crearTicket({ asunto, mensaje, cliente, pedido }) {
  if (!cliente || !cliente.uid) throw new Error("Inicia sesión para enviar un ticket.");
  if (!ASUNTOS_TICKET.includes(asunto)) throw new Error("Elige un asunto de la lista.");
  const texto = String(mensaje || "").trim();
  if (!texto) throw new Error("Describe tu problema para poder ayudarte.");
  if (texto.length > 2000) throw new Error("El mensaje es muy largo (máximo 2000 caracteres).");

  // Producto comprado sobre el que trata la queja (opcional): { ventaId, folio, productoId, producto, cantidad }.
  // Las reglas comprueban que esa venta sea del mismo cliente.
  let pedidoDoc = null;
  if (pedido && pedido.ventaId) {
    pedidoDoc = {
      ventaId: String(pedido.ventaId).slice(0, 60),
      folio: String(pedido.folio || "").slice(0, 40),
      productoId: String(pedido.productoId || "").slice(0, 60),
      producto: String(pedido.producto || "").slice(0, 200),
      cantidad: Number(pedido.cantidad) || 1,
    };
  }

  const contadorRef = doc(db, "contadores", "tickets");
  const nombre = String(cliente.nombre || cliente.correo || "Cliente").slice(0, 120);
  const folio = await runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorRef);
    const numero = snap.exists() ? (Number(snap.data().ultimo) || 100) + 1 : 101;
    const nuevoFolio = "T-" + numero;
    if (snap.exists()) tx.update(contadorRef, { ultimo: numero });
    else tx.set(contadorRef, { ultimo: numero });
    tx.set(doc(db, "tickets", nuevoFolio), {
      folio: nuevoFolio,
      clienteId: cliente.uid,
      clienteNombre: nombre,
      clienteCorreo: cliente.correo || "",
      asunto,
      mensaje: texto,
      estado: "En proceso",
      esperaSoporte: true,
      respuesta: "",
      agente: "",
      leidoCliente: true,
      hilo: [{ de: "cliente", nombre, texto, fecha: new Date().toISOString() }],
      creadoEn: serverTimestamp(),
      ...(pedidoDoc ? { pedido: pedidoDoc } : {}),
    });
    return nuevoFolio;
  });
  return folio;
}

/** Tickets de UN cliente (los más recientes primero). Se ordena aquí para no exigir un índice. */
export function escucharTicketsDeCliente(uid, callback, onError) {
  const q = query(ticketsRef, where("clienteId", "==", uid));
  return onSnapshot(q, (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => milisTicket(b) - milisTicket(a));
    callback(lista);
  }, onError);
}

/** TODOS los tickets (soporte y administrador). Los resueltos nunca se borran. */
export function escucharTodosLosTickets(callback, onError) {
  const q = query(ticketsRef, orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * El cliente contesta dentro de su ticket (por ejemplo, cuando soporte le pide evidencia o más datos).
 * Solo se puede mientras el ticket siga "En proceso": si soporte lo marcó Solucionado o Cerrado ya
 * no admite mensajes (las reglas también lo impiden). El ticket vuelve a quedar "en espera" de soporte.
 * cliente = { uid, nombre }.
 */
export async function responderTicketCliente(ticket, texto, cliente) {
  const mensaje = String(texto || "").trim();
  if (!mensaje) throw new Error("Escribe tu respuesta.");
  if (mensaje.length > 2000) throw new Error("La respuesta es muy larga (máximo 2000 caracteres).");
  if ((ticket.estado || "En proceso") !== "En proceso") {
    throw new Error("Este ticket ya está " + String(ticket.estado).toLowerCase() + ". Crea uno nuevo si necesitas algo más.");
  }
  const nombre = String(cliente?.nombre || ticket.clienteNombre || "Cliente").slice(0, 120);
  return updateDoc(doc(db, "tickets", ticket.id), {
    hilo: arrayUnion({ de: "cliente", nombre, texto: mensaje, fecha: new Date().toISOString() }),
    esperaSoporte: true,
    leidoCliente: true,
    actualizadoEn: serverTimestamp(),
  });
}

/** El cliente abrió el ticket: apaga la alerta de "respuesta sin leer". */
export function marcarTicketLeido(folio) {
  return updateDoc(doc(db, "tickets", folio), { leidoCliente: true });
}

/**
 * Soporte responde y/o cambia el estado. agente = { uid, nombre, correo } (queda registrado quién
 * contestó). Si el ticket ya tenía respuesta, se puede cambiar solo el estado dejando el texto vacío.
 */
export async function responderTicket(ticket, { texto, estado }, agente) {
  if (!ESTADOS_TICKET.includes(estado)) throw new Error("Estado no válido.");
  const mensaje = String(texto || "").trim();
  const yaRespondido = !!ticket.respuesta;
  if (!mensaje && !yaRespondido) throw new Error("Escribe la respuesta para el cliente.");
  if (mensaje.length > 2000) throw new Error("La respuesta es muy larga (máximo 2000 caracteres).");
  const quien = agente?.nombre || agente?.correo || "Soporte";
  const cambios = {
    estado,
    respuesta: mensaje || ticket.respuesta,
    agente: quien,
    agenteId: agente?.uid || "",
    esperaSoporte: false,
    actualizadoEn: serverTimestamp(),
  };
  if (mensaje) {
    cambios.hilo = arrayUnion({ de: "soporte", nombre: quien, texto: mensaje, fecha: new Date().toISOString() });
  }
  if (mensaje || estado !== ticket.estado) cambios.leidoCliente = false;   // avisa al cliente
  return updateDoc(doc(db, "tickets", ticket.id), cambios);
}

/** Ficha en vivo de un cliente del CRM (para la tarjeta de soporte junto al ticket). */
export function escucharClienteUno(id, callback, onError) {
  return onSnapshot(doc(db, "clientes", id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

// ---------- Pagos e integración de una compra de la tienda ----------

const pagosRef = collection(db, "pagos");

/** Escucha los pagos más recientes (personal de ventas/logística/admin). */
export function escucharPagos(callback, onError, maximo = 30) {
  return onSnapshot(query(pagosRef, orderBy("creadoEn", "desc"), limit(maximo)), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * Sincroniza una compra recién cerrada en la tienda con el resto del sistema, en UNA operación
 * atómica (writeBatch):
 *   1) pagos/{ventaId}  -> documento independiente del pago (pedidoId, monto, iva, método,
 *                          estado "Pagado" | "Pendiente" (OXXO/SPEI), referencia)
 *   2) clientes/{uid}   -> suma 1 compra, suma el total gastado, última compra y etapa del CRM
 *   3) erp_operaciones  -> deja el registro empresarial "Compra en tienda"
 * Los 3 documentos se ligan a la venta por su id. Las reglas comprueban que el monto y el
 * total gastado coincidan con la venta real. Lo llama crearVenta() justo después de guardar la compra.
 */
export async function registrarIntegracionCompra({ ventaId, folio, clienteId, clienteNombre, total, metodoPago, estadoPago, referenciaPago, iva }) {
  const hoy = hoyISO();
  const monto = Number(total) || 0;
  const clienteRef = doc(db, "clientes", clienteId);
  const clienteSnap = await getDoc(clienteRef);
  const lote = writeBatch(db);

  lote.set(doc(db, "pagos", ventaId), {
    pedidoId: ventaId,
    folio,
    clienteId,
    clienteNombre: clienteNombre || "",
    monto,
    iva: Number(iva) || 0,
    metodoPago: metodoPago || "No especificado",
    // OXXO / SPEI quedan "Pendiente" hasta que el personal confirme que llegó el dinero.
    estado: estadoPago === "Pendiente" ? "Pendiente" : "Pagado",
    referencia: referenciaPago ? (referenciaPago.clabe || referenciaPago.referencia || "") : "",
    origen: "Tienda web",
    usuarioId: clienteId,
    usuarioNombre: clienteNombre || "",
    fecha: hoy,
    creadoEn: serverTimestamp(),
  });

  if (clienteSnap.exists()) {
    const c = clienteSnap.data();
    const numCompras = (Number(c.numCompras) || 0) + 1;
    lote.update(clienteRef, {
      numCompras,
      totalComprado: (Number(c.totalComprado) || 0) + monto,
      ultimaCompra: hoy,
      ultimaVentaId: ventaId,
      etapa: etapaTrasCompra(c.etapa, numCompras),
      actualizadoEn: serverTimestamp(),
    });
  }

  lote.set(doc(erpOperacionesRef), {
    tipo: "Compra en tienda",
    descripcion: `Compra ${folio} de ${clienteNombre || "cliente"} en la tienda web: total $${monto.toFixed(2)} (${metodoPago || "sin método"})`,
    ordenId: ventaId,
    folio,
    clienteId,
    clienteNombre: clienteNombre || "",
    total: monto,
    origen: "Tienda web",
    usuarioId: clienteId,
    usuarioNombre: clienteNombre || "",
    creadoEn: serverTimestamp(),
  });

  await lote.commit();
}

// =====================================================================
// ---------- Etapa 4 · Cuenta del cliente y Monedero (integrante 2) ----------
// =====================================================================
// Todo lo de "Mi cuenta" que faltaba: monedero (saldo, recargas, historial, pago),
// direcciones guardadas, edición de datos y recuperación de contraseña.
//
//   monederos/{uid}               ← el id es el mismo uid del cliente (un monedero por cliente)
//   monedero_movimientos/{id}     ← historial: nunca se edita ni se borra, solo se agregan
//   clientes/{uid}/direcciones/{id}
//
// Cada cambio de saldo se hace en UNA transacción que (1) lee el saldo actual, (2) lo cambia
// y (3) crea su movimiento. El monedero guarda el id de ese movimiento en
// "ultimoMovimientoId": las reglas lo usan para comprobar que el saldo cambió exactamente lo
// que dice el movimiento (nadie puede subirse el saldo "a mano").

export const MONEDERO = Object.freeze({
  recargaMinima: 50,
  recargaMaxima: 10000,
  saldoBajo: 100,                       // debajo de esto se muestra la alerta "recarga tu monedero"
  montosRapidos: [100, 200, 500, 1000],
  metodosRecarga: ["Tarjeta de crédito/débito", "PayPal", "Transferencia bancaria"],
});

const monederosRef = collection(db, "monederos");
const movMonederoRef = collection(db, "monedero_movimientos");

/** Fecha/hora de un documento (Timestamp de Firestore, ISO o Date) en milisegundos. */
function milisDe(valor) {
  if (!valor) return Date.now();
  if (typeof valor.toMillis === "function") return valor.toMillis();
  const t = new Date(valor).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Escucha el monedero de un cliente (null si todavía no tiene). */
export function escucharMonedero(uid, callback, onError) {
  return onSnapshot(doc(db, "monederos", uid), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

/** Lee el monedero una sola vez (checkout). */
export async function obtenerMonedero(uid) {
  const snap = await getDoc(doc(db, "monederos", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Crea el monedero en $0 la primera vez que el cliente entra a "Mi monedero". */
export async function asegurarMonedero(cliente) {
  const ref = doc(db, "monederos", cliente.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  const nuevo = {
    clienteId: cliente.uid,
    clienteNombre: String(cliente.nombre || cliente.correo || "Cliente").slice(0, 120),
    saldo: 0,
    totalRecargado: 0,
    totalGastado: 0,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  };
  await setDoc(ref, nuevo);
  return { id: cliente.uid, ...nuevo };
}

/** Historial de movimientos de UN cliente (más recientes primero; se ordena aquí para no exigir índice). */
export function escucharMovimientosMonedero(uid, callback, onError) {
  return onSnapshot(query(movMonederoRef, where("clienteId", "==", uid)), (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => milisDe(b.creadoEn) - milisDe(a.creadoEn));
    callback(lista);
  }, onError);
}

/** Panel: todos los monederos (ventas y administrador). */
export function escucharMonederos(callback, onError) {
  return onSnapshot(monederosRef, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/** Panel: los movimientos más recientes de todos los monederos. */
export function escucharMovimientosMonederoTodos(callback, onError, maximo = 200) {
  return onSnapshot(query(movMonederoRef, orderBy("creadoEn", "desc"), limit(maximo)), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * El cliente recarga su monedero. No hay pasarela real: el formulario del método (tarjeta,
 * PayPal o transferencia) se valida en la pantalla y aquí solo se guarda un resumen seguro
 * (marca y últimos 4 dígitos, correo de PayPal o clave de rastreo de la transferencia).
 * cliente = { uid, nombre }. Devuelve { saldoAnterior, saldoNuevo, movimientoId }.
 */
export async function recargarMonedero({ cliente, monto, metodo, detalle }) {
  const cantidad = redondear2(monto);
  if (!Number.isFinite(cantidad) || cantidad < MONEDERO.recargaMinima || cantidad > MONEDERO.recargaMaxima) {
    throw new Error(`La recarga debe ser de ${dineroTxt(MONEDERO.recargaMinima)} a ${dineroTxt(MONEDERO.recargaMaxima)}.`);
  }
  if (!Number.isInteger(cantidad)) throw new Error("La recarga debe ser en pesos completos (sin centavos).");
  if (!MONEDERO.metodosRecarga.includes(metodo)) throw new Error("Elige un método de pago para la recarga.");

  await asegurarMonedero(cliente);
  const ref = doc(db, "monederos", cliente.uid);
  const movRef = doc(movMonederoRef);
  const nombre = String(cliente.nombre || "Cliente").slice(0, 120);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.data();
    const anterior = redondear2(m.saldo);
    const nuevo = redondear2(anterior + cantidad);
    tx.update(ref, {
      saldo: nuevo,
      totalRecargado: redondear2((Number(m.totalRecargado) || 0) + cantidad),
      ultimoMovimientoId: movRef.id,
      actualizadoEn: serverTimestamp(),
    });
    tx.set(movRef, {
      clienteId: cliente.uid,
      clienteNombre: nombre,
      tipo: "Recarga",
      efecto: "abono",
      monto: cantidad,
      saldoAnterior: anterior,
      saldoNuevo: nuevo,
      metodo,
      detalle: String(detalle || "").slice(0, 120),
      ventaId: "",
      folio: "",
      motivo: "",
      usuarioId: cliente.uid,
      usuarioNombre: nombre,
      fecha: hoyISO(),
      creadoEn: serverTimestamp(),
    });
    return { saldoAnterior: anterior, saldoNuevo: nuevo, movimientoId: movRef.id };
  });
}

/**
 * Administrador: recarga manual (abono) o ajuste (abono / cargo) del saldo de un cliente,
 * siempre con un motivo. Si el cliente aún no tiene monedero, se le crea aquí.
 * datos = { clienteId, clienteNombre, efecto: "abono"|"cargo", monto, motivo, tipo: "Recarga"|"Ajuste" }
 * usuario = window.BP_SESION (quién hizo el ajuste).
 */
export async function ajustarMonedero({ clienteId, clienteNombre, efecto, monto, motivo, tipo = "Ajuste" }, usuario) {
  const cantidad = redondear2(monto);
  if (!clienteId) throw new Error("Elige un cliente.");
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 50000) throw new Error("Escribe un monto válido (mayor a $0).");
  if (!["abono", "cargo"].includes(efecto)) throw new Error("Indica si se suma o se resta saldo.");
  if (!["Ajuste", "Recarga"].includes(tipo)) throw new Error("Tipo de movimiento no válido.");
  if (tipo === "Recarga" && efecto !== "abono") throw new Error("Una recarga siempre suma saldo.");
  const textoMotivo = String(motivo || "").trim();
  if (textoMotivo.length < 5) throw new Error("Escribe el motivo del ajuste (mínimo 5 letras).");

  const ref = doc(db, "monederos", clienteId);
  const movRef = doc(movMonederoRef);
  const quien = usuario?.nombre || usuario?.correo || "Administrador";

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.exists() ? snap.data() : { saldo: 0, totalRecargado: 0, totalGastado: 0 };
    const anterior = redondear2(m.saldo);
    const nuevo = redondear2(efecto === "abono" ? anterior + cantidad : anterior - cantidad);
    if (nuevo < 0) throw new Error(`No se puede restar ${dineroTxt(cantidad)}: el cliente solo tiene ${dineroTxt(anterior)}.`);

    const cambios = {
      saldo: nuevo,
      totalRecargado: redondear2((Number(m.totalRecargado) || 0) + (tipo === "Recarga" ? cantidad : 0)),
      ultimoMovimientoId: movRef.id,
      actualizadoEn: serverTimestamp(),
    };
    if (snap.exists()) {
      tx.update(ref, cambios);
    } else {
      tx.set(ref, {
        ...cambios,
        clienteId,
        clienteNombre: String(clienteNombre || "Cliente").slice(0, 120),
        totalGastado: 0,
        creadoEn: serverTimestamp(),
      });
    }
    tx.set(movRef, {
      clienteId,
      clienteNombre: String(clienteNombre || m.clienteNombre || "Cliente").slice(0, 120),
      tipo,
      efecto,
      monto: cantidad,
      saldoAnterior: anterior,
      saldoNuevo: nuevo,
      metodo: "Panel de administración",
      detalle: "",
      ventaId: "",
      folio: "",
      motivo: textoMotivo.slice(0, 300),
      usuarioId: usuario?.uid || "",
      usuarioNombre: quien,
      fecha: hoyISO(),
      creadoEn: serverTimestamp(),
    });
    return { saldoAnterior: anterior, saldoNuevo: nuevo };
  });
}

/**
 * Cancelar una orden pagada con monedero devuelve el dinero al saldo del cliente.
 * Lo usa cambiarEstadoOrdenErp() dentro de su mismo lote (writeBatch).
 */
async function agregarReembolsoMonedero(lote, orden, usuario) {
  const ref = doc(db, "monederos", orden.clienteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;               // no debería pasar: sin monedero no pudo pagar con él
  const m = snap.data();
  const monto = redondear2(orden.total);
  const anterior = redondear2(m.saldo);
  const nuevo = redondear2(anterior + monto);
  const movRef = doc(movMonederoRef);
  const quien = usuario?.nombre || usuario?.correo || "";
  lote.update(ref, {
    saldo: nuevo,
    totalGastado: redondear2(Math.max(0, (Number(m.totalGastado) || 0) - monto)),
    ultimoMovimientoId: movRef.id,
    actualizadoEn: serverTimestamp(),
  });
  lote.set(movRef, {
    clienteId: orden.clienteId,
    clienteNombre: orden.clienteNombre || m.clienteNombre || "",
    tipo: "Reembolso",
    efecto: "abono",
    monto,
    saldoAnterior: anterior,
    saldoNuevo: nuevo,
    metodo: "Monedero",
    detalle: `Cancelación de ${orden.folio || orden.id}`,
    ventaId: orden.id,
    folio: orden.folio || "",
    motivo: "Orden cancelada",
    usuarioId: usuario?.uid || "",
    usuarioNombre: quien,
    fecha: hoyISO(),
    creadoEn: serverTimestamp(),
  });
}

// ---------- Direcciones guardadas del cliente ----------

/** Revisa una dirección; devuelve el texto del primer error o "" si está bien. */
export function errorDeDireccion(d) {
  const RE_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;
  if (!d.nombre || !RE_NOMBRE.test(d.nombre)) return "Escribe el nombre de quien recibe (solo letras).";
  if (!d.apellido || !RE_NOMBRE.test(d.apellido)) return "Escribe el apellido de quien recibe (solo letras).";
  if (!d.calle || d.calle.trim().length < 5) return "Escribe la calle y el número.";
  if (!d.ciudad) return "Escribe la ciudad.";
  if (!d.estado) return "Escribe el estado.";
  if (!/^\d{5}$/.test(d.cp || "")) return "El código postal debe tener 5 números.";
  if (!/^\d{10}$/.test(d.telefono || "")) return "El teléfono debe tener 10 dígitos.";
  return "";
}

function limpiarDireccion(d) {
  const t = (v, max) => String(v ?? "").trim().slice(0, max);
  return {
    alias: t(d.alias, 40) || "Mi dirección",
    nombre: t(d.nombre, 60),
    apellido: t(d.apellido, 60),
    pais: t(d.pais, 60) || "México",
    calle: t(d.calle, 200),
    ciudad: t(d.ciudad, 80),
    estado: t(d.estado, 80),
    cp: t(d.cp, 5),
    telefono: String(d.telefono ?? "").replace(/\D/g, "").slice(0, 10),
    referencias: t(d.referencias, 300),
    predeterminada: !!d.predeterminada,
  };
}

/** Escucha las direcciones del cliente (la predeterminada primero). */
export function escucharDirecciones(uid, callback, onError) {
  return onSnapshot(collection(db, "clientes", uid, "direcciones"), (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => (b.predeterminada === true) - (a.predeterminada === true) || milisDe(a.creadoEn) - milisDe(b.creadoEn));
    callback(lista);
  }, onError);
}

/** Lee las direcciones una sola vez (checkout). */
export async function obtenerDirecciones(uid) {
  const snap = await getDocs(collection(db, "clientes", uid, "direcciones"));
  const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  lista.sort((a, b) => (b.predeterminada === true) - (a.predeterminada === true) || milisDe(a.creadoEn) - milisDe(b.creadoEn));
  return lista;
}

/**
 * Crea (id vacío) o edita una dirección. Solo puede haber UNA predeterminada: si esta lo es,
 * a las demás se les quita en la misma operación. La primera dirección siempre es predeterminada.
 * todas = lista actual de direcciones (para saber cuál era la predeterminada).
 */
export async function guardarDireccion(uid, datos, id, todas = []) {
  const limpia = limpiarDireccion(datos);
  const error = errorDeDireccion(limpia);
  if (error) throw new Error(error);
  const otras = todas.filter(d => d.id !== id);
  if (otras.length === 0) limpia.predeterminada = true;
  if (todas.length >= 10 && !id) throw new Error("Puedes guardar hasta 10 direcciones. Elimina una para agregar otra.");

  const lote = writeBatch(db);
  const ref = id ? doc(db, "clientes", uid, "direcciones", id) : doc(collection(db, "clientes", uid, "direcciones"));
  if (id) lote.update(ref, { ...limpia, actualizadoEn: serverTimestamp() });
  else lote.set(ref, { ...limpia, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
  if (limpia.predeterminada) {
    otras.filter(d => d.predeterminada).forEach(d =>
      lote.update(doc(db, "clientes", uid, "direcciones", d.id), { predeterminada: false, actualizadoEn: serverTimestamp() }));
  }
  await lote.commit();
  return ref.id;
}

/** Marca una dirección como la predeterminada (la que se usa sola en el checkout). */
export async function marcarDireccionPredeterminada(uid, id, todas = []) {
  const lote = writeBatch(db);
  todas.forEach(d => {
    const debe = d.id === id;
    if (!!d.predeterminada !== debe) {
      lote.update(doc(db, "clientes", uid, "direcciones", d.id), { predeterminada: debe, actualizadoEn: serverTimestamp() });
    }
  });
  await lote.commit();
}

/** Elimina una dirección; si era la predeterminada, la siguiente pasa a serlo. */
export async function eliminarDireccion(uid, id, todas = []) {
  const lote = writeBatch(db);
  const borrada = todas.find(d => d.id === id);
  lote.delete(doc(db, "clientes", uid, "direcciones", id));
  const siguiente = todas.find(d => d.id !== id);
  if (borrada && borrada.predeterminada && siguiente) {
    lote.update(doc(db, "clientes", uid, "direcciones", siguiente.id), { predeterminada: true, actualizadoEn: serverTimestamp() });
  }
  await lote.commit();
}

// ---------- Mis datos y contraseña del cliente ----------

/**
 * Cuentas que existen en Authentication pero NO tienen su documento en "clientes" (se crearon
 * cuando el registro estaba roto, o desde el panel): se les crea el perfil con lo que se sabe de
 * la cuenta. Sin esto, "Mis datos" fallaba con "No document to update" y sus compras no llegaban
 * al CRM. Devuelve el perfil (existente o nuevo).
 */
export async function asegurarPerfilCliente(user) {
  if (!user) return null;
  // Mientras registro.js está creando la cuenta, el perfil lo guarda registrarCliente() con todos
  // sus datos: si aquí también se creara, los dos chocarían y Firebase rechazaría el segundo.
  let registrando = false;
  try { registrando = sessionStorage.getItem("bpRegistrando") === "1"; } catch { /* sin almacenamiento */ }
  if (registrando) return null;
  // Una cuenta dada de baja desde el panel NO se vuelve a crear: se termina de borrar.
  if (await completarBajaSiCorresponde(user)) {
    const err = new Error("Tu cuenta fue dada de baja por la tienda.");
    err.code = "bp/cuenta-dada-de-baja";
    throw err;
  }
  const ref = doc(db, "clientes", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  const nuevo = {
    nombre: String(user.displayName || (user.email || "Cliente").split("@")[0]).slice(0, 120),
    correo: user.email || "",
    telefono: "",
    mascota: "Sin especificar",
    etapa: "Prospecto",
    estado: "Activo",
    fechaRegistro: new Date().toLocaleDateString("es-MX"),
    creadoEn: serverTimestamp(),
  };
  await setDoc(ref, nuevo);
  return { id: user.uid, ...nuevo };
}

/** El cliente cambia sus datos de contacto (y su nombre también en Authentication). */
export async function actualizarDatosCliente(uid, { nombre, telefono, mascota }) {
  const n = String(nombre || "").trim();
  const tel = String(telefono || "").replace(/\D/g, "");
  if (n.length < 3 || !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(n)) throw new Error("Escribe tu nombre completo (solo letras).");
  if (tel && tel.length !== 10) throw new Error("El teléfono debe tener 10 dígitos.");
  if (auth.currentUser && auth.currentUser.uid === uid) await asegurarPerfilCliente(auth.currentUser);
  await updateDoc(doc(db, "clientes", uid), {
    nombre: n.slice(0, 120),
    telefono: tel,
    mascota: String(mascota || "").trim().slice(0, 60) || "Sin especificar",
    actualizadoEn: serverTimestamp(),
  });
  if (auth.currentUser && auth.currentUser.uid === uid) {
    await updateProfile(auth.currentUser, { displayName: n.slice(0, 120) });
  }
}

/**
 * Cambio de correo del cliente: Firebase manda un enlace al correo NUEVO y el cambio se hace
 * cuando la persona lo abre (así nadie puede poner un correo ajeno). Requiere su contraseña.
 */
export async function solicitarCambioCorreoCliente(correoNuevo, contrasenaActual) {
  await reautenticar(contrasenaActual);
  await verifyBeforeUpdateEmail(auth.currentUser, String(correoNuevo).trim());
}

/** Si el correo de la cuenta ya cambió (enlace confirmado), lo copia al perfil del CRM. */
export async function sincronizarCorreoCliente(uid, perfil) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid || !user.email || !perfil || perfil.correo === user.email) return false;
  await user.getIdToken(true);    // token fresco: las reglas comparan contra el correo verificado
  await updateDoc(doc(db, "clientes", uid), { correo: user.email, actualizadoEn: serverTimestamp() });
  return true;
}

/** Cambio de contraseña estando dentro de la cuenta (pide la contraseña actual). */
export function cambiarContrasenaCliente(contrasenaNueva, contrasenaActual) {
  if (String(contrasenaNueva || "").length < 6) throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
  return cambiarContrasenaPropia(contrasenaNueva, contrasenaActual);
}

/**
 * "¿Olvidaste tu contraseña?": Firebase manda un correo con el enlace para crear una nueva.
 * IMPORTANTE: cada correo nuevo deja SIN VALOR a los anteriores, y el enlace dura 1 hora y sirve una
 * sola vez. Por eso aquí no se deja pedir otro hasta pasados 60 segundos (lanza code
 * "bp/espera-reenvio" con segundos), para que nadie termine abriendo un enlace viejo.
 */
export async function enviarCorreoRecuperacion(correo) {
  const c = String(correo || "").trim().toLowerCase();
  const clave = "bpUltimoReset:" + c;
  let ultimo = 0;
  try { ultimo = Number(localStorage.getItem(clave)) || 0; } catch { /* sin almacenamiento */ }
  const espera = 60000 - (Date.now() - ultimo);
  if (espera > 0) {
    const err = new Error(`Ya te enviamos un enlace hace un momento. Usa ese correo (el más reciente) o espera ${Math.ceil(espera / 1000)} segundos para pedir otro.`);
    err.code = "bp/espera-reenvio";
    throw err;
  }
  await enviarCorreoConEnlace((ajustes) => sendPasswordResetEmail(auth, c, ajustes), "login.html?restablecida=1");
  try { localStorage.setItem(clave, String(Date.now())); } catch { /* sin almacenamiento */ }
}

// ---------- Página propia para los enlaces de los correos (cuenta-accion.html) ----------

/** Revisa que el enlace de "crear contraseña nueva" siga sirviendo. Devuelve el correo de la cuenta. */
export function revisarEnlaceContrasena(codigo) {
  return verifyPasswordResetCode(auth, codigo);
}

/** Guarda la contraseña nueva usando el código del enlace (aquí es donde el enlace se "gasta"). */
export function guardarContrasenaNueva(codigo, contrasenaNueva) {
  if (String(contrasenaNueva || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  return confirmPasswordReset(auth, codigo, contrasenaNueva);
}

/** Confirma el correo (enlace del correo de bienvenida) o un cambio de correo. */
export function aplicarEnlaceCorreo(codigo) {
  return applyActionCode(auth, codigo);
}

// =====================================================================
// ---------- Etapa 4 · Carrito persistente (modelos Carrito y CarritoDetalle del PDF) ----------
// =====================================================================
//   carritos/{uid}                     ← un cliente tiene UN carrito (id = uid)
//     { clienteId, clienteNombre, estado: "Activo"|"Vacío"|"Comprado"|"Expirado",
//       numProductos, totalPiezas, subtotal, resumen: [{ nombre, cantidad }],
//       ultimaVentaId, actualizadoEn }
//   carritos/{uid}/detalle/{productoId} ← cada producto del carrito
//     { productoId, nombre, cantidad, precioUnitario, imagen, agregadoEn (ms) }
// En el navegador el carrito se sigue leyendo de localStorage (así funciona igual sin sesión);
// carrito-sync.js lo copia a Firebase cuando hay un cliente con sesión y lo trae de vuelta
// desde cualquier dispositivo.

export const CARRITO = Object.freeze({
  horasCaducidad: 72,       // un producto se quita solo del carrito 72 h después de agregarlo
  maxPiezasPorProducto: 99,
});

/** Lee el carrito guardado de un cliente: { estado, items: [...] } o null. */
export async function obtenerCarritoRemoto(uid) {
  const [cab, det] = await Promise.all([
    getDoc(doc(db, "carritos", uid)),
    getDocs(collection(db, "carritos", uid, "detalle")),
  ]);
  if (!cab.exists() && det.empty) return null;
  return { ...(cab.exists() ? cab.data() : {}), items: det.docs.map(d => ({ id: d.id, ...d.data() })) };
}

/** Escucha los productos del carrito guardado (para ver en vivo cambios hechos en otro dispositivo). */
export function escucharCarritoRemoto(uid, callback, onError) {
  return onSnapshot(collection(db, "carritos", uid, "detalle"), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * Guarda el carrito completo del cliente: actualiza la cabecera, escribe cada producto en
 * "detalle" y borra los que ya no están. items = [{ id, nombre, precio, cantidad, imagen, agregadoEn }].
 * extra = { estado, ultimaVentaId, clienteNombre }.
 */
export async function guardarCarritoRemoto(uid, items, extra = {}) {
  const limpios = (items || [])
    .map(i => ({
      productoId: String(i.id || i.productoId || ""),
      nombre: String(i.nombre || "Producto").slice(0, 200),
      cantidad: Math.min(CARRITO.maxPiezasPorProducto, Math.max(1, Math.floor(Number(i.cantidad) || 1))),
      precioUnitario: redondear2(i.precio ?? i.precioUnitario),
      imagen: String(i.imagen || "").slice(0, 500),
      agregadoEn: Number(i.agregadoEn) || Date.now(),
    }))
    .filter(i => i.productoId && !i.productoId.includes("/"));

  const actuales = await getDocs(collection(db, "carritos", uid, "detalle"));
  const lote = writeBatch(db);
  const ids = new Set(limpios.map(i => i.productoId));
  actuales.docs.forEach(d => { if (!ids.has(d.id)) lote.delete(d.ref); });
  limpios.forEach(i => lote.set(doc(db, "carritos", uid, "detalle", i.productoId), i));

  const totalPiezas = limpios.reduce((s, i) => s + i.cantidad, 0);
  const estado = extra.estado || (limpios.length ? "Activo" : "Vacío");
  lote.set(doc(db, "carritos", uid), {
    clienteId: uid,
    clienteNombre: String(extra.clienteNombre || "").slice(0, 120),
    estado,
    numProductos: limpios.length,
    totalPiezas,
    subtotal: redondear2(limpios.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0)),
    resumen: limpios.slice(0, 30).map(i => ({ nombre: i.nombre, cantidad: i.cantidad })),
    ultimaVentaId: String(extra.ultimaVentaId || ""),
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
  await lote.commit();
}

/** Panel: todos los carritos (activos, abandonados, comprados, expirados). */
export function escucharCarritos(callback, onError) {
  return onSnapshot(collection(db, "carritos"), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

// =====================================================================
// ---------- Etapa 4 · Foto de perfil del cliente ----------
// =====================================================================
//   fotos_perfil/{uid}  { foto: "data:image/jpeg;base64,...", actualizadoEn }
// La foto se reduce en el navegador a 256×256 (JPEG, ~20-60 KB) y se guarda como texto en
// Firestore, en una colección APARTE de "clientes" para que las listas del CRM no carguen
// fotos. No se usa Firebase Storage porque en proyectos nuevos exige el plan de pago (Blaze).
// Sin foto, las pantallas muestran el ícono genérico de perfil.

/** Escucha la foto de perfil del cliente (callback recibe el texto de la imagen o "" si no tiene). */
export function escucharFotoPerfil(uid, callback, onError) {
  return onSnapshot(doc(db, "fotos_perfil", uid), (snap) => {
    callback(snap.exists() ? (snap.data().foto || "") : "");
  }, onError);
}

/** Guarda (o reemplaza) la foto. dataUrl debe venir de reducirFoto() (foto-perfil.js). */
export async function guardarFotoPerfil(uid, dataUrl) {
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl || "")) throw new Error("La imagen no es válida.");
  if (dataUrl.length > 200000) throw new Error("La imagen es demasiado pesada.");
  await setDoc(doc(db, "fotos_perfil", uid), { foto: dataUrl, actualizadoEn: serverTimestamp() });
}

/** Quita la foto: vuelve a verse el ícono genérico. */
export function quitarFotoPerfil(uid) {
  return deleteDoc(doc(db, "fotos_perfil", uid));
}


// =====================================================================
// ---------- Etapa 4 · Seguridad: bloqueo tras 5 intentos fallidos ----------
// =====================================================================
// Protocolo de seguridad contra adivinar contraseñas (fuerza bruta):
//   - Cada intento fallido de iniciar sesión con un correo suma 1 en intentos_login/{id}.
//   - Al 5.º fallo la cuenta queda BLOQUEADA 5 minutos: ni con la contraseña correcta se entra.
//   - Al entrar bien, el contador se borra. Si pasan 15 min sin fallos, vuelve a empezar en 1.
//   - El {id} del documento es el SHA-256 del correo (en mayúsculas hex): en la base de datos
//     no queda escrito ningún correo, solo su "huella".
// Lo usan el login de la tienda (loginCliente) y el del panel (loginAdmin).
//
// Sobre las CONTRASEÑAS: este proyecto nunca las guarda. Firebase Authentication las guarda
// con hash (algoritmo scrypt modificado, con "sal" distinta por usuario); ni el equipo ni la
// base de datos pueden verlas. Por eso solo se pueden RESTABLECER, nunca "recuperar".

export const BLOQUEO_LOGIN = Object.freeze({ intentos: 5, minutosBloqueo: 5, minutosReinicio: 15 });
const ERRORES_CREDENCIAL = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"];

/** SHA-256 del correo en hexadecimal MAYÚSCULAS (igual que hashing.sha256(...).toHexString() en las reglas). */
export async function huellaCorreo(correo) {
  const texto = String(correo || "").trim().toLowerCase();
  if (!globalThis.crypto?.subtle) return null;   // sin contexto seguro (https/localhost) no hay bloqueo
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function errorBloqueado(restanteMs) {
  const min = Math.max(1, Math.ceil(restanteMs / 60000));
  const err = new Error(`Por seguridad, la cuenta está bloqueada por ${min} minuto${min === 1 ? "" : "s"} después de ${BLOQUEO_LOGIN.intentos} intentos fallidos.`);
  err.code = "bp/cuenta-bloqueada";
  err.restanteMs = restanteMs;
  return err;
}

function leerEstadoIntentos(d) {
  if (!d) return { fallidos: 0, bloqueado: false, restanteMs: 0 };
  const desde = d.bloqueadoDesde ? milisDe(d.bloqueadoDesde) : 0;
  const fin = desde + BLOQUEO_LOGIN.minutosBloqueo * 60000;
  const bloqueado = Number(d.fallidos) >= BLOQUEO_LOGIN.intentos && desde > 0 && Date.now() < fin;
  return { fallidos: Number(d.fallidos) || 0, bloqueado, restanteMs: bloqueado ? fin - Date.now() : 0, finMs: fin, ultimo: milisDe(d.actualizadoEn) };
}

/** ¿Está bloqueado este correo? -> { bloqueado, restanteMs, fallidos } (si no se puede revisar, no bloquea). */
export async function estadoBloqueoLogin(correo) {
  const id = await huellaCorreo(correo);
  if (!id) return { bloqueado: false, restanteMs: 0, fallidos: 0 };
  const snap = await getDoc(doc(db, "intentos_login", id));
  return leerEstadoIntentos(snap.exists() ? snap.data() : null);
}

/** Suma un intento fallido. Devuelve { restantes, bloqueado, restanteMs }. */
async function registrarIntentoFallido(correo) {
  const id = await huellaCorreo(correo);
  if (!id) return null;
  const ref = doc(db, "intentos_login", id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const est = leerEstadoIntentos(snap.exists() ? snap.data() : null);
    if (est.bloqueado) return { restantes: 0, bloqueado: true, restanteMs: est.restanteMs };
    const reiniciar = !snap.exists()
      || est.fallidos >= BLOQUEO_LOGIN.intentos                                   // ya pasó un bloqueo
      || Date.now() - est.ultimo > BLOQUEO_LOGIN.minutosReinicio * 60000;           // fallos viejos
    if (reiniciar) {
      tx.set(ref, { fallidos: 1, bloqueadoDesde: null, actualizadoEn: serverTimestamp() });
      return { restantes: BLOQUEO_LOGIN.intentos - 1, bloqueado: false, restanteMs: 0 };
    }
    const n = est.fallidos + 1;
    if (n >= BLOQUEO_LOGIN.intentos) {
      tx.update(ref, { fallidos: BLOQUEO_LOGIN.intentos, bloqueadoDesde: serverTimestamp(), actualizadoEn: serverTimestamp() });
      return { restantes: 0, bloqueado: true, restanteMs: BLOQUEO_LOGIN.minutosBloqueo * 60000 };
    }
    tx.update(ref, { fallidos: n, actualizadoEn: serverTimestamp() });
    return { restantes: BLOQUEO_LOGIN.intentos - n, bloqueado: false, restanteMs: 0 };
  });
}

/**
 * Inicio de sesión con el protocolo de bloqueo. Errores que puede lanzar además de los de Firebase:
 *   code "bp/cuenta-bloqueada" (con restanteMs). Los de contraseña incorrecta llevan
 *   err.intentosRestantes para avisar "te quedan N intentos".
 */
async function iniciarSesionProtegida(correo, contrasena) {
  const correoN = String(correo || "").trim().toLowerCase();
  let estado = null;
  try { estado = await estadoBloqueoLogin(correoN); } catch { /* si no se puede revisar, Firebase igual limita intentos */ }
  if (estado?.bloqueado) throw errorBloqueado(estado.restanteMs);

  try {
    const cred = await signInWithEmailAndPassword(auth, correoN, contrasena);
    // Entró bien: se borra el contador (solo el dueño del correo puede borrarlo, ver reglas).
    const id = await huellaCorreo(correoN).catch(() => null);
    if (id && estado && estado.fallidos > 0) await deleteDoc(doc(db, "intentos_login", id)).catch(() => {});
    return cred;
  } catch (err) {
    if (ERRORES_CREDENCIAL.includes(err.code)) {
      let r = null;
      try { r = await registrarIntentoFallido(correoN); } catch { /* sin conexión: queda el límite propio de Firebase */ }
      if (r?.bloqueado) throw errorBloqueado(r.restanteMs);
      if (r) err.intentosRestantes = r.restantes;
    }
    throw err;
  }
}


// =====================================================================
// ---------- Etapa 4 · Eliminar un cliente por completo (panel) ----------
// =====================================================================
// Una página web NO puede borrar la cuenta de acceso (Authentication) de otra persona: solo
// un servidor con el Admin SDK. Por eso hay dos caminos y el panel usa el que esté disponible:
//
//  1) Cloud Function "eliminarClienteCompleto" (carpeta functions/, requiere plan Blaze):
//     borra AL INSTANTE la cuenta de acceso, la ficha del CRM con sus direcciones, el carrito
//     y la foto. El correo queda libre para registrarse otra vez.
//  2) Si la función no está publicada: BAJA. Se borra la ficha del CRM y se guarda
//     bajas/{uid} con estado "Pendiente". La cuenta ya no puede usar la tienda: en cuanto
//     intente entrar (o abra la tienda con su sesión), la propia página borra sus datos y su
//     cuenta de acceso (cada quien sí puede borrar SU cuenta) y le avisa.
//
// En los dos casos se CONSERVAN sus ventas, pagos, tickets y movimientos del monedero:
// son registros del negocio (contabilidad e historial), no datos de la cuenta.

/** Panel: elimina un cliente. Devuelve { modo: "completo" | "baja", cuentaBorrada }. */
export async function eliminarClienteCompleto(cliente, usuario) {
  try {
    const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
    const funcion = httpsCallable(getFunctions(firebaseApp, "us-central1"), "eliminarClienteCompleto", { timeout: 20000 });
    const r = await funcion({ uid: cliente.id });
    return { modo: "completo", cuentaBorrada: !!(r.data && r.data.cuentaBorrada) };
  } catch (err) {
    const codigo = String(err.code || "").replace("functions/", "");
    // Errores "de verdad" de la función (sin permiso, cuenta del personal…): se informan tal cual.
    if (["permission-denied", "unauthenticated", "invalid-argument", "failed-precondition"].includes(codigo)) {
      throw new Error(err.message || "No se pudo eliminar el cliente.");
    }
    // Cualquier otro (función no publicada, plan sin Blaze, sin conexión con la función): se usa la baja.
  }
  const lote = writeBatch(db);
  lote.set(doc(db, "bajas", cliente.id), {
    clienteId: cliente.id,
    nombre: String(cliente.nombre || "").slice(0, 120),
    correo: String(cliente.correo || "").slice(0, 120),
    estado: "Pendiente",
    usuarioId: usuario?.uid || "",
    usuarioNombre: usuario?.nombre || usuario?.correo || "",
    fecha: serverTimestamp(),
  });
  lote.delete(doc(db, "clientes", cliente.id));
  await lote.commit();
  return { modo: "baja", cuentaBorrada: false };
}

/**
 * Si el cliente con sesión fue dado de baja desde el panel: borra sus datos de cuenta y su
 * cuenta de acceso (o, si Firebase pide volver a iniciar sesión para eso, cierra la sesión y
 * se completa cuando vuelva a entrar). Devuelve true si la cuenta estaba dada de baja.
 */
export async function completarBajaSiCorresponde(user) {
  if (!user) return false;
  let snap;
  try { snap = await getDoc(doc(db, "bajas", user.uid)); } catch { return false; }
  if (!snap.exists() || snap.data().estado !== "Pendiente") return false;

  const uid = user.uid;
  const borrar = (ref) => deleteDoc(ref).catch(() => {});
  try { for (const d of (await getDocs(collection(db, "clientes", uid, "direcciones"))).docs) await borrar(d.ref); } catch { /* sin datos */ }
  try { for (const d of (await getDocs(collection(db, "clientes", uid, "favoritos"))).docs) await borrar(d.ref); } catch { /* sin datos */ }
  try { for (const d of (await getDocs(collection(db, "carritos", uid, "detalle"))).docs) await borrar(d.ref); } catch { /* sin datos */ }
  await borrar(doc(db, "carritos", uid));
  await borrar(doc(db, "fotos_perfil", uid));
  try { localStorage.removeItem("carrito"); localStorage.removeItem("carritoDueno"); } catch { /* sin almacenamiento */ }
  try {
    await deleteUser(user);            // cada quien SÍ puede borrar su propia cuenta de acceso
  } catch {
    await signOut(auth).catch(() => {});   // p. ej. "requires-recent-login": se completa en su próximo inicio de sesión
  }
  return true;
}

// ============================================
//  Página de producto: reseñas, preguntas y favoritos
//
//    resenas/{productoId}_{uid}  { productoId, uid, nombre, huellitas (1-5), titulo, texto, fecha }
//        una reseña por cliente y producto (el id lo garantiza)
//    preguntas/{id}              { productoId, uid, nombre, texto, fecha,
//                                  respuesta?, respondidoPor?, respondidaEn? }
//    clientes/{uid}/favoritos/{productoId} { productoId, agregadoEn }
// ============================================

/** Agrega al catálogo los productos de la lista que todavía no existen (se comparan por nombre). */
export async function agregarProductosNuevosScm(lista) {
  const existentes = new Set((await getDocs(scmProductosRef)).docs
    .map(d => String(d.data().nombre || '').trim().toLowerCase()));
  let creados = 0;
  for (const p of lista) {
    if (existentes.has(p.nombre.trim().toLowerCase())) continue;
    await addDoc(scmProductosRef, { ...p, creadoEn: serverTimestamp() });
    creados++;
  }
  return creados;
}

export function escucharResenas(productoId, callback, onError) {
  const q = query(collection(db, "resenas"), where("productoId", "==", productoId));
  return onSnapshot(q, (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => milisDe(b.fecha) - milisDe(a.fecha));
    callback(lista);
  }, onError);
}

export async function guardarResena(productoId, { nombre, huellitas, titulo, texto }) {
  const user = auth.currentUser;
  if (!user) { const e = new Error("Inicia sesión para escribir una reseña."); e.code = "bp/sin-sesion"; throw e; }
  const ref = doc(db, "resenas", `${productoId}_${user.uid}`);
  if ((await getDoc(ref)).exists()) {
    const e = new Error("Ya escribiste una reseña de este producto."); e.code = "bp/resena-repetida"; throw e;
  }
  await setDoc(ref, {
    productoId, uid: user.uid,
    nombre: String(nombre || 'Cliente').trim().slice(0, 60) || 'Cliente',
    huellitas: Math.max(1, Math.min(5, Math.round(Number(huellitas) || 0))),
    titulo: String(titulo || '').trim().slice(0, 100),
    texto: String(texto || '').trim().slice(0, 1000),
    fecha: serverTimestamp(),
  });
}

export function eliminarResena(id) {
  return deleteDoc(doc(db, "resenas", id));
}

export function escucharPreguntas(productoId, callback, onError) {
  const q = query(collection(db, "preguntas"), where("productoId", "==", productoId));
  return onSnapshot(q, (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => milisDe(b.fecha) - milisDe(a.fecha));
    callback(lista);
  }, onError);
}

export async function crearPregunta(productoId, { nombre, texto }) {
  const user = auth.currentUser;
  if (!user) { const e = new Error("Inicia sesión para hacer una pregunta."); e.code = "bp/sin-sesion"; throw e; }
  return addDoc(collection(db, "preguntas"), {
    productoId, uid: user.uid,
    nombre: String(nombre || 'Cliente').trim().slice(0, 60) || 'Cliente',
    texto: String(texto || '').trim().slice(0, 500),
    fecha: serverTimestamp(),
  });
}

export async function responderPregunta(id, respuesta, nombreQuienResponde) {
  return updateDoc(doc(db, "preguntas", id), {
    respuesta: String(respuesta || '').trim().slice(0, 1000),
    respondidoPor: String(nombreQuienResponde || 'Bigotes y Patitas').trim().slice(0, 60),
    respondidaEn: serverTimestamp(),
  });
}

export function eliminarPregunta(id) {
  return deleteDoc(doc(db, "preguntas", id));
}

/** Rol del panel de la cuenta actual ('' si es cliente o no tiene perfil en "usuarios"). */
export async function rolDelPanelActual() {
  const user = auth.currentUser;
  if (!user) return '';
  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    return snap.exists() ? String(snap.data().rol || '') : '';
  } catch {
    return '';   // un cliente no puede leer "usuarios": no es personal
  }
}

export function escucharFavoritos(uid, callback, onError) {
  return onSnapshot(collection(db, "clientes", uid, "favoritos"), (snap) => {
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lista.sort((a, b) => milisDe(b.agregadoEn) - milisDe(a.agregadoEn));
    callback(lista);
  }, onError);
}

export function agregarFavorito(uid, productoId) {
  return setDoc(doc(db, "clientes", uid, "favoritos", productoId), { productoId, agregadoEn: serverTimestamp() });
}

export function quitarFavorito(uid, productoId) {
  return deleteDoc(doc(db, "clientes", uid, "favoritos", productoId));
}
