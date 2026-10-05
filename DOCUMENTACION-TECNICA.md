# Documentación técnica — Panel de administración CRM (Bigotes y Patitas)

Este documento explica cómo funciona el panel de administración: qué hace
cada archivo, cómo está armada la base de datos, cómo se conecta todo a
Firebase, y qué se tuvo que configurar en la consola de Firebase para que
funcionara. Está escrito para poder explicarlo o defenderlo, no solo para
leerlo.

---

## 1. ¿Qué es y cómo está organizado?

El panel de administración es la parte del sitio "Bigotes y Patitas" donde
el equipo (administradores y vendedores) gestiona clientes, registra sus
interacciones con ellos, y consulta reportes. No es un programa aparte:
son páginas HTML normales, con JavaScript, que en vez de guardar la
información "en el papel" (variables que se borran al recargar), la guardan
y la leen de **Firebase** — una base de datos en la nube de Google.

Analogía simple: antes de conectar Firebase, el CRM era como un cuaderno
que se borraba cada vez que cerrabas la página. Firebase es el archivero
permanente: todos los datos quedan guardados en internet, cualquiera del
equipo que entre los ve, y se puede consultar desde cualquier computadora.

### Piezas que usa Firebase aquí

Firebase es en realidad un conjunto de servicios. Este proyecto usa dos:

- **Firestore** — la base de datos en sí (guarda clientes, interacciones y
  usuarios).
- **Authentication** — el sistema de login (verifica correo/contraseña y
  sabe quién eres en cada momento).

---

## 2. Mapa de archivos

| Archivo | Para qué sirve |
|---|---|
| `admin-login.html` | Pantalla de inicio de sesión. |
| `admin.html` | Dashboard — contadores y gráfica de clientes activos/inactivos. |
| `admin-clientes.html` | Listado de clientes: buscar, filtrar, crear, editar, eliminar. |
| `admin-cliente-detalle.html` | Ficha completa de un cliente (se abre desde el listado). |
| `admin-cliente-etapa.html` | Cambiar la etapa CRM de un cliente (Prospecto/Activo/Frecuente/Inactivo). |
| `admin-interacciones.html` | Historial de interacciones de **un** cliente específico. |
| `admin-interacciones-todas.html` | Tabla con **todas** las interacciones de todos los clientes. |
| `admin-actividad.html` | "Mi actividad" — interacciones filtrables por rango de fechas. |
| `admin-reportes.html` | Gráficas y métricas generales (por tipo de interacción, por etapa CRM, clientes en riesgo). |
| `admin-usuarios.html` | Alta y gestión de administradores/vendedores (solo visible para administradores). |
| `admin-configuracion.html` | Cambiar tu propio nombre, correo y contraseña. |
| `admin-components.js` | Dibuja el menú lateral (sidebar) igual en todas las páginas. |
| `admin-icons.js` | Librería de íconos SVG que se usan en vez de emojis. |
| **`firebase-config.js`** | Conecta el proyecto con la cuenta de Firebase real (las llaves). |
| **`firebase-db.js`** | Todas las funciones que hablan con Firestore/Authentication. |
| **`admin-auth-guard.js`** | Se incluye en cada página del panel; exige sesión iniciada y revisa el rol. |
| **`firestore.rules`** | Reglas de seguridad de la base de datos (quién puede leer/escribir qué). |

Los cuatro en negritas son el "cableado" hacia Firebase — el resto son
pantallas que usan ese cableado.

---

## 3. Cómo se conecta el sitio a Firebase

### 3.1 `firebase-config.js` — la conexión

Este archivo es el primero que se ejecuta. Le dice al navegador **a cuál**
proyecto de Firebase conectarse (hay un identificador único por proyecto:
`apiKey`, `projectId`, etc., que Firebase entrega al crear el proyecto).

```js
import { initializeApp } from ".../firebase-app.js";
import { getAuth } from ".../firebase-auth.js";
import { getFirestore } from ".../firebase-firestore.js";

export const firebaseConfig = { apiKey: "...", projectId: "bigotes-y-patitas-7a192", ... };

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);       // el "teléfono" hacia Authentication
export const db = getFirestore(firebaseApp);    // el "teléfono" hacia Firestore
```

