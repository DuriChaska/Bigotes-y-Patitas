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
//                          subtotal, descuento, cupon, total, folio,
//                          direccionEnvio, metodoPago, estado, creadoEn }
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
  onSnapshot, query, where, orderBy, limit, serverTimestamp, writeBatch, runTransaction,
  arrayUnion, increment,
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

export async function registrarCliente({ nombre, correo, contrasena, telefono, mascota }) {
  const credencial = await createUserWithEmailAndPassword(auth, correo, contrasena);
  await updateProfile(credencial.user, { displayName: nombre });
  await setDoc(doc(db, "clientes", credencial.user.uid), {
    nombre, correo,
    telefono: telefono || "",
    mascota: mascota || "Sin especificar",
    etapa: "Prospecto",
    estado: "Activo",
    fechaRegistro: new Date().toLocaleDateString('es-MX'),
    creadoEn: serverTimestamp(),
  });
  return credencial.user;
}

export function loginCliente(correo, contrasena) {
  return signInWithEmailAndPassword(auth, correo, contrasena);
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
export function escucharVentasDeCliente(uid, callback, onError) {
  const q = query(ventasRef, where("clienteId", "==", uid), orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError);
}

/**
 * Crea una venta real: guarda el pedido, descuenta el stock de cada producto
 * comprado y registra un movimiento de "Salida" por cada línea — todo en una
 * sola operación atómica (writeBatch: o se guarda todo, o no se guarda nada).
 *
 * datosVenta: { clienteId, clienteNombre, clienteCorreo, items: [{ productoId,
 *   nombre, precio, cantidad }], subtotal, descuento, cupon, total,
 *   direccionEnvio, metodoPago }
 * productosActuales: catálogo con el stock ANTES de la compra (ya disponible en
 *   la página desde escucharProductosScm, no hace falta volver a pedirlo aquí).
 */
export async function crearVenta(datosVenta, productosActuales) {
  const items = datosVenta.items || [];
  if (items.length === 0) throw new Error("El carrito está vacío.");

  // Etapa 4: los cupones viven en Firestore con vigencia; se revisa otra vez justo antes de
  // cobrar por si venció o se desactivó mientras estaba en el carrito.
  if (datosVenta.cupon) {
    const promo = await obtenerPromocion(datosVenta.cupon);
    if (!promocionVigente(promo)) {
      throw new Error(`El cupón ${datosVenta.cupon} ya no está vigente. Quítalo del carrito para continuar.`);
    }
  }

  // Verifica que haya stock suficiente ANTES de tocar nada.
  for (const item of items) {
    const prod = productosActuales.find(p => p.id === item.productoId);
    if (!prod) throw new Error(`El producto "${item.nombre}" ya no está disponible en el catálogo.`);
    if (Number(prod.stock) < Number(item.cantidad)) {
      throw new Error(`Ya no hay suficiente stock de "${prod.nombre}" (disponible: ${Number(prod.stock)}).`);
    }
  }

  // El folio NO se genera contando los documentos existentes (a diferencia de
  // "PC-001" en pedidos/proveedores, que sí lo hace): un cliente real no tiene
  // permiso para leer TODAS las ventas (las reglas de "ventas" solo dejan ver
  // las propias o al personal), así que una lectura sin filtro aquí sería
  // rechazada por Firestore. En su lugar se arma un folio único con la fecha
  // y un sufijo aleatorio, sin necesitar ningún permiso extra.
  const ahora = new Date();
  const fechaFolio = ahora.toISOString().slice(2, 10).replace(/-/g, "");
  const sufijo = Math.random().toString(36).slice(2, 6).toUpperCase();
  const folio = `CC-${fechaFolio}-${sufijo}`;
  const hoy = ahora.toISOString().slice(0, 10);

  const lote = writeBatch(db);
  const ventaRef = doc(ventasRef);
  lote.set(ventaRef, {
    ...datosVenta,
    folio,
    estado: "Confirmada",
    creadoEn: serverTimestamp(),
  });

  items.forEach((item) => {
    const prod = productosActuales.find(p => p.id === item.productoId);
    const nuevoStock = Math.max(0, Number(prod.stock) - Number(item.cantidad));
    lote.update(doc(db, "scm_productos", item.productoId), {
      stock: nuevoStock, actualizadoEn: serverTimestamp(),
    });
    lote.set(doc(collection(db, "scm_movimientos")), {
      productoId: item.productoId,
      producto: item.nombre,
      tipo: "Salida",
      cantidad: Number(item.cantidad),
      motivo: `Venta ${folio}`,
      fecha: hoy,
      usuario: datosVenta.clienteNombre || datosVenta.clienteCorreo || "Cliente",
      creadoEn: serverTimestamp(),
    });
  });

  await lote.commit();

  // Etapa 4: pagos + CRM + erp_operaciones. La venta ya quedó guardada; si esta sincronización
  // fallara (p. ej. sin internet justo ahora) NO se le cobra dos veces ni se pierde la compra.
  try {
    await registrarIntegracionCompra({
      ventaId: ventaRef.id,
      folio,
      clienteId: datosVenta.clienteId,
      clienteNombre: datosVenta.clienteNombre,
      total: datosVenta.total,
      metodoPago: datosVenta.metodoPago,
    });
  } catch (err) {
    console.error("[Etapa 4] La compra se guardó, pero no se pudo sincronizar con pagos/CRM/ERP:", err);
  }
  return { id: ventaRef.id, folio };
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
    if ((await getDoc(pagoRef)).exists()) {
      lote.update(pagoRef, { estado: "Cancelado", actualizadoEn: serverTimestamp() });
    }
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
//    pagos/{ventaId}        { pedidoId, folio, clienteId, clienteNombre, monto, metodoPago,
//                             estado: "Pagado"|"Cancelado"|"Reembolsado", origen, usuarioId,
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
export async function crearTicket({ asunto, mensaje, cliente }) {
  if (!cliente || !cliente.uid) throw new Error("Inicia sesión para enviar un ticket.");
  if (!ASUNTOS_TICKET.includes(asunto)) throw new Error("Elige un asunto de la lista.");
  const texto = String(mensaje || "").trim();
  if (!texto) throw new Error("Describe tu problema para poder ayudarte.");
  if (texto.length > 2000) throw new Error("El mensaje es muy largo (máximo 2000 caracteres).");

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
 *   1) pagos/{ventaId}  -> documento independiente del pago (pedidoId, monto, método, estado)
 *   2) clientes/{uid}   -> suma 1 compra, suma el total gastado, última compra y etapa del CRM
 *   3) erp_operaciones  -> deja el registro empresarial "Compra en tienda"
 * Los 3 documentos se ligan a la venta por su id. Las reglas comprueban que el monto y el
 * total gastado coincidan con la venta real. Lo llama crearVenta() justo después de guardar la compra.
 */
export async function registrarIntegracionCompra({ ventaId, folio, clienteId, clienteNombre, total, metodoPago }) {
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
    metodoPago: metodoPago || "No especificado",
    estado: "Pagado",
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
