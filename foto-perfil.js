// ============================================
//  Bigotes y Patitas - foto-perfil.js  (Etapa 4)
//  Foto de perfil del cliente:
//   - Sin foto se ve el ícono genérico de perfil (silueta), nunca una foto fija.
//   - "Cambiar foto": el cliente elige una imagen; aquí se recorta en cuadro, se reduce a
//     256×256 y se guarda en Firebase (fotos_perfil/{uid}).
//   - "Quitar foto": vuelve al ícono genérico (con confirmación).
//  Se usa en el Perfil y en "Mis datos" con montarFotoPerfil(...).
// ============================================

import { escucharFotoPerfil, guardarFotoPerfil, quitarFotoPerfil } from './firebase-db.js';

/** Ícono genérico de perfil (silueta) para cuando el cliente no ha subido foto. */
export const ICONO_PERFIL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
  + '<rect width="100" height="100" fill="#efe4d6"/>'
  + '<circle cx="50" cy="38" r="18" fill="#b9a48f"/>'
  + '<path d="M16 92c3-20 18-31 34-31s31 11 34 31z" fill="#b9a48f"/>'
  + '</svg>');

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_MB = 8;

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen. Prueba con otra (JPG o PNG).')); };
    img.src = url;
  });
}

/**
 * Recorta la imagen al centro en cuadro y la reduce a 256×256 JPEG.
 * Devuelve el texto "data:image/jpeg;base64,..." (normalmente 20-60 KB).
 */
export async function reducirFoto(archivo, lado = 256) {
  if (!archivo) throw new Error('No elegiste ninguna imagen.');
  if (!TIPOS.includes(archivo.type)) throw new Error('El archivo debe ser una imagen JPG, PNG, WEBP o GIF.');
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`La imagen pesa más de ${MAX_MB} MB. Elige una más ligera.`);
  const img = await cargarImagen(archivo);
  const corte = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - corte) / 2;
  const sy = (img.naturalHeight - corte) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';                  // fondo blanco para PNG con transparencia
  ctx.fillRect(0, 0, lado, lado);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, corte, corte, 0, 0, lado, lado);
  // Baja la calidad si hiciera falta para no pasar de ~150 KB.
  for (const calidad of [0.85, 0.75, 0.6, 0.45]) {
    const dataUrl = canvas.toDataURL('image/jpeg', calidad);
    if (dataUrl.length <= 150000) return dataUrl;
  }
  throw new Error('No se pudo reducir la imagen lo suficiente. Prueba con otra.');
}

const avisar = (texto, tipo) => (window.bpNotificar ? window.bpNotificar(texto, tipo) : null);
const alerta = (texto, opciones) => (window.bpAlerta ? window.bpAlerta(texto, opciones) : Promise.resolve());

/**
 * Conecta la foto de perfil a la pantalla.
 *  img          <img> donde se muestra la foto (o el ícono genérico)
 *  btnCambiar   botón "Cambiar foto"
 *  btnQuitar    botón "Quitar foto" (se oculta si no hay foto)
 *  uid          cliente con sesión
 */
export function montarFotoPerfil({ img, btnCambiar, btnQuitar, uid }) {
  let fotoActual = '';
  img.src = ICONO_PERFIL;
  img.alt = 'Foto de perfil';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = TIPOS.join(',');
  input.hidden = true;
  document.body.appendChild(input);

  function pintar(foto) {
    fotoActual = foto || '';
    img.src = fotoActual || ICONO_PERFIL;
    img.classList.toggle('sin-foto', !fotoActual);
    if (btnQuitar) btnQuitar.style.display = fotoActual ? '' : 'none';
    if (btnCambiar) btnCambiar.textContent = fotoActual ? '📷 Cambiar foto' : '📷 Agregar foto';
  }
  pintar('');

  escucharFotoPerfil(uid, pintar, () => avisar('No se pudo cargar tu foto de perfil.', 'error'));

  btnCambiar?.addEventListener('click', () => { input.value = ''; input.click(); });
  img.addEventListener('click', () => { input.value = ''; input.click(); });

  input.addEventListener('change', async () => {
    const archivo = input.files && input.files[0];
    if (!archivo) return;
    const anterior = fotoActual;
    if (btnCambiar) { btnCambiar.disabled = true; btnCambiar.textContent = 'Subiendo…'; }
    try {
      const dataUrl = await reducirFoto(archivo);
      img.src = dataUrl;                      // se ve de inmediato mientras se guarda
      await guardarFotoPerfil(uid, dataUrl);
      avisar('Tu foto de perfil se actualizó.', 'ok');
    } catch (err) {
      pintar(anterior);
      await alerta(err.code === 'permission-denied'
        ? 'Firebase no dejó guardar la foto (falta publicar las reglas actualizadas).'
        : (err.message || 'No se pudo guardar la foto. Revisa tu conexión.'), { tipo: 'error', titulo: 'No se guardó la foto' });
    } finally {
      if (btnCambiar) btnCambiar.disabled = false;
      pintar(img.src.startsWith('data:image/jpeg') ? img.src : anterior);
    }
  });

  btnQuitar?.addEventListener('click', async () => {
    const ok = window.bpConfirmar
      ? await window.bpConfirmar('¿Quitar tu foto de perfil? Se mostrará el ícono genérico.', { titulo: 'Quitar foto', aceptar: 'Quitar foto', peligro: true })
      : true;
    if (!ok) return;
    try {
      await quitarFotoPerfil(uid);
      avisar('Quitaste tu foto de perfil.', 'ok');
    } catch {
      await alerta('No se pudo quitar la foto. Revisa tu conexión.', { tipo: 'error' });
    }
  });
}
