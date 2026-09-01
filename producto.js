// =============================================
// producto.js - Detalle de producto dinámico
// =============================================

const productos = [
  {
    id: "blusa-amarilla-cruzada",
    nombre: "Blusa amarilla cruzada (manga larga)",
    precio: 399,
    precioFormatted: "$399 MXN",
    descripcion: "Blusa cruzada de manga larga con diseño fruncido al frente. Ideal para looks frescos y femeninos.",
    imagen: "Imagenes/PLAYERA ESTAMPADA TRAVIS SCOTT.png"
  },
  {
    id: "top-vino-acampanado",
    nombre: "Top vino manga larga acampanada",
    precio: 389,
    precioFormatted: "$389 MXN",
    descripcion: "Top ajustado en tono vino con mangas acampanadas, elegante y moderno.",
    imagen: "Imagenes/SUDADERA ESTAMPADA.png"
  },
  {
    id: "top-rojo-tirantes",
    nombre: "Top rojo con tirantes",
    precio: 299,
    precioFormatted: "$299 MXN",
    descripcion: "Top de tirantes con textura acanalada y diseño ajustado.",
    imagen: "Imagenes/Playera estampada jesus.png"
  },
  {
    id: "top-rosa-mono",
    nombre: "Top rosa con moño",
    precio: 249,
    precioFormatted: "$249 MXN",
    descripcion: "Top corto en tono rosa pastel con detalle de moño al frente.",
    imagen: "Imagenes/Playera estampada con flores.png"
  },
  {
    id: "top-rosa-strapless",
    nombre: "Top rosa strapless",
    precio: 269,
    precioFormatted: "$269 MXN",
    descripcion: "Top strapless con ajuste cómodo, ideal para climas cálidos.",
    imagen: "Imagenes/Playera de bruja feminista.png"
  },
  {
    id: "top-amarillo-tirantes",
    nombre: "Top amarillo con tirantes finos",
    precio: 289,
    precioFormatted: "$289 MXN",
    descripcion: "Top ligero con tirantes delgados y diseño fruncido.",
    imagen: "Imagenes/Playera Return of Misfits.png"
  },
  {
    id: "top-rosa-manga-larga",
    nombre: "Top rosa manga larga",
    precio: 319,
    precioFormatted: "$319 MXN",
    descripcion: "Top de manga larga en tono rosa suave.",
    imagen: "Imagenes/Playera de manga corta para hombre.png"
  },
  {
    id: "top-halter-brillante",
    nombre: "Top brillante cuello halter",
    precio: 349,
    precioFormatted: "$349 MXN",
    descripcion: "Top con acabado brillante y cuello halter.",
    imagen: "Imagenes/Playera Estampada Gatos.png"
  },
  {
    id: "blusa-blanca-vuelo",
    nombre: "Blusa blanca con tirantes y vuelo",
    precio: 379,
    precioFormatted: "$379 MXN",
    descripcion: "Blusa blanca con diseño romántico y fresco.",
    imagen: "Imagenes/playera estampada persona.png"
  }
];

// ──────────────────────────────────────────────
// 1. Leer ID desde la URL
// ──────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const productoId = params.get("id");

// ──────────────────────────────────────────────
// 2. Buscar el producto
// ──────────────────────────────────────────────
const producto = productos.find(p => p.id === productoId);

if (producto) {
  // Actualizar título de la página
  document.title = `Estampa-TLA - ${producto.nombre}`;

  // Llenar información principal
  document.getElementById("nombre-producto").textContent = producto.nombre;
  document.getElementById("precio-producto").textContent = producto.precioFormatted;
  document.getElementById("descripcion-producto").textContent = producto.descripcion;
  document.getElementById("imagen-producto").src = producto.imagen;
  document.getElementById("imagen-producto").alt = producto.nombre;

  // ──────────────────────────────────────────────
  // 3. Productos similares (4 aleatorios o primeros excluyendo el actual)
  // ──────────────────────────────────────────────
  const contenedor = document.getElementById("articulos-similares");
  contenedor.innerHTML = ""; // Limpiar por si acaso

  // Filtrar y tomar hasta 4
  const similares = productos
    .filter(p => p.id !== productoId)
    .sort(() => Math.random() - 0.5) // ← mezcla aleatoria (opcional)
    .slice(0, 4);

  similares.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card"; // usa la clase que ya tienes en CSS

    card.innerHTML = `
      <img src="${p.imagen}" alt="${p.nombre}">
      <h4>${p.nombre}</h4>
      <p class="price">${p.precioFormatted}</p>
      <button class="ver-detalles" 
              onclick="window.location.href='producto.html?id=${p.id}'">
        Ver detalles
      </button>
    `;

    contenedor.appendChild(card);
  });

} else {
  // Producto no encontrado
  const detalle = document.querySelector(".producto-detalle") || document.body;
  detalle.innerHTML = `
    <div style="text-align:center; padding: 4rem 1rem;">
      <h2>😥 Producto no encontrado</h2>
      <p>El producto que buscas no existe o el enlace está incorrecto.</p>
      <br>
      <button class="regresar" onclick="window.location.href='shop.html'">
        ← Volver al catálogo
      </button>
    </div>
  `;
}

// ──────────────────────────────────────────────
// 4. Funciones auxiliares (cantidad y carrito)
// ──────────────────────────────────────────────

function cambiarCantidad(delta) {
  const input = document.getElementById("cantidad");
  if (!input) return;

  let val = parseInt(input.value) || 1;
  val = Math.max(1, val + delta);
  input.value = val;
}

function obtenerCarrito() {
  return JSON.parse(localStorage.getItem("carrito") || "[]");
}

function guardarCarrito(carrito) {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

function agregarAlCarrito() {
  if (!producto) return;

  const cantidadInput = document.getElementById("cantidad");
  const cantidad = cantidadInput ? parseInt(cantidadInput.value) || 1 : 1;

  let carrito = obtenerCarrito();

  const existe = carrito.find(item => item.id === producto.id);
  if (existe) {
    existe.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      precioFormatted: producto.precioFormatted,
      imagen: producto.imagen,
      cantidad: cantidad
    });
  }

  guardarCarrito(carrito);

  // Feedback visual (puedes cambiar por un toast más bonito después)
  alert(`¡Agregado! ${cantidad} × ${producto.nombre} al carrito 🛒`);
}

// Para el botón "Comprar ahora"
function comprarAhora() {
  agregarAlCarrito();
  window.location.href = "carrito.html";
}