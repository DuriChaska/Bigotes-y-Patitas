// ============================================
//  Bigotes y Patitas - scm-config.js
//  Configuración y datos de ejemplo del módulo SCM
//  (cadena de suministros). Lo usan las páginas
//  admin-scm-productos.html y admin-scm-proveedores.html.
//
//  Edita aquí las categorías o los datos de ejemplo:
//  no hace falta tocar las páginas.
// ============================================

export const CATEGORIAS = ['Cerámica', 'Textil', 'Decoración', 'Joyería'];

// Botón "Cargar proveedores de ejemplo"
export const EJEMPLOS_PROVEEDORES = [
  { nombre: 'Artesanías del Sur',   contacto: 'Juan Pérez',  correo: 'juan@sur.com',       telefono: '55 1234 5678', direccion: 'Av. Hidalgo #120, Oaxaca Centro' },
  { nombre: 'Textiles Oaxaqueños',  contacto: 'María López', correo: 'maria@oax.com',      telefono: '55 8765 4321', direccion: 'Calle Independencia #45, San Cristóbal' },
  { nombre: 'Barro y Tradición',    contacto: 'Carlos Ruiz', correo: 'carlos@barro.com',   telefono: '55 2222 3333', direccion: 'Camino Real #8, San Bartolo Coyotepec' },
  { nombre: 'Alebrijes García',     contacto: 'Ana Torres',  correo: 'ana@alebrijes.com',  telefono: '55 4444 5555', direccion: 'Plaza Principal #12, San Martín Tilcajete' },
];

// Botón "Cargar productos de ejemplo". "proveedor" es el NOMBRE de un proveedor de arriba;
// al cargar se convierte al id real del proveedor.
export const EJEMPLOS_PRODUCTOS = [
  { nombre: 'Vasija de barro',   categoria: 'Cerámica',   stock: 25, stockMin: 10, estrategia: 'PUSH', costo: 120, proveedor: 'Barro y Tradición',
    descripcion: 'Vasija artesanal de barro negro modelada a mano.',
    img: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=100&auto=format&fit=crop&q=80' },
  { nombre: 'Textil bordado',    categoria: 'Textil',     stock: 12, stockMin: 10, estrategia: 'PULL', costo: 450, proveedor: 'Textiles Oaxaqueños',
    descripcion: 'Huipil con bordados tradicionales hechos en telar de cintura.',
    img: 'https://images.unsplash.com/photo-1606760227091-3dd850d97f1d?w=100&auto=format&fit=crop&q=80' },
  { nombre: 'Alebrije',          categoria: 'Decoración', stock: 8,  stockMin: 5,  estrategia: 'PUSH', costo: 380, proveedor: 'Alebrijes García',
    descripcion: 'Figura fantástica de madera de copal pintada a mano.',
    img: 'https://images.unsplash.com/photo-1569172122301-bc5008bc09c5?w=100&auto=format&fit=crop&q=80' },
  { nombre: 'Collar artesanal',  categoria: 'Joyería',    stock: 30, stockMin: 15, estrategia: 'PULL', costo: 210, proveedor: 'Artesanías del Sur',
    descripcion: 'Collar elaborado con cuentas de ámbar de Simojovel y plata.',
    img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=100&auto=format&fit=crop&q=80' },
];
