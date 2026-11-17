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
   rol (`administrador`: todo; `vendedor`: solo CRM; `logistica`: solo SCM; `soporte`: solo atención a clientes, ver §11) y,
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
  rol: "administrador" | "vendedor" | "logistica" | "soporte"

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
  `stockMin`, el sistema genera solo un pedido de reposición "Pendiente" por
  la cantidad que falta para llegar al doble del mínimo; el stock sube hasta
  que alguien lo marca "Surtido" en Pedidos (ahí se registra la "Entrada").
  Mientras no esté surtido, Inventario lo muestra como "en camino" y no se
  genera otro pedido para ese producto. Con `PUSH_SURTIR_AUTOMATICO = true`
  el pedido se surte solo y el stock sube al instante, dentro de una
  transacción de Firestore. Corre en el navegador
  cada vez que alguien con acceso a SCM tiene abierto Resumen, Inventario o
  Pedidos (no hay servidor: para que corra aunque nadie tenga el panel
  abierto haría falta una Cloud Function programada).
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

---

## 10. Etapa 3: ERP (integra CRM + SCM + usuarios)

El ERP **no duplica datos**: una orden del ERP es un documento de la colección
`ventas` (la misma de las compras de la tienda) que apunta al cliente del CRM
(`clientes`) y a los productos del SCM (`scm_productos`).

### 10.1 Páginas

| Archivo | Qué hace |
|---|---|
| `admin-erp.html` | Dashboard empresarial: 4 KPIs, ventas de los últimos 6 meses, más vendidos, indicadores operativos y actividad reciente. |
| `admin-erp-ordenes.html` | Listado de órdenes en tiempo real, detalle, historial y cambio de estado (solo administrador y logística). |
| `admin-erp-nueva-orden.html` | Asistente de 5 pasos: cliente → productos → confirmación → procesamiento → orden exitosa. |
| `admin-erp-reportes.html` | Reportes ERP: ventas por mes, más vendidos, inventario con rotación, diagrama CRM ↔ ERP ↔ SCM. |
| `admin-erp-madurez.html` | Nivel de implementación ERP (Básico / Integrado / Automatizado / Optimizado). Solo administrador. |

### 10.2 Flujo automático de una orden (`crearOrdenErp`, en `firebase-db.js`)

Todo ocurre en **una sola transacción** de Firestore (o pasa todo, o no pasa nada):
validar el stock actual → crear la orden (`ventas`, `origen: "ERP"`, con el
`usuarioId` de quien la registró) → reducir el stock → registrar un movimiento de
"Salida" por producto (`scm_movimientos`) → guardar el historial
(`erp_operaciones`) → actualizar al cliente en el CRM (compras, total comprado,
última compra y etapa: Prospecto/Inactivo pasa a Activo; 3 compras o más, Frecuente).
Si otra persona vendió el último producto un segundo antes, la orden se rechaza
con un mensaje claro en vez de dejar el inventario en negativo.

### 10.3 Estados de la orden (`cambiarEstadoOrdenErp`)

`Confirmada` → `En proceso` / `Enviada` / `Cancelada`; `En proceso` → `Enviada` /
`Cancelada`; `Enviada` → `Entregada` / `Cancelada`. **Cancelar devuelve el stock**
al inventario y registra una "Entrada" por cada producto. Cada cambio se guarda
en el `historial` de la orden y en `erp_operaciones`. Las canceladas no cuentan
en las ventas ni en los productos vendidos.

### 10.4 Equivalencia con los endpoints del PDF

| Endpoint del PDF | En este proyecto |
|---|---|
| `POST /ordenes`, `POST /ordenes/procesar` | `crearOrdenErp()` |
| `GET /ordenes`, `GET /ordenes/{id}` | `escucharOrdenesErp()` y el panel de detalle |
| `PUT /ordenes/{id}/estado` | `cambiarEstadoOrdenErp()` |
| `GET /erp/metricas` | `calcularMetricasErp()` |
| `GET/PUT /erp/estado` | `admin-erp-madurez.html` (documento `scm_estado/madurez-erp`) |

(No hay servidor REST: Firestore se consulta directo desde el navegador, igual
que en el resto del proyecto.)

### 10.5 Roles y menú por rol (pantalla 10)

| Sección | Administrador | Ventas (vendedor) | Logística |
|---|:-:|:-:|:-:|
| Inicio (Dashboard ERP) | sí | sí | sí |
| Clientes CRM (y resto del CRM) | sí | sí | no |
| Productos SCM / Inventario SCM | sí (edita) | solo consulta | sí (edita) |
| Resto del SCM (proveedores, pedidos, logística…) | sí | no | sí |
| Órdenes ERP: ver | sí | sí | sí |
| Órdenes ERP: crear | sí | sí | no |
| Órdenes ERP: cambiar estado / cancelar | sí | no | sí |
| Reportes ERP | sí | sí | sí |
| Nivel ERP, Usuarios | sí | no | no |
| Configuración | sí | sí | sí |

