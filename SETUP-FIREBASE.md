# Configurar Firebase para el panel de admin de Bigotes y Patitas

El panel de administración (`admin.html`, `admin-clientes.html`, etc.) ya está
conectado a Firebase (Firestore + Authentication). Solo falta que el equipo
cree su propio proyecto de Firebase y pegue sus llaves. Son ~10 minutos.

## 1. Crear el proyecto

1. Ve a **https://console.firebase.google.com** e inicia sesión con una
   cuenta de Google (puede ser la de cualquiera del equipo).
2. Clic en **"Agregar proyecto"**, ponle un nombre (ej. `bigotes-y-patitas`)
   y sigue el asistente (Google Analytics es opcional, pueden desactivarlo).

## 2. Registrar la app web

1. Dentro del proyecto, clic en el ícono **"</>"** (Web) en la pantalla de
   inicio, o en **⚙️ Configuración del proyecto → General → Tus apps**.
2. Ponle un apodo, por ejemplo "Bigotes y Patitas Admin". No necesitan
   Firebase Hosting en este paso.
3. Firebase les va a mostrar un bloque `firebaseConfig = { apiKey: ..., ... }`.
   **Cópienlo completo.**

## 3. Pegar la configuración en el proyecto

Abran el archivo **`firebase-config.js`** y reemplacen el objeto
`firebaseConfig` de ejemplo por el que copiaron en el paso anterior:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "bigotes-y-patitas.firebaseapp.com",
  projectId: "bigotes-y-patitas",
  storageBucket: "bigotes-y-patitas.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

Guarden el archivo. Con eso todas las páginas del panel (que importan de
`firebase-config.js`) ya apuntan a su proyecto.

## 4. Activar Authentication (login del panel)

1. En el menú izquierdo de la consola: **Authentication → Get started**.
2. Pestaña **Sign-in method** → habiliten **"Correo electrónico/contraseña"**.
3. Pestaña **Users → Add user**: creen el primer usuario administrador
   (ej. `admin@bigotesypatitas.com` con una contraseña). Con ese correo y
   contraseña se van a poder loguear en `admin-login.html`.
4. Copien el **UID** que le asignó Firebase a ese usuario (aparece en la
   columna "User UID" de la tabla de Users).

## 4.1 Crear el primer perfil de administrador (paso obligatorio)

El panel maneja tres roles (**administrador**, **vendedor** y **logistica**) guardados
en una colección de Firestore llamada `usuarios`. El propio panel permite
crear usuarios nuevos desde **Configuración → Usuarios**, pero esa pantalla
solo la puede usar alguien que YA sea administrador — para el primer
administrador del proyecto no hay quien lo dé de alta, así que se crea a
mano, una única vez:

1. Consola de Firebase → **Firestore Database → Datos → Iniciar colección**.
2. ID de la colección: `usuarios`.
3. ID del documento: peguen el **UID** que copiaron en el paso anterior
   (no le pongan un ID automático, tiene que ser exactamente ese UID).
4. Agreguen estos campos:
   - `nombre` (string) → su nombre, ej. "Kimi"
   - `correo` (string) → el mismo correo del usuario de Authentication
   - `rol` (string) → escriban exactamente `administrador`
5. Guarden.

Con eso, al iniciar sesión con ese correo, el panel ya sabe que es
administrador y les va a dejar entrar a **Configuración → Usuarios** para
crear ahí, desde la interfaz, a los siguientes administradores y vendedores
— ya no van a necesitar tocar la consola de Firebase de nuevo para eso.

> **Qué puede hacer cada rol:**
>
> | Rol | CRM (clientes, interacciones, reportes) | SCM (inventario, pedidos, productos...) | Usuarios |
> |---|---|---|---|
> | `administrador` | Sí | Sí | Sí |
> | `vendedor` | Sí | No | No |
> | `logistica` | No | Sí | No |
>
> Configuración (cambiar nombre, correo o contraseña propios) la ven los tres.
> Quien entra a una sección que no le toca es regresado a su página de inicio
> (vendedor → Dashboard, logística → SCM). Los permisos reales los aplican las
> reglas de Firestore (`firestore.rules`), no solo el menú: **después de
> actualizar el proyecto hay que volver a publicar `firestore.rules`** en la
> consola de Firebase (Firestore Database → Reglas → Publicar).

> **Sobre "eliminar" un usuario:** el botón de eliminar en Usuarios les quita
> el acceso al panel (borra su perfil de Firestore), pero no borra su cuenta
> de correo de Firebase Authentication — eso requiere el SDK de administrador
> desde un backend (Cloud Functions), no se puede hacer solo con el código
> del navegador. Para un proyecto escolar esto es suficiente: sin perfil en
> Firestore, la persona ya no puede entrar al panel aunque su cuenta exista.

## 5. Activar Firestore (la base de datos)

1. Menú izquierdo: **Firestore Database → Crear base de datos**.
2. Elijan **modo producción** (no "modo de prueba", porque ese modo deja la
   base abierta a cualquiera).
