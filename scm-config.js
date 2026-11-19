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

// Colección Otoño-Invierno (fotos reales en Imagenes/Productos/).
// Se agregan desde el panel: SCM → Productos → "Agregar colección Otoño-Invierno".
// Solo se crean las que todavía no existen (se comparan por nombre).
const INTRO_OTONO = 'El otoño ya llegó y también el momento de renovar el guardarropa de tu mejor amigo. ' +
  'La colección Fall Apparel cuenta con suéteres, chamarras, sudaderas, chalecos y accesorios únicos, como gorras, ' +
  'sombreros, bandanas y lentes, para que disfruten de esta temporada con mucho estilo. Porque no hay nada mejor que ' +
  'salir a pasear entre hojas secas, sentir el aire fresco y crear recuerdos juntos con el outfit perfecto.';

const fotos = (slug, n) => Array.from({ length: n }, (_, i) => `Imagenes/Productos/${slug}-${i + 1}.jpg`);

export const COLECCION_OTONO = [
  {
    nombre: 'Petco Fall Apparel Chaleco Modelo Polar Beige para Perro, Mediano',
    marca: 'Petco', talla: 'Mediano', categoria: 'Perros', paraQuien: 'Ellos', destacado: true,
    stock: 15, stockMin: 5, estrategia: 'PUSH', costo: 270, precio: 449,
    descripcion: INTRO_OTONO,
    beneficios: [
      'Cierres de velcro que permiten ponerlo y quitarlo fácilmente.',
      'El chaleco se abre por completo para facilitar su colocación.',
      'Pequeña abertura en la parte superior para pasar la correa del arnés.',
      'Resorte en la parte media que permite un mejor ajuste.',
      'Se ajusta a perros con un largo de espalda de 41 a 46 cm.',
      'Recomendado para perros de razas pequeñas y medianas.',
    ],
    imagenes: fotos('chaleco-polar-beige', 6),
  },
  {
    nombre: 'Petco Fall Apparel Chamarra Rosa Modelo Borrego para Perro, Grande',
    marca: 'Petco', talla: 'Grande', categoria: 'Perros', paraQuien: 'Ellas', destacado: true,
    stock: 12, stockMin: 4, estrategia: 'PUSH', costo: 360, precio: 599,
    descripcion: INTRO_OTONO,
    beneficios: [
      'Fácil de colocar y quitar gracias a su cierre de cremallera.',
      'Cuenta con bolsas laterales decorativas.',
      'Exterior tipo borrega que lo hace más cómodo y suave.',
      'Se ajusta a perros con un largo de espalda de 43 a 48 cm.',
      'Recomendado para perros de razas medianas.',
    ],
    imagenes: fotos('chamarra-borrego-rosa', 4),
  },
  {
    nombre: 'Petco Fall Apparel Suéter Tejido Rojo con Moños Rosas para Perro, Chico',
    marca: 'Petco', talla: 'Chico', categoria: 'Perros', paraQuien: 'Ellas', destacado: true,
    stock: 18, stockMin: 5, estrategia: 'PUSH', costo: 240, precio: 399,
    descripcion: INTRO_OTONO,
    beneficios: [
      'Suéter tejido color rojo con moños rosas.',
      'Pequeña abertura en la parte superior para pasar la correa al arnés.',
      'Se ajusta a perros con un largo de espalda de 33 a 38 cm.',
      'Recomendado para perros de razas pequeñas.',
    ],
    imagenes: fotos('sueter-rojo-monos', 4),
  },
  {
    nombre: 'Petco Fall Apparel Suéter Tejido Blanco con Moño de Lentejuela para Perro, Mediano',
    marca: 'Petco', talla: 'Mediano', categoria: 'Perros', paraQuien: 'Ellas', destacado: true,
    stock: 15, stockMin: 5, estrategia: 'PUSH', costo: 300, precio: 499,
    descripcion: INTRO_OTONO,
    beneficios: [
      'Suéter tejido con moño bordado de lentejuela.',
      'Pequeña abertura en la parte superior para pasar la correa al arnés.',
      'Se ajusta a perros con un largo de espalda de 41 a 46 cm.',
      'Recomendado para perros de razas pequeñas y medianas.',
    ],
    imagenes: fotos('sueter-blanco-lentejuela', 3),
  },
].map((p) => ({ ...p, img: p.imagenes[0], proveedor: '', proveedorId: '' }));

// Producto de la página "Carpeta" (colección exclusiva). Se agrega con el mismo botón del panel.
// carpeta: true → aparece en carpeta.html. Precio, stock y talla son de ejemplo: cámbialos en el panel.
export const COLECCION_CARPETA = [
  {
    nombre: 'Vestido Picnic de Cuadros Rojos con Moños para Perrita, Chico',
    marca: 'Bigotes y Patitas', talla: 'Chico', categoria: 'Ediciones limitadas', paraQuien: 'Ellas',
    destacado: true, carpeta: true,
    stock: 10, stockMin: 3, estrategia: 'PUSH', costo: 260, precio: 459,
    descripcion: 'Un vestido coqueto para los días de paseo y de picnic. Combina tela de cuadros rojos con blanco, ' +
      'holanes rojos y delicados detalles de encaje de florecitas, rematado con dos moños blancos en la cintura. ' +
      'Una pieza de edición limitada para que tu perrita sea la más elegante de la reunión.',
    beneficios: [
      'Tela de cuadros (vichy) rojo con blanco y holanes rojos en falda y mangas.',
      'Encaje blanco de florecitas en mangas y falda.',
      'Dos moños blancos decorativos en la cintura.',
      'Forro interior blanco, suave al contacto con su pelaje.',
      'Cierre de velcro en la panza para ponerlo y quitarlo fácilmente.',
      'Abertura en la espalda para pasar la correa del arnés.',
    ],
    imagenes: ['Imagenes/Productos/vestido-picnic-rojo-1.jpg', 'Imagenes/Productos/vestido-picnic-rojo-2.jpg'],
  },
].map((p) => ({ ...p, img: p.imagenes[0], proveedor: '', proveedorId: '' }));

// Todo lo que el botón del panel puede agregar
export const PRODUCTOS_DE_COLECCIONES = [...COLECCION_OTONO, ...COLECCION_CARPETA];