**El ERP no es un apartado aparte: es un interruptor ("Modo ERP") en la barra
lateral del mismo panel.** Apagado, se ve el menú de siempre según el rol (CRM,
SCM, Usuarios, Configuración). Encendido, el menú pasa a la vista integrada del
ERP: Inicio, Clientes, Productos, Inventario, Órdenes, Reportes, Nivel de
implementación, Usuarios y Configuración (cada rol ve solo lo suyo). El modo se
recuerda en el navegador (`bpModoErp`), las páginas `admin-erp-*` lo encienden
solas y al apagarlo cada rol vuelve a su inicio (`admin.html` o `admin-scm.html`).
Con el interruptor encendido, el ERP **consulta** el CRM y el SCM sin salirse a
esos módulos: Clientes (`admin-erp-clientes.html`), Productos
(`admin-erp-productos.html`) e Inventario (`admin-erp-inventario.html`) son
páginas de **solo consulta** que leen los mismos datos del CRM y del SCM, sin
duplicarlos y sin enlaces que lleven a esos módulos. Clientes la ven
administrador y ventas (logística no tiene acceso al CRM).

El menú lateral (`admin-components.js`) oculta lo que el rol no puede usar, y
cada página declara quién puede entrar con `<body data-roles="...">`
(`admin-auth-guard.js` redirige al resto). **La barrera real son las reglas de
`firestore.rules`**; el menú y la redirección son solo comodidad de la interfaz.
Los controles de escritura de Productos e Inventario llevan la clase
`solo-escritura-scm` y se ocultan al vendedor.

### 10.6 Colección nueva: `erp_operaciones`

Historial de operaciones empresariales: `tipo`, `descripcion`, `ordenId`, `folio`,
`clienteId`, `clienteNombre`, `total`, `usuarioId`, `usuarioNombre`, `creadoEn`.
Solo se agregan documentos (no se editan ni se borran); leen los tres roles.
**Después de actualizar el proyecto hay que volver a publicar `firestore.rules`**
en la consola de Firebase (Firestore → Reglas → Publicar).

### 10.7 Gráficas con selector de tipo (`admin-charts.js`)

Todas las gráficas del panel (CRM, SCM y ERP) usan el mismo archivo,
`admin-charts.js`, que dibuja SVG sin librerías externas. Cada gráfica trae
botones para verla como **barras, barras horizontales, línea, área, pastel o
dona**; el tipo elegido se recuerda en el navegador (por gráfica). Para agregar
una gráfica nueva: cargar `admin-charts.js` después de `admin-components.js`,
poner un `<div id="miGrafica"></div>` y llamar
`BPCharts.montar(el, { id, titulo, tipo, datos: [{ etiqueta, valor, color }], formato })`.
Para comparar varias series (p. ej. PUSH y PULL) se usa `series` y
`datos: [{ etiqueta, valores: [..] }]`. Las páginas con gráficas son
`admin.html`, `admin-reportes.html`, `admin-scm-reportes.html`, `admin-erp.html`
y `admin-erp-reportes.html`.

---

## 11. Etapa 4: soporte técnico, promociones e integración compra → pagos → CRM → ERP

Esta etapa agrega tres cosas sin duplicar datos: **atención a clientes (tickets)** con un rol
nuevo **`soporte`**, **promociones con vigencia** (los cupones dejan de estar escritos en el
código) y la **sincronización automática** de cada compra de la tienda con `pagos`, el CRM y
`erp_operaciones`.

### 11.1 Archivos nuevos y modificados

| Archivo | Qué hace |
|---|---|
| `atencion-clientes.html` (nuevo) | Pantalla del cliente dentro de "Mi cuenta": formulario **Nuevo ticket** (izquierda) y **Mis tickets** (derecha) con el hilo de respuestas. |
| `cuenta-menu.js` (nuevo) | Menú lateral de "Mi cuenta" compartido (Mi cuenta, Mis pedidos, Mi monedero, Mis datos, Direcciones, Atención a clientes). Desde la entrega del integrante 2 (§12) todas las opciones tienen su pantalla. |
| `admin-soporte.html` (nuevo) | Panel del rol `soporte`: alerta de tickets en espera, bandeja con todo el historial, ficha del cliente en el CRM y formulario de respuesta + cambio de estado. |
| `admin-promociones.html` (nuevo) | CRUD de cupones con vigencia + vista en vivo de la sincronización (pagos ↔ CRM ↔ erp_operaciones). Solo administrador y ventas. |
| `firebase-db.js` | Funciones nuevas: `crearTicket`, `escucharTicketsDeCliente`, `escucharTodosLosTickets`, `responderTicket`, `marcarTicketLeido`, `escucharClienteUno`, `obtenerPromocion`, `validarCupon`, `guardarPromocion`, `escucharPromociones`, `cargarPromocionesEjemplo`, `escucharPagos`, `registrarIntegracionCompra`. `crearVenta` y `crearOrdenErp`/`cambiarEstadoOrdenErp` se ampliaron (ver 11.4). |
| `firestore.rules` | Rol `soporte`; reglas de `tickets`, `contadores`, `promociones`, `pagos`; ventas puede cambiar estatus; la tienda puede sincronizar CRM y `erp_operaciones` (ver 11.5). |
| `admin-auth-guard.js`, `admin-components.js`, `admin-usuarios.html`, `admin-icons.js`, `styles.css` | El rol `soporte` en el guard, el menú (con contador de tickets en espera), el alta de usuarios, íconos y estilos. |
| `promos.html`, `Carrito.html`, `Checkout.html` | Validan el cupón contra Firebase (existe, activo y vigente) al aplicarlo, al abrir el carrito/checkout y otra vez dentro de `crearVenta()` antes de cobrar. |
| `components.js` | Muestra junto a "Hola, Nombre" cuántas respuestas de soporte tiene el cliente sin leer. |
| `Interfaz Cliente - Perfil.html` | Botón "Atención a clientes" y soporte para el enlace `#pedidos` del menú. |
| `admin-erp-ordenes.html` | El rol ventas (vendedor) ya puede cambiar el estatus (no cancelar). |

