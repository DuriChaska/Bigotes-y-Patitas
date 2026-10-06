// ============================================
//  Bigotes y Patitas - scm-config.js
//  Configuración y datos de ejemplo del módulo SCM
//  (cadena de suministros). Lo usan las páginas
//  admin-scm-productos.html y admin-scm-proveedores.html.
//
//  Las categorías son las mismas 4 que se ven en la
//  página de inicio (sección "Categorías"): Perros, Gatos,
//  Accesorios y Ediciones limitadas.
//
//  Cada producto tiene "costo" (lo que cuesta producirlo/comprarlo,
//  uso interno de la cadena de suministros) Y "precio" (lo que le
//  cobramos al cliente en la tienda). Son cosas distintas a propósito.
//
//  Edita aquí las categorías o los datos de ejemplo:
//  no hace falta tocar las páginas.
// ============================================

export const CATEGORIAS = ['Perros', 'Gatos', 'Accesorios', 'Ediciones limitadas'];

// Botón "Cargar proveedores de ejemplo"
export const EJEMPLOS_PROVEEDORES = [
  { nombre: 'PerrTex Confecciones', contacto: 'Laura Gómez',   correo: 'laura@perrtex.com',           telefono: '55 1122 3344', direccion: 'Av. Reforma #210, Ciudad de México' },
  { nombre: 'Michu Moda Felina',    contacto: 'Diego Ramírez', correo: 'diego@michumoda.com',         telefono: '55 5566 7788', direccion: 'Calle Morelos #58, Guadalajara' },
  { nombre: 'Bigotes Accesorios',   contacto: 'Sofía Herrera', correo: 'sofia@bigotesaccesorios.com', telefono: '55 9900 1122', direccion: 'Blvd. Independencia #34, Monterrey' },
  { nombre: 'Ediciones Patitas',    contacto: 'Renata Cruz',   correo: 'renata@edicionespatitas.com', telefono: '55 3344 5566', direccion: 'Av. Juárez #77, Puebla' },
];

// Botón "Cargar productos de ejemplo". "proveedor" es el NOMBRE de un proveedor de arriba;
// al cargar se convierte al id real del proveedor. Las imágenes ya están en el proyecto
// (Imagenes/Mascotas/), no dependen de internet.
export const EJEMPLOS_PRODUCTOS = [
  { nombre: 'Chamarra para perro', categoria: 'Perros', stock: 20, stockMin: 8, estrategia: 'PUSH', costo: 320, precio: 499, proveedor: 'PerrTex Confecciones',
    descripcion: 'Chamarra acolchada e impermeable para pasear con tu perro en días fríos.',
    img: 'Imagenes/Mascotas/prod-chamarra-perro.svg' },
  { nombre: 'Hoodie para perro', categoria: 'Perros', stock: 15, stockMin: 6, estrategia: 'PUSH', costo: 280, precio: 439, proveedor: 'PerrTex Confecciones',
    descripcion: 'Sudadera con capucha, suave y cómoda, para perros de cualquier tamaño.',
    img: 'Imagenes/Mascotas/prod-hoodie-perro.svg' },
  { nombre: 'Impermeable para perro', categoria: 'Perros', stock: 10, stockMin: 5, estrategia: 'PULL', costo: 260, precio: 399, proveedor: 'PerrTex Confecciones',
    descripcion: 'Capa impermeable ligera, ideal para los días de lluvia.',
    img: 'Imagenes/Mascotas/prod-impermeable-perro.svg' },
  { nombre: 'Playera para perro', categoria: 'Perros', stock: 25, stockMin: 10, estrategia: 'PUSH', costo: 180, precio: 289, proveedor: 'PerrTex Confecciones',
    descripcion: 'Playera de algodón fresca para el día a día.',
    img: 'Imagenes/Mascotas/prod-playera-perro.svg' },
  { nombre: 'Suéter para perro', categoria: 'Perros', stock: 12, stockMin: 6, estrategia: 'PULL', costo: 240, precio: 379, proveedor: 'PerrTex Confecciones',
    descripcion: 'Suéter tejido para mantener a tu perro abrigado.',
    img: 'Imagenes/Mascotas/prod-sueter-perro.svg' },
  { nombre: 'Gorro para gato', categoria: 'Gatos', stock: 18, stockMin: 8, estrategia: 'PUSH', costo: 150, precio: 239, proveedor: 'Michu Moda Felina',
    descripcion: 'Gorro tejido a mano, cómodo y adorable.',
    img: 'Imagenes/Mascotas/prod-gorro-gato.svg' },
  { nombre: 'Moño decorativo para gato', categoria: 'Accesorios', stock: 14, stockMin: 6, estrategia: 'PULL', costo: 60, precio: 99, proveedor: 'Bigotes Accesorios',
    descripcion: 'Accesorio elegante y liviano, perfecto para ocasiones especiales o fotos.',
    img: 'Imagenes/Mascotas/prod-mono-gato.svg' },
  { nombre: 'Vestido para gata', categoria: 'Gatos', stock: 9, stockMin: 5, estrategia: 'PULL', costo: 260, precio: 399, proveedor: 'Michu Moda Felina',
    descripcion: 'Vestido con moño, perfecto para ocasiones especiales.',
    img: 'Imagenes/Mascotas/prod-vestido-gata.svg' },
  { nombre: 'Arnés para perro', categoria: 'Accesorios', stock: 30, stockMin: 12, estrategia: 'PUSH', costo: 190, precio: 299, proveedor: 'Bigotes Accesorios',
    descripcion: 'Arnés ajustable y reflectante para paseos seguros.',
    img: 'Imagenes/Mascotas/prod-arnes-perro.svg' },
  { nombre: 'Collar para gato', categoria: 'Accesorios', stock: 28, stockMin: 12, estrategia: 'PUSH', costo: 90, precio: 149, proveedor: 'Bigotes Accesorios',
    descripcion: 'Collar ligero con cascabel, seguro y ajustable.',
    img: 'Imagenes/Mascotas/prod-collar-gato.svg' },
  { nombre: 'Pañoleta para gato', categoria: 'Accesorios', stock: 22, stockMin: 10, estrategia: 'PULL', costo: 80, precio: 129, proveedor: 'Bigotes Accesorios',
    descripcion: 'Pañoleta estampada para darle un toque de estilo.',
    img: 'Imagenes/Mascotas/prod-panoleta-gato.svg' },
  { nombre: 'Disfraz para perro', categoria: 'Ediciones limitadas', stock: 6, stockMin: 4, estrategia: 'PULL', costo: 350, precio: 549, proveedor: 'Ediciones Patitas',
    descripcion: 'Disfraz de temporada, edición limitada mientras dura el stock.',
    img: 'Imagenes/Mascotas/prod-disfraz-perro.svg' },
];
