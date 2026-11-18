# Arreglo del registro + eliminar clientes por completo (18-nov-2026)

Incluye TODO lo del zip anterior (seguridad y correos) más esto. Si ya copiaste el anterior, no pasa
nada: copia este encima.

## 1. Arreglo: "Tu cuenta se creó, pero Firebase no dejó guardar tu perfil"
No eran las reglas. Al registrarse, dos partes de la página guardaban la ficha del cliente al mismo
tiempo y Firebase rechazaba la segunda. Ahora solo la guarda el registro (archivo `firebase-db.js`).

**La cuenta que quedó a medias** (`dramaticplant@gmail.com`): bórrala en Firebase →
**Authentication → Usuarios → ⋮ → Borrar cuenta**, y también su ficha en el panel (Clientes) si
aparece. Luego vuelve a registrarte.

## 2. Nuevo: eliminar desde el panel también borra la cuenta de acceso
- **Con la Cloud Function publicada** (plan Blaze): se borra al instante, también la cuenta de acceso.
- **Sin ella** (plan gratis): la cuenta queda dada de baja y se borra sola cuando esa persona intenta
  entrar o abre la tienda.
- Ventas, pagos y tickets se conservan como historial.
- Pasos para publicar la función: `SETUP-FIREBASE.md`, sección "Eliminar clientes por completo".

## Archivos
- Nuevos:
  - `functions/index.js` y `functions/package.json`: la Cloud Function.
  - `firebase.json`: igual al tuyo, más la parte de `functions` y que no se publique esa carpeta.
  - `.firebaserc` (el mismo de antes).
  - `.gitignore`: para no subir `functions/node_modules` a GitHub.
- `email-recibo.js` ya trae tu Template ID de bienvenida (`template_dxc4pol`).

## Cómo aplicarlo
1. Copia **todo** el contenido de esta carpeta a la raíz del proyecto, incluida la carpeta
   `functions` y los archivos que empiezan con punto. En Windows, para ver los archivos con punto:
   Explorador → Vista → Mostrar → Elementos ocultos.
2. Publica:
   ```powershell
   firebase deploy --only "hosting,firestore:rules"
   ```
3. (Opcional, con Blaze) La Cloud Function:
   ```powershell
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

## Lo que se probó
- **Registro:** con el simulador rechazando igual que las reglas reales, ya guarda el perfil completo.
- **Cloud Function** (lógica, con datos de prueba), 10 casos:
  - sin sesión, rol sin permiso, cuenta del personal, uno mismo y uid inválido: rechazados;
  - borra la cuenta, la ficha, las direcciones, el carrito y la foto;
  - conserva ventas;
  - deja registro de quién la eliminó;
  - un cliente del CRM sin cuenta se borra sin error.
- **Panel y tienda:**
  - sin función: baja, borrado al intentar entrar y con la sesión abierta, no revive la ficha, y puede
    registrarse de nuevo con el mismo correo;
  - con función: borrado al instante.
- **Todas las pruebas anteriores:** 0 fallas, sin alertas del navegador y sin mensajes en consola.

**No se pudo probar aquí** (requiere tu Firebase real):
- la Cloud Function publicada de verdad;
- las reglas de `bajas`.