### 11.2 Colecciones nuevas y sus relaciones (punto 4.2)

```
tickets/{folio}                      ← el id del documento ES el folio ("T-105")
  folio, clienteId ────────────────► clientes/{uid}      (ligado al CRM: soporte lee compras y total gastado)
  clienteNombre, clienteCorreo
  asunto: "Duda sobre mi pedido" | "Cambio de producto" | "Facturación" | "Problema con monedero"
  mensaje, estado: "En proceso" | "Solucionado" | "Cerrado"
  esperaSoporte: boolean           (true = nadie de soporte ha respondido; es el contador de "en espera")
  respuesta, agente, agenteId      (última respuesta y quién la escribió = usuarios/{uid})
  leidoCliente: boolean            (false = respuesta nueva; enciende la alerta del cliente)
  hilo: [{ de: "cliente"|"soporte", nombre, texto, fecha }]
  creadoEn, actualizadoEn

contadores/tickets   { ultimo }      folio consecutivo T-101, T-102… dentro de una transacción

promociones/{CODIGO}                 ← el código del cupón es el id del documento
  codigo, descripcion, tipo: "porcentaje" | "tercera_prenda" | "envio_gratis"
  valor (1-90), minimoCompra, vigenciaHasta "AAAA-MM-DD", activa
  creadoPor, creadoPorId ──────────► usuarios/{uid}

pagos/{ventaId}                      ← mismo id que la venta/orden: un pago por venta
  pedidoId ────────────────────────► ventas/{ventaId}
  folio, clienteId ────────────────► clientes/{uid}
  monto, metodoPago, estado: "Pagado" | "Cancelado" | "Reembolsado"
  origen: "Tienda web" | "ERP", usuarioId, usuarioNombre, fecha, creadoEn
```

Campos que la compra agrega al cliente en `clientes/{uid}`: `numCompras`, `totalComprado`,
`ultimaCompra`, `ultimaVentaId` y `etapa`. `erp_operaciones` recibe además el tipo
`"Compra en tienda"` (con `origen: "Tienda web"`).

Relación completa de una compra de la tienda:

```
ventas/{id} ──► pagos/{id}  (mismo id)
   │              └─ monto = ventas.total
   ├────────────► clientes/{uid}  (numCompras +1, totalComprado +total, etapa)
   └────────────► erp_operaciones  (ordenId = ventas.id, tipo "Compra en tienda")
```

### 11.3 Flujo de tickets

1. El cliente abre **Mi cuenta → Atención a clientes**, elige el asunto, escribe el mensaje y envía.
   `crearTicket()` toma el siguiente folio del contador **dentro de una transacción** (dos clientes
   al mismo tiempo no pueden recibir el mismo folio) y guarda el ticket `En proceso` con
   `esperaSoporte: true`.
2. Soporte ve la alerta superior con el contador de tickets en espera (también aparece en el
   menú lateral), abre el ticket y ve a la derecha la **ficha del cliente en el CRM** (compras,
   total gastado, etapa), leída en vivo de `clientes/{clienteId}`.
3. Soporte escribe la respuesta y elige el estado (**En proceso / Solucionado / Cerrado**).
   `responderTicket()` guarda la respuesta con su nombre (`agente`/`agenteId`), agrega la entrada
   al `hilo`, pone `esperaSoporte: false` y `leidoCliente: false`.
4. El cliente ve una alerta verde (junto a "Hola, Nombre" y en el menú de Mi cuenta). Al abrir el
   ticket se marca `leidoCliente: true`. Colores: amarillo = En proceso, verde = Respondido
   (estado `Solucionado`), gris = Cerrado.
5. **Los tickets nunca se borran** (`allow delete: if false`): lo resuelto queda en el historial.

### 11.4 Flujo de una compra de la tienda (coordinado con el integrante 1)

`crearVenta()` (compras) guarda la venta, descuenta stock y registra la salida. **Justo después**
llama a `registrarIntegracionCompra()`, que en **una sola operación atómica** (`writeBatch`):

1. crea `pagos/{ventaId}` (documento independiente: pedido, monto, método, estado, fecha);
2. actualiza al cliente en el CRM: +1 compra, +total gastado, última compra y etapa
   (Prospecto/Inactivo → Activo; 3 compras o más → Frecuente, igual que en el ERP);
