# Seguridad de cuentas, correos y arreglos (18-nov-2026)

Basado en **Develop** de GitHub con tu PR #25 (commit 4aeb7e4).

## Qué incluye

1. **"No document to update" en Mis datos:** tu cuenta existía pero no tenía perfil en `clientes`.
   Ahora el perfil se crea solo al entrar a la tienda, y "Guardar cambios" funciona.
2. **Bloqueo por intentos (protocolo de seguridad):** después de 5 intentos fallidos, la cuenta se
   bloquea 5 minutos, en el login de la tienda y en el del panel.
   - Muestra cuántos intentos quedan y una cuenta regresiva.
   - Durante el bloqueo no entra nadie, ni con la contraseña correcta.
3. **Contraseñas con hash:** el proyecto nunca guarda contraseñas; Firebase las guarda con hash
   (scrypt + sal). Está explicado en `DOCUMENTACION-TECNICA.md` §14.1 para la defensa.
4. **Correo de bienvenida al registrarse:** lo manda Firebase (siempre) y, de forma opcional, EmailJS con
   el diseño de la tienda.
5. **El registro manda a iniciar sesión:** ya no entra solo. Llegas a "Iniciar sesión" con tu correo ya
   escrito y un aviso verde.
6. **Enlace de cambio de contraseña:** hay una página propia, `cuenta-accion.html`, que explica en español
   si el enlace ya no sirve. No deja pedir otro enlace antes de 60 segundos y avisa que se use el correo
   más reciente.
7. **El aviso "¡Agregado!" del carrito ahora sale abajo a la derecha.**

## Archivo NUEVO
- `cuenta-accion.html`: página a la que llevan los enlaces de los correos.

## Cómo aplicarlo
1. `git checkout Develop`, luego `git pull origin Develop` y luego `git checkout -b rama-Kim-seguridad`.
2. Copia los archivos de esta carpeta a la raíz del proyecto (este LEEME no hace falta).
3. **Publica `firestore.rules`** (Firestore → Reglas → Publicar).
4. En Firebase: **Authentication → Plantillas → lápiz → "Personalizar URL de acción"** →
   `http://localhost:5500/cuenta-accion.html`. Detalles en `SETUP-FIREBASE.md`, al final.
5. Commit, push y Pull Request.

## Lo que se probó (Chrome, con Firebase simulado)
- **Cuenta sin perfil:** se crea el perfil y "Guardar cambios" funciona.
- **Bloqueo:**
  - 5 fallos con el aviso de cuántos quedan;
  - bloqueo con cuenta regresiva;
  - no entra ni con la contraseña correcta;
  - pasados 5 minutos sí entra;
  - el contador se borra;
  - el login del panel también se bloquea.
- **Registro:**
  - manda el correo;
  - no deja la sesión abierta;
  - llega a "Iniciar sesión" con el correo escrito;
  - no pierde el carrito;
  - después entra con sus datos.
- **Contraseña:**
  - enlace con regreso a la tienda;
  - espera de 60 segundos;
  - página propia;
  - contraseña nueva;
  - entra con la nueva;
  - el enlace usado explica qué pasó.
- **Aviso del carrito:** sale abajo.
- **Todas las pruebas anteriores** (monedero, carrito, ventanas, foto, registro): 0 fallas, sin alertas
  del navegador y sin mensajes en consola.

**No se pudo probar aquí** (requiere tu Firebase real):
- las reglas nuevas (sobre todo la que borra el contador al entrar bien, que usa `hashing.sha256`);
- que los correos lleguen de verdad.

Si algo sale "sin permiso", pásame el mensaje.
