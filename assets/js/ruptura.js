// Boletim de Ruptura: réplica web do dashboard Power BI, com dados fictícios gerados no navegador

(function () {
  // Gerador pseudoaleatório com semente fixa: todo visitante vê os mesmos números
  let seed = 20261023;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

  const WEEKS = [36, 37, 38, 39, 40, 41, 42, 43];
  const LINES = [
    { id: 'Novidade', risk: 1.35, cd: 0.55 },
    { id: 'Core', risk: 0.85, cd: 0.82 },
    { id: 'Essencial', risk: 0.7, cd: 0.88 },
    { id: 'Sazonal', risk: 1.25, cd: 0.5 }
  ];
  const STORES = [
    ['SP Centro', 'Loja própria'], ['SP Pinheiros', 'Loja própria'], ['SP Tatuapé', 'Loja própria'], ['Campinas', 'Loja própria'],
    ['Santos', 'Franquia'], ['Sorocaba', 'Franquia'], ['Ribeirão Preto', 'Franquia'], ['Rio Tijuca', 'Loja própria'],
    ['Rio Centro', 'Loja própria'], ['Niterói', 'Franquia'], ['BH Savassi', 'Loja própria'], ['Uberlândia', 'Franquia'],
    ['Curitiba', 'Loja própria'], ['Joinville', 'Franquia'], ['Porto Alegre', 'Loja própria'], ['Florianópolis', 'Franquia'],
    ['Goiânia', 'Franquia'], ['Brasília', 'Loja própria'], ['Salvador', 'Franquia'], ['Recife', 'Loja própria']
  ].map(([name, canal]) => ({ name, canal, base: 0.05 + rand() * 0.11 }));

  const SKUS = Array.from({ length: 80 }, (_, i) => ({
    line: LINES[i % 4],
    pot: Math.round(300 + rand() * 1700)
  }));

  // Uma linha por semana x loja x SKU
  const rows = [];
  WEEKS.forEach((week, wi) => {
    const wf = 1 + Math.sin(wi / 1.6) * 0.18 - wi * 0.012;
    STORES.forEach(store => {
      SKUS.forEach(sku => {
        const cd = rand() < sku.line.cd;
        const p = Math.min(0.6, store.base * sku.line.risk * wf * (cd ? 0.62 : 1.35));
        const r1 = rand() < p;
        const r7 = r1 ? (3 + Math.floor(rand() * 5)) / 7 : (rand() < p * 0.5 ? (1 + Math.floor(rand() * 2)) / 7 : 0);
        rows.push({ week, store, line: sku.line.id, canal: store.canal, cd, r1, r7, pot: sku.pot });
      });
    });
  });

  // Medidas (equivalentes às medidas DAX do modelo original)
  function measures(list) {
    let n = 0, r = 0, nT = 0, rT = 0, v = 0, pot = 0;
    for (const x of list) {
      n++; if (x.r1) r++;
      if (x.cd) { nT++; if (x.r1) rT++; }
      v += x.r7 * x.pot; pot += x.pot;
    }
    return { total: n ? r / n : 0, trat: nT ? rT / nT : 0, repor: rT, valor: v, pctValor: pot ? v / pot : 0 };
  }

  const $ = id => document.getElementById(id);
  const fWeek = $('fWeek'), fCanal = $('fCanal'), fLine = $('fLine'), fMetric = $('fMetric');
  WEEKS.slice().reverse().forEach(w => fWeek.add(new Option('Semana ' + w, w)));

  const pct = x => (x * 100).toFixed(1).replace('.', ',') + '%';
  const pp = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(1).replace('.', ',') + ' p.p.';
  const brl = x => 'R$ ' + Math.round(x / 1000).toLocaleString('pt-BR') + ' mil';

  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  // Cores validadas (contraste e daltonismo) para fundo claro e escuro
  const colors = () => isDark()
    ? { total: '#3F86D6', trat: '#D9740F' }
    : { total: '#2A6CB8', trat: '#C96A0A' };

  const filtered = (week, opts = {}) => rows.filter(x =>
    (week == null || x.week === week) &&
    (fCanal.value === 'all' || x.canal === fCanal.value) &&
    (opts.ignoreLine || fLine.value === 'all' || x.line === fLine.value));

  let trendChart, storeChart, lineChart;

  // Rótulo direto no último ponto de cada série (a cor fica só na linha, o texto usa a cor de texto)
  const endLabels = {
    id: 'endLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = "600 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = css('--text');
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((ds, i) => {
        const pts = chart.getDatasetMeta(i).data;
        const last = pts[pts.length - 1];
        if (!last) return;
        ctx.fillText(ds.data[ds.data.length - 1].toFixed(1).replace('.', ',') + '%', last.x + 10, last.y);
      });
      ctx.restore();
    }
  };

  function chartDefaults() {
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = css('--muted');
    Chart.defaults.borderColor = css('--line');
  }

  function tooltip() {
    return {
      backgroundColor: css('--surface'), titleColor: css('--text'), bodyColor: css('--text'),
      borderColor: css('--line'), borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true
    };
  }

  function render() {
    const week = +fWeek.value;
    const prev = WEEKS[WEEKS.indexOf(week) - 1];
    const metric = fMetric.value;
    const c = colors();

    // KPIs
    const m = measures(filtered(week));
    const mp = prev ? measures(filtered(prev)) : null;
    const kpis = [
      ['kTotal', pct(m.total), mp ? pp(m.total - mp.total) : '', mp && m.total > mp.total],
      ['kTrat', pct(m.trat), mp ? pp(m.trat - mp.trat) : '', mp && m.trat > mp.trat],
      ['kRepor', m.repor.toLocaleString('pt-BR'), mp ? ((m.repor - mp.repor >= 0 ? '+' : '') + (m.repor - mp.repor) + ' vs semana anterior') : '', mp && m.repor > mp.repor],
      ['kValor', brl(m.valor), pct(m.pctValor) + ' da venda potencial', false]
    ];
    kpis.forEach(([id, val, delta, worse]) => {
      $(id).querySelector('b').textContent = val;
      const d = $(id).querySelector('small');
      d.textContent = delta;
      d.dataset.trend = id === 'kValor' ? '' : (worse ? 'up' : 'down');
    });

    // Tendência semanal
    const trend = WEEKS.map(w => measures(filtered(w)));
    const labels = WEEKS.map(w => 'S' + w);
    $('lTrend').innerHTML = '<span><i style="background:' + c.total + '"></i>Ruptura total</span><span><i style="background:' + c.trat + '"></i>Ruptura tratável</span>';
    const ds = [
      { label: 'Ruptura total', data: trend.map(t => t.total * 100), borderColor: c.total, backgroundColor: c.total },
      { label: 'Ruptura tratável', data: trend.map(t => t.trat * 100), borderColor: c.trat, backgroundColor: c.trat }
    ].map(d => ({ ...d, borderWidth: 2, pointRadius: labels.map(l => l === 'S' + week ? 5 : 0), pointHoverRadius: 6, pointBorderColor: css('--surface'), pointBorderWidth: 2, tension: 0.25 }));
    if (!trendChart) {
      trendChart = new Chart($('cTrend'), {
        type: 'line',
        data: { labels, datasets: ds },
        plugins: [endLabels],
        options: {
          maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
          layout: { padding: { right: 48 } },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => v + '%' }, grid: { color: css('--line') }, border: { display: false } },
            x: { grid: { display: false } }
          },
          plugins: {
            legend: { display: false },
            tooltip: { ...tooltip(), callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1).replace('.', ',') + '%' } }
          }
        }
      });
    } else { trendChart.data.datasets = ds; trendChart.update(); }

    // Ruptura por loja (semana selecionada)
    const byStore = STORES.map(s => {
      const list = filtered(week).filter(x => x.store === s);
      const listPrev = prev ? filtered(prev).filter(x => x.store === s) : [];
      return { s, m: measures(list), mp: listPrev.length ? measures(listPrev) : null, n: list.length };
    }).filter(x => x.n);
    const key = metric === 'trat' ? 'trat' : 'total';
    const sorted = byStore.slice().sort((a, b) => b.m[key] - a.m[key]);
    const top = sorted.slice(0, 12);
    const storeData = {
      labels: top.map(x => x.s.name),
      datasets: [{ label: metric === 'trat' ? 'Ruptura tratável' : 'Ruptura total', data: top.map(x => x.m[key] * 100), backgroundColor: c[key], borderRadius: 4, maxBarThickness: 14, borderSkipped: 'start' }]
    };
    if (!storeChart) {
      storeChart = new Chart($('cStore'), {
        type: 'bar', data: storeData,
        options: {
          indexAxis: 'y', maintainAspectRatio: false,
          scales: { x: { beginAtZero: true, ticks: { callback: v => v + '%' }, grid: { color: css('--line') }, border: { display: false } }, y: { grid: { display: false } } },
          plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.x.toFixed(1).replace('.', ',') + '%' } } }
        }
      });
    } else { storeChart.data = storeData; storeChart.update(); }
    $('tStoreTitle').textContent = (metric === 'trat' ? 'Ruptura tratável' : 'Ruptura total') + ' por loja, semana ' + week + ' (12 maiores)';

    // Ruptura por linha de produto
    const byLine = LINES.map(l => measures(filtered(week, { ignoreLine: true }).filter(x => x.line === l.id)));
    const lineData = {
      labels: LINES.map(l => l.id),
      datasets: [{ label: metric === 'trat' ? 'Ruptura tratável' : 'Ruptura total', data: byLine.map(x => x[key] * 100), backgroundColor: LINES.map(l => fLine.value === 'all' || fLine.value === l.id ? c[key] : css('--line')), borderRadius: 4, maxBarThickness: 36, borderSkipped: 'start' }]
    };
    if (!lineChart) {
      lineChart = new Chart($('cLine'), {
        type: 'bar', data: lineData,
        options: {
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' }, grid: { color: css('--line') }, border: { display: false } }, x: { grid: { display: false } } },
          plugins: { legend: { display: false }, tooltip: { ...tooltip(), callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1).replace('.', ',') + '%' } } }
        }
      });
    } else { lineChart.data = lineData; lineChart.update(); }
    $('tLineTitle').textContent = (metric === 'trat' ? 'Ruptura tratável' : 'Ruptura total') + ' por linha de produto';

    // Detratoras e promotoras
    const rowHtml = x => {
      const d = x.mp ? x.m[key] - x.mp[key] : null;
      return '<tr><td>' + x.s.name + '</td><td>' + x.s.canal + '</td><td class="num">' + pct(x.m[key]) + '</td><td class="num">' + x.m.repor + '</td><td class="num" data-trend="' + (d == null ? '' : d > 0 ? 'up' : 'down') + '">' + (d == null ? '' : pp(d)) + '</td></tr>';
    };
    $('tDet').innerHTML = sorted.slice(0, 5).map(rowHtml).join('');
    $('tPro').innerHTML = sorted.slice(-5).reverse().map(rowHtml).join('');
  }

  function rebuild() {
    // Recria os gráficos quando o tema muda, para trocar cores de texto, grade e séries
    [trendChart, storeChart, lineChart].forEach(ch => ch && ch.destroy());
    trendChart = storeChart = lineChart = null;
    chartDefaults();
    render();
  }

  [fWeek, fCanal, fLine, fMetric].forEach(el => el.addEventListener('change', () => {
    render();
    if (typeof track === 'function') track('dashboard-filtro', { filtro: el.id });
  }));
  new MutationObserver(rebuild).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rebuild);

  chartDefaults();
  render();
})();