3. crea el registro en `erp_operaciones` (`"Compra en tienda"`).

**Qué recibe el CRM y el ERP de cada compra** (para acordar con el integrante 1): `ventaId`,
`folio`, `clienteId`, `clienteNombre`, `total` y `metodoPago` — todos ya existen en el objeto
`datosVenta` que `Checkout.html` le pasa a `crearVenta()`. Si el integrante 1 reescribe
`crearVenta`, solo debe conservar la llamada a `registrarIntegracionCompra()` después de guardar la venta.

Si esa sincronización fallara (por ejemplo, se perdió la conexión en ese instante), la compra
**no se pierde ni se cobra doble**: queda guardada y el error se registra en la consola.
Las órdenes creadas desde el ERP (`crearOrdenErp`) también crean su documento en `pagos`, y
cancelar una orden marca su pago como `Cancelado`.

El cupón se revisa de nuevo dentro de `crearVenta()`: si venció o se desactivó mientras estaba
en el carrito, la compra se rechaza con un mensaje claro.

### 11.5 Reglas de Firestore nuevas (resumen)

- **Rol `soporte`**: lee/responde `tickets`, **lee** `clientes` (solo para la ficha) y su propio
  perfil en `usuarios`. No lee `ventas`, `pagos`, inventario ni `erp_operaciones`. El guard
  (`admin-auth-guard.js`), el menú y el CSS tampoco le muestran nada de eso.
- **`tickets`**: el cliente crea (siempre `En proceso`, a su nombre, asunto de la lista) y lee solo
  los suyos; solo puede marcar como leído. Soporte/administrador leen todos y solo pueden tocar
  estado, respuesta, agente, hilo y alertas. Nadie borra.
- **`promociones`**: cualquiera puede leer **un** cupón si sabe su código (`get`); solo ventas y
  administrador pueden listar, crear, editar y borrar.
- **`pagos`**: el cliente crea el pago de **su** venta con el monto exacto de esa venta; ventas/admin
  crean el de las órdenes ERP. Después solo se puede cambiar el `estado`.
- **Sincronización con el CRM desde la tienda**: el cliente solo puede subir **una** compra, con el
  total exacto de la venta, y solo si en la misma operación se crea `pagos/{ventaId}` (se comprueba
  con `existsAfter`); como ese pago no puede existir antes, la misma compra no se puede repetir.
- **`ventas`**: administrador, ventas y logística cambian el estatus; **cancelar** sigue siendo de
  administrador y logística porque devuelve stock al inventario.

### 11.6 Cómo probarlo (después de publicar `firestore.rules`)

1. Panel → **Usuarios**: crear un usuario con rol **Soporte**.
2. Panel → **Promociones**: "Cargar los 3 cupones de ejemplo".
3. Como cliente: comprar algo (con cupón) → en el panel de promociones aparece la fila de
   sincronización con los 3 pasos, y en el CRM suben compras y total gastado.
4. Como cliente: **Mi cuenta → Atención a clientes** → enviar un ticket (folio T-101).
5. Entrar con el usuario soporte → debe ir directo a **Atención a clientes**, ver la alerta, la
   ficha del CRM y responder. El cliente ve la alerta verde y la respuesta.

### 11.7 Limitaciones que hay que tener claras

- **No hay servidor**: la sincronización la dispara el navegador del cliente justo después de pagar.
  Las reglas validan monto y total gastado, pero el precio y el descuento de la tienda pública aún
  se calculan en el navegador (el ERP sí toma el precio de Firestore).
- Las compras hechas **antes** de la Etapa 4 no tienen documento en `pagos` ni cuentan en
  `numCompras` / `totalComprado` del CRM.
- Cancelar una orden marca su pago como `Cancelado`, pero **no** resta esa compra del CRM.
- La alerta de soporte y la de respuestas son en pantalla (tiempo real); no se envían correos
  (haría falta EmailJS o una Cloud Function).
- ~~Las pantallas Mi monedero, Mis datos y Direcciones aparecían como "Pronto"~~: ya existen (ver §12).
- Los tickets de clientes que el CRM dio de alta a mano (sin cuenta) no existen: para abrir un ticket
  hace falta tener cuenta real en la tienda.

#### Réplicas del cliente y producto de la queja (ampliación)

- **Producto de la queja:** al crear el ticket el cliente puede elegir uno de los productos de sus compras (las canceladas no aparecen). Se guarda en `tickets.pedido = { ventaId, folio, productoId, producto, cantidad }`; la relación es `tickets.pedido.ventaId → ventas/{id}`. Las reglas exigen que esa venta pertenezca al mismo cliente. Soporte lo ve resaltado arriba de la conversación.
- **Respuesta del cliente:** mientras el ticket esté **En proceso** el cliente puede seguir escribiendo (por ejemplo para dar la evidencia que soporte le pidió). Cada mensaje se agrega al final de `hilo` y el ticket vuelve a quedar `esperaSoporte: true`, así que reaparece en el contador de soporte. Con estado **Solucionado** o **Cerrado** ya no se puede responder (lo bloquean la pantalla y las reglas `ticketRespondidoPorCliente`).
- **Evidencia:** el proyecto no usa Firebase Storage, por lo que la evidencia se entrega como texto o como enlace (Drive, Dropbox, etc.) dentro de la respuesta.

