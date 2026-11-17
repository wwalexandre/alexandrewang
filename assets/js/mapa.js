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
    abbott(g, x, y, c) {           // fábrica: galpão com chaminé que solta fumaça
      bloco(g, x + 12, y - 20, 4, 4, 58, 'mb-acento');
      bloco(g, x, y, 34, 24, 30);
      const fe = face(g, 'esq', x, y, 34, 24, 30);
      placa(fe, 9, 4, 50, 25, c.src, 'Abbott');
      janelas(face(g, 'dir', x, y, 34, 24, 30), 3, 2, { mt: 6, mb: 6, sem: 2 });
      fumaca(g, x + 12, y - 20 - 60);
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

  // ---------- montagem da cena
  const caixa = document.createElement('div');
  caixa.className = 'tl-mapa';
  caixa.hidden = true;
  const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group',
    'aria-label': EN ? 'Career path, in chronological order' : 'Trajetória em ordem cronológica' });

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