3. Elijan la región más cercana (por ejemplo `us-central1`).
4. Una vez creada, vayan a la pestaña **Reglas** y peguen el contenido del
   archivo **`firestore.rules`** (incluido en este proyecto). Publiquen.

Esto asegura que solo alguien con sesión iniciada (creada en el paso 4)
puede leer o escribir clientes e interacciones — nadie más puede entrar a
los datos desde fuera del panel.

## 6. Probar

1. Abran `admin-login.html` en el navegador (puede ser abriendo el archivo
   directamente, o mejor con una extensión tipo "Live Server" para evitar
   problemas de módulos de JavaScript).
2. Entren con el correo/contraseña que crearon en el paso 4.
3. Vayan a **Clientes → Nuevo cliente** y registren uno de prueba: debería
   aparecer también en la consola de Firebase, en **Firestore Database →
   Datos → clientes**.
4. Regístrenle una interacción desde su ficha para probar la colección
   `interacciones`.

Si algo no conecta, abran la consola del navegador (F12 → pestaña
"Console"): Firebase muestra ahí el motivo exacto del error (llaves mal
copiadas, reglas que bloquean el acceso, etc.).

> **Nota sobre índices:** la primera vez que abran el historial de
> interacciones de un cliente (`admin-interacciones.html`), o la primera vez
> que un cliente real abra su perfil (`Interfaz Cliente - Perfil.html`) y se
> pida su historial de compras, es posible que Firestore muestre en la
> consola un error como *"The query requires an index"* con un enlace azul.
> Es normal — Firestore necesita crear un índice para poder filtrar por
> cliente y ordenar por fecha al mismo tiempo (pasa con `interacciones` y con
> `ventas`). Solo hagan clic en ese enlace, esperen 1-2 minutos a que se
> construya el índice, y recarguen la página.

## 7. Cargar el catálogo de ejemplo (SCM / tienda)

Las páginas públicas (`index.html`, `shop.html`, `Producto.html`) y todo el
módulo SCM leen productos reales de la colección `scm_productos` — si esa
colección está vacía, la tienda se ve vacía. Para arrancar con datos:

1. Entren al panel como administrador y abran **SCM → Catálogo de productos**
   (`admin-scm-productos.html`).
2. Si la colección está vacía, la página ofrece un botón para cargar el
   catálogo de ejemplo (`scm-config.js`, ya con productos y proveedores para
   mascotas). Con eso la tienda pública queda poblada de inmediato.

## Estructura de datos en Firestore

Hay dos partes en este proyecto: el **CRM** (panel de administración, solo
personal) y la **tienda pública + SCM** (catálogo, carrito, checkout, cuentas
de cliente reales). Ambas viven en el mismo proyecto de Firebase.

```
usuarios/{uid}          (uid = el mismo ID que le da Firebase Authentication)
  nombre: string
  correo: string
  rol: "administrador" | "vendedor" | "logistica"

clientes/{id}
  # Esta colección tiene DOS orígenes posibles para el mismo documento:
  # - Prospectos que el personal agrega a mano desde el CRM (id autogenerado).
  # - Cuentas reales de clientes que se registran en el sitio público
  #   (Interfaz Usuario - Registro .html): en ese caso el id del documento
  #   es EXACTAMENTE el mismo uid que Firebase Authentication le dio a esa
  #   cuenta, para poder relacionarlos.
  nombre: string
  mascota: string
  correo: string
  telefono: string
  etapa: "Prospecto" | "Activo" | "Frecuente" | "Inactivo"
  estado: "Activo" | "Inactivo"
  fechaRegistro: string (dd/mm/aaaa)
  creadoEn: timestamp

interacciones/{idAutogenerado}
  clienteId: string       (referencia al id del documento en "clientes")
  clienteNombre: string
  tipo: "Llamada" | "Correo" | "Reunión"
  descripcion: string
  usuario: string
  fecha: string (dd/mm/aaaa)
  creadoEn: timestamp

scm_productos/{idAutogenerado}   (catálogo — lectura PÚBLICA, la usa la tienda)
  nombre: string
  categoria: string
  proveedor, proveedorId: string
  costo: number            (costo interno de compra/suministro)
  precio: number           (precio de venta al público, el que ve la tienda)
  stock: number (int)
  stockMin: number (int)   (debajo de esto se considera "bajo stock")
  estrategia: "PUSH" | "PULL"
  img: string (ruta o URL de la imagen)
  creadoEn / actualizadoEn: timestamp

scm_proveedores/{idAutogenerado}
  nombre, contacto, correo, telefono, direccion: string

scm_pedidos/{idAutogenerado}      (pedidos de reposición a proveedores)
  folio: string ("PC-001", ...)
  productoId, cantidad, tipo, estado, fecha, ...

scm_movimientos/{idAutogenerado}  (historial de entradas/salidas de inventario)
  productoId, producto, tipo: "Entrada" | "Salida", cantidad, motivo, fecha,
  usuario, creadoEn

scm_estado/madurez   (un solo documento: checklist manual del nivel de madurez SCM)
  items: map<string, boolean>   (se marca a mano desde admin-scm-madurez.html)

ventas/{idAutogenerado}   (compras REALES hechas por clientes desde la tienda)
  clienteId: string        (uid de la cuenta que compró)
  clienteNombre, clienteCorreo: string
  items: [{ productoId, nombre, precio, cantidad }]
  subtotal, descuento, envio, total: number
  cupon, descripcionCupon: string | null
  direccionEnvio: { nombre, pais, calle, ciudad, estado, cp, telefono, correo, notas }
  metodoPago: string
  folio: string ("CC-AAMMDD-XXXX")
  estado: "Confirmada" (no hay todavía pantalla de admin para cambiarlo a
    "Enviada"/"Entregada"; las reglas y el badge del perfil ya lo soportan
    si en el futuro se agrega)
  creadoEn: timestamp

  # Al crearse (función crearVenta en firebase-db.js) TAMBIÉN, en la misma
  # operación atómica: descuenta el stock del producto en scm_productos y
  # registra un movimiento de "Salida" en scm_movimientos.
```