---

## 12. Etapa 4: cuenta del cliente y monedero (integrante 2)

Esta parte completa **"Mi cuenta"** del cliente: monedero (saldo, recargas, historial y pago de
compras), direcciones guardadas, edición de datos, cambio y recuperación de contraseña, y el
historial de pedidos con **línea de tiempo**. También agrega la pantalla de **administración del
monedero** (consulta, recargas manuales, ajustes y reportes). Todo se conecta con lo que ya existía:
la compra con monedero es la misma `crearVenta()` (stock + pagos + CRM + ERP), y cancelar una orden
pagada con monedero devuelve el dinero al saldo.

Analogía: el monedero es como una **alcancía con libreta**. El saldo es lo que hay dentro, y la
libreta (`monedero_movimientos`) anota cada vez que se mete o se saca dinero, quién lo hizo y por qué.
Nadie puede cambiar el saldo sin escribir en la libreta en ese mismo momento, y las hojas de la
libreta no se pueden borrar.

### 12.1 Archivos nuevos y modificados

| Archivo | Qué hace |
|---|---|
| `mi-monedero.html` (nuevo) | Saldo actual, total recargado/gastado, **alerta de saldo bajo** (menos de $100), recarga con montos rápidos ($100/$200/$500/$1,000) u otro monto, 3 métodos con su formulario (tarjeta con validación Luhn, PayPal, transferencia SPEI con CLABE y clave de rastreo) e **historial de movimientos** filtrable con el id de cada movimiento. Si llega desde el checkout por falta de saldo, propone recargar lo que falta y ofrece "Volver a mi pago". |
| `mis-pedidos.html` (nuevo) | Historial de todo lo comprado (en tiempo real), con filtros y **línea de tiempo** Confirmada → Preparando → Enviada → Entregada con la fecha de cada paso (sale de `ventas.historial`). Pedidos cancelados en rojo. Botones "Ver recibo" y "Ayuda con este pedido" (ticket). |
| `mis-datos.html` (nuevo) | Editar nombre, teléfono y mascota; **cambiar contraseña** (pide la actual); **"¿Olvidaste tu contraseña?"**; **cambiar correo** con enlace de confirmación. |
| `mis-direcciones.html` (nuevo) | **Agregar, editar, eliminar** (con confirmación) y elegir la **predeterminada** de hasta 10 direcciones. |
| `admin-monedero.html` (nuevo) | Panel: 4 indicadores, saldos por cliente, historial de movimientos, gráfica recargas vs pagos por mes y formulario de **recarga manual / ajuste** con motivo (solo administrador; ventas solo consulta). |
| `cuenta-comun.js` (nuevo) | Lo que comparten las pantallas de Mi cuenta: exigir sesión, menú con alerta de tickets, formato de dinero/fechas, validación de tarjeta. |
| `firebase-db.js` | Funciones nuevas (§12.3). `crearVenta()` cobra con monedero **dentro de su transacción**; `cambiarEstadoOrdenErp()` reembolsa al cancelar. |
| `firestore.rules` | Reglas de `monederos`, `monedero_movimientos` y `clientes/{uid}/direcciones`; una venta "pagada con monedero" solo se crea si se descontó el saldo en la misma transacción; el cliente puede actualizar su `correo` solo al correo verificado de su cuenta. |
| `Checkout.html` | La opción fija "Puntos Cotton Candy (500 puntos)" se reemplazó por **Monedero** real: saldo disponible, total, saldo después del pago y bloqueo + botón "Recargar" si no alcanza. Selector **"Usar una de mis direcciones"** (carga la predeterminada sola) y casilla "Guardar esta dirección en mi cuenta". La confirmación muestra el saldo anterior y el actual. |
| `login.html` | Enlace **"¿Olvidaste tu contraseña?"** que envía el correo de recuperación de Firebase. |
| `cuenta-menu.js` | Las opciones Mis pedidos, Mi monedero, Mis datos y Direcciones ya tienen su pantalla. |
| `Interfaz Cliente - Perfil.html` | Saldo del monedero en vivo y botones a las pantallas nuevas. |
| `admin-components.js`, `admin-icons.js`, `styles.css` | Opción "Monedero" en el menú del panel (CRM y modo ERP), ícono y estilos. |

### 12.2 Colecciones nuevas y relaciones (punto 4.2)

