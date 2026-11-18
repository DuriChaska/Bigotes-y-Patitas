# Página de producto nueva + colección Otoño-Invierno

Este zip **incluye todo lo de los zips del banner y de destacados**, así que puedes copiarlo encima sin perder nada.

## 1. Copiar y publicar
1. Copia todo el contenido de esta carpeta a tu proyecto (reemplaza los archivos).
2. Publica **la página y las reglas** (hay reglas nuevas para reseñas, preguntas y favoritos):
   ```powershell
   firebase deploy --only "hosting,firestore:rules"
   ```

## 2. Agregar las 4 prendas
1. Entra al panel → **SCM → Productos**.
2. Arriba a la derecha aparece **"Agregar colección Otoño-Invierno"**. Dale clic una vez.
3. Se crean las 4 prendas con sus fotos, descripción, beneficios y talla, marcadas como destacadas.
   El botón desaparece cuando ya están todas (si borras una, vuelve a aparecer).

| Prenda | Precio | Talla | Sale en |
|---|---|---|---|
| Chaleco Polar Beige | $449 | Mediano | Para ellos |
| Chamarra Rosa Borrego | $599 | Grande | Para ellas |
| Suéter Rojo con Moños | $399 | Chico | Para ellas |
| Suéter Blanco con Moño de Lentejuela | $499 | Mediano | Para ellas |

Solo el precio del chaleco venía en tus capturas; **los otros 3 los puse yo** (y el stock de 12 a 18 piezas). Cámbialos con el lápiz ✏️.

## 3. Lo nuevo en el formulario de producto
- **Más imágenes**: una ruta o URL por renglón (salen como miniaturas).
- **Marca** y **Talla**.
- **Beneficios**: uno por renglón (salen como lista con viñetas).

## 4. Qué tiene la página de producto
- Miniaturas a la izquierda con flechas, foto grande y visor al dar clic.
- Guía de tallas y "¿Cuál es la talla correcta?" (calcula con el largo de espalda).
- Talla y cantidad. Si subes la misma prenda en otra talla con el mismo nombre (solo cambia lo que va después de la última coma), aparecen juntas en "Talla".
- Agregar al carrito, **Comprar ahora** (va directo a pagar) y **Agregar a favoritos**.
- Envío a domicilio y recoger en tienda.
- Compartir: un botón discreto con WhatsApp, Facebook, X y copiar enlace (en celular abre el menú de compartir del teléfono).
- Descripción y beneficios.
- Reseñas con huellitas (1 a 5), barras por calificación y círculo con el promedio.
- Preguntas: el cliente pregunta; **tú respondes desde la misma página** entrando con tu cuenta del panel (administrador, vendedor o soporte).
- Barra fija abajo con el botón de carrito cuando bajas.
- Nueva sección **Mi cuenta → Mis favoritos**.

Para reseñas, preguntas y favoritos hay que iniciar sesión; si no, se le pide al cliente.
