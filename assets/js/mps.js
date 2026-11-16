// Simulador de MPS com teto de ocupação: de out a dez, calcula quanto produzir de um item de
// campanha para entregar a cobertura alvo e testa se o plano cabe sob o teto de ocupação,
// lido na linha inteira (com a carga dos outros itens) ou só sobre o item.
// Tudo é calculado no navegador; os números são fictícios.
(function mps() {
  const raiz = document.getElementById('simulador-mps');
  if (!raiz) return;
  const EN = document.documentElement.lang.startsWith('en');
  const LOCALE = EN ? 'en-US' : 'pt-BR';
  const $ = id => document.getElementById(id);
  const n0 = x => Math.round(x).toLocaleString(LOCALE);
  const n1 = x => x.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const MESES = EN ? ['Oct', 'Nov', 'Dec'] : ['Out', 'Nov', 'Dez'];
  const MESES_LONGO = EN ? ['October', 'November', 'December'] : ['outubro', 'novembro', 'dezembro'];
  const PROX = EN ? ['November', 'December', 'January'] : ['novembro', 'dezembro', 'janeiro'];
  const DIAS = [31, 30, 31, 31];   // out, nov, dez e jan (jan repete dez)
  const UTEIS = [21, 19, 22];      // dias úteis, já sem feriados nacionais

  const T = EN ? {
    cabe: 'Fits', naoCabe: 'Does not fit', acima: ' (above the cap)', un: ' units', h: ' h', dias: ' days',
    invalido: 'Fill every field with a valid number (the cap between 1 and 100).',
    ocup: 'Line occupancy', outros: 'Other items', este: 'This item', teto: 'Cap', disp: 'Hours available',
    todasCabem: (t, a) => 'The plan reaches the target coverage and stays within the ' + t + '% cap in every month.',
    quebra: (mes, livre, preciso, falta, sab, prod, prox, cob, alvo) =>
      'In ' + mes + ', the cap leaves ' + livre + ' h for this item and the target needs ' + preciso + ' h: ' + falta + ' h are missing, about ' + sab + (sab === 1 ? ' Saturday' : ' Saturdays') + ' of 3 shifts. Planned production is ' + prod + ' units and coverage at the start of ' + prox + ' falls to ' + cob + ' days, against a target of ' + alvo + '.',
    mais: n => n === 1 ? ' One more month is also capped.' : ' ' + n + ' more months are also capped.',
    ruptura: (mes, un) => ' There is a stockout of ' + un + ' units in ' + mes + '.',
    soItem: (a, b, pior, mes, t) => 'Reading the cap only on this item, the plan "fits" every month (the item uses ' + a + '% to ' + b + '% of the line). But the whole line reaches ' + pior + '% in ' + mes + ', above the ' + t + '% cap.',
    soItemOk: (t) => 'Reading the cap only on this item, the plan fits every month, and the whole line also stays under ' + t + '%.'
  } : {
    cabe: 'Cabe', naoCabe: 'Não cabe', acima: ' (acima do teto)', un: ' un', h: ' h', dias: ' dias',
    invalido: 'Preencha todos os campos com um número válido (o teto entre 1 e 100).',
    ocup: 'Ocupação da linha', outros: 'Outros itens', este: 'Este item', teto: 'Teto', disp: 'Horas disponíveis',
    todasCabem: (t, a) => 'O plano entrega a cobertura alvo e fica dentro do teto de ' + t + '% em todos os meses.',
    quebra: (mes, livre, preciso, falta, sab, prod, prox, cob, alvo) =>
      'Em ' + mes + ', o teto deixa ' + livre + ' h para este item e o alvo pede ' + preciso + ' h: faltam ' + falta + ' h, cerca de ' + sab + (sab === 1 ? ' sábado' : ' sábados') + ' de 3 turnos. A produção planejada fica em ' + prod + ' un e a cobertura no início de ' + prox + ' cai para ' + cob + ' dias, contra o alvo de ' + alvo + '.',
    mais: n => n === 1 ? ' Mais um mês também fica limitado pelo teto.' : ' Mais ' + n + ' meses também ficam limitados pelo teto.',
    ruptura: (mes, un) => ' Há ruptura de ' + un + ' un em ' + mes + '.',
    soItem: (a, b, pior, mes, t) => 'Lendo o teto só sobre o item, o plano "cabe" em todos os meses (o item usa de ' + a + '% a ' + b + '% da linha). Mas a linha inteira chega a ' + pior + '% em ' + mes + ', acima do teto de ' + t + '%.',
    soItemOk: (t) => 'Lendo o teto só sobre o item, o plano cabe em todos os meses, e a linha inteira também fica abaixo de ' + t + '%.'
  };

  const ler = id => parseFloat(String($(id).value).replace(',', '.'));
  const entradas = () => ({
    S: ler('mpEstoque'), alvo: ler('mpAlvo'), vaz: ler('mpVazao'), fixas: ler('mpFixas'), outros: ler('mpOutros'),
    hdia: ler('mpHDia'), teto: ler('mpTeto') / 100, sab: ler('mpSab'), D: [ler('mpD0'), ler('mpD1'), ler('mpD2')]
  });
  const valido = e => [e.S, e.alvo, e.vaz, e.hdia].every(v => isFinite(v) && v > 0) &&
    [e.fixas, e.outros, e.sab].every(v => isFinite(v) && v >= 0) && e.D.every(v => isFinite(v) && v >= 0) &&
    isFinite(e.teto) && e.teto > 0 && e.teto <= 1;

  // A conta, mês a mês. modo 'linha': o teto vale para a linha inteira; modo 'item': só para as horas do item.
  function calcular(e, modo) {
    const D = e.D.concat([e.D[2]]);
    let S = e.S;
    return [0, 1, 2].map(m => {
      const disp = (UTEIS[m] + e.sab) * e.hdia;
      const outros = e.outros * UTEIS[m];
      const tetoH = e.teto * disp;
      const livre = modo === 'linha' ? tetoH - outros - e.fixas : tetoH - e.fixas;
      const capUn = Math.max(0, livre) * e.vaz;
      const alvoFim = e.alvo * D[m + 1] / DIAS[m + 1];
      const nec = Math.ceil(Math.max(0, alvoFim + D[m] - S) / 100 - 1e-12) * 100;
      const cabe = nec <= capUn + 1e-9;
      const prod = cabe ? nec : Math.floor(capUn / 100) * 100;
      const hItem = prod > 0 ? prod / e.vaz + e.fixas : 0;
      const hLinha = outros + hItem;
      let fim = S + prod - D[m], falta = 0;
      if (fim < 0) { falta = -fim; fim = 0; }
      const r = {
        m, S, nec, capUn, prod, cabe, hItem, hLinha, outros, disp, tetoH, livre, fim, falta,
        cob: fim / (D[m + 1] / DIAS[m + 1]),
        ocup: hLinha / disp, ocupItem: hItem / disp,
        horasPreciso: nec / e.vaz + e.fixas
      };
      S = fim;
      return r;
    });
  }

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, texto) => {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    if (texto != null) n.textContent = texto;
    return n;
  };

  function grafico(res) {
    const alvo = $('mpGrafico');
    alvo.textContent = '';
    const W = 680, H = 320, ME = 20, MD = 20, MT = 30, MB = 46;
    const maximo = Math.max(...res.map(r => Math.max(r.disp, r.hLinha))) * 1.05;
    const y = h => MT + (1 - h / maximo) * (H - MT - MB);
    const largura = (W - ME - MD) / 3;
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': T.ocup + ': ' + res.map((r, i) => MESES[i] + ' ' + Math.round(r.ocup * 100) + '%').join(', ') });
    svg.appendChild(svgEl('line', { x1: ME, x2: W - MD, y1: y(0), y2: y(0), class: 'mp-eixo' }));
    res.forEach((r, i) => {
      const x0 = ME + i * largura + largura * 0.2, w = largura * 0.6;
      // caixa das horas disponíveis e linha tracejada do teto
      svg.appendChild(svgEl('rect', { x: x0 - 6, y: y(r.disp), width: w + 12, height: y(0) - y(r.disp), class: 'mp-disp' }));
      // pilha: outros itens embaixo, este item em cima
      svg.appendChild(svgEl('rect', { x: x0, y: y(r.outros), width: w, height: y(0) - y(r.outros), class: 'mp-outros' }));
      svg.appendChild(svgEl('rect', { x: x0, y: y(r.hLinha), width: w, height: y(r.outros) - y(r.hLinha), class: 'mp-item' }));
      svg.appendChild(svgEl('line', { x1: x0 - 6, x2: x0 + w + 6, y1: y(r.tetoH), y2: y(r.tetoH), class: 'mp-teto' }));
      const acima = r.hLinha > r.tetoH + 1e-9;
      svg.appendChild(svgEl('text', { x: x0 + w / 2, y: y(Math.max(r.hLinha, r.disp)) - 8, class: 'mp-pct' + (acima ? ' mp-acima' : ''), 'text-anchor': 'middle' },
        Math.round(r.ocup * 100) + '%' + (acima ? ' ▲' : '')));
      svg.appendChild(svgEl('text', { x: x0 + w / 2, y: H - MB + 20, class: 'mp-mes', 'text-anchor': 'middle' }, MESES[i]));
    });
    alvo.appendChild(svg);
  }

  function tabela(res, e) {
    const corpo = $('mpCorpo');
    corpo.textContent = '';
    res.forEach((r, i) => {
      const tr = document.createElement('tr');
      const acima = r.ocup > e.teto + 1e-9;
      const celulas = [
        [MESES[i], ''], [n0(r.nec), 'num'], [n0(r.capUn), 'num'], [n0(r.prod), 'num'],
        [n1(r.cob) + T.dias + (r.cob + 1e-9 < e.alvo ? ' ▼' : ''), 'num' + (r.cob + 1e-9 < e.alvo ? ' mp-baixo' : '')],
        [Math.round(r.ocup * 100) + '%' + (acima ? T.acima : ''), 'num' + (acima ? ' mp-baixo' : '')]
      ];
      celulas.forEach(([txt, cls], k) => {
        const td = document.createElement('td');
        td.textContent = txt;
        if (cls) td.className = cls;
        if (k === 3) {   // o plano diz, na própria célula, se o volume necessário coube
          const s = document.createElement('small');
          s.className = r.cabe ? 'mp-cabe' : 'mp-naocabe';
          s.textContent = r.cabe ? T.cabe : T.naoCabe;
          td.appendChild(s);
        }
        tr.appendChild(td);
      });
      corpo.appendChild(tr);
    });
  }

  function frase(res, e, modo) {
    if (modo === 'item') {
      const pior = res.reduce((a, b) => (b.ocup > a.ocup ? b : a));
      if (pior.ocup <= e.teto + 1e-9) return T.soItemOk(Math.round(e.teto * 100));
      const itens = res.map(r => Math.round(r.ocupItem * 100));
      return T.soItem(Math.min(...itens), Math.max(...itens), Math.round(pior.ocup * 100), MESES_LONGO[pior.m], Math.round(e.teto * 100));
    }
    const ruins = res.filter(r => !r.cabe);
    if (!ruins.length) return T.todasCabem(Math.round(e.teto * 100));
    const r = ruins[0];
    const faltam = Math.max(0, r.horasPreciso - Math.max(0, r.livre));
    const sab = Math.max(1, Math.ceil(faltam / (e.teto * e.hdia)));
    let s = T.quebra(MESES_LONGO[r.m], n1(Math.max(0, r.livre)), n1(r.horasPreciso), n1(faltam), sab, n0(r.prod), PROX[r.m], n1(r.cob), e.alvo);
    if (ruins.length > 1) s += T.mais(ruins.length - 1);
    const ruptura = res.find(x => x.falta > 0);
    if (ruptura) s += T.ruptura(MESES_LONGO[ruptura.m], n0(ruptura.falta));
    return s;
  }

  let modo = 'linha';
  function atualizar() {
    const e = entradas();
    $('mpErro').textContent = valido(e) ? '' : T.invalido;
    if (!valido(e)) return;
    const res = calcular(e, modo);
    tabela(res, e);
    grafico(res);
    $('mpFrase').textContent = frase(res, e, modo);
  }

  const botoes = document.querySelectorAll('#mpSeg [data-modo]');
  botoes.forEach(b => b.addEventListener('click', () => {
    modo = b.dataset.modo;
    botoes.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    atualizar();
    if (typeof track === 'function') track('simulador-mps', { leitura: modo });
  }));
  raiz.querySelectorAll('input').forEach(c => c.addEventListener('input', atualizar));
  $('mpReset').addEventListener('click', () => {
    raiz.querySelectorAll('input').forEach(c => { c.value = c.getAttribute('data-padrao'); });
    atualizar();
  });
  atualizar();
})();
