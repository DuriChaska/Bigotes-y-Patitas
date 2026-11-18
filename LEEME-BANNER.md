# Banner principal tipo carrusel (página de Inicio)

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | El banner viejo se cambió por el carrusel nuevo |
| `styles.css` | Estilos del carrusel al final (sección "Hero carrusel") y la letra Fredoka |
| `hero-carrusel.js` | Hace que cambie solo cada 6 s, los puntitos, y deslizar en celular |
| `Imagenes/Mascotas/hero-perro-sudadera.svg` | Perrito con sudadera tie-dye |
| `Imagenes/Mascotas/hero-gato-sueter.svg` | Gatito con suéter tejido |
| `Imagenes/Mascotas/hero-duo.svg` | Perrito y gatito, sin fondo |

`index.html` y `styles.css` ya traen los cambios de los zips anteriores, así que puedes reemplazarlos sin perder nada.

## Cómo cambiar textos, botones o imágenes
En `index.html` busca `<article class="hc-slide`. Cada `article` es una diapositiva:
- `hc-sub`: texto chiquito de arriba
- `hc-titulo`: título grande (`<br>` = salto de línea)
- `hc-boton`: el `href` es a dónde lleva el botón
- `<img src="...">`: la imagen

Para usar una **foto real** como la del ejemplo, quítale el fondo (por ejemplo con remove.bg o Canva), guárdala como **PNG** en `Imagenes/Mascotas/` y pon su nombre en el `src`.

Para agregar o quitar diapositivas, copia o borra un `article` completo y agrega o quita un `<button class="hc-punto">` abajo, para que haya uno por diapositiva.

## Colores
Están arriba de la sección `.hero-carrusel` en `styles.css`: `--hc-fondo`, `--hc-boton`, `--hc-titulo`, etc.