```
monederos/{uid}                      ← el id ES el uid del cliente: un cliente tiene UN monedero
  clienteId ───────────────────────► clientes/{uid}
  clienteNombre, saldo, totalRecargado, totalGastado
  ultimoMovimientoId ──────────────► monedero_movimientos/{id}   (el movimiento que hizo el último cambio)
  creadoEn, actualizadoEn

monedero_movimientos/{id}            ← historial: solo se agregan (no se editan ni se borran)
  clienteId ───────────────────────► clientes/{uid} y monederos/{uid}
  tipo: "Recarga" | "Pago" | "Ajuste" | "Reembolso"
  efecto: "abono" (suma) | "cargo" (resta), monto, saldoAnterior, saldoNuevo
  metodo ("Tarjeta de crédito/débito" | "PayPal" | "Transferencia bancaria" | "Monedero" | "Panel de administración")
  detalle (p. ej. "Visa •••• 4242", nunca la tarjeta completa), motivo (ajustes)
  ventaId, folio ──────────────────► ventas/{id}   (en Pago y Reembolso)
  usuarioId, usuarioNombre ────────► quién lo hizo (el cliente o el administrador / logística)
  fecha, creadoEn

clientes/{uid}/direcciones/{id}      ← subcolección: un cliente tiene varias direcciones
  alias, nombre, apellido, pais, calle, ciudad, estado, cp (5 dígitos), telefono (10 dígitos),
  referencias, predeterminada (solo una en true), creadoEn, actualizadoEn
```

Relación de una compra pagada con monedero (todo en **una** transacción, o pasa todo o nada):

```
ventas/{id}  (metodoPagoClave "monedero", pagoDetalle.saldoAnterior / saldoNuevo)
   ├──► scm_productos (stock −)  +  scm_movimientos ("Salida")
   ├──► monederos/{uid} (saldo −, totalGastado +, ultimoMovimientoId)
   └──► monedero_movimientos (tipo "Pago", ventaId = ventas.id)
después (§11.4): pagos/{id} + clientes/{uid} (CRM) + erp_operaciones
```

### 12.3 Funciones nuevas en `firebase-db.js`

| Función | Para qué |
|---|---|
| `asegurarMonedero`, `obtenerMonedero`, `escucharMonedero` | Crear el monedero en $0 la primera vez y leer el saldo (en vivo). |
| `recargarMonedero({ cliente, monto, metodo, detalle })` | Recarga del cliente ($50 a $10,000, pesos completos) en una transacción: saldo + movimiento. |
| `escucharMovimientosMonedero(uid)` / `escucharMovimientosMonederoTodos()` / `escucharMonederos()` | Historial del cliente / historial y saldos para el panel. |
| `ajustarMonedero({ clienteId, efecto, monto, motivo, tipo }, usuario)` | Recarga manual o ajuste del administrador, con motivo. Nunca deja saldo negativo. |
| `agregarReembolsoMonedero` (interna) | La usa `cambiarEstadoOrdenErp()`: al cancelar una orden pagada con monedero, devuelve el total al saldo y marca el pago como `Reembolsado`. |
| `escucharDirecciones`, `obtenerDirecciones`, `guardarDireccion`, `eliminarDireccion`, `marcarDireccionPredeterminada`, `errorDeDireccion` | CRUD de direcciones. Solo una predeterminada (se ajustan las demás en el mismo lote). |
| `actualizarDatosCliente`, `cambiarContrasenaCliente`, `solicitarCambioCorreoCliente`, `sincronizarCorreoCliente`, `enviarCorreoRecuperacion` | Mis datos, contraseña, correo y "olvidé mi contraseña". |

Equivalencia con los endpoints del PDF (no hay servidor REST; Firestore se usa directo, igual que en el resto del proyecto):

| Endpoint del PDF | En este proyecto |
|---|---|
| `GET /auth/perfil`, `PUT /auth/perfil` | `obtenerPerfilCliente()`, `actualizarDatosCliente()` |
| `POST /pagos/procesar` (con Monedero) | `crearVenta()` con `metodoPagoClave: "monedero"` |
| Monedero: consultar / recargar / historial | `escucharMonedero()`, `recargarMonedero()`, `escucharMovimientosMonedero()` |
| Monedero (Administración): ajustes, recargas manuales, reportes | `ajustarMonedero()`, `admin-monedero.html` |

### 12.4 Qué pasa en los casos difíciles

- **Saldo insuficiente:** el checkout bloquea el botón y muestra cuánto falta; aun así, `crearVenta()`
  vuelve a leer el saldo **dentro de la transacción**. Si el cliente gastó su saldo en otra pestaña un
  segundo antes, la compra se rechaza con "Saldo insuficiente…" y no se descuenta nada (ni stock).
- **Dos compras al mismo tiempo con el mismo monedero:** Firestore repite la transacción de la segunda
  con el saldo nuevo; si ya no alcanza, la rechaza. El saldo nunca queda negativo.
- **Alguien intenta subirse el saldo desde la consola del navegador:** las reglas solo aceptan un cambio de
  saldo si en la misma operación se crea su movimiento con el **mismo monto**, y una recarga solo puede ser
  de $50 a $10,000 hecha por el propio cliente. Una venta marcada "pagada con monedero" sin haber
  descontado el saldo es rechazada por las reglas de `ventas`.
- **Cancelar una orden pagada con monedero:** logística o administrador la cancelan en Órdenes; en la misma
  operación se devuelve el stock, el dinero regresa al saldo (movimiento "Reembolso") y el pago queda
  `Reembolsado`. No se puede reembolsar dos veces (la regla exige que la orden no estuviera cancelada antes).
- **Recarga por transferencia:** no hay banco real; se pide la clave de rastreo del comprobante y la recarga se
  aplica al momento (simulado, igual que tarjeta y PayPal en el checkout).
