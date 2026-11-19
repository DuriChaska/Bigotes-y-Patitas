# Página de inicio: banner carrusel + "Productos destacados"

Este zip incluye todo lo del banner (zip anterior) más la sección nueva. Reemplaza los archivos sin miedo.

## Archivos
| Archivo | Qué cambió |
|---|---|
| `index.html` | Banner carrusel arriba; "Diseños populares" ahora son dos secciones: **Para ellas** y **Para ellos** |
| `styles.css` | Estilos del carrusel y de los destacados (al final del archivo) |
| `hero-carrusel.js` | Movimiento del banner |
| `admin-scm-productos.html` | En el formulario de producto hay 2 campos nuevos (ver abajo) |
| `Imagenes/Mascotas/hero-*.svg` | Dibujos del banner |
| `Imagenes/Mascotas/sinfondo/` | Las imágenes de ejemplo de productos, pero sin el cuadro de color, para que se vean "flotando" como en tu referencia |

## Cómo elegir qué sale en cada sección
En el panel: **SCM → Productos → editar (lápiz)**. Hay 2 campos nuevos:
- **¿Para quién es?** → Para ellas / Para ellos / Para ambos
- **Mostrar en "Productos destacados"** → si lo marcas, sale de los primeros

Reglas:
- Cada sección muestra hasta 8 productos; se deslizan de lado con las flechas (o con el dedo en celular).
- Los marcados como destacados salen primero; los agotados al final.
- Los de "Para ambos" se reparten entre las dos secciones para que no se repitan.
- Los productos que todavía no tienen el dato se acomodan solos: si el nombre dice "gata", "vestido", "moño", "falda"… van a *Para ellas*; los demás se reparten.

## Fotos
Se ven mejor con **fotos de la prenda sin fondo o con fondo blanco** (como en tu ejemplo). Pon la URL o ruta en "Imagen del producto".

No se cambiaron las reglas de Firebase: los campos nuevos ya están permitidos.
