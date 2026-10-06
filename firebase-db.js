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
//    usuarios/{uid}     { nombre, correo, rol: "administrador"|"vendedor"|"logistica" }
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
  onSnapshot, query, where, orderBy, serverTimestamp, writeBatch, runTransaction,
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
  return { id: ventaRef.id, folio };
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
