# Iniciar sesión y registro por pasos

Este zip es **acumulado**: trae todo lo de los zips anteriores (banner, destacados, página de producto y colección) más esto. Cópialo encima y listo.

## Publicar
```powershell
firebase deploy --only "hosting,firestore:rules"
```
(Las reglas cambiaron un poquito para que el cliente pueda guardar sus apellidos y código postal.)

## Qué cambió
- **login.html**: a la izquierda la bienvenida con ilustración; a la derecha las pestañas **Iniciar sesión / Registrarme**.
- **Registro en 4 pasos** con barra de avance y botón **Volver** en cada paso (no se pierden los datos):
  1. Nombre, apellido paterno, apellido materno y código postal.
  2. "Kim, introduce tus datos de contacto": correo y teléfono.
  3. Contraseña con las 3 reglas que se ponen en verde mientras escribes, confirmar contraseña, aceptar aviso de privacidad (obligatorio) y recibir promociones (opcional). El ojito muestra/oculta la contraseña.
  4. Mascota de interés: **Perro** (lista de razas con buscador), **Gato** (lista de colores) u **Otras mascotas**. Se puede omitir.
- Se conserva todo lo de antes: bloqueo de 5 min tras 5 intentos, "¿Olvidaste tu contraseña? Recupérala", avisos al llegar, correo de bienvenida y mandarte a iniciar sesión.
- La página vieja `Interfaz Usuario - Registro .html` ahora solo te manda a la pestaña "Registrarme".
- En celular el menú de arriba ya no se sale de la pantalla (ahora se desliza de lado).

## Ojo con las contraseñas
Ahora piden **mayúsculas y minúsculas**. Las cuentas viejas siguen entrando con su contraseña de siempre; la regla solo aplica al crear cuentas nuevas.