`auth` y `db` son los dos objetos que el resto del código usa para hablar
con Firebase. Se importan en `firebase-db.js` y de ahí se reparten a todas
las páginas.

Los `import` con URLs de `gstatic.com` son el **SDK (kit de herramientas)**
de Firebase para navegador — no hay que instalar nada, el navegador lo
descarga directo de ahí cada vez que se abre una página.

### 3.2 `firebase-db.js` — el "traductor"

Ninguna página habla con Firestore directamente; todas pasan por funciones
de este archivo. Esto evita repetir el mismo código de conexión veinte
veces y centraliza cualquier cambio futuro. Algunos ejemplos:

```js
export function escucharClientes(callback) {
  const q = query(collection(db, "clientes"), orderBy("nombre"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
```

`onSnapshot` es la parte importante: no es una consulta que se hace una
sola vez, es una **suscripción en tiempo real**. Mientras la página esté
abierta, si cualquier persona del equipo agrega/edita/borra un cliente
desde otra computadora, tu pantalla se actualiza sola, sin recargar.

### 3.3 `admin-auth-guard.js` — el portero

Se incluye en el `<head>` de cada página del panel (menos el login). Hace
tres cosas, en este orden:

1. Pregunta a Firebase Authentication: "¿hay alguien con sesión iniciada
   ahorita?" Si no, manda a `admin-login.html`.
2. Si sí hay sesión, busca en Firestore el documento de esa persona en la
   colección `usuarios` (ahí vive su nombre y su rol).
3. Cada página declara su sección en el `<body>`: `data-seccion="crm"`
   (clientes, interacciones, reportes CRM), `data-seccion="scm"` (todo lo de
   cadena de suministros), `data-solo-admin` (solo `admin-usuarios.html`) o
   nada (Configuración). El guard compara esa sección con lo que permite el
   rol (`administrador`: todo; `vendedor`: solo CRM; `logistica`: solo SCM) y,
   si no le toca, la regresa a su página de inicio (Dashboard o SCM).

Mientras esto se confirma, el panel completo está oculto con CSS
(`visibility: hidden`) para que nadie vea ni un parpadeo de contenido antes
de saber si tiene permiso de estar ahí.

---

## 4. Cómo está organizada la base de datos (Firestore)

Firestore no es como Excel/SQL con tablas de filas y columnas fijas: es una
base de **documentos**, agrupados en **colecciones**. Piensa en cada
colección como una carpeta, y cada documento adentro como una ficha con
los datos de una sola cosa (un cliente, una interacción, un usuario).

```
usuarios/{uid}
  nombre: string
  correo: string
  rol: "administrador" | "vendedor" | "logistica"

clientes/{idAutogenerado}
  nombre: string
  mascota: string
  correo: string
  telefono: string
  etapa: "Prospecto" | "Activo" | "Frecuente" | "Inactivo"
  estado: "Activo" | "Inactivo"
  fechaRegistro: string (dd/mm/aaaa)
  creadoEn: timestamp

interacciones/{idAutogenerado}
  clienteId: string        ← aquí está la conexión con "clientes"
  clienteNombre: string
  tipo: "Llamada" | "Correo" | "Reunión"
  descripcion: string
  usuario: string
  fecha: string (dd/mm/aaaa)
  creadoEn: timestamp
```

### ¿Por qué el `id` de `usuarios` es distinto a los demás?

Los documentos de `clientes` e `interacciones` tienen un ID que Firestore
inventa solo (una cadena rara tipo `aB3xZ...`). Los de `usuarios` en cambio
usan como ID el mismo **UID** que le asigna Firebase Authentication a esa
persona al crear su cuenta. Así, cuando alguien inicia sesión, el código
sabe exactamente en qué documento buscar su rol: `usuarios/{su-uid}`.

### La relación entre clientes e interacciones

