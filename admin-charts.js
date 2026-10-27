// ============================================
//  Bigotes y Patitas - admin-charts.js
//  Gráficas del panel de administración con SELECTOR DE TIPO:
//  barras, barras horizontales, línea, área, pastel y dona.
//  No necesita librerías externas (dibuja SVG), así que funciona
//  igual con "python -m http.server" que en Firebase Hosting.
//
//  Uso (en cada página, después de cargar este archivo):
//
//    BPCharts.montar(document.getElementById('miGrafica'), {
//      id: 'ventas-mes',              // para recordar el tipo elegido
//      titulo: 'Ventas por mes',      // texto para lectores de pantalla
//      tipo: 'barras',                // tipo inicial (si la persona no eligió otro)
//      datos: [{ etiqueta: 'Ene', valor: 120, color: '#6b8f71' }, ...],
//      formato: v => '$' + v,         // cómo se escribe un valor
//      centro: { texto: '55%', sub: 'activos' },   // (opcional) texto al centro de la dona
//      vacio: 'Sin datos todavía',
//    });
//
//  Con varias series (p. ej. PUSH y PULL por mes):
//      series: [{ nombre: 'PUSH', color: '#d97b4f' }, { nombre: 'PULL', color: '#3b6ea5' }],
//      datos:  [{ etiqueta: 'Oct', valores: [4, 2] }, ...]
//
//  Si se vuelve a llamar a montar() sobre el mismo elemento (por ejemplo cuando
//  llegan datos nuevos en tiempo real) solo se actualizan los datos y se
//  conserva el tipo de gráfica que la persona eligió.
// ============================================
(function () {
  'use strict';

  const TIPOS = {
    barras:     { nombre: 'Barras' },
    horizontal: { nombre: 'Barras horizontales' },
    linea:      { nombre: 'Línea' },
    area:       { nombre: 'Área' },
    pastel:     { nombre: 'Pastel' },
    dona:       { nombre: 'Dona' },
  };
  const TODOS = Object.keys(TIPOS);
  const PALETA = ['#6b8f71', '#d97b4f', '#f2c14e', '#3b6ea5', '#b8603a', '#8a7d6b', '#4f7355', '#a77bb5'];

  // Íconos pequeños (16x16) de cada tipo, para los botones del selector.
  const ICONOS = {
    barras:     '<rect x="2" y="9" width="3" height="5" rx="1"/><rect x="6.5" y="4" width="3" height="10" rx="1"/><rect x="11" y="7" width="3" height="7" rx="1"/>',
    horizontal: '<rect x="2" y="2" width="6" height="3" rx="1"/><rect x="2" y="6.5" width="11" height="3" rx="1"/><rect x="2" y="11" width="8" height="3" rx="1"/>',
    linea:      '<polyline points="2,12 6,7 9,10 14,3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    area:       '<polygon points="2,14 2,10 6,6 9,9 14,3 14,14" opacity=".85"/>',
    pastel:     '<path d="M8 8V2a6 6 0 1 1-5.2 9z"/><path d="M8 8L2.8 11A6 6 0 0 1 8 2z" opacity=".55"/>',
    dona:       '<path fill-rule="evenodd" d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>',
  };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
  const fmtBase = (v) => numero.format(v);
  const recortar = (txt, max) => {
    const t = String(txt ?? '');
    return t.length > max ? t.slice(0, Math.max(1, max - 1)) + '…' : t;
  };

  function compacto(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(v * 100) / 100);
  }

  // Escala "bonita" para el eje Y (0, 25, 50, 75, 100...).
  function escalaY(max) {
    if (!(max > 0)) return { max: 1, pasos: [0, 0.5, 1] };
    const crudo = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
    const f = crudo / mag;
    const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
    const tope = Math.ceil(max / paso - 1e-9) * paso;
    const pasos = [];
    for (let v = 0; v <= tope + paso / 1000; v += paso) pasos.push(Math.round(v * 1e6) / 1e6);
    return { max: tope, pasos };
  }

  // ---------- Normalizar datos ----------
  function normalizar(opts) {
    const datos = (opts.datos || []).map((d, i) => {
      const valores = Array.isArray(d.valores) ? d.valores.map(Number) : [Number(d.valor)];
      return {
        etiqueta: String(d.etiqueta ?? ''),
        valores: valores.map(v => (isFinite(v) && v > 0 ? v : 0)),
        color: d.color || null,
        indice: i,
      };
    });
    const nSeries = datos.reduce((m, d) => Math.max(m, d.valores.length), 1);
    const series = [];
    for (let s = 0; s < nSeries; s++) {
      const dado = (opts.series && opts.series[s]) || {};
      series.push({ nombre: dado.nombre || '', color: dado.color || (nSeries === 1 ? (opts.color || PALETA[0]) : PALETA[s % PALETA.length]) });
    }
    datos.forEach(d => { while (d.valores.length < nSeries) d.valores.push(0); });
    // Colores por categoría (pastel, dona y barras de una sola serie con colorPorDato)
    datos.forEach((d, i) => { d.colorCat = d.color || PALETA[i % PALETA.length]; });
    // Con una sola serie, si los datos traen su propio color se respeta en barras (p. ej. Llamada / Correo / Reunión).
    const colorPorDato = nSeries === 1 && (opts.colorPorDato || datos.some(d => d.color));
    const hayValores = datos.some(d => d.valores.some(v => v > 0));
    return { datos, series, nSeries, hayValores, colorPorDato };
  }

  const estiloTexto = 'fill:var(--gray,#8a7d6b);font-family:inherit;';

  // ---------- Barras verticales ----------
  function svgBarras(n, fmt, opts) {
    const W = 380, H = 230, m = { l: 38, r: 10, t: 22, b: 36 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = Math.max(...n.datos.flatMap(d => d.valores));
    const esc_ = escalaY(max);
    const grupo = pw / n.datos.length;
    const ancho = Math.min(46, grupo * 0.72);
    const anchoBarra = ancho / n.nSeries;
    const porDato = n.colorPorDato;
    let g = '';
    esc_.pasos.forEach((p) => {
      const y = m.t + ph - (p / esc_.max) * ph;
      g += `<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" style="stroke:var(--border,#e6ddd0);stroke-width:1;"/>` +
           `<text x="${m.l - 6}" y="${y + 3}" text-anchor="end" font-size="9" style="${estiloTexto}">${esc(compacto(p))}</text>`;
    });
    const maxEtq = Math.max(5, Math.floor(grupo / 5.4));
    n.datos.forEach((d, i) => {
      const x0 = m.l + grupo * i + (grupo - ancho) / 2;
      d.valores.forEach((v, s) => {
        const h = Math.max(v > 0 ? 2 : 0, (v / esc_.max) * ph);
        const x = x0 + anchoBarra * s;
        const y = m.t + ph - h;
        const color = porDato ? d.colorCat : n.series[s].color;
        const tit = `${d.etiqueta}${n.series[s].nombre ? ' · ' + n.series[s].nombre : ''}: ${fmt(v)}`;
        g += `<rect class="bpc-marca" x="${x}" y="${y}" width="${Math.max(2, anchoBarra - (n.nSeries > 1 ? 2 : 0))}" height="${h}" rx="3" style="fill:${color};"><title>${esc(tit)}</title></rect>`;
        if (anchoBarra >= 18 && n.datos.length <= 8) {
          g += `<text x="${x + anchoBarra / 2 - (n.nSeries > 1 ? 1 : 0)}" y="${y - 4}" text-anchor="middle" font-size="9" font-weight="700" style="${estiloTexto}">${esc(fmt(v))}</text>`;
        }
      });
      g += `<text x="${m.l + grupo * i + grupo / 2}" y="${H - m.b + 15}" text-anchor="middle" font-size="10" style="${estiloTexto}"><title>${esc(d.etiqueta)}</title>${esc(recortar(d.etiqueta, maxEtq))}</text>`;
    });
    g += `<line x1="${m.l}" y1="${m.t + ph}" x2="${W - m.r}" y2="${m.t + ph}" style="stroke:var(--gray,#8a7d6b);stroke-width:1.5;"/>`;
    return { svg: `<svg class="bpc-svg" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`, leyenda: n.nSeries > 1 ? 'series' : null };
  }

  // ---------- Barras horizontales ----------
  function svgHorizontal(n, fmt, opts) {
    const fila = 30, mt = 8, ml = 96, mr = 58, W = 380;
    const H = mt * 2 + fila * n.datos.length;
    const pw = W - ml - mr;
    const max = Math.max(...n.datos.flatMap(d => d.valores), 1);
    const porDato = n.colorPorDato;
    let g = '';
    n.datos.forEach((d, i) => {
      const yFila = mt + fila * i;
      const alto = (fila - 10) / n.nSeries;
      g += `<text x="${ml - 8}" y="${yFila + fila / 2 + 3}" text-anchor="end" font-size="10" style="${estiloTexto}"><title>${esc(d.etiqueta)}</title>${esc(recortar(d.etiqueta, 15))}</text>`;
      d.valores.forEach((v, s) => {
        const w = Math.max(v > 0 ? 2 : 0, (v / max) * pw);
        const color = porDato ? d.colorCat : n.series[s].color;
        const y = yFila + 5 + alto * s;
        const tit = `${d.etiqueta}${n.series[s].nombre ? ' · ' + n.series[s].nombre : ''}: ${fmt(v)}`;
        g += `<rect class="bpc-marca" x="${ml}" y="${y}" width="${w}" height="${Math.max(3, alto - (n.nSeries > 1 ? 1 : 0))}" rx="3" style="fill:${color};"><title>${esc(tit)}</title></rect>`;
        g += `<text x="${ml + w + 5}" y="${y + Math.max(3, alto) / 2 + 3}" font-size="9" font-weight="700" style="${estiloTexto}">${esc(fmt(v))}</text>`;
      });
    });
    g += `<line x1="${ml}" y1="${mt}" x2="${ml}" y2="${H - mt}" style="stroke:var(--gray,#8a7d6b);stroke-width:1.5;"/>`;
    return { svg: `<svg class="bpc-svg" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`, leyenda: n.nSeries > 1 ? 'series' : null };
  }

  // ---------- Línea y área ----------
  function svgLinea(n, fmt, opts, conArea) {
    const W = 380, H = 230, m = { l: 38, r: 16, t: 22, b: 36 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const max = Math.max(...n.datos.flatMap(d => d.valores));
    const esc_ = escalaY(max);
    const N = n.datos.length;
    const xDe = (i) => N === 1 ? m.l + pw / 2 : m.l + (pw * i) / (N - 1);
    const yDe = (v) => m.t + ph - (v / esc_.max) * ph;
    let g = '';
    esc_.pasos.forEach((p) => {
      const y = yDe(p);
      g += `<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" style="stroke:var(--border,#e6ddd0);stroke-width:1;"/>` +
           `<text x="${m.l - 6}" y="${y + 3}" text-anchor="end" font-size="9" style="${estiloTexto}">${esc(compacto(p))}</text>`;
    });
    const maxEtq = Math.max(5, Math.floor((N > 1 ? pw / (N - 1) : pw) / 5.4));
    n.datos.forEach((d, i) => {
      g += `<text x="${xDe(i)}" y="${H - m.b + 15}" text-anchor="middle" font-size="10" style="${estiloTexto}"><title>${esc(d.etiqueta)}</title>${esc(recortar(d.etiqueta, maxEtq))}</text>`;
    });
    for (let s = 0; s < n.nSeries; s++) {
      const color = n.series[s].color;
      const pts = n.datos.map((d, i) => `${xDe(i)},${yDe(d.valores[s])}`);
      if (conArea && N > 1) {
        g += `<polygon points="${xDe(0)},${m.t + ph} ${pts.join(' ')} ${xDe(N - 1)},${m.t + ph}" style="fill:${color};opacity:.2;"/>`;
      }
      if (N > 1) g += `<polyline points="${pts.join(' ')}" fill="none" style="stroke:${color};stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round;"/>`;
      n.datos.forEach((d, i) => {
        const v = d.valores[s];
        const tit = `${d.etiqueta}${n.series[s].nombre ? ' · ' + n.series[s].nombre : ''}: ${fmt(v)}`;
        g += `<circle class="bpc-marca" cx="${xDe(i)}" cy="${yDe(v)}" r="4" style="fill:#fff;stroke:${color};stroke-width:2.5;"><title>${esc(tit)}</title></circle>`;
        if (n.nSeries === 1 && N <= 8) {
          g += `<text x="${xDe(i)}" y="${yDe(v) - 9}" text-anchor="middle" font-size="9" font-weight="700" style="${estiloTexto}">${esc(fmt(v))}</text>`;
        }
      });
    }
    g += `<line x1="${m.l}" y1="${m.t + ph}" x2="${W - m.r}" y2="${m.t + ph}" style="stroke:var(--gray,#8a7d6b);stroke-width:1.5;"/>`;
    return { svg: `<svg class="bpc-svg" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`, leyenda: n.nSeries > 1 ? 'series' : null };
  }

  // ---------- Pastel y dona ----------
  function punto(cx, cy, r, ang) { return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; }

  function svgCircular(n, fmt, opts, dona) {
    const cx = 100, cy = 100, R = 92, r = dona ? 58 : 0;
    // Cada categoría pesa lo que suman todas sus series.
    const cats = n.datos.map(d => ({ d, v: d.valores.reduce((a, b) => a + b, 0) })).filter(c => c.v > 0);
    const total = cats.reduce((a, c) => a + c.v, 0);
    let g = '';
    let ang = -Math.PI / 2;
    if (cats.length === 1) {
      const c = cats[0];
      g += dona
        ? `<circle class="bpc-marca" cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" style="stroke:${c.d.colorCat};stroke-width:${R - r};"><title>${esc(c.d.etiqueta + ': ' + fmt(c.v) + ' (100%)')}</title></circle>`
        : `<circle class="bpc-marca" cx="${cx}" cy="${cy}" r="${R}" style="fill:${c.d.colorCat};"><title>${esc(c.d.etiqueta + ': ' + fmt(c.v) + ' (100%)')}</title></circle>`;
      if (!dona) g += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="700" style="fill:#fff;">100%</text>`;
    } else {
      cats.forEach((c) => {
        const frac = c.v / total;
        const fin = ang + frac * Math.PI * 2;
        const [x1, y1] = punto(cx, cy, R, ang);
        const [x2, y2] = punto(cx, cy, R, fin);
        const grande = frac > 0.5 ? 1 : 0;
        const pct = Math.round(frac * 1000) / 10;
        const tit = `${c.d.etiqueta}: ${fmt(c.v)} (${pct}%)`;
        let ruta;
        if (dona) {
          const [x3, y3] = punto(cx, cy, r, fin);
          const [x4, y4] = punto(cx, cy, r, ang);
          ruta = `M${x1},${y1} A${R},${R} 0 ${grande} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${grande} 0 ${x4},${y4} Z`;
        } else {
          ruta = `M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${grande} 1 ${x2},${y2} Z`;
        }
        g += `<path class="bpc-marca" d="${ruta}" style="fill:${c.d.colorCat};stroke:#fff;stroke-width:2;"><title>${esc(tit)}</title></path>`;
        if (!dona && frac >= 0.07) {
          const [lx, ly] = punto(cx, cy, R * 0.66, ang + (fin - ang) / 2);
          g += `<text x="${lx}" y="${ly + 3}" text-anchor="middle" font-size="10" font-weight="700" style="fill:#fff;pointer-events:none;">${Math.round(frac * 100)}%</text>`;
        }
        ang = fin;
      });
    }
    if (dona) {
      const c = opts.centro || { texto: fmt(total), sub: 'total' };
      g += `<text x="${cx}" y="${cy + (c.sub ? 2 : 7)}" text-anchor="middle" font-size="22" font-weight="800" style="fill:var(--text,#4a3826);">${esc(c.texto)}</text>`;
      if (c.sub) g += `<text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="9" style="${estiloTexto}">${esc(c.sub)}</text>`;
    }
    const items = n.datos.map(d => {
      const v = d.valores.reduce((a, b) => a + b, 0);
      return { etiqueta: d.etiqueta, color: d.colorCat, v, pct: total ? Math.round((v / total) * 100) : 0 };
    });
    return { svg: `<svg class="bpc-svg bpc-svg-circ" viewBox="0 0 200 200" role="img">${g}</svg>`, items, circular: true };
  }

  // ---------- Armado de la gráfica ----------
  function dibujar(est) {
    const o = est.opts;
    const n = normalizar(o);
    const fmt = o.formato || fmtBase;
    const lienzo = est.lienzo;
    est.botones.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tipo === est.tipo)));

    if (!n.datos.length || !n.hayValores) {
      lienzo.innerHTML = `<p class="bpc-vacio">${esc(o.vacio || 'Aún no hay datos para esta gráfica.')}</p>`;
      return;
    }
    let r;
    if (est.tipo === 'pastel') r = svgCircular(n, fmt, o, false);
    else if (est.tipo === 'dona') r = svgCircular(n, fmt, o, true);
    else if (est.tipo === 'horizontal') r = svgHorizontal(n, fmt, o);
    else if (est.tipo === 'linea') r = svgLinea(n, fmt, o, false);
    else if (est.tipo === 'area') r = svgLinea(n, fmt, o, true);
    else r = svgBarras(n, fmt, o);

    let html;
    if (r.circular) {
      html = `<div class="bpc-circ">${r.svg}<ul class="bpc-leyenda">` +
        r.items.map(i => `<li><i style="background:${i.color};"></i><span>${esc(i.etiqueta)}</span><b>${esc(fmt(i.v))}</b><small>${i.pct}%</small></li>`).join('') +
        '</ul></div>';
    } else {
      html = r.svg;
      if (r.leyenda === 'series') {
        html += '<ul class="bpc-leyenda bpc-leyenda-h">' +
          n.series.map(s => `<li><i style="background:${s.color};"></i><span>${esc(s.nombre)}</span></li>`).join('') + '</ul>';
      }
    }
    lienzo.innerHTML = html;
    const svg = lienzo.querySelector('svg');
    if (svg) svg.setAttribute('aria-label', `${o.titulo || 'Gráfica'} (${TIPOS[est.tipo].nombre.toLowerCase()})`);
  }

  function leerGuardado(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }
  function guardar(clave, v) {
    try { localStorage.setItem(clave, v); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  function inyectarEstilos() {
    if (document.getElementById('bpc-estilos')) return;
    const st = document.createElement('style');
    st.id = 'bpc-estilos';
    st.textContent = `
      .bpc { width: 100%; }
      .bpc-bar { display: flex; gap: 4px; justify-content: flex-end; flex-wrap: wrap; margin-bottom: 8px; }
      .bpc-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 28px; padding: 0;
        border: 1px solid var(--border, #e6ddd0); border-radius: 8px; background: var(--white, #fff); color: var(--gray, #8a7d6b);
        cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
      .bpc-btn:hover { border-color: var(--admin-green, #6b8f71); color: var(--admin-green, #6b8f71); }
      .bpc-btn:focus-visible { outline: 2px solid var(--admin-green, #6b8f71); outline-offset: 1px; }
      .bpc-btn[aria-pressed="true"] { background: var(--admin-green, #6b8f71); border-color: var(--admin-green, #6b8f71); color: #fff; }
      .bpc-btn svg { width: 16px; height: 16px; fill: currentColor; }
      .bpc-svg { display: block; width: 100%; height: auto; max-height: 340px; }
      .bpc-marca { transition: opacity .15s; }
      .bpc-marca:hover { opacity: .8; }
      .bpc-circ { display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; padding: 4px 0; }
      .bpc-svg-circ { width: 190px; max-height: none; flex: 0 0 auto; }
      .bpc-leyenda { list-style: none; margin: 0; padding: 0; font-size: .84rem; color: var(--text, #4a3826); }
      .bpc-leyenda li { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
      .bpc-leyenda i { width: 12px; height: 12px; border-radius: 3px; flex: 0 0 auto; }
      .bpc-leyenda b { margin-left: 4px; }
      .bpc-leyenda small { color: var(--gray, #8a7d6b); }
      .bpc-leyenda-h { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 6px; }
      .bpc-vacio { color: var(--gray, #8a7d6b); font-size: .88rem; text-align: center; padding: 28px 8px; margin: 0; }
    `;
    document.head.appendChild(st);
  }

  function montar(el, opciones) {
    if (!el) return null;
    inyectarEstilos();
    const opts = opciones || {};
    let est = el.__bpc;
    if (!est) {
      const tipos = (opts.tipos || TODOS).filter(t => TIPOS[t]);
      const clave = 'bpGrafica:' + (opts.id || el.id || 'sin-id');
      const guardado = leerGuardado(clave);
      const inicial = tipos.includes(guardado) ? guardado : (tipos.includes(opts.tipo) ? opts.tipo : tipos[0]);
      el.innerHTML = '<div class="bpc"><div class="bpc-bar" role="group" aria-label="Tipo de gráfica"></div><div class="bpc-lienzo"></div></div>';
      const barra = el.querySelector('.bpc-bar');
      est = { opts, tipo: inicial, clave, lienzo: el.querySelector('.bpc-lienzo'), botones: [] };
      tipos.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bpc-btn';
        b.dataset.tipo = t;
        b.title = TIPOS[t].nombre;
        b.setAttribute('aria-label', 'Ver como ' + TIPOS[t].nombre.toLowerCase());
        b.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONOS[t]}</svg>`;
        b.addEventListener('click', () => {
          est.tipo = t;
          guardar(est.clave, t);
          dibujar(est);
        });
        barra.appendChild(b);
        est.botones.push(b);
      });
      el.__bpc = est;
    } else {
      est.opts = opts;
    }
    dibujar(est);
    return est;
  }

  window.BPCharts = { montar, TIPOS: TODOS };
})();
