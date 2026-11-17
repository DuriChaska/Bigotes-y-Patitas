// ============================================
//  Bigotes y Patitas - dialogos.js
//  Ventanas emergentes propias de la tienda y del panel. Reemplazan a las del
//  navegador (alert, confirm y prompt), que salen con el título "localhost dice"
//  y no se pueden adaptar al diseño.
//
//  Se carga con <script src="dialogos.js"></script> ANTES de los demás scripts
//  de la página. Todas devuelven una promesa, así que se usan con await:
//
//    await bpAlerta('Cupón aplicado correctamente.', { tipo: 'exito' });
//    if (!(await bpConfirmar('¿Vaciar tu carrito?', { peligro: true, aceptar: 'Vaciar' }))) return;
//    const correo = await bpPedirTexto('¿A qué correo te enviamos el recibo?', { valor: 'a@b.com', tipoCampo: 'email' });
//
//  tipo: 'info' (default) | 'exito' | 'error' | 'aviso' | 'pregunta'
//  Teclado: Enter = aceptar, Esc = cancelar. El foco regresa a donde estaba al cerrar.
// ============================================

(function () {
  if (window.bpConfirmar) return;   // ya cargado (p. ej. también importado por otro script)

  const ICONOS = { info: 'ℹ️', exito: '✅', error: '⚠️', aviso: '🔔', pregunta: '❓' };
  const TITULOS = { info: 'Aviso', exito: 'Listo', error: 'Algo salió mal', aviso: 'Importante', pregunta: 'Confirma' };

  const CSS = `
    .bpd-fondo { position: fixed; inset: 0; background: rgba(40, 28, 18, .45); display: flex; align-items: center;
      justify-content: center; padding: 18px; z-index: 100000; opacity: 0; transition: opacity .18s ease; }
    .bpd-fondo.bpd-visible { opacity: 1; }
    .bpd-caja { background: #fffaf4; color: #3d2c1e; width: min(440px, 100%); border-radius: 18px;
      box-shadow: 0 18px 50px rgba(40, 28, 18, .35); padding: 22px 22px 18px; font-family: "DM Sans", "Segoe UI", sans-serif;
      transform: translateY(10px) scale(.98); transition: transform .18s ease; border-top: 6px solid #d97b4f; }
    .bpd-visible .bpd-caja { transform: none; }
    .bpd-caja.bpd-error { border-top-color: #b3261e; }
    .bpd-caja.bpd-exito { border-top-color: #2f7a43; }
    .bpd-caja.bpd-aviso { border-top-color: #d9a43a; }
    .bpd-cabeza { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .bpd-icono { font-size: 1.5rem; line-height: 1; }
    .bpd-titulo { margin: 0; font-size: 1.08rem; font-weight: 700; color: #3d2c1e; }
    .bpd-texto { margin: 0; font-size: .95rem; line-height: 1.5; white-space: pre-line; color: #5a4636; }
    .bpd-campo { width: 100%; margin-top: 12px; padding: 10px 12px; border: 1px solid #e6dccb; border-radius: 10px;
      font: inherit; font-size: .95rem; background: #fff; color: #3d2c1e; box-sizing: border-box; }
    .bpd-campo:focus { outline: 2px solid #d97b4f; outline-offset: 1px; }
    .bpd-botones { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    .bpd-btn { border: 2px solid transparent; border-radius: 10px; padding: 9px 18px; font: inherit; font-weight: 700;
      font-size: .9rem; cursor: pointer; transition: filter .15s, background .15s; }
    .bpd-btn:focus-visible { outline: 3px solid #f2c4a8; outline-offset: 2px; }
    .bpd-aceptar { background: #d97b4f; color: #fff; }
    .bpd-aceptar:hover { filter: brightness(.95); }
    .bpd-aceptar.bpd-peligro { background: #b3261e; }
    .bpd-cancelar { background: #fff; color: #8a5a3c; border-color: #e6c9b4; }
    .bpd-cancelar:hover { background: #fbefe6; }
    @media (max-width: 480px) { .bpd-botones { flex-direction: column-reverse; } .bpd-btn { width: 100%; } }
  `;

  function asegurarEstilos() {
    if (document.getElementById('bpd-estilos')) return;
    const st = document.createElement('style');
    st.id = 'bpd-estilos';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // Si se piden dos ventanas a la vez, se muestran una después de otra.
  let cola = Promise.resolve();

  function abrir({ mensaje, titulo, tipo = 'info', aceptar = 'Aceptar', cancelar = null, peligro = false, campo = null }) {
    const tarea = cola.then(() => new Promise((resolver) => {
      asegurarEstilos();
      const anterior = document.activeElement;
      const fondo = document.createElement('div');
      fondo.className = 'bpd-fondo';
      fondo.innerHTML = `
        <div class="bpd-caja bpd-${tipo}" role="${cancelar ? 'alertdialog' : 'dialog'}" aria-modal="true" aria-labelledby="bpd-titulo" aria-describedby="bpd-texto">
          <div class="bpd-cabeza"><span class="bpd-icono" aria-hidden="true"></span><h2 class="bpd-titulo" id="bpd-titulo"></h2></div>
          <p class="bpd-texto" id="bpd-texto"></p>
          <div class="bpd-botones"></div>
        </div>`;
      fondo.querySelector('.bpd-icono').textContent = ICONOS[tipo] || ICONOS.info;
      fondo.querySelector('.bpd-titulo').textContent = titulo || TITULOS[tipo] || TITULOS.info;
      fondo.querySelector('.bpd-texto').textContent = String(mensaje ?? '');

      let input = null;
      if (campo) {
        input = document.createElement('input');
        input.className = 'bpd-campo';
        input.type = campo.tipoCampo || 'text';
        input.value = campo.valor || '';
        input.placeholder = campo.placeholder || '';
        input.setAttribute('aria-label', String(mensaje ?? ''));
        fondo.querySelector('.bpd-texto').after(input);
      }

      const botones = fondo.querySelector('.bpd-botones');
      let btnCancelar = null;
      if (cancelar) {
        btnCancelar = document.createElement('button');
        btnCancelar.type = 'button';
        btnCancelar.className = 'bpd-btn bpd-cancelar';
        btnCancelar.textContent = cancelar;
        botones.appendChild(btnCancelar);
      }
      const btnAceptar = document.createElement('button');
      btnAceptar.type = 'button';
      btnAceptar.className = 'bpd-btn bpd-aceptar' + (peligro ? ' bpd-peligro' : '');
      btnAceptar.textContent = aceptar;
      botones.appendChild(btnAceptar);

      function cerrar(valor) {
        document.removeEventListener('keydown', teclado, true);
        fondo.classList.remove('bpd-visible');
        setTimeout(() => {
          fondo.remove();
          if (anterior && typeof anterior.focus === 'function' && document.contains(anterior)) anterior.focus();
          resolver(valor);
        }, 160);
      }
      const aceptarValor = () => cerrar(campo ? input.value : true);
      const cancelarValor = () => cerrar(campo ? null : false);

      function teclado(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelar ? cancelarValor() : aceptarValor(); }
        else if (e.key === 'Enter' && document.activeElement !== btnCancelar) { e.preventDefault(); e.stopPropagation(); aceptarValor(); }
        else if (e.key === 'Tab') {
          // El foco no sale de la ventana mientras está abierta.
          const enfocables = [input, btnCancelar, btnAceptar].filter(Boolean);
          const i = enfocables.indexOf(document.activeElement);
          e.preventDefault();
          enfocables[(i + (e.shiftKey ? -1 : 1) + enfocables.length) % enfocables.length].focus();
        }
      }

      btnAceptar.addEventListener('click', aceptarValor);
      if (btnCancelar) btnCancelar.addEventListener('click', cancelarValor);
      fondo.addEventListener('click', (e) => { if (e.target === fondo && cancelar) cancelarValor(); });
      document.addEventListener('keydown', teclado, true);

      document.body.appendChild(fondo);
      requestAnimationFrame(() => fondo.classList.add('bpd-visible'));
      // En las preguntas peligrosas el foco empieza en "Cancelar" para que un Enter sin querer no borre nada.
      (input || (peligro && btnCancelar) || btnAceptar).focus();
      if (input) input.select();
    }));
    cola = tarea.catch(() => {});
    return tarea;
  }

  /** Aviso con un solo botón. Devuelve una promesa que se cumple al cerrarlo. */
  window.bpAlerta = function (mensaje, opciones = {}) {
    return abrir({ mensaje, tipo: 'info', aceptar: 'Entendido', ...opciones, cancelar: null }).then(() => undefined);
  };

  /** Pregunta Sí/No. Devuelve true (Aceptar) o false (Cancelar / Esc / clic fuera). */
  window.bpConfirmar = function (mensaje, opciones = {}) {
    return abrir({ mensaje, tipo: 'pregunta', aceptar: 'Aceptar', cancelar: 'Cancelar', ...opciones });
  };

  /**
   * Notificación pequeña que no interrumpe (abajo al centro, se quita sola). Para errores de fondo,
   * como una lista que no cargó. En la tienda ya la define components.js; aquí es para el panel.
   */
  if (!window.bpNotificar) {
    window.bpNotificar = function (texto, tipo = 'info') {
      let caja = document.getElementById('bp-notificacion');
      if (!caja) {
        caja = document.createElement('div');
        caja.id = 'bp-notificacion';
        caja.setAttribute('role', 'status');
        caja.setAttribute('aria-live', 'polite');
        caja.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(92vw,520px);'
          + 'color:#fff;padding:12px 18px;border-radius:12px;font:14px/1.45 "DM Sans",sans-serif;'
          + 'box-shadow:0 8px 20px rgba(0,0,0,.25);z-index:99999;transition:opacity .3s;opacity:0;pointer-events:none;';
        document.body.appendChild(caja);
      }
      caja.style.background = { error: '#a3322a', ok: '#2f6b3a' }[tipo] || '#4a3826';
      caja.textContent = texto;
      caja.style.opacity = '1';
      clearTimeout(window.bpNotificar._t);
      window.bpNotificar._t = setTimeout(() => { caja.style.opacity = '0'; }, 6500);
    };
  }

  /** Pide un texto. Devuelve lo escrito o null si se canceló. */
  window.bpPedirTexto = function (mensaje, opciones = {}) {
    const { valor = '', tipoCampo = 'text', placeholder = '', ...resto } = opciones;
    return abrir({ mensaje, tipo: 'pregunta', aceptar: 'Aceptar', cancelar: 'Cancelar', ...resto, campo: { valor, tipoCampo, placeholder } });
  };
})();