Una interacción "sabe" a qué cliente pertenece porque guarda su `clienteId`
(el ID del documento del cliente). Es el mismo concepto que una llave
foránea en una base de datos tradicional, solo que aquí no hay una relación
forzada por la base de datos misma — el código es el que se encarga de
guardar el ID correcto y de filtrar por él cuando hace falta (por ejemplo,
`admin-interacciones.html` pide "tráeme las interacciones donde
`clienteId == X`").

### De dónde sale cada pantalla

| Pantalla | Qué colección(es) lee/escribe |
|---|---|
| Dashboard / Reportes | Lee `clientes` e `interacciones` completas y calcula contadores en el propio navegador (no hay una tabla de "métricas" aparte). |
| Clientes | Lee y escribe `clientes`. |
| Detalle de cliente / Clasificación | Lee y actualiza **un** documento de `clientes`. |
| Interacciones (por cliente / todas) | Lee y escribe `interacciones`. |
| Mi actividad | Lee `interacciones`, filtradas en el navegador por fecha. |
| Usuarios | Lee, crea, edita y borra documentos de `usuarios` (y crea cuentas nuevas en Authentication). |
| Configuración | Edita el propio documento de `usuarios` y los datos de Authentication (correo/contraseña) de quien tiene la sesión iniciada. |

---

## 5. Login y roles — cómo funciona paso a paso

1. La persona escribe correo y contraseña en `admin-login.html`.
2. El código llama a `signInWithEmailAndPassword` (de Firebase
   Authentication) — Firebase revisa si esas credenciales existen y son
   correctas. Esto **no** consulta Firestore todavía, es un sistema aparte
   dedicado solo a logins.
3. Si es correcto, Firebase le da al navegador un "gafete" (token) que dice
   quién es. Con eso, `admin-auth-guard.js` ya sabe el `uid` de la persona.
4. El guard busca `usuarios/{uid}` en Firestore para saber su nombre y su
   rol.
5. Si el rol es `administrador`, ve absolutamente todo, incluyendo
   Usuarios. Si es `vendedor`, solo ve el CRM (clientes, interacciones,
   reportes, mi actividad). Si es `logistica`, solo ve el SCM (inventario,
   pedidos, productos, proveedores, etc.). Lo que no le toca desaparece del
   menú y la URL directa lo rebota a su página de inicio.

### Crear un usuario nuevo sin perder tu propia sesión

Esto tiene un detalle técnico que vale la pena explicar si te preguntan:
normalmente, cuando usas el comando de Firebase para "crear una cuenta",
Firebase automáticamente **inicia sesión como esa cuenta nueva** en el
navegador — lo cual sería un problema, porque el administrador que está
dando de alta a alguien perdería su propia sesión. La solución que se usó
fue abrir una **segunda conexión temporal** a Firebase (una instancia
secundaria) solo para crear esa cuenta, y cerrarla enseguida — la sesión
del administrador que sigue usando la página nunca se toca.

---

## 6. Reglas de seguridad (`firestore.rules`)

Sin estas reglas, cualquier persona en internet que supiera el
`projectId` podría leer o modificar los datos directamente, sin pasar por
el login. Las reglas son el "candado" que vive en los servidores de
Firebase, no en el código del sitio (así que no se pueden saltar editando
el HTML/JS del navegador).

```
match /clientes/{clienteId} {
  allow read, update, delete: if request.auth != null;
  allow create: if request.resource.data.nombre is string
                && request.resource.data.correo is string
                && request.resource.data.etapa == 'Prospecto';
}
match /interacciones/{interaccionId} {
  allow read, write: if request.auth != null;
}
match /usuarios/{uid} {
  allow read: if request.auth != null;
  allow create, update, delete: if request.auth != null &&
    get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'administrador';
}
```

En palabras simples:
- **Clientes:** cualquiera (incluso sin sesión) puede *crear* un cliente nuevo — eso es lo que usa el formulario público de registro del sitio (`Interfaz Usuario - Registro .html`) para darse de alta como prospecto. Pero **leer, editar o borrar** clientes sigue exigiendo sesión iniciada, o sea, solo desde el panel admin.
- **Interacciones:** administrador y vendedor pueden leer y escribir (la logística no). Sin sesión, cero acceso.
- **SCM (productos, proveedores, pedidos, movimientos, madurez):** administrador y logística pueden leer y escribir; el vendedor no. La lectura del catálogo de productos sigue siendo pública (la usa la tienda).
- **Usuarios:** cualquier persona del panel puede *leer* (necesario para que el
  guard sepa tu propio rol al entrar), pero solo alguien cuyo *propio*
  documento diga `rol: "administrador"` puede crear, editar o borrar
  perfiles de otras personas, y el rol solo puede ser `administrador`,
  `vendedor` o `logistica`.
- Cualquier otra colección que no esté listada queda bloqueada por
  completo (`allow read, write: if false`), por si en el futuro se crea
  una por error.

---

## 7. Qué se configuró en la consola de Firebase (resumen)

Esto es lo que se hizo del lado de Firebase (fuera del código) para que
todo funcionara — el detalle paso a paso está en `SETUP-FIREBASE.md`, aquí
va el resumen de **qué** se hizo y **para qué**:

1. **Se creó un proyecto de Firebase** (`bigotes-y-patitas-7a192`) — es el
   "contenedor" que agrupa la base de datos, el login y todo lo demás.
2. **Se registró una app web** dentro del proyecto — esto es lo que genera
   las llaves (`apiKey`, `appId`, etc.) que se pegaron en
   `firebase-config.js`. Sin registrar la app, no hay llaves que usar.
3. **Se activó Authentication con el proveedor "Correo/contraseña"** — por
   default Firebase no acepta ningún método de login hasta que se
   habilita uno explícitamente.
4. **Se activó Firestore Database en modo producción** — el modo
   producción empieza bloqueado a cualquier acceso hasta que se publican
   reglas (a diferencia del "modo de prueba", que deja todo abierto por
   30 días, inseguro para dejarlo así).
5. **Se publicaron las reglas de seguridad** (el contenido de
   `firestore.rules`) en la pestaña "Reglas" de Firestore.
6. **Se creó a mano, una sola vez, el primer usuario administrador:** un
   usuario en Authentication (correo + contraseña) y su documento
   correspondiente en `usuarios/{uid}` con `rol: "administrador"`. Esto es
   el único paso manual necesario porque, hasta que existe un primer
   administrador, no hay nadie con permiso de crear a los demás desde la
   pantalla de Usuarios.

Después de esos 6 pasos, todo lo demás (crear más administradores o
vendedores, agregar clientes, registrar interacciones) se hace desde el
propio panel, sin volver a tocar la consola de Firebase.

---

## 8. Limitaciones que hay que tener claras

- **"Eliminar" un usuario** en la pantalla de Usuarios borra su perfil de
  Firestore (le quita el acceso al panel), pero **no** borra su cuenta de
  Firebase Authentication. Borrar la cuenta de verdad requiere el SDK de
  administrador de Firebase desde un servidor (Cloud Functions), algo que
  no se puede hacer solo con código de navegador.
- **No hay endpoints REST clásicos** (`POST /clientes`, `GET /clientes/1`,
  etc.). El sitio habla con Firestore directo a través del SDK de
  JavaScript. Si en algún momento se necesitan rutas REST reales, el
  siguiente paso sería envolver estas mismas funciones de `firebase-db.js`
  en **Cloud Functions** (HTTPS functions), que sí generan una URL pública
  por cada endpoint.
- **Los roles solo controlan la interfaz y las reglas de Firestore**, no
  existe todavía un "super-admin" separado del resto de administradores —
  cualquier administrador puede editar o quitarle el rol a otro
  administrador (aunque no puede tocar su propio rol desde esa misma
  pantalla, por seguridad básica).

---

## 9. Ampliación: módulo SCM y tienda pública conectados a Firebase

Todo lo de arriba describe el CRM. Después se conectó también el módulo
**SCM** (cadena de suministro) y **toda la tienda pública** (catálogo,
carrito, checkout, cuentas de cliente) a la misma base de Firestore. El
esquema completo de las colecciones nuevas (`scm_productos`,
`scm_proveedores`, `scm_pedidos`, `scm_movimientos`, `scm_estado`, `ventas`)
está documentado en **`SETUP-FIREBASE.md`**, sección "Estructura de datos en
Firestore" — para no duplicarlo aquí. Un resumen de lo más importante:

- **El catálogo (`scm_productos`) es de lectura pública** (`allow read: if
  true` en `firestore.rules`): es lo único de todo el proyecto que cualquier
  visitante sin sesión puede leer, porque de eso viven `index.html`,
  `shop.html` y `Producto.html`.
- **Las cuentas de cliente son cuentas reales de Firebase Authentication**,
  no simuladas: se registran en `Interfaz Usuario - Registro .html`, inician
  sesión en `login.html`, y su perfil vive en `clientes/{uid}` (mismo
  documento que usa el CRM, pero con el id igual al uid de Authentication en
  vez de un id autogenerado). Por eso las reglas ya no pueden usar
  `request.auth != null` como sinónimo de "es personal" — ver la función
  `esStaff()` en `firestore.rules`.
- **El carrito vive en `localStorage`** (igual que en la versión original),
  pero `Carrito.html` y `Checkout.html` lo revalidan contra el stock real de
  `scm_productos` antes de cobrar, para no vender algo agotado.
- **El checkout (`Checkout.html`) exige sesión iniciada** (redirige a
  `login.html?next=Checkout.html` si no hay nadie logueado) y, al confirmar
  el pedido, llama a `crearVenta()` en `firebase-db.js`: esa función guarda
  el pedido en `ventas`, descuenta el stock de cada producto comprado y
  registra el movimiento de salida correspondiente, **todo en una sola
  operación atómica** (`writeBatch`) — o se guarda todo o no se guarda nada.
- **El perfil del cliente (`Interfaz Cliente - Perfil.html`) muestra su
  historial de compras real**, leyendo `ventas` filtradas por su propio
  `clienteId` (no puede ver las compras de otros clientes).
- **Reposición automática de productos PUSH** (`generarReposicionesAutomaticas`
  en `firebase-db.js`): cuando un producto con estrategia PUSH llega a su
  `stockMin`, el sistema genera solo el pedido de reposición, lo deja como
  "Surtido", sube el stock hasta el doble del mínimo y registra el movimiento
  de "Entrada" — todo en una transacción de Firestore, así que si dos
  pestañas lo detectan a la vez solo una lo repone. Corre en el navegador
  cada vez que alguien con acceso a SCM tiene abierto Resumen, Inventario o
  Pedidos (no hay servidor: para que corra aunque nadie tenga el panel
  abierto haría falta una Cloud Function programada). Si se prefiere que el
  pedido automático quede "Pendiente" hasta que llegue la mercancía, se
  cambia `PUSH_SURTIR_AUTOMATICO` a `false`.
- **Pedidos surtidos y el inventario:** marcar un pedido como "Surtido" (o
  registrarlo ya surtido) mueve el stock: Reposición suma y registra una
  "Entrada"; Venta resta y registra una "Salida". Inventario muestra además
  cuánto viene en camino (pedidos de reposición Pendientes o En proceso).
- **El nivel de madurez del SCM** (`admin-scm-madurez.html`) es un checklist
  manual, no un cálculo automático: alguien del panel marca a mano qué
  puntos ya se cumplen, y de ahí sale la barra de avance y si el proyecto se
  considera "Inicial", "En desarrollo" u "Optimizado". Se guarda en el
  documento único `scm_estado/madurez`.
- **Alertas de bajo stock**: cuando un producto cae por debajo de su
  `stockMin`, aparece un banner en las páginas del SCM (`admin-stock-alertas.js`,
  reutilizado en Inventario, Productos, Pedidos, Logística y el hub de SCM).
