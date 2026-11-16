// Painel de capacidade e cobertura de uma fábrica fictícia de confeitos: ocupação das linhas,
// para onde vão as horas, Pareto das paradas e cobertura de estoque contra o alvo.
// Todos os dados são gerados no navegador, com semente fixa: todo visitante vê os mesmos números.
(function fabrica() {
  const raiz = document.getElementById('fbPainel');
  if (!raiz) return;
  const EN = document.documentElement.lang.startsWith('en');
  const LOCALE = EN ? 'en-US' : 'pt-BR';
  const $ = id => document.getElementById(id);
  const n0 = x => Math.round(x).toLocaleString(LOCALE);
  const n1 = x => x.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const n2 = x => x.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = x => n1(x * 100) + '%';
  const TETO = 85;

  const T = EN ? {
    mes: { 4: 'Apr', 5: 'May', 6: 'Jun' }, todos: 'Whole quarter', todas: 'All lines',
    partes: { prod: 'Production', setup: 'Setup', parada: 'Stops', ocioso: 'Idle' },
    motivos: ['Breakdown', 'Material shortage', 'Corrective maintenance', 'Awaiting quality'],
    ocup: 'Occupancy', teto: 'Cap ' + TETO + '%', horas: ' h', acum: 'Cumulative %', horasParada: 'Stop hours',
    kOcup: 'Plant occupancy', kParada: 'Stop hours', kMotivo: 'Main stop reason', kFora: 'Items out of range',
    subParadas: v => v + ' of available hours', subMotivo: v => v + ' of stop hours', subFora: (r, e) => r + ' at risk, ' + e + ' in excess',
    de: ' of ', semParada: 'without stops counted', comParada: 'with stops counted',
    t: { excesso: 'Excess', risco: 'Risk', ok: 'In range' },
    frase: (linha, o, h, mot, p) => linha + ' is the most loaded line, at ' + o + ' occupancy. Stops total ' + h + ' h, and the main reason is ' + mot + ' (' + p + ').',
    nomeLinha: { L1: 'Line 1', L2: 'Line 2', L3: 'Line 3' }
  } : {
    mes: { 4: 'Abr', 5: 'Mai', 6: 'Jun' }, todos: 'Trimestre todo', todas: 'Todas as linhas',
    partes: { prod: 'Produção', setup: 'Setup', parada: 'Paradas', ocioso: 'Ociosa' },
    motivos: ['Quebra', 'Falta de material', 'Manutenção corretiva', 'Aguardando qualidade'],
    ocup: 'Ocupação', teto: 'Teto de ' + TETO + '%', horas: ' h', acum: '% acumulado', horasParada: 'Horas de parada',
    kOcup: 'Ocupação da planta', kParada: 'Horas de parada', kMotivo: 'Principal motivo de parada', kFora: 'Itens fora da faixa',
    subParadas: v => v + ' das horas disponíveis', subMotivo: v => v + ' das horas de parada', subFora: (r, e) => r + ' em risco, ' + e + ' em excesso',
    de: ' de ', semParada: 'sem contar as paradas', comParada: 'contando as paradas',
    t: { excesso: 'Excesso', risco: 'Risco', ok: 'Na faixa' },
    frase: (linha, o, h, mot, p) => linha + ' é a linha mais carregada, com ' + o + ' de ocupação. As paradas somam ' + h + ' h, e o principal motivo é ' + mot + ' (' + p + ').',
    nomeLinha: { L1: 'Linha 1', L2: 'Linha 2', L3: 'Linha 3' }
  };

  const LINHAS = [
    { id: 'L1', turnos: 3, ocup: [0.74, 0.77, 0.80], peso: [0.46, 0.24, 0.18, 0.12] },
    { id: 'L2', turnos: 2, ocup: [0.86, 0.88, 0.90], peso: [0.34, 0.30, 0.22, 0.14] },
    { id: 'L3', turnos: 3, ocup: [0.89, 0.93, 0.96], peso: [0.30, 0.22, 0.22, 0.26] }
  ];
  const MESES = [{ id: 4, uteis: 20, dias: 30 }, { id: 5, uteis: 20, dias: 31 }, { id: 6, uteis: 21, dias: 30 }];

  // ---- horas: um turno por vez, com semente fixa
  let semente = 20260630;
  const rand = () => { semente = (semente * 1664525 + 1013904223) % 4294967296; return semente / 4294967296; };
  const sorteia = pesos => { let r = rand(), a = 0; for (let i = 0; i < pesos.length; i++) { a += pesos[i]; if (r < a) return i; } return pesos.length - 1; };
  const agg = {};   // agg[linha][mes] = { disp, prod, setup, parada, ocioso, motivos: [h,h,h,h] }
  LINHAS.forEach(l => {
    agg[l.id] = {};
    MESES.forEach((m, mi) => {
      const a = { disp: 0, prod: 0, setup: 0, parada: 0, ocioso: 0, motivos: [0, 0, 0, 0] };
      for (let d = 0; d < m.uteis; d++) {
        for (let t = 0; t < l.turnos; t++) {
          const disp = rand() < 0.05 ? 4 : 8;
          const setup = rand() < 0.45 ? Math.round((0.5 + rand() * 1.2) * 10) / 10 : 0;
          let parada = 0, motivo = -1;
          if (rand() < 0.35) { parada = Math.round((0.4 + rand() * 2.8) * 10) / 10; motivo = sorteia(l.peso); }
          let ocupado = disp * Math.min(1, l.ocup[mi] * (0.9 + rand() * 0.2));
          ocupado = Math.min(disp, Math.max(ocupado, setup + parada + 0.3));
          const prod = Math.max(0, ocupado - setup - parada);
          a.disp += disp; a.prod += prod; a.setup += setup; a.parada += parada; a.ocioso += disp - (prod + setup + parada);
          if (motivo >= 0) a.motivos[motivo] += parada;
        }
      }
      agg[l.id][m.id] = a;
    });
  });

  // ---- estoque: início do mês, venda do mês e cobertura alvo (dias), por item
  const ITENS = [
    { l: 'L1', pt: 'Bala dura morango 500 g', en: 'Strawberry hard candy 500 g', alvo: 25, v: [180000, 186000, 190000], e: [150000, 170000, 140000] },
    { l: 'L1', pt: 'Bala dura menta 500 g', en: 'Mint hard candy 500 g', alvo: 25, v: [170000, 172000, 175000], e: [330000, 340000, 350000] },
    { l: 'L2', pt: 'Goma frutas 200 g', en: 'Fruit gummies 200 g', alvo: 30, v: [180000, 184000, 188000], e: [130000, 150000, 140000] },
    { l: 'L2', pt: 'Goma ácida 150 g', en: 'Sour gummies 150 g', alvo: 30, v: [176000, 180000, 185000], e: [60000, 55000, 70000] },
    { l: 'L2', pt: 'Goma ursinhos 1 kg', en: 'Gummy bears 1 kg', alvo: 30, v: [17000, 18000, 18500], e: [16000, 17500, 15000] },
    { l: 'L3', pt: 'Drágea de chocolate 100 g', en: 'Chocolate dragée 100 g', alvo: 30, v: [88000, 91000, 93000], e: [80000, 85000, 70000] },
    { l: 'L3', pt: 'Drágea de amendoim 100 g', en: 'Peanut dragée 100 g', alvo: 30, v: [64000, 66000, 68000], e: [60000, 66000, 50000] },
    { l: 'L3', pt: 'Barra de chocolate ao leite 80 g', en: 'Milk chocolate bar 80 g', alvo: 30, v: [124000, 127000, 130000], e: [110000, 119000, 150000] }
  ];
  const razao = (it, mi) => (it.e[mi] / (it.v[mi] / MESES[mi].dias)) / it.alvo;
  const classe = r => (r > 1.5 ? 'excesso' : r < 0.5 ? 'risco' : 'ok');

  // ---- filtros e somas
  const fMes = $('fbMes'), fLinha = $('fbLinha'), fParadas = $('fbParadas');
  const mesesSel = () => (fMes.value === 'all' ? MESES : MESES.filter(m => String(m.id) === fMes.value));
  const linhasSel = () => (fLinha.value === 'all' ? LINHAS : LINHAS.filter(l => l.id === fLinha.value));
  const somar = (linhas, meses) => {
    const s = { disp: 0, prod: 0, setup: 0, parada: 0, ocioso: 0, motivos: [0, 0, 0, 0] };
    linhas.forEach(l => meses.forEach(m => {
      const a = agg[l.id][m.id];
      ['disp', 'prod', 'setup', 'parada', 'ocioso'].forEach(k => { s[k] += a[k]; });
      a.motivos.forEach((h, i) => { s.motivos[i] += h; });
    }));
    return s;
  };
  const contaParada = () => fParadas.value === 'sim';
  const ocupacao = s => (s.prod + s.setup + (contaParada() ? s.parada : 0)) / s.disp;

  // ---- gráficos (Chart.js, o mesmo do Boletim de Ruptura)
  const css = nome => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const escuro = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  const cores = () => (escuro()
    ? { prod: '#3F86D6', setup: '#2FA07A', parada: '#E08A2E', ocioso: '#52667E', meses: ['#7FA9DC', '#3F86D6', '#2A62B0'] }
    : { prod: '#2A6CB8', setup: '#1B7F5B', parada: '#C96A0A', ocioso: '#CBD5DE', meses: ['#9DBDE3', '#2A6CB8', '#174A87'] });
  const alfa = (hex, op) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + op + ')'; };
  const tooltip = () => ({ backgroundColor: css('--surface'), titleColor: css('--text'), bodyColor: css('--text'), borderColor: css('--line'), borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true });
  let cA, cB, cC;

  function padroes() {
    Chart.defaults.font.family = "'Barlow', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = css('--muted');
    Chart.defaults.borderColor = css('--line');
  }

  function renderizar() {
    const c = cores();
    const meses = mesesSel(), linhas = linhasSel();
    const foco = id => fLinha.value === 'all' || fLinha.value === id;

    // KPIs
    const s = somar(linhas, meses);
    $('kOcup').querySelector('b').textContent = pct(ocupacao(s));
    $('kOcup').querySelector('small').textContent = contaParada() ? T.comParada : T.semParada;
    $('kParada').querySelector('b').textContent = n0(s.parada) + T.horas;
    $('kParada').querySelector('small').textContent = T.subParadas(pct(s.parada / s.disp));
    const ordem = s.motivos.map((h, i) => [h, i]).sort((a, b) => b[0] - a[0]);
    const totalMot = s.motivos.reduce((a, b) => a + b, 0);
    $('kMotivo').querySelector('b').textContent = T.motivos[ordem[0][1]];
    $('kMotivo').querySelector('small').textContent = T.subMotivo(pct(ordem[0][0] / totalMot));
    const mi = fMes.value === 'all' ? 2 : MESES.findIndex(m => String(m.id) === fMes.value);
    const itens = ITENS.filter(it => foco(it.l));
    const risco = itens.filter(it => classe(razao(it, mi)) === 'risco').length;
    const excesso = itens.filter(it => classe(razao(it, mi)) === 'excesso').length;
    $('kFora').querySelector('b').textContent = (risco + excesso) + T.de + itens.length;
    $('kFora').querySelector('small').textContent = T.subFora(risco, excesso) + ' · ' + T.mes[MESES[mi].id];

    // A: para onde vão as horas, por linha, em % das horas disponíveis
    const partes = ['prod', 'setup', 'parada', 'ocioso'];
    const porLinha = LINHAS.map(l => somar([l], meses));
    const dadosA = {
      labels: LINHAS.map(l => T.nomeLinha[l.id] + ' · ' + pct(ocupacao(porLinha[LINHAS.indexOf(l)]))),
      datasets: partes.map(k => ({
        label: T.partes[k], data: porLinha.map(p => p[k] / p.disp * 100),
        backgroundColor: LINHAS.map(l => alfa(c[k], foco(l.id) ? 1 : 0.3)), borderWidth: 0
      }))
    };
    const opA = {
      indexAxis: 'y', maintainAspectRatio: false,
      scales: { x: { stacked: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: css('--line') }, border: { display: false } }, y: { stacked: true, grid: { display: false } } },
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { ...tooltip(), callbacks: { label: x => ' ' + x.dataset.label + ': ' + n1(x.parsed.x) + '% (' + n0(porLinha[x.dataIndex][partes[x.datasetIndex]]) + T.horas + ')' } } }
    };
    if (!cA) cA = new Chart($('cA'), { type: 'bar', data: dadosA, options: opA });
    else { cA.data = dadosA; cA.update(); }

    // B: ocupação por linha e mês, com o teto
    const dadosB = {
      labels: LINHAS.map(l => T.nomeLinha[l.id]),
      datasets: MESES.map((m, i) => ({
        type: 'bar', label: T.mes[m.id], data: LINHAS.map(l => { const a = agg[l.id][m.id]; return (a.prod + a.setup + (contaParada() ? a.parada : 0)) / a.disp * 100; }),
        backgroundColor: LINHAS.map(l => alfa(c.meses[i], foco(l.id) ? 1 : 0.3)), borderRadius: 3
      })).concat([{ type: 'line', label: T.teto, data: LINHAS.map(() => TETO), borderColor: css('--text'), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false }])
    };
    const opB = {
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: css('--line') }, border: { display: false } }, x: { grid: { display: false } } },
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { ...tooltip(), callbacks: { label: x => ' ' + x.dataset.label + ': ' + n1(x.parsed.y) + '%' } } }
    };
    if (!cB) cB = new Chart($('cB'), { type: 'bar', data: dadosB, options: opB });
    else { cB.data = dadosB; cB.update(); }

    // C: Pareto das paradas por motivo
    const pares = s.motivos.map((h, i) => ({ h, nome: T.motivos[i] })).sort((a, b) => b.h - a.h);
    let acum = 0;
    const cum = pares.map(p => { acum += p.h; return totalMot ? acum / totalMot * 100 : 0; });
    const dadosC = {
      labels: pares.map(p => p.nome),
      datasets: [
        { type: 'bar', label: T.horasParada, data: pares.map(p => p.h), backgroundColor: c.parada, borderRadius: 3, yAxisID: 'y', order: 2 },
        { type: 'line', label: T.acum, data: cum, borderColor: css('--text'), backgroundColor: css('--text'), borderWidth: 2, pointRadius: 4, yAxisID: 'y1', order: 1 }
      ]
    };
    const opC = {
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: T.horasParada }, grid: { color: css('--line') }, border: { display: false } },
        y1: { position: 'right', min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { display: false }, border: { display: false } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { ...tooltip(), callbacks: { label: x => ' ' + x.dataset.label + ': ' + (x.datasetIndex === 1 ? n1(x.parsed.y) + '%' : n1(x.parsed.y) + T.horas) } } }
    };
    if (!cC) cC = new Chart($('cC'), { type: 'bar', data: dadosC, options: opC });
    else { cC.data = dadosC; cC.update(); }

    // D: cobertura por item e mês, em múltiplos do alvo
    const corpo = $('fbCorpo');
    corpo.textContent = '';
    itens.forEach(it => {
      const tr = document.createElement('tr');
      const nome = document.createElement('td');
      nome.textContent = (EN ? it.en : it.pt) + ' · ' + T.nomeLinha[it.l];
      tr.appendChild(nome);
      MESES.forEach((m, k) => {
        const r = razao(it, k), cl = classe(r);
        const td = document.createElement('td');
        td.className = 'num fb-cel fb-' + cl + (fMes.value !== 'all' && String(m.id) === fMes.value ? ' fb-sel' : '');
        td.textContent = n2(r) + 'x' + (cl === 'excesso' ? ' ▲' : cl === 'risco' ? ' ▼' : '');
        td.title = T.t[cl] + ' · ' + n0(it.e[k] / (it.v[k] / m.dias)) + (EN ? ' days' : ' dias') + ' · ' + (EN ? 'target ' : 'alvo ') + it.alvo + (EN ? ' days' : ' dias');
        tr.appendChild(td);
      });
      corpo.appendChild(tr);
    });

    // frase de leitura
    const porL = linhas.map(l => ({ l, o: ocupacao(somar([l], meses)) })).sort((a, b) => b.o - a.o)[0];
    $('fbFrase').textContent = T.frase(T.nomeLinha[porL.l.id], pct(porL.o), n0(s.parada), T.motivos[ordem[0][1]].toLowerCase(), pct(ordem[0][0] / totalMot));
  }

  function reconstruir() {
    [cA, cB, cC].forEach(ch => ch && ch.destroy());
    cA = cB = cC = null;
    padroes();
    renderizar();
  }

  [fMes, fLinha, fParadas].forEach(el => el.addEventListener('change', () => {
    renderizar();
    if (typeof track === 'function') track('dashboard-filtro', { filtro: el.id });
  }));
  new MutationObserver(reconstruir).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reconstruir);
  padroes();
  renderizar();
})();
