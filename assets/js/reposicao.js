// Simulador de reposição de estoque: lote econômico (EOQ), estoque de segurança (SS)
// e ponto de pedido (ROP), com o gráfico dente de serra do estoque ao longo do tempo.
// Tudo é calculado no navegador; nenhum dado sai da página.
(function reposicao() {
  const caixa = document.getElementById('simulador');
  if (!caixa) return;
  const EN = document.documentElement.lang.startsWith('en');
  const $ = id => document.getElementById(id);
  const LOCALE = EN ? 'en-US' : 'pt-BR';
  const n0 = x => Math.round(x).toLocaleString(LOCALE);
  const n1 = x => x.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dinheiro = x => 'R$ ' + Math.round(x).toLocaleString(LOCALE);

  const T = EN ? {
    un: ' units', dias: ' days', vezes: ' orders a year', cada: 'one order every ',
    eixoY: 'Stock (units)', eixoX: 'Days', rop: 'Reorder point', ss: 'Safety stock', pedido: 'Order placed', chega: 'Lot arrives',
    frase: (rop, eoq, ss) => 'Decision: when stock reaches ' + rop + ', order ' + eoq + '. If demand follows the average, the new lot arrives with ' + ss + ' units still in reserve.',
    alertaLT: 'Demand during the lead time is larger than the lot: there will be more than one order on the way at the same time.',
    invalido: 'Fill every field with a number greater than zero.'
  } : {
    un: ' un', dias: ' dias', vezes: ' pedidos por ano', cada: 'um pedido a cada ',
    eixoY: 'Estoque (un)', eixoX: 'Dias', rop: 'Ponto de pedido', ss: 'Estoque de segurança', pedido: 'Pedido feito', chega: 'Lote chega',
    frase: (rop, eoq, ss) => 'Decisão: quando o estoque chegar a ' + rop + ', pedir ' + eoq + '. Se a demanda seguir a média, o lote novo chega com ' + ss + ' unidades ainda na reserva.',
    alertaLT: 'A demanda durante o lead time é maior que o lote: vai haver mais de um pedido a caminho ao mesmo tempo.',
    invalido: 'Preencha todos os campos com um número maior que zero.'
  };

  const campos = ['rpDemanda', 'rpDesvio', 'rpLead', 'rpServico', 'rpPedido', 'rpManter', 'rpDias'].map($);
  const ler = el => parseFloat(String(el.value).replace(',', '.'));

  // As três contas, separadas para poderem ser conferidas à mão
  function calcular(e) {
    const D = e.d * e.dias;                              // demanda anual
    const eoq = Math.sqrt((2 * D * e.S) / e.H);          // lote econômico
    const ss = e.z * e.sigma * Math.sqrt(e.L);           // estoque de segurança
    const rop = e.d * e.L + ss;                          // ponto de pedido
    const pedidosAno = D / eoq;
    return {
      D, eoq, ss, rop, pedidosAno,
      ciclo: eoq / e.d,                                  // dias entre um pedido e outro
      estoqueMedio: eoq / 2 + ss,
      custoPedido: pedidosAno * e.S,
      custoManter: (eoq / 2 + ss) * e.H
    };
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, texto) => {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    if (texto != null) n.textContent = texto;
    return n;
  };

  function desenhar(e, r) {
    const alvo = $('rpGrafico');
    alvo.textContent = '';
    const W = 680, H = 300, ME = 56, MD = 16, MT = 18, MB = 40;
    const topo = r.ss + r.eoq;
    const ciclos = 3;
    const totalDias = r.ciclo * ciclos;
    const x = dia => ME + (dia / totalDias) * (W - ME - MD);
    const y = v => MT + (1 - v / (topo * 1.08)) * (H - MT - MB);
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': T.eixoY + ': ' + T.rop + ' ' + n0(r.rop) + ', ' + T.ss + ' ' + n0(r.ss) });

    // faixa do estoque de segurança e linha do ponto de pedido
    svg.appendChild(svgEl('rect', { x: ME, y: y(r.ss), width: W - ME - MD, height: y(0) - y(r.ss), class: 'rp-faixa' }));
    svg.appendChild(svgEl('line', { x1: ME, x2: W - MD, y1: y(0), y2: y(0), class: 'rp-eixo' }));
    svg.appendChild(svgEl('line', { x1: ME, x2: ME, y1: MT, y2: y(0), class: 'rp-eixo' }));
    if (r.rop <= topo) svg.appendChild(svgEl('line', { x1: ME, x2: W - MD, y1: y(r.rop), y2: y(r.rop), class: 'rp-rop' }));

    // dente de serra: desce com a demanda média e sobe quando o lote chega
    let d = 'M' + x(0) + ' ' + y(topo);
    for (let c = 0; c < ciclos; c++) {
      const fim = (c + 1) * r.ciclo;
      d += 'L' + x(fim) + ' ' + y(r.ss);
      if (c < ciclos - 1) d += 'L' + x(fim) + ' ' + y(topo);
    }
    svg.appendChild(svgEl('path', { d, class: 'rp-linha' }));

    // marca o dia do pedido (quando o estoque cruza o ponto de pedido) e a chegada do lote
    if (r.rop <= topo) {
      for (let c = 0; c < ciclos; c++) {
        const diaPedido = (c + 1) * r.ciclo - e.L;
        if (diaPedido < 0) continue;
        svg.appendChild(svgEl('circle', { cx: x(diaPedido), cy: y(r.rop), r: 5, class: 'rp-ponto' }));
        svg.appendChild(svgEl('line', { x1: x(diaPedido), x2: x(diaPedido), y1: y(r.rop), y2: y(0), class: 'rp-guia' }));
      }
      const primeiro = r.ciclo - e.L;
      svg.appendChild(svgEl('text', { x: x(primeiro) - 8, y: y(r.rop) - 9, class: 'rp-rotulo', 'text-anchor': 'end' }, T.pedido));
      svg.appendChild(svgEl('text', { x: x(r.ciclo) + 8, y: y(topo) + 4, class: 'rp-rotulo' }, T.chega));
    }

    // rótulos dos eixos
    [[0, '0'], [r.ss, n0(r.ss)], [r.rop, n0(r.rop)], [topo, n0(topo)]].forEach(([v, txt], i, lista) => {
      if (v > topo) return;
      if (lista.some(([o], k) => k < i && Math.abs(y(o) - y(v)) < 13)) return; // evita rótulo em cima de rótulo
      svg.appendChild(svgEl('text', { x: ME - 8, y: y(v) + 4, class: 'rp-tick', 'text-anchor': 'end' }, txt));
    });
    for (let c = 0; c <= ciclos; c++) {
      svg.appendChild(svgEl('text', { x: x(c * r.ciclo), y: H - MB + 16, class: 'rp-tick', 'text-anchor': 'middle' }, n0(c * r.ciclo)));
    }
    svg.appendChild(svgEl('text', { x: (ME + W - MD) / 2, y: H - 6, class: 'rp-tick', 'text-anchor': 'middle' }, T.eixoX));
    if (r.rop <= topo) svg.appendChild(svgEl('text', { x: W - MD - 4, y: y(r.rop) - 6, class: 'rp-rotulo rp-rotulo-rop', 'text-anchor': 'end' }, T.rop));
    svg.appendChild(svgEl('text', { x: W - MD - 4, y: y(r.ss) + 14, class: 'rp-rotulo rp-rotulo-ss', 'text-anchor': 'end' }, T.ss));
    alvo.appendChild(svg);
  }

  function atualizar() {
    const e = {
      d: ler($('rpDemanda')), sigma: ler($('rpDesvio')), L: ler($('rpLead')), z: ler($('rpServico')),
      S: ler($('rpPedido')), H: ler($('rpManter')), dias: ler($('rpDias'))
    };
    const ok = Object.keys(e).every(k => isFinite(e[k]) && (k === 'sigma' ? e[k] >= 0 : e[k] > 0));
    $('rpErro').textContent = ok ? '' : T.invalido;
    if (!ok) return;
    const r = calcular(e);
    $('rpEoq').textContent = n0(r.eoq) + T.un;
    $('rpSs').textContent = n0(r.ss) + T.un;
    $('rpRop').textContent = n0(r.rop) + T.un;
    $('rpFreq').textContent = n1(r.pedidosAno) + T.vezes;
    $('rpCiclo').textContent = T.cada + n0(r.ciclo) + T.dias;
    $('rpMedio').textContent = n0(r.estoqueMedio) + T.un;
    $('rpCusto').textContent = dinheiro(r.custoPedido + r.custoManter);
    $('rpFrase').textContent = T.frase(n0(r.rop), n0(r.eoq), n0(r.ss)) + (r.rop > r.ss + r.eoq ? ' ' + T.alertaLT : '');
    desenhar(e, r);
  }

  campos.forEach(c => c.addEventListener('input', atualizar));
  $('rpReset').addEventListener('click', () => {
    campos.forEach(c => { c.value = c.getAttribute('data-padrao'); });
    atualizar();
    if (typeof track === 'function') track('simulador-reposicao', { acao: 'exemplo' });
  });
  atualizar();
})();
