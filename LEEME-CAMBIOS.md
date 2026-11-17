# Etapa 4 · Cuenta del cliente y Monedero (integrante 2)

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

## Archivos NUEVOS (6)

| Archivo | Qué es |
|---|---|
| `mi-monedero.html` | Saldo, alerta de saldo bajo, recargas (tarjeta / PayPal / transferencia) e historial con ID de cada movimiento |
| `mis-pedidos.html` | Historial de compras con línea de tiempo del estado (Confirmada → Preparando → Enviada → Entregada) |
| `mis-datos.html` | Editar datos, cambiar contraseña, "olvidé mi contraseña" y cambiar correo |
| `mis-direcciones.html` | Agregar, editar, eliminar y elegir la dirección predeterminada |
| `admin-monedero.html` | Panel: saldos, recargas manuales, ajustes con motivo y reportes |
| `cuenta-comun.js` | Código compartido por las pantallas de "Mi cuenta" |

## Archivos MODIFICADOS (11)

| Archivo | Qué cambió | Dueño original |
|---|---|---|
| `firebase-db.js` | Funciones nuevas al final (sección "Etapa 4 · Cuenta del cliente y Monedero"). En `crearVenta()` se agregó el cobro con monedero **dentro de la misma transacción**. En `cambiarEstadoOrdenErp()`, cancelar devuelve el dinero al monedero. | Todos (avisar a Brenda: toqué `crearVenta`) |
| `firestore.rules` | Reglas de `monederos`, `monedero_movimientos`, `clientes/{uid}/direcciones`; venta con monedero solo si se descontó el saldo; el cliente puede actualizar su correo verificado | Todos (avisar a Axel) |
| `Checkout.html` | "Puntos Cotton Candy (500)" → **Monedero real** (saldo, total, saldo después, bloqueo y "Recargar"). Selector de direcciones guardadas + "Guardar esta dirección". Se agregó el `<div id="footer">` que faltaba (daba un error en consola). | Brenda (integrante 1) |
| `login.html` | "¿Olvidaste tu contraseña?" | — |
| `Interfaz Cliente - Perfil.html` | Saldo del monedero y botones a las pantallas nuevas | — |
| `cuenta-menu.js` | Las 4 opciones que decían "Pronto" ya llevan a su pantalla | Axel |
| `admin-components.js` | Opción "Monedero" en el menú del panel | — |
| `admin-icons.js` | Ícono `wallet` | — |
| `styles.css` | Estilos nuevos al final del archivo | — |
| `DOCUMENTACION-TECNICA.md` | Nueva **sección 12** (colecciones, relaciones, funciones, casos difíciles, cómo probar) | — |
| `SETUP-FIREBASE.md` | Pasos al final para publicar reglas | — |

## Lo que se probó

Las pantallas se probaron en Chrome con una copia de Firebase simulada en memoria. Se probaron:
recarga, tarjeta inválida, compra con monedero (descuenta saldo, stock, crea pago, suma en el CRM),
saldo insuficiente, direcciones, mis pedidos con línea de tiempo, mis datos, olvidé contraseña,
ajustes del administrador, rol ventas solo consulta, y cancelación con reembolso.
**Las reglas de Firestore no se pudieron probar con el emulador**: revísenlas al publicarlas.
Hagan una compra con monedero real; si algo da `permission-denied`, el error aparece en la consola del navegador.
