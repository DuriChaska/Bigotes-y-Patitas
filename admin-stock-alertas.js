// ============================================
//  Bigotes y Patitas - admin-stock-alertas.js
//  Banner reutilizable de "stock bajo" para las páginas
//  del panel SCM. Cada página YA escucha scm_productos en
//  tiempo real para lo suyo; solo hay que pasarle la lista
//  de productos aquí cada vez que cambie.
//  Requiere admin-icons.js cargado antes (bpIcon), igual
//  que el resto del panel.
// ============================================

function productosStockBajo(productos) {
  return (productos || []).filter(p => Number(p.stock) <= Number(p.stockMin));
}

/**
 * Pinta (o quita, si ya no hace falta) el banner de stock bajo.
 * - productos: arreglo completo de scm_productos (se filtra aquí adentro).
 * - antesDeId: id del elemento antes del cual se inserta el banner (normalmente
 *   el primer panel de la página). Si no existe, se agrega al inicio de <main>.
 */
export function pintarBannerStockBajo(productos, antesDeId) {
  const bajos = productosStockBajo(productos);
  let banner = document.getElementById('bannerStockBajo');

  if (bajos.length === 0) {
    if (banner) banner.remove();
    return;
  }

  const nombres = bajos.slice(0, 6).map(p => p.nombre).join(', ');
  const resto = bajos.length > 6 ? ` y ${bajos.length - 6} más` : '';

  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'bannerStockBajo';
    banner.className = 'admin-alert-stock';

    const referencia = antesDeId ? document.getElementById(antesDeId) : null;
    if (referencia && referencia.parentNode) {
      referencia.parentNode.insertBefore(banner, referencia);
    } else {
      const main = document.querySelector('.admin-main');
      if (main) main.insertBefore(banner, main.firstChild);
    }
  }

  banner.innerHTML = `
    <span class="admin-alert-stock-icon">${typeof bpIcon === 'function' ? bpIcon('warning') : '⚠️'}</span>
    <div>
      <strong>${bajos.length} producto${bajos.length === 1 ? '' : 's'} con stock bajo</strong>
      <span>${nombres}${resto}</span>
    </div>
  `;
}