## Archivos involucrados

| Archivo | Qué hace |
|---|---|
| `firebase-config.js` | Inicializa Firebase con las llaves del proyecto (aquí pegan su configuración). |
| `firebase-db.js` | Todas las funciones para leer/crear/editar/eliminar clientes, interacciones, usuarios y el módulo SCM completo, más las de cuentas de cliente reales (registro/login/perfil) y de compras (`crearVenta`). El resto de las páginas importan de aquí. |
| `admin-auth-guard.js` | Se incluye en cada página del panel (menos el login) para exigir sesión iniciada, cargar el perfil/rol y bloquear `admin-usuarios.html` a quien no sea administrador. |
| `components.js` | Header/footer de las páginas públicas de la tienda; también decide si mostrar "Iniciar sesión" o el nombre del cliente con sesión iniciada. |
| `scm-config.js` | Catálogo y proveedores de ejemplo (mascotas) para poblar `scm_productos`/`scm_proveedores` la primera vez. |
| `firestore.rules` | Reglas de seguridad a copiar en la consola de Firebase (cubren CRM, SCM y la tienda/cuentas de cliente). |

> **Importante sobre roles y cuentas de cliente:** desde que la tienda tiene
> cuentas reales de clientes (Firebase Authentication), `request.auth != null`
> YA NO significa "es personal del panel" — un cliente cualquiera también
> tiene sesión. Las reglas usan `esStaff()`/`esAdmin()` (que revisan que
> exista un documento en `usuarios`) para distinguir al personal de un
> cliente común. Si en algún momento agregan una colección nueva, revisen
> que sus reglas usen `esStaff()`/`esAdmin()` y no `request.auth != null` a
> secas, para no abrir por accidente datos de personal a cualquier cliente.

## Si el login no te deja entrar

Revisa en orden (abre la consola del navegador con F12 → pestaña "Console"
para ver el error exacto):

1. **¿`firebase-config.js` tiene tus llaves reales y sin duplicados?** Si lo
   pegaste directo desde el snippet que da Firebase (el que incluye
   `import ... from "firebase/app"`), va a tronar — esa forma de importar
   solo funciona con un instalador (npm), no en un navegador sin bundler.
   Usa únicamente los tres `import` que ya vienen con `https://www.gstatic.com/...`.
2. **¿Está habilitado "Correo/contraseña" en Authentication → Sign-in method?**
   Si no está prendido el proveedor, ningún correo/contraseña va a funcionar
   aunque el usuario exista.
3. **¿Existe ese usuario en Authentication → Users?** El correo y contraseña
   con los que intentas entrar tienen que ser exactamente los de un usuario
   que ya creaste ahí.
4. **¿Ya le creaste su perfil en la colección `usuarios`?** (ver sección 4.1
   arriba). Sin ese documento, el panel te deja iniciar sesión en
   Authentication pero te saca de inmediato con una alerta de "no tiene rol
   asignado" — es normal, hay que crear ese documento una vez para el primer
   administrador.
5. **¿Las reglas de Firestore son las de `firestore.rules`?** Revísalas en
   Firebase Console → Firestore Database → Reglas, y confirma que digan
   "Publicado" (no solo escritas sin publicar).

## Nota sobre los "endpoints" REST del PDF de la actividad

El PDF de la Etapa 1 pide endpoints tipo `POST /clientes`, `GET /clientes/{id}`,
etc. Firestore no expone URLs así por defecto: las páginas hablan con la base
de datos directo a través del SDK de Firebase (lo que ya está implementado
aquí). Si su maestra pide explícitamente que existan esas rutas REST
literales, el siguiente paso sería envolver estas mismas funciones de
`firebase-db.js` en **Cloud Functions** (HTTPS functions), que sí exponen una
URL por cada endpoint y por dentro usan Firestore igual que ahora.
