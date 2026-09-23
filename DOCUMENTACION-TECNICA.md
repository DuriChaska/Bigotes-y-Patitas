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
3. Si la página tiene marcado `data-solo-admin` (solo `admin-usuarios.html`
   la tiene) y el rol no es `administrador`, la regresa al dashboard.

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
  rol: "administrador" | "vendedor"

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
   Usuarios. Si es `vendedor`, ve todo excepto Usuarios (esa opción
   desaparece del menú y la URL directa lo rebota al dashboard).

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
- **Interacciones:** cualquiera con sesión iniciada (admin o vendedor) puede leer y escribir. Sin sesión, cero acceso.
- **Usuarios:** cualquiera con sesión puede *leer* (necesario para que el
  guard sepa tu propio rol al entrar), pero solo alguien cuyo *propio*
  documento diga `rol: "administrador"` puede crear, editar o borrar
  perfiles de otras personas.
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
