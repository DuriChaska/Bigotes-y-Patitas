// ============================================
//  Bigotes y Patitas - guia-tallas.js
//  Guía de tallas de la tienda (medidas promedio, sin marcas) y la
//  recomendación de talla de ropa por largo de espalda y peso.
//  La usa Producto.html (botones "Guía de tallas" y "¿Cuál es la talla correcta?").
// ============================================

// Cada pestaña tiene una o más tablas. Las medidas son aproximadas.
export const GUIA_TALLAS = [
  {
    id: 'ropa', nombre: 'Ropa',
    tablas: [{
      titulo: 'Suéteres, chamarras, sudaderas, chalecos y playeras',
      columnas: ['Talla', 'Peso', 'Largo de espalda (A)', 'Ancho de pecho (B)', 'Razas de ejemplo'],
      filas: [
        ['XX-Chico', '1.8 a 3.6 kg', '22 a 27 cm', '20 a 27 cm', 'Chihuahua, Poodle toy'],
        ['X-Chico', '2.7 a 4.5 kg', '27 a 33 cm', '27 a 40 cm', 'Maltés, Pomerania, Yorkshire'],
        ['Chico', '4.5 a 7 kg', '33 a 38 cm', '33 a 43 cm', 'Jack Russell, Pequinés, Pug'],
        ['Mediano', '7 a 12 kg', '38 a 43 cm', '40 a 48 cm', 'Beagle, Cocker Spaniel, Westie'],
        ['Grande', '12 a 20 kg', '43 a 48 cm', '48 a 58 cm', 'Pastor Australiano, Bulldog, Schnauzer'],
        ['X-Grande', '20 a 29 kg', '48 a 55 cm', '58 a 66 cm', 'Bóxer, Collie'],
        ['XX-Grande', '23 a 32 kg', '55 a 63 cm', '60 a 71 cm', 'Labrador, Golden, Husky'],
        ['XXX-Grande', '27 a 38 kg', '63 a 68 cm', '63 a 71 cm', 'Pastor Alemán, Dóberman, Rottweiler'],
      ],
    }],
  },
  {
    id: 'arneses', nombre: 'Arneses',
    tablas: [{
      titulo: 'Arneses (pecho y cuello)',
      columnas: ['Talla', 'Peso máximo', 'Ancho de pecho (B)', 'Ancho de cuello (C)'],
      filas: [
        ['X-Chico', '4 kg', '30 a 45 cm', '25 a 33 cm'],
        ['Chico', '7 kg', '36 a 55 cm', '33 a 40 cm'],
        ['Mediano', '13 kg', '45 a 65 cm', '36 a 45 cm'],
        ['Grande', '25 kg', '55 a 80 cm', '41 a 55 cm'],
        ['X-Grande', '40 kg', '70 a 95 cm', '50 a 70 cm'],
      ],
    }],
  },
  {
    id: 'collares', nombre: 'Collares',
    tablas: [{
      titulo: 'Collares de broche o hebilla',
      columnas: ['Talla', 'Peso', 'Ancho de cuello (C)'],
      filas: [
        ['XX-Chico', 'Hasta 3.5 kg', '15 a 20 cm'],
        ['X-Chico', '2.5 a 4.5 kg', '20 a 28 cm'],
        ['Chico', '4.5 a 7 kg', '25 a 35 cm'],
        ['Mediano', '7 a 12 kg', '35 a 46 cm'],
        ['Grande', '12 a 25 kg', '41 a 56 cm'],
        ['X-Grande', '25 a 40 kg', '51 a 66 cm'],
        ['XX-Grande', 'Más de 40 kg', '60 a 76 cm'],
      ],
    }],
  },
  {
    id: 'botas', nombre: 'Botas y calcetines',
    tablas: [{
      titulo: 'Botas y calcetines',
      columnas: ['Talla', 'Largo de pata (D)', 'Ancho de pata (E)'],
      filas: [
        ['XX-Chico', 'Hasta 3 cm', 'Hasta 3 cm'],
        ['X-Chico', '3 a 4 cm', '3 a 3.5 cm'],
        ['Chico', '4 a 5.5 cm', '3.5 a 4.8 cm'],
        ['Mediano', '5.5 a 6.5 cm', '4.8 a 6 cm'],
        ['Grande', '6.5 a 8 cm', '6 a 7.5 cm'],
        ['X-Grande', 'Más de 8 cm', 'Más de 7.5 cm'],
      ],
    }],
  },
  {
    id: 'accesorios', nombre: 'Accesorios',
    tablas: [
      { titulo: 'Bandanas, pañoletas y bufandas', columnas: ['Talla', 'Ancho de cuello (C)'],
        filas: [['X-Chico / Chico', '20 a 30 cm'], ['Chico / Mediano', '30 a 40 cm'], ['Mediano / Grande', '40 a 48 cm'], ['Grande / X-Grande', '48 a 58 cm']] },
      { titulo: 'Gorras y sombreros', columnas: ['Talla', 'Contorno de cabeza'],
        filas: [['X-Chico / Chico', '23 a 33 cm'], ['Chico / Mediano', '30 a 41 cm'], ['Grande / X-Grande', '41 a 51 cm']] },
      { titulo: 'Mochilas', columnas: ['Talla', 'Contorno detrás de las patas delanteras'],
        filas: [['X-Chico / Chico', '32 a 46 cm'], ['Chico / Mediano', '41 a 57 cm'], ['Grande / X-Grande', '48 a 79 cm']] },
      { titulo: 'Collares de adorno (gatos y perritos mini)', columnas: ['Talla', 'Ancho de cuello (C)'],
        filas: [['X-Chico / Chico', '11 a 19 cm'], ['Chico / Mediano', '16 a 22 cm'], ['Grande / X-Grande', '22 a 27 cm']] },
    ],
  },
];