- **Cambio de correo:** Firebase manda un enlace al correo nuevo; el cambio ocurre cuando la persona lo abre.
  La siguiente vez que entra a "Mis datos", el correo del CRM (`clientes/{uid}.correo`) se actualiza solo. Las
  reglas solo permiten poner como correo el que la cuenta ya verificó.

### 12.5 Cómo probarlo (después de publicar `firestore.rules`)

1. Como cliente: **Mi cuenta → Mi monedero** → recarga $500 con la tarjeta de prueba `4242 4242 4242 4242`,
   vencimiento futuro, CVV `123`. Debe aparecer el movimiento con su id y el saldo nuevo.
2. Agrega un producto al carrito → Checkout → elige **Monedero**: se ven saldo, total y saldo después. Paga.
   La confirmación muestra el saldo anterior y el actual; en Mi monedero aparece el movimiento "Pago" con
   enlace al recibo.
3. Prueba con un carrito más caro que tu saldo: el botón se bloquea y "Recargar mi monedero" lleva a la
   recarga con el monto que falta; al terminar, "Volver a mi pago".
4. **Mis pedidos:** la compra aparece con la línea de tiempo en "Confirmada". En el panel (ventas o
   logística) cámbiala a "En proceso" / "Enviada" y mira cómo avanza sola la línea en la pantalla del cliente.
5. En el panel, cancela una orden pagada con monedero: el saldo del cliente regresa (movimiento "Reembolso").
6. **Direcciones:** agrega dos, marca una como predeterminada y abre el checkout: se carga sola.
7. **Mis datos:** cambia el teléfono; en el CRM (Clientes) se ve el cambio. Prueba "¿Olvidaste tu contraseña?"
   en `login.html`.
8. Panel → **Monedero:** como administrador haz una recarga manual con motivo; como ventas, verifica que solo
   puedes consultar.

### 12.6 Limitaciones que hay que tener claras

- Las recargas no pasan por una pasarela real (como el resto de los pagos del proyecto): se valida el
  formulario y se guarda solo un resumen seguro (marca y últimos 4 dígitos, correo de PayPal o clave de rastreo).
- El reembolso automático solo aplica a órdenes pagadas con **monedero**; para tarjeta/PayPal/OXXO/SPEI el pago
  queda `Cancelado` y la devolución sería manual (fuera del sistema).
- El correo de recuperación de contraseña y el de cambio de correo los manda Firebase Authentication
  (plantilla editable en la consola: Authentication → Plantillas). Pueden llegar a spam.
- Los clientes que el CRM dio de alta a mano (sin cuenta) pueden recibir una recarga manual del administrador,
  pero no podrán usarla hasta que tengan cuenta en la tienda.

---

## 13. Etapa 4: carrito persistente (modelos Carrito y CarritoDetalle del PDF)

Antes el carrito vivía solo en el navegador (`localStorage`): si el cliente cambiaba de computadora
lo perdía, nunca caducaba y no se enteraba si otra persona compraba lo mismo. Ahora:

1. **Se guarda en la cuenta del cliente** (Firebase) y se ve igual en cualquier dispositivo.
2. **Caduca:** cada producto se quita solo **72 horas** después de agregarlo, con un aviso.
3. **Avisa en vivo** si alguien más compra un producto que tienes en el carrito y ya no alcanza: la
   cantidad se ajusta (o el producto se quita) y aparece el mensaje "Alguien más acaba de comprar…".
4. **Al pagar**, el carrito queda en estado `Comprado` con el id de la venta; al **cerrar sesión** se
   borra del navegador (sigue guardado en la cuenta), así en una computadora compartida nadie ve el
   carrito de otro.

Analogía: el carrito del navegador es la canasta que traes en la mano; el de Firebase es el casillero
con tu nombre en la tienda. Cada vez que cambias la canasta, se copia al casillero, y si llegas por otra
puerta (otro dispositivo) te dan lo que había en tu casillero.

### 13.1 Cómo está hecho (sin reescribir las páginas)

Las páginas de la tienda (`index`, `shop`, `Producto`, `Carrito`, `Checkout`, `carpeta`) **siguen
usando `localStorage`** como antes, y todas lanzan el evento `actualizarCarrito` al guardar. El archivo
nuevo **`carrito-sync.js`**, que carga `components.js` en todas las páginas, escucha ese evento y:

- le pone fecha (`agregadoEn`) a cada producto nuevo y quita los que ya tienen 72 h;
- si hay sesión, copia el carrito a Firebase (`guardarCarritoRemoto`, medio segundo después del último
  cambio, para no escribir en cada clic);
- al iniciar sesión **junta** el carrito del navegador con el de la cuenta (por producto se queda la
  cantidad mayor) y escucha cambios hechos en otro dispositivo;
- escucha el stock (`scm_productos`, que ya era público) y ajusta el carrito si ya no alcanza.

Cuando `carrito-sync.js` cambia el carrito por su cuenta lanza `carritoCambioExterno`, y
`Carrito.html` y `Checkout.html` se vuelven a pintar. **La validación final de stock sigue siendo la
transacción de `crearVenta()`** (§11): el carrito solo avisa antes.

