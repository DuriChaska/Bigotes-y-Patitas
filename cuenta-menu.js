// ============================================
//  Bigotes y Patitas - cuenta-menu.js
//  Menú lateral de "Mi cuenta" (lado del cliente), compartido por
//  todas las pantallas de la cuenta. Cada pantalla lo usa así:
//
//    <aside class="cta-menu" id="cuenta-menu"></aside>
//    <script src="cuenta-menu.js"></script>
//    <script> pintarMenuCuenta('atencion'); </script>
//
//  Para sumar una pantalla nueva (p. ej. Mi monedero o Direcciones) basta con
//  ponerle su "href" a la opción correspondiente en ITEMS_CUENTA: mientras
//  una opción no tenga "href" se muestra apagada con la etiqueta "Pronto".
//  El número verde junto a "Atención a clientes" son las respuestas de soporte sin leer.
// ============================================

const ITEMS_CUENTA = [
  { id: 'cuenta',      label: 'Mi cuenta',           icono: '👤', href: 'Interfaz Cliente - Perfil.html' },
  { id: 'pedidos',     label: 'Mis pedidos',         icono: '📦', href: 'Interfaz Cliente - Perfil.html#pedidos' },
  { id: 'monedero',    label: 'Mi monedero',         icono: '👛', href: null },   // pendiente (integrante 2)
  { id: 'datos',       label: 'Mis datos',           icono: '🪪', href: null },   // pendiente (integrante 2)
  { id: 'direcciones', label: 'Direcciones',         icono: '📍', href: null },   // pendiente (integrante 2)
  { id: 'atencion',    label: 'Atención a clientes', icono: '🎧', href: 'atencion-clientes.html' },
];

/** Dibuja el menú. activo = id de la opción actual; sinLeer = respuestas de soporte sin leer. */
function pintarMenuCuenta(activo, sinLeer) {
  const el = document.getElementById('cuenta-menu');
  if (!el) return;
  const opciones = ITEMS_CUENTA.map((it) => {
    if (!it.href) {
      return `<span class="cta-off" title="Disponible pronto"><span>${it.icono} ${it.label}</span><small>Pronto</small></span>`;
    }
    const badge = it.id === 'atencion' && sinLeer > 0 ? `<span class="cta-badge">${sinLeer}</span>` : '';
    return `<a href="${it.href}" class="${it.id === activo ? 'active' : ''}"><span>${it.icono} ${it.label}</span>${badge}</a>`;
  }).join('');
  el.innerHTML = `<h4>Mi cuenta</h4>${opciones}<a href="#" class="cta-salir" onclick="cerrarSesionClientePublico(event)"><span>🚪 Cerrar sesión</span></a>`;
}