// Talla de ropa: rangos numéricos para recomendar.
export const TALLAS_ROPA = [
  { talla: 'XX-Chico', espalda: [22, 27], peso: [1.8, 3.6] },
  { talla: 'X-Chico', espalda: [27, 33], peso: [2.7, 4.5] },
  { talla: 'Chico', espalda: [33, 38], peso: [4.5, 7] },
  { talla: 'Mediano', espalda: [38, 43], peso: [7, 12] },
  { talla: 'Grande', espalda: [43, 48], peso: [12, 20] },
  { talla: 'X-Grande', espalda: [48, 55], peso: [20, 29] },
  { talla: 'XX-Grande', espalda: [55, 63], peso: [23, 32] },
  { talla: 'XXX-Grande', espalda: [63, 68], peso: [27, 38] },
];

/** Qué pestaña abrir según el producto. */
export function pestanaDeProducto(p) {
  const t = `${p?.nombre || ''} ${p?.categoria || ''}`.toLowerCase();
  if (/arn[eé]s/.test(t)) return 'arneses';
  if (/collar/.test(t)) return 'collares';
  if (/bota|calcet/.test(t)) return 'botas';
  if (/bandana|pa[ñn]oleta|bufanda|gorr|sombrero|mochila|mo[ñn]o/.test(t)) return 'accesorios';
  return 'ropa';
}

/**
 * Recomienda talla de ropa. espalda en cm (obligatoria), peso en kg (opcional).
 * Devuelve { tallas: [...], nota } (tallas vacío si la medida está fuera de la tabla).
 */
export function recomendarTallaRopa(espalda, peso) {
  const dentro = (v, [a, b]) => v >= a && v <= b;
  let tallas = TALLAS_ROPA.filter((t) => dentro(espalda, t.espalda));
  if (!tallas.length) {
    if (espalda < TALLAS_ROPA[0].espalda[0]) return { tallas: [], nota: 'chica' };
    if (espalda > TALLAS_ROPA.at(-1).espalda[1]) return { tallas: [], nota: 'grande' };
  }
  // Si queda justo en el límite entre dos tallas, se recomienda la más grande.
  if (tallas.length > 1) tallas = [tallas.at(-1)];
  let nota = '';
  if (peso > 0 && tallas.length) {
    const porPeso = TALLAS_ROPA.filter((t) => dentro(peso, t.peso));
    const i = TALLAS_ROPA.indexOf(tallas[0]);
    const mayor = porPeso.length ? TALLAS_ROPA.indexOf(porPeso.at(-1)) : -1;
    if (mayor > i) { tallas = [TALLAS_ROPA[i], TALLAS_ROPA[i + 1]].filter(Boolean); nota = 'peso'; }
  }
  return { tallas: tallas.map((t) => t.talla), nota };
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Pinta las pestañas y tablas dentro de los contenedores dados. */
export function pintarGuia(contTabs, contTablas, activa) {
  contTabs.innerHTML = GUIA_TALLAS.map((g) =>
    `<button type="button" role="tab" data-guia="${g.id}" class="${g.id === activa ? 'activa' : ''}" aria-selected="${g.id === activa}">${esc(g.nombre)}</button>`).join('');
  const g = GUIA_TALLAS.find((x) => x.id === activa) || GUIA_TALLAS[0];
  contTablas.innerHTML = g.tablas.map((t) => `
    <h4 class="gt-titulo">${esc(t.titulo)}</h4>
    <div class="gt-tabla-caja"><table class="gt-tabla">
      <thead><tr>${t.columnas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${t.filas.map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`).join('');
}
