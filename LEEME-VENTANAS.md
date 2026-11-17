# Ventanas emergentes propias + cero mensajes de consola

Basado en **Develop** de GitHub con tu PR #24 ya incluido (commit f7a0d3e, 17-nov-2026).
**Incluye también** los cambios de tu commit local "Eliminacion de mensajes de consola"
(el que no se pudo subir), así que con esta carpeta ya no necesitas ese commit.

## Qué cambió

1. **Ya no salen las ventanas del navegador** ("localhost:5500 dice"). Las 42 que había en todo el
   proyecto (`alert`, `confirm` y `prompt`) ahora son una ventana propia con el diseño de la tienda.
   Esto incluye las de Carrito, Checkout, el panel, promos, subasta, comunidad, publicar, factura, etc.
   - Las acciones que borran algo llevan el botón en rojo y el foco empieza en "Cancelar".
   - Enter acepta y Esc cancela.
2. **Cero `console.*` en todo el proyecto** (antes había 69 más en el panel y la tienda).
   - Donde la pantalla ya mostraba el error, solo se quitó la línea.
   - Donde el error pasaba en silencio, ahora sale un aviso abajo en la pantalla.

3. **"Mis pedidos" y "Producto de tu compra" en Atención a clientes no cargaban.** La consulta de compras
   filtraba por cliente y ordenaba por fecha, y eso obliga a crear un **índice** en Firebase. El enlace para
   crearlo solo aparecía en la consola. Ahora la consulta solo filtra por cliente y ordena las compras en el
   navegador, así que ya no necesita índice. Se arregló igual el historial de interacciones del CRM.
   Si algo vuelve a fallar, la pantalla dice el motivo (permiso, índice o conexión).

## Archivo NUEVO
- `dialogos.js`: las ventanas `bpAlerta`, `bpConfirmar`, `bpPedirTexto` y el aviso `bpNotificar`.

## Cómo aplicarlo

Primero resuelve la conexión a GitHub (el error "Could not resolve host").
Luego, en PowerShell, dentro de la carpeta del proyecto:

```powershell
git fetch origin
git checkout Develop
git pull origin Develop
git checkout -b rama-Kim-ventanas
```

Copia **todos** los archivos de esta carpeta a la raíz del proyecto (reemplaza los que ya existan).
Este LEEME no hace falta copiarlo. Después:

```powershell
git add .
git commit -m "Ventanas emergentes propias y sin mensajes de consola"
git push origin rama-Kim-ventanas
```

Y abre el Pull Request hacia Develop. Tu rama `Rama-Kim` con el commit viejo la puedes dejar así;
ya no hace falta subirla.

## Lo que se probó (Chrome, con Firebase simulado)
- El simulador ahora exige índices igual que Firebase real (así se reprodujo el error de "Mis pedidos").
- Las 70 revisiones de antes (monedero, carrito, compra, panel): 0 fallas, sin ninguna alerta del navegador.
- Ventanas nuevas:
  - vaciar carrito (Cancelar, Esc y Aceptar);
  - quitar producto;
  - confirmar compra ("Revisar de nuevo" no compra);
  - correo del recibo (campo prellenado);
  - eliminar producto en el panel (Cancelar no borra).
- Se provocaron errores a propósito: aparece el aviso en pantalla y la consola queda vacía.
