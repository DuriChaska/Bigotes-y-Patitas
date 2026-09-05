// ============================================
//  Bigotes y Patitas - admin-icons.js
//  Íconos SVG en línea (sin dependencias externas)
//  para sustituir los emojis del panel de admin.
//  Uso: bpIcon('home')  -> devuelve el <svg> como texto
// ============================================

const ADMIN_ICONS = {
  home:        '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/>',
  users:       '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14c2.6.3 4.5 2.4 4.5 6"/>',
  chat:        '<path d="M4 5h16v11H8l-4 4z"/>',
  chart:       '<path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/><path d="M3 20h18"/>',
  clock:       '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  settings:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5c.1-.5.1-1 0-1.5l1.8-1.4-1.5-2.6-2.1.6a7.7 7.7 0 0 0-1.3-.8L16 5.5h-3l-.3 2.3c-.5.2-.9.5-1.3.8l-2.1-.6-1.5 2.6 1.8 1.4c-.1.5-.1 1 0 1.5l-1.8 1.4 1.5 2.6 2.1-.6c.4.3.8.6 1.3.8l.3 2.3h3l.3-2.3c.5-.2.9-.5 1.3-.8l2.1.6 1.5-2.6z"/>',
  logout:      '<path d="M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/>',
  search:      '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.3-4.3"/>',
  warning:     '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".2" fill="currentColor" stroke-width="1.6"/>',
  check:       '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5 5.5-6"/>',
  eye:         '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.7"/>',
  pencil:      '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5.5 16.5z"/><path d="m14.5 6 3.5 3.5"/>',
  trash:       '<path d="M5 7h14"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  phone:       '<path d="M6 3.5 9 4l1 3.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 3.5 1 .5 3a2 2 0 0 1-2 2.2A15.5 15.5 0 0 1 4 4.5 2 2 0 0 1 6 3.5z"/>',
  mail:        '<path d="M3.5 5.5h17v13h-17z"/><path d="m4 6 8 6.5L20 6"/>',
  group:       '<circle cx="8" cy="8" r="3"/><path d="M2.5 19.5c0-3 2.5-5.3 5.5-5.3s5.5 2.3 5.5 5.3"/><circle cx="17" cy="8.5" r="2.3"/><path d="M15.7 14.3c2.5.3 4.3 2.3 4.3 5.2"/>',
  plus:        '<path d="M12 5v14"/><path d="M5 12h14"/>',
  calendar:    '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 9.5h17"/><path d="M8 3v3.5"/><path d="M16 3v3.5"/>',
  paw:         '<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M12 12c-3.3 0-5.7 2.2-5.7 4.6 0 1.7 1.5 2.9 3.2 2.4a5 5 0 0 1 5 0c1.7.5 3.2-.7 3.2-2.4 0-2.4-2.4-4.6-5.7-4.6z"/>',
  hourglass:   '<path d="M6 3.5h12"/><path d="M6 20.5h12"/><path d="M7 3.5v3.2c0 1.6 5 4.3 5 5.3s-5 3.7-5 5.3v3.2"/><path d="M17 3.5v3.2c0 1.6-5 4.3-5 5.3s5 3.7 5 5.3v3.2"/>',
  arrow_left:  '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
};

function bpIcon(name, cls) {
  const body = ADMIN_ICONS[name] || '';
  return `<svg class="bp-icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

// Sustituye cualquier <span data-bp-icon="nombre"></span> ya presente en el HTML.
function pintarIconosBP() {
  document.querySelectorAll('[data-bp-icon]').forEach(el => {
    el.innerHTML = bpIcon(el.dataset.bpIcon);
  });
}
document.addEventListener('DOMContentLoaded', pintarIconosBP);
