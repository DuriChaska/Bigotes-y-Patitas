# Etapa 4 · Cuenta, monedero y carrito persistente

Basado en la rama **Develop** de GitHub (último commit: "Merge pull request #23", 17-nov-2026),
que ya trae lo de compras/pagos (Brenda) y soporte (Axel).

## Cómo aplicarlo

1. En tu carpeta del proyecto, trae lo más nuevo de Develop
   (tu carpeta local estaba en `rama-Kim`, sin estos cambios):
   `git checkout Develop` y luego `git pull origin Develop`.
2. Crea tu rama, por ejemplo `git checkout -b rama-Kim-etapa4`.
3. Copia **todos** los archivos de esta carpeta a la raíz del proyecto (reemplaza los que ya existan).
   Este LEEME no hace falta copiarlo.
4. Publica `firestore.rules` en la consola de Firebase (Firestore → Reglas → Publicar).
5. Haz commit, push y el Pull Request a Develop.

## Archivos NUEVOS (8)

| Archivo | Qué es |
|---|---|
| `mi-monedero.html` | Saldo, alerta de saldo bajo, recargas (tarjeta / PayPal / transferencia) e historial con ID de cada movimiento |
| `mis-pedidos.html` | Historial de compras con línea de tiempo (Confirmada → Preparando → Enviada → Entregada) |
| `mis-datos.html` | Editar datos, cambiar contraseña, "olvidé mi contraseña", cambiar correo |
| `mis-direcciones.html` | Agregar, editar, eliminar y elegir la dirección predeterminada |
| `admin-monedero.html` | Panel: saldos, recargas manuales, ajustes con motivo, reportes |
| `admin-carritos.html` | Panel: carritos activos, abandonados, comprados y expirados |
| `carrito-sync.js` | Carrito guardado en Firebase, caducidad de 72 h, aviso de stock en vivo |
| `cuenta-comun.js` | Código compartido por las pantallas de "Mi cuenta" |

## Archivos MODIFICADOS (14)

| Archivo | Qué cambió | Avisar a |
|---|---|---|
| `firebase-db.js` | Funciones nuevas al final (monedero, direcciones, cuenta, carrito). `crearVenta()` cobra con monedero dentro de su transacción; `cambiarEstadoOrdenErp()` reembolsa al monedero al cancelar. | Brenda (toqué `crearVenta`) |
| `firestore.rules` | Reglas de `monederos`, `monedero_movimientos`, `direcciones`, `carritos`; venta con monedero solo si se descontó el saldo | Todos |
| `Checkout.html` | Monedero real en vez de "Puntos (500)", direcciones guardadas, marca el carrito como Comprado, `<div id="footer">` que faltaba | Brenda |
| `Carrito.html` | Se repinta si el carrito cambia por fuera (stock, caducidad, otro dispositivo) + nota de 72 h | Brenda |
| `components.js` | Carga `carrito-sync.js` | — |
| `carpeta.html` | `guardarCarrito` ahora avisa al badge y a la sincronización | — |
| `login.html` | "¿Olvidaste tu contraseña?" | — |
| `Interfaz Cliente - Perfil.html` | Saldo del monedero y botones a las pantallas nuevas | — |
| `cuenta-menu.js` | Las 4 opciones "Pronto" ya llevan a su pantalla | Axel |
| `admin-components.js`, `admin-icons.js` | Opciones "Monedero" y "Carritos" en el menú del panel | — |
| `styles.css` | Estilos nuevos al final | — |
| `DOCUMENTACION-TECNICA.md` | Secciones **12** (cuenta y monedero) y **13** (carrito persistente) | — |
| `SETUP-FIREBASE.md` | Pasos al final | — |

## Lo que se probó

Las pantallas se probaron en Chrome con una copia de Firebase simulada en memoria (70 revisiones, 0 fallas):
- recarga, compra con monedero, saldo insuficiente y reembolso al cancelar;
- direcciones, mis pedidos, mis datos y "olvidé mi contraseña";
- roles del panel;
- carrito: caducidad de 72 h, unión del carrito al iniciar sesión, aviso de "alguien más compró",
  cambios desde otro dispositivo, estado "Comprado" y limpieza al cerrar sesión.

**Las reglas de Firestore no se pudieron probar con el emulador.** Después de publicarlas, hagan una compra
con monedero y agreguen productos con sesión iniciada. Si algo da `permission-denied`, el error sale en la
consola del navegador.
