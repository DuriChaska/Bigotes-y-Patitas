# Guía de tallas nueva

Copia estos archivos a tu proyecto (reemplaza) y publica:
```powershell
firebase deploy --only hosting
```
(Incluye también el `firebase.json` del arreglo de caché, por si aún no lo pusiste.)

- **Guía de tallas** con 5 pestañas: Ropa, Arneses, Collares, Botas y calcetines, Accesorios. Medidas promedio, sin marcas.
  Abre sola en la pestaña que corresponde al producto (un collar abre "Collares", un arnés "Arneses", etc.).
- Abajo: **Tipos de medidas y cómo obtenerlas** (A espalda, B pecho, C cuello, D y E pata) con un dibujo propio.
- **¿Cuál es la talla correcta?** ahora pide largo de espalda y peso (opcional), y si la prenda trae en sus Beneficios
  "largo de espalda de X a Y cm", te dice si **esa prenda** le queda.
- Para cambiar medidas: edita las tablas en `guia-tallas.js` (`GUIA_TALLAS` y `TALLAS_ROPA`).
