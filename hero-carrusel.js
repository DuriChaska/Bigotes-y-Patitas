// Carrusel del banner principal (index.html).
// Cambia solo cada 6 segundos, se pausa al pasar el mouse o al enfocar con el teclado,
// y en celular se puede deslizar con el dedo.
(function () {
  const carrusel = document.querySelector('.hero-carrusel');
  if (!carrusel) return;

  const slides = [...carrusel.querySelectorAll('.hc-slide')];
  const puntos = [...carrusel.querySelectorAll('.hc-punto')];
  if (slides.length < 2) return;

  const INTERVALO = 6000;
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = 0;
  let temporizador = null;

  function mostrar(i) {
    actual = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      const activo = n === actual;
      s.classList.toggle('activo', activo);
      s.setAttribute('aria-hidden', activo ? 'false' : 'true');
      s.querySelectorAll('a, button').forEach((el) => {
        if (activo) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', '-1');
      });
    });
    puntos.forEach((p, n) => {
      p.classList.toggle('activo', n === actual);
      if (n === actual) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
    });
  }

  function iniciar() {
    if (sinMovimiento) return;
    detener();
    temporizador = setInterval(() => mostrar(actual + 1), INTERVALO);
  }
  function detener() { clearInterval(temporizador); temporizador = null; }

  puntos.forEach((p, n) => p.addEventListener('click', () => { mostrar(n); iniciar(); }));

  carrusel.addEventListener('mouseenter', detener);
  carrusel.addEventListener('mouseleave', iniciar);
  carrusel.addEventListener('focusin', detener);
  carrusel.addEventListener('focusout', iniciar);
  document.addEventListener('visibilitychange', () => (document.hidden ? detener() : iniciar()));

  // Deslizar con el dedo en celular
  let inicioX = null;
  carrusel.addEventListener('touchstart', (e) => { inicioX = e.touches[0].clientX; }, { passive: true });
  carrusel.addEventListener('touchend', (e) => {
    if (inicioX === null) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    if (Math.abs(dx) > 40) { mostrar(actual + (dx < 0 ? 1 : -1)); iniciar(); }
    inicioX = null;
  });

  // Flechas del teclado cuando el foco está en los puntos
  carrusel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { mostrar(actual + 1); puntos[actual].focus(); }
    if (e.key === 'ArrowLeft')  { mostrar(actual - 1); puntos[actual].focus(); }
  });

  iniciar();
})();