### 13.2 Colecciones y relaciones (punto 4.2)

```
carritos/{uid}                       ← un cliente tiene UN carrito (id = uid del cliente)
  clienteId ───────────────────────► clientes/{uid}
  clienteNombre
  estado: "Activo" | "Vacío" | "Comprado" | "Expirado"
  numProductos, totalPiezas, subtotal
  resumen: [{ nombre, cantidad }]    (para la tabla del panel sin abrir el detalle)
  ultimaVentaId ───────────────────► ventas/{id}  (cuando terminó en compra)
  actualizadoEn

carritos/{uid}/detalle/{productoId}  ← un carrito tiene muchos productos (CarritoDetalle)
  productoId ──────────────────────► scm_productos/{id}
  nombre, cantidad (1-99), precioUnitario, imagen, agregadoEn (milisegundos)
```

Equivalencia con los endpoints del PDF:

| Endpoint del PDF | En este proyecto |
|---|---|
| `POST /carrito/agregar`, `PUT /carrito/item/{id}`, `DELETE /carrito/item/{id}`, `DELETE /carrito/vaciar/{cliente_id}` | Las páginas cambian `localStorage` y `carrito-sync.js` llama `guardarCarritoRemoto()` (escribe/borra en `detalle`) |
| `GET /carrito/{cliente_id}` | `obtenerCarritoRemoto()` / `escucharCarritoRemoto()` |

### 13.3 Archivos

| Archivo | Cambio |
|---|---|
| `carrito-sync.js` (nuevo) | Caducidad, sincronización con Firebase, unión al iniciar sesión, aviso de stock en vivo. |
| `admin-carritos.html` (nuevo) | Panel (administrador y ventas): carritos activos, **abandonados** (activos sin cambios en 24 h), comprados y expirados, con lo que tiene cada uno y enlace a la ficha del cliente en el CRM. |
| `firebase-db.js` | `CARRITO`, `obtenerCarritoRemoto`, `escucharCarritoRemoto`, `guardarCarritoRemoto`, `escucharCarritos`. |
| `firestore.rules` | `carritos/{uid}` y `detalle`: solo el dueño escribe (con validación de cantidad y precio); ventas/admin leen. |
| `components.js` | Carga `carrito-sync.js` y define `bpNotificar(texto, tipo)`: la notificación en pantalla de toda la tienda (ver §13.6). |
| `Carrito.html` | Se repinta con `carritoCambioExterno`; aviso de las 72 h. |
| `Checkout.html` | Al pagar marca el carrito como `Comprado`; el resumen se repinta si el carrito cambia por fuera. |
| `carpeta.html` | Su `guardarCarrito` ahora también lanza `actualizarCarrito` (antes no avisaba). |
| `admin-components.js` | Opción "Carritos" en el menú del panel. |

### 13.4 Cómo probarlo

1. Sin sesión, agrega 2 productos. Inicia sesión: el carrito se conserva y aparece en Firebase
   (`carritos/{tu uid}/detalle`).
2. Abre la tienda en otro navegador o en el celular con la misma cuenta: aparecen los mismos productos.
   Agrega uno ahí y mira cómo llega solo a la primera ventana.
3. Con un producto en el carrito, entra al panel como logística y baja su stock a 1 (o compra ese
   producto con otra cuenta): en la ventana del cliente aparece "Alguien más acaba de comprar…" y la
   cantidad baja.
4. Para probar la caducidad sin esperar 72 h: en la consola del navegador cambia `agregadoEn` de un
   producto en `localStorage.carrito` a una fecha de hace 4 días y recarga.
5. Paga: en el panel → **Carritos**, el de ese cliente aparece como `Comprado`.

### 13.5 Limitaciones

- No hay servidor: la caducidad se revisa cuando el cliente abre la tienda (cada minuto mientras está
  abierta). Un carrito abandonado sigue en Firebase con sus productos hasta que el cliente vuelve a entrar.
  Para limpiarlo sin que entre haría falta una Cloud Function programada.
- Sin sesión, el carrito sigue solo en el navegador (con caducidad y aviso de stock, pero sin copia en Firebase).
- Las reglas no comparan la cantidad del carrito contra el stock: eso se avisa en la pantalla y se garantiza
  al pagar, dentro de la transacción de `crearVenta()`.

### 13.6 Errores: notificación en pantalla, no mensajes en consola

En las pantallas de la Etapa 4 (y en los archivos de la tienda que esta entrega modifica) **no se usa
`console.log` ni `console.error`**. Cuando algo falla:

- si el error le importa a la persona, se le avisa **en pantalla**: con `bpNotificar(texto, 'error' | 'info' | 'ok')`
  en la tienda, `toast()` / el aviso del formulario en "Mi cuenta", y la tabla o `mostrarToast()` en el panel;
- si no le afecta (por ejemplo, el contador de tickets sin leer), se ignora en silencio con un comentario
  que explica por qué.

Los errores de conexión del carrito se avisan **una sola vez** (no en cada intento) hasta que vuelva a funcionar.

