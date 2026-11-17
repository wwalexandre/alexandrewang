// Trajetória em modo Mapa: um tabuleiro em perspectiva isométrica, com uma casa por empresa em
// ordem cronológica (da primeira experiência à mais recente). Cada prédio leva o letreiro ou o
// logo da empresa na fachada. Clicar numa casa, ou usar Anterior e Próxima, move o peão e mostra
// o cartão daquela empresa logo abaixo. O desenho é SVG puro, sem biblioteca 3D.
// Depende de main.js (LANG, REDUCE, Reveal), que é carregado antes.
(function mapaTrajetoria() {
  const tl = document.querySelector('.timeline');
  if (!tl) return;
  const cartoes = [...tl.querySelectorAll('.tl')].reverse(); // no HTML o mais recente vem primeiro
  if (cartoes.length < 2) return;
  const EN = LANG === 'en';
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, texto) => {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k]));
    if (texto != null) n.textContent = texto;
    return n;
  };

  // ---------- geometria: grade em zigue-zague projetada em perspectiva isométrica
  const ESC = 52, HW = 72, HH = 36, FUNDO = 14;
  const grade = cartoes.map((_, i) => [Math.ceil(i / 2) * 2, 4 - Math.floor(i / 2) * 2]);
  const pts = grade.map(g => [(g[0] - g[1]) * ESC, (g[0] + g[1]) * ESC / 2]);
  const ALT = { funed: 46, abbott: 64, hypera: 50, hering: 38, sanofi: 98 }; // altura visual de cada prédio
  const alt = i => ALT[cartoes[i].dataset.item] || 50;
  const minX = Math.min(...pts.map(p => p[0])), maxX = Math.max(...pts.map(p => p[0]));
  const cimaI = i => pts[i][1] === Math.min(...pts.map(p => p[1]));      // rótulo acima nas casas de cima
  const topo = Math.min(...pts.map((p, i) => (cimaI(i) ? p[1] - alt(i) - 50 : p[1] - alt(i))));
  const fundo = Math.max(...pts.map((p, i) => (cimaI(i) ? p[1] + HH + FUNDO : p[1] + HH + FUNDO + 54)));
  const W = maxX - minX + HW * 2 + 40, H = fundo - topo + 30;
  const ox = -minX + HW + 20, oy = -topo + 10;
  const losango = (x, y, hw, hh) => 'M' + x + ' ' + (y - hh) + 'L' + (x + hw) + ' ' + y + 'L' + x + ' ' + (y + hh) + 'L' + (x - hw) + ' ' + y + 'Z';
  const lateral = (x, y, hw, hh, d) =>
    'M' + (x - hw) + ' ' + y + 'L' + x + ' ' + (y + hh) + 'L' + (x + hw) + ' ' + y +
    'L' + (x + hw) + ' ' + (y + d) + 'L' + x + ' ' + (y + hh + d) + 'L' + (x - hw) + ' ' + (y + d) + 'Z';

  // ---------- peças de desenho
  // Bloco: (cx, cy) é o centro da base; a e b, as meias-larguras nos dois eixos; h, a altura; z, a elevação.
  function bloco(g, cx, cy, a, b, h, extra, z) {
    cy -= z || 0;
    const P = (sa, sb, dz) => (cx + sa * a - sb * b) + ' ' + (cy + (sa * a + sb * b) * 0.5 - (dz || 0));
    const f = (pontos, cls) => g.appendChild(svgEl('path', { d: 'M' + pontos.join('L') + 'Z', class: cls + (extra ? ' ' + extra : '') }));
    f([P(-1, 1), P(1, 1), P(1, 1, h), P(-1, 1, h)], 'mb-esq');
    f([P(1, 1), P(1, -1), P(1, -1, h), P(1, 1, h)], 'mb-dir');
    f([P(-1, -1, h), P(1, -1, h), P(1, 1, h), P(-1, 1, h)], 'mb-topo');
  }
  // Face: grupo cujo (0, 0) é o canto superior esquerdo da fachada e cujos eixos seguem a fachada.
  function face(g, lado, cx, cy, a, b, h) {
    const gr = svgEl('g');
    if (lado === 'esq') { gr.setAttribute('transform', 'matrix(1 .5 0 1 ' + (cx - a - b) + ' ' + (cy + (b - a) * 0.5 - h) + ')'); gr.w = 2 * a; }
    else { gr.setAttribute('transform', 'matrix(1 -.5 0 1 ' + (cx + a - b) + ' ' + (cy + (a + b) * 0.5 - h) + ')'); gr.w = 2 * b; }
    gr.h = h;
    g.appendChild(gr);
    return gr;
  }
  function janelas(gr, cols, linhas, o) {
    o = o || {};
    const mx = o.mx == null ? 6 : o.mx, mt = o.mt == null ? 6 : o.mt, mb = o.mb == null ? 6 : o.mb, gap = o.gap == null ? 3 : o.gap;
    const cw = (gr.w - 2 * mx - (cols - 1) * gap) / cols, ch = (gr.h - mt - mb - (linhas - 1) * gap) / linhas;
    for (let r = 0; r < linhas; r++) for (let c = 0; c < cols; c++) {
      gr.appendChild(svgEl('rect', { x: mx + c * (cw + gap), y: mt + r * (ch + gap), width: cw, height: ch, rx: 0.8,
        class: 'mb-jan' + ((r * 7 + c * 3 + (o.sem || 0)) % 4 === 0 ? ' on' : '') }));
    }
  }
  // Letreiro: placa branca com o logo (imagem) ou, na falta dele, o nome em texto.
  function placa(gr, x, y, w, h, src, texto) {
    gr.appendChild(svgEl('rect', { x, y, width: w, height: h, rx: 2, class: 'mb-placa' }));
    if (src) {
      const im = svgEl('image', { x: x + 3, y: y + 2, width: w - 6, height: h - 4, preserveAspectRatio: 'xMidYMid meet' });
      im.setAttribute('href', src);
      gr.appendChild(im);
    } else {
      gr.appendChild(svgEl('text', { x: x + w / 2, y: y + h * 0.72, class: 'mb-placa-txt', 'text-anchor': 'middle', 'font-size': h * 0.78 }, texto));
    }
  }
  function tanque(g, cx, cy, r, h, extra) {
    const rv = r * 0.5;
    g.appendChild(svgEl('path', { d: 'M' + (cx - r) + ' ' + cy + 'L' + (cx - r) + ' ' + (cy - h) + 'A' + r + ' ' + rv + ' 0 0 0 ' + (cx + r) + ' ' + (cy - h) +
      'L' + (cx + r) + ' ' + cy + 'A' + r + ' ' + rv + ' 0 0 1 ' + (cx - r) + ' ' + cy + 'Z', class: 'mb-esq ' + extra }));
    g.appendChild(svgEl('ellipse', { cx, cy: cy - h, rx: r, ry: rv, class: 'mb-topo ' + extra }));
  }
  function fumaca(g, x, y) {
    for (let i = 0; i < 3; i++) {
      const c = svgEl('circle', { cx: x, cy: y, r: 4 + i, class: 'mb-fumaca' });
      c.style.animationDelay = (i * 1.1) + 's';
      g.appendChild(c);
    }
  }

  // ---------- um prédio por tipo de lugar; todos levam o letreiro da empresa na fachada
  const PREDIOS = {
    funed(g, x, y, c) {            // laboratório público: bloco largo com um volume verde no teto
      bloco(g, x - 8, y - 8, 12, 10, 12, 'mb-acento-verde', 30);
      bloco(g, x, y, 34, 24, 30);
      const fe = face(g, 'esq', x, y, 34, 24, 30);
      placa(fe, 14, 5, 40, 20, c.src, 'FUNED');
      janelas(face(g, 'dir', x, y, 34, 24, 30), 3, 2, { mt: 6, mb: 6, sem: 1 });
    },
    abbott(g, x, y, c) {           // prédio de vidro: torre da escada, andar de cima em balanço com faixa de janelas, térreo envidraçado e galpão ao fundo
      bloco(g, x + 14, y - 18, 30, 16, 24, 'mb-galpao');
      bloco(g, x + 3, y, 29, 21, 17);
      const t = face(g, 'esq', x + 3, y, 29, 21, 17);
      t.appendChild(svgEl('rect', { x: 3, y: 4, width: t.w - 6, height: 12, class: 'mb-luz' }));
      for (let k = 1; k < 6; k++) t.appendChild(svgEl('line', { x1: 3 + k * (t.w - 6) / 6, y1: 4, x2: 3 + k * (t.w - 6) / 6, y2: 16, class: 'mb-caixilho' }));
      const td = face(g, 'dir', x + 3, y, 29, 21, 17);
      td.appendChild(svgEl('rect', { x: 3, y: 4, width: td.w - 6, height: 12, class: 'mb-luz' }));
      bloco(g, x, y, 34, 24, 17, null, 17);
      const fe = face(g, 'esq', x, y - 17, 34, 24, 17);
      fe.appendChild(svgEl('rect', { x: 3, y: 4, width: fe.w - 33, height: 9, class: 'mb-luz' }));
      for (let k = 1; k < 5; k++) fe.appendChild(svgEl('line', { x1: 3 + k * (fe.w - 33) / 5, y1: 4, x2: 3 + k * (fe.w - 33) / 5, y2: 13, class: 'mb-caixilho' }));
      placa(fe, fe.w - 28, 3, 25, 11, c.src, 'Abbott');
      const fd = face(g, 'dir', x, y - 17, 34, 24, 17);
      fd.appendChild(svgEl('rect', { x: 3, y: 4, width: fd.w - 6, height: 9, class: 'mb-luz' }));
      // torre da escada, toda de vidro, na ponta da fachada
      const tx = x - 58, ty = y + 10;
      bloco(g, tx, ty, 9, 9, 46, 'mb-torre');
      [face(g, 'esq', tx, ty, 9, 9, 46), face(g, 'dir', tx, ty, 9, 9, 46)].forEach((f, lado) => {
        f.appendChild(svgEl('rect', { x: 1.5, y: 1.5, width: f.w - 3, height: f.h - 3, class: 'mb-luz' }));
        for (let r = 1; r < 7; r++) f.appendChild(svgEl('line', { x1: 1.5, y1: 1.5 + r * (f.h - 3) / 7, x2: f.w - 1.5, y2: 1.5 + r * (f.h - 3) / 7, class: 'mb-caixilho' }));
        if (!lado) for (let r = 0; r < 7; r++) {   // lances da escada vistos pelo vidro
          const y0 = 1.5 + (r + 1) * (f.h - 3) / 7, y1 = y0 - (f.h - 3) / 7 + 1.5;
          f.appendChild(svgEl('line', { x1: r % 2 ? f.w - 3 : 3, y1: y0 - 0.8, x2: r % 2 ? 3 : f.w - 3, y2: y1, class: 'mb-escada' }));
        }
      });
    },
    hypera(g, x, y, c) {           // planta: galpão com dois tanques ao fundo
      tanque(g, x - 14, y - 16, 11, 42, 'mb-acento-verde');
      tanque(g, x + 8, y - 24, 10, 46, 'mb-acento-verde');
      bloco(g, x, y, 34, 22, 26);
      const fe = face(g, 'esq', x, y, 34, 22, 26);
      placa(fe, 4, 4, 60, 17, c.src, 'Hypera');
      janelas(fe, 5, 1, { mt: 22, mb: 2, mx: 6 });
      janelas(face(g, 'dir', x, y, 34, 22, 26), 3, 2, { mt: 5, mb: 5, sem: 3 });
    },
    hering(g, x, y, c) {           // loja: vitrine de vidro, toldo laranja e letreiro com o nome
      bloco(g, x, y, 32, 24, 30);
      const fe = face(g, 'esq', x, y, 32, 24, 30);
      placa(fe, 9, 3, 46, 12, null, c.nome);
      fe.appendChild(svgEl('rect', { x: 6, y: 22, width: 52, height: 7, class: 'mb-vidro' }));
      for (let k = 0; k < 7; k++) {   // toldo listrado sobre a vitrine
        fe.appendChild(svgEl('rect', { x: 4 + k * 8, y: 16, width: 8, height: 6, class: k % 2 ? 'mb-toldo-b' : 'mb-toldo-a' }));
      }
      janelas(face(g, 'dir', x, y, 32, 24, 30), 2, 2, { mt: 6, mb: 6, sem: 0 });
    },
    sanofi(g, x, y, c) {           // torre corporativa: fachada de vidro com fileiras de janelas
      bloco(g, x, y, 22, 20, 76);
      bloco(g, x, y, 10, 9, 8, 'mb-acento', 76);
      g.appendChild(svgEl('line', { x1: x, y1: y - 84, x2: x, y2: y - 98, class: 'mb-antena' }));
      const fe = face(g, 'esq', x, y, 22, 20, 76);
      placa(fe, 3, 5, 38, 19, c.src, 'Sanofi');
      janelas(fe, 4, 6, { mt: 29, mb: 5, mx: 4, gap: 2.5, sem: 1 });
      janelas(face(g, 'dir', x, y, 22, 20, 76), 4, 8, { mt: 6, mb: 5, mx: 4, gap: 2.5, sem: 2 });
    }
  };


  // ---------- fundo: contorno dos estados onde cada experiência aconteceu, como marca d'água.
  // Contornos do IBGE (malha estadual, qualidade mínima), simplificados e normalizados para uma caixa de 100.
  const ESTADOS = {
    MG: { nome: 'Minas Gerais', w: 100, h: 81.8, d: 'M30 38.8L27.6 40.2L24.7 38.6L24.1 38.9L19 38.3L17.7 39.2L16.4 39.4L14.9 41.4L13.9 40.5L11.1 41.5L9 41.1L8.6 41.8L6.9 41.9L5.1 44.1L4.5 45.8L2.7 46.7L1.9 47.8L1.5 48.9L1.9 49.4L0.9 49.3L1 50.5L0 51.4L0.3 55.2L5.2 52.3L6.3 53.1L8.9 53.6L16 54.1L15.5 55.5L15.9 56.8L16.6 57.3L17.6 55.8L18.4 56L18.6 58.2L19.2 58.5L19.2 57L19.8 55.9L25.2 55.6L25.4 54.8L26.5 55.8L27.3 54.7L28.1 55.5L28.5 54.3L30.4 54.8L31.7 54.1L34 56.4L33.5 58.3L34.8 59.5L35.2 60.8L34.5 61.3L34.1 62.4L35.1 65.6L36.1 67.2L36 67.8L38.2 67.2L40.5 68.4L38.9 71.7L39.5 73.2L38.6 74.1L39.7 74.6L38.6 76.2L41 78.2L41.5 79.5L40.8 79.9L42.1 80.5L42 81.8L46.2 81.5L47.6 80.5L46.8 80.2L47.9 78.7L48 79.4L49.7 78.8L50.4 79.4L52.9 78L57 76.9L58.9 75.7L60.6 75.8L65.1 73.9L68 73.8L68.8 73.3L70.7 73.5L70.6 74.3L78.4 70.6L77.7 69.4L78.6 68.4L79.1 65.3L80.1 64.1L79.5 63.6L81 63.2L82 61.6L82.6 58.9L82.1 57.9L83 56.3L86.1 56.3L87.1 53.8L88.1 53.3L88.3 51.2L90 49.7L90.1 46L89.2 45.4L89.2 44.4L87.6 43.5L87.7 43L90.5 43.1L90.3 42L89.3 41.4L89.6 39.8L88.1 39.6L88.4 38.3L89.3 37L91.8 36.5L90.6 35.3L91.6 35L92.8 35.6L94 34.4L96.7 35.2L96.7 32.9L95 31.7L93.3 29.3L93.8 28.7L93.5 27.4L94.3 24.9L96.2 25L96.3 21.9L97.3 22L97.7 20.8L99.5 19.2L100 17.6L99.5 16.5L98.7 16.5L96.6 14.7L94.9 14.7L94.7 14.3L94.1 14.6L92.5 13.4L91.9 13.8L91.4 13.2L88.5 14.4L86.8 14.1L86.5 11.7L82.6 8L81.2 8.7L79.3 7.9L78.5 8.2L72.4 4.3L70.3 3.8L69.1 3.9L67.1 5.3L64 3.8L64.9 0.8L63.2 0.2L60.3 0L58 0.8L55.5 2.3L55.1 3.3L53.1 4.7L52.2 4.6L47.4 8.2L45.3 8.5L44.4 9.6L45.4 6.7L44.7 5.9L43.5 6.6L42.2 6.1L42.2 5.3L40.6 4.3L40 5.3L40.6 7.5L39.5 7.9L37.4 7.2L36.8 7.6L36.7 9L37.5 10.6L36.7 11.3L36.6 12.4L37.2 12.8L37.8 15.3L34.9 15.8L33.3 16.9L33.2 18.5L32.1 20.9L32.4 22L34.1 23.3L34.3 24.8L35 25.8L31.5 29.1L31.3 30.3L33.7 31.8L32.8 33.8L33.6 35.8L30.7 37.8Z' },
    SP: { nome: 'São Paulo', w: 100, h: 66.8, d: 'M71.8 24.8L73.8 20.6L70.9 19L68.2 19.8L65.8 12.9L66.2 11.4L67.2 10.8L66.7 9.1L65 7.6L65.7 5.2L62.8 2.2L61.1 3.2L58.8 2.5L58.2 4.1L57.3 3L56.2 4.4L54.8 3.1L54.7 4.1L47.9 4.5L47.2 7.9L46.3 7.5L46.1 4.6L45.2 4.4L43.9 6.4L43 5.7L42.5 4L43.1 2.2L34.2 1.6L31 1L29.7 0L24.8 2.5L22.3 6L19.7 6.9L17.1 10.1L16.4 11.7L16.6 14L13.7 17.1L13.9 18.7L12.8 20.6L11.2 21.6L11.7 22.9L8 28.1L0.4 33.4L0 34.3L2 33.6L3.8 34.1L5.8 33.6L6.3 34.2L10.3 34.7L10.8 33.1L15.5 34.8L20.2 34.9L24.4 36.4L25.8 38.3L28.3 37.7L32.5 38.3L34.1 37.7L37.9 40.6L38.9 42.3L39.7 48.4L39.1 49L42.2 52.6L42 53.6L43.1 54.8L42.4 59L43.6 59.4L50.4 59L51.1 59.7L50.4 63.1L50.9 64L52.5 62.8L53.5 63.5L54.4 62.9L56 66.8L58.1 64.9L58.1 63.7L60.1 61.6L71.5 52.7L75.5 50.6L77.4 50.8L78 49.2L81.2 48L84.5 48.5L84.9 49L86.2 48.6L86.1 46.4L89.9 44.8L91.7 42.9L92.4 43.5L93.8 43.3L92 41.3L92.6 40.8L93 38.6L96.3 37L98.3 37L100 34.9L99.3 34.1L94.6 34.1L92.8 31.7L89.3 32.8L86.2 34.7L85.3 33.9L83.2 34.6L83.1 33.7L81.7 35.7L82.7 36.1L80.9 37.3L75.6 37.7L75.8 36L74.2 35.3L75.1 34.8L74.4 33.1L71.4 30.5L72.8 28.4L71.4 27.8L72.6 26.7Z' }
  };
  const UF = { funed: 'MG', abbott: 'MG', hypera: 'SP', hering: 'SP', sanofi: 'SP' };

  // ---------- montagem da cena
  const caixa = document.createElement('div');
  caixa.className = 'tl-mapa';
  caixa.hidden = true;
  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group',
    'aria-label': EN ? 'Career path, in chronological order' : 'Trajetória em ordem cronológica' });

  // fundo: terreno com grade isométrica pontilhada e, por cima, os estados em marca d'água
  const defs = svgEl('defs');
  const uid = 'mp' + Math.random().toString(36).slice(2, 7);
  const grad = svgEl('radialGradient', { id: uid + 'g', cx: '50%', cy: '45%', r: '70%' });
  grad.append(svgEl('stop', { offset: '0%', class: 'mp-chao-1' }), svgEl('stop', { offset: '100%', class: 'mp-chao-2' }));
  const pat = svgEl('pattern', { id: uid + 'p', width: ESC, height: ESC / 2, patternUnits: 'userSpaceOnUse',
    patternTransform: 'translate(' + ox + ' ' + oy + ')' });
  [[0, 0], [ESC / 2, ESC / 4], [ESC, 0], [0, ESC / 2], [ESC, ESC / 2]].forEach(p =>
    pat.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: 1.1, class: 'mp-ponto' })));
  const clip = svgEl('clipPath', { id: uid + 'c' });
  clip.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, rx: 10 }));
  defs.append(grad, pat, clip);
  svg.appendChild(defs);
  const chao = svgEl('g', { class: 'mp-chao', 'clip-path': 'url(#' + uid + 'c)', 'aria-hidden': 'true' });
  chao.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#' + uid + 'g)' }));
  chao.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#' + uid + 'p)' }));
  Object.keys(ESTADOS).forEach(uf => {
    const idx = cartoes.map((c, i) => (UF[c.dataset.item] === uf ? i : -1)).filter(i => i >= 0);
    if (!idx.length) return;
    const E = ESTADOS[uf];
    const xs = idx.map(i => pts[i][0] + ox), ys = idx.map(i => pts[i][1] + oy);
    const k = (Math.max(...xs) - Math.min(...xs) + 190) / E.w;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2 - 18;
    const tx = cx - E.w * k / 2, ty = cy - E.h * k / 2;
    const ge = svgEl('g', { class: 'mp-estado mp-uf-' + uf.toLowerCase() });
    const forma = svgEl('path', { d: E.d, transform: 'translate(' + tx + ' ' + ty + ') scale(' + k + ')', class: 'mp-estado-forma' });
    forma.style.strokeWidth = (1.4 / k) + 'px';
    ge.appendChild(forma);
    ge.appendChild(svgEl('text', { x: Math.max(tx + 4, 16), y: Math.max(ty + 12, 22), class: 'mp-estado-nome' }, E.nome.toUpperCase()));
    chao.appendChild(ge);
  });
  svg.appendChild(chao);

  for (let i = 0; i < pts.length - 1; i++) {   // trilha entre as casas
    const mx = (pts[i][0] + pts[i + 1][0]) / 2 + ox, my = (pts[i][1] + pts[i + 1][1]) / 2 + oy;
    svg.appendChild(svgEl('path', { d: lateral(mx, my, 24, 12, 6), class: 'mp-trilha-lado' }));
    svg.appendChild(svgEl('path', { d: losango(mx, my, 24, 12), class: 'mp-trilha' }));
  }

  const casas = cartoes.map((c, i) => {
    const x = pts[i][0] + ox, y = pts[i][1] + oy;
    const nome = (c.querySelector('.tl-co') || {}).textContent || '';
    const periodo = (c.querySelector('.tl-period') || {}).textContent || '';
    const curto = nome.replace(/\s*\(.*\)/, '').replace(/^Cia\.\s*/, '');
    const logo = c.querySelector('.tl-logo img');
    const g = svgEl('g', { class: 'mp-casa', role: 'button', tabindex: '0', 'aria-label': (i + 1) + '. ' + nome + ', ' + periodo });
    g.appendChild(svgEl('path', { d: lateral(x, y, HW, HH, FUNDO), class: 'mp-lado' }));
    g.appendChild(svgEl('path', { d: losango(x, y, HW, HH), class: 'mp-topo' }));

    const predio = svgEl('g', { class: 'mp-predio' });
    predio.style.setProperty('--d', (i * 0.12) + 's');
    // sombra no chão, à direita e atrás
    predio.appendChild(svgEl('path', { d: losango(x + 14, y + 4, 40, 20), class: 'mb-sombra' }));
    const fazer = PREDIOS[c.dataset.item] || PREDIOS.abbott;
    fazer(predio, x, y + 2, { src: logo ? logo.getAttribute('src') : null, nome: curto });
    g.appendChild(predio);

    g.appendChild(svgEl('text', { x: x - HW + 14, y: y + 4, class: 'mp-num', 'text-anchor': 'middle' }, String(i + 1)));
    // placa de rótulo: nome e período, acima nas casas de cima e abaixo nas de baixo
    const larg = Math.max(curto.length * 8.6, periodo.length * 6.4) + 20;
    const ry = cimaI(i) ? y - alt(i) - 48 : y + HH + FUNDO + 8;
    const rot = svgEl('g', { class: 'mp-rotulo' });
    rot.appendChild(svgEl('rect', { x: x - larg / 2, y: ry, width: larg, height: 36, rx: 6, class: 'mp-rotulo-fundo' }));
    rot.appendChild(svgEl('text', { x, y: ry + 15, class: 'mp-nome', 'text-anchor': 'middle' }, curto));
    rot.appendChild(svgEl('text', { x, y: ry + 29, class: 'mp-ano', 'text-anchor': 'middle' }, periodo));
    g.appendChild(rot);
    svg.appendChild(g);
    return g;
  });

  // peão: a sombra fica no chão e o corpo salta de uma casa para a outra
  const sombra = svgEl('ellipse', { cx: 0, cy: 0, rx: 11, ry: 5.5, class: 'mp-peao-base' });
  const corpo = svgEl('g', { class: 'mp-peao', 'aria-hidden': 'true' });
  corpo.appendChild(svgEl('path', { d: 'M-7 -1 L0 -26 L7 -1 Z', class: 'mp-peao-corpo' }));
  corpo.appendChild(svgEl('circle', { cx: 0, cy: -29, r: 6.5, class: 'mp-peao-corpo' }));
  svg.append(sombra, corpo);
  const posPeao = i => [pts[i][0] + ox - 34, pts[i][1] + oy + 15];
  const poe = (x, y, arco) => {
    sombra.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    corpo.setAttribute('transform', 'translate(' + x + ' ' + (y - arco) + ')');
  };
  let anim = 0;
  function moverPeao(de, para) {
    const [x0, y0] = posPeao(de), [x1, y1] = posPeao(para);
    if (de === para || REDUCE.matches || caixa.hidden) { poe(x1, y1, 0); return; }
    const t0 = performance.now(), dur = 560, id = ++anim;
    (function passo(t) {
      if (id !== anim) return;
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      poe(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, Math.sin(Math.PI * e) * 30);
      if (k < 1) requestAnimationFrame(passo);
    })(t0);
  }

  const nav = document.createElement('div');
  nav.className = 'mp-nav';
  const voltar = document.createElement('button');
  const avancar = document.createElement('button');
  const passoTxt = document.createElement('span');
  passoTxt.setAttribute('aria-live', 'polite');
  [voltar, avancar].forEach(b => { b.type = 'button'; b.className = 'btn btn-outline btn-sm'; });
  voltar.textContent = EN ? 'Previous' : 'Anterior';
  avancar.textContent = EN ? 'Next' : 'Próxima';
  nav.append(voltar, passoTxt, avancar);
  caixa.append(svg, nav);
  tl.parentNode.insertBefore(caixa, tl);

  let atual = 0, primeira = true;
  function vai(i) {
    const antes = atual;
    atual = Math.max(0, Math.min(cartoes.length - 1, i));
    casas.forEach((g, k) => {
      g.classList.toggle('sel', k === atual);
      g.classList.toggle('passou', k < atual);
      g.setAttribute('aria-pressed', String(k === atual));
    });
    cartoes.forEach((c, k) => c.classList.toggle('mapa-sel', k === atual));
    if (primeira) { poe(posPeao(atual)[0], posPeao(atual)[1], 0); primeira = false; } else moverPeao(antes, atual);
    voltar.disabled = atual === 0;
    avancar.disabled = atual === cartoes.length - 1;
    passoTxt.textContent = (atual + 1) + (EN ? ' of ' : ' de ') + cartoes.length;
    try { sessionStorage.setItem('traj-casa', String(atual)); } catch (e) {}
  }
  casas.forEach((g, i) => {
    g.addEventListener('click', () => vai(i));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vai(i); } });
  });
  voltar.addEventListener('click', () => vai(atual - 1));
  avancar.addEventListener('click', () => vai(atual + 1));

  // os prédios sobem do chão na primeira vez que o mapa aparece na tela
  let entrou = false;
  const entrada = () => {
    if (entrou || REDUCE.matches) { svg.classList.add('mp-pronto'); return; }
    if (!('IntersectionObserver' in window)) { svg.classList.add('mp-pronto'); return; }
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { entrou = true; svg.classList.add('mp-entra', 'mp-pronto'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(svg);
  };
  const liga = on => {
    caixa.hidden = !on;
    if (on) { cartoes.forEach(Reveal.finish); entrada(); }
  };
  let inicio = 0;
  try { inicio = parseInt(sessionStorage.getItem('traj-casa'), 10) || 0; } catch (e) {}
  vai(inicio);
  liga(tl.dataset.mapa === 'on');
  document.addEventListener('traj-mapa', e => liga(e.detail));
})();
