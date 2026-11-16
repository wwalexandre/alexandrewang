// Cobertura de estoque que engana: o mesmo estoque, lido de duas formas.
// "Para trás" divide o estoque pela venda do mês atual; "para a frente", pela previsão do mês seguinte.
// Itens e números fictícios, fixos no código. Tudo é calculado no navegador.
(function cobertura() {
  const raiz = document.getElementById('covGrafico');
  if (!raiz) return;
  const EN = document.documentElement.lang.startsWith('en');
  const LOCALE = EN ? 'en-US' : 'pt-BR';
  const n2 = x => x.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const n0 = x => Math.round(x).toLocaleString(LOCALE);
  const DIAS_ATUAL = 30, DIAS_PROX = 31, ESCALA = 3; // o eixo vai de 0x a 3x o alvo

  const T = EN ? {
    classe: { excesso: 'Excess', risco: 'Risk', ok: 'In range' },
    dias: ' d', un: ' units',
    formula: { tras: 'Coverage = stock ÷ (September sales ÷ 30 days)', frente: 'Coverage = stock ÷ (October forecast ÷ 31 days)' },
    resumo: (nome, e, r, o) => nome + ': ' + e + (e === 1 ? ' item in excess, ' : ' items in excess, ') + r + (r === 1 ? ' at stockout risk, ' : ' at stockout risk, ') + o + ' within range.',
    nome: { tras: 'Looking back', frente: 'Looking ahead' },
    eixo: ['0x', '0.5x', '1x', '1.5x', '2x', '3x+'], estoque: 'Stock: ', alvo: 'Target: ', cortada: 'Bar cut at 3x'
  } : {
    classe: { excesso: 'Excesso', risco: 'Risco', ok: 'Na faixa' },
    dias: ' d', un: ' un',
    formula: { tras: 'Cobertura = estoque ÷ (vendas de setembro ÷ 30 dias)', frente: 'Cobertura = estoque ÷ (previsão de outubro ÷ 31 dias)' },
    resumo: (nome, e, r, o) => nome + ': ' + e + (e === 1 ? ' item em excesso, ' : ' itens em excesso, ') + r + (r === 1 ? ' em risco de ruptura, ' : ' em risco de ruptura, ') + o + ' dentro da faixa.',
    nome: { tras: 'Olhando para trás', frente: 'Olhando para a frente' },
    eixo: ['0x', '0,5x', '1x', '1,5x', '2x', '3x+'], estoque: 'Estoque: ', alvo: 'Alvo: ', cortada: 'Barra cortada em 3x'
  };

  // estoque no início de outubro, vendas de setembro, previsão de outubro e cobertura alvo (dias)
  const ITENS = [
    { pt: 'Bala dura morango 500 g', en: 'Strawberry hard candy 500 g', est: 160000, set: 192000, out: 186000, alvo: 25 },
    { pt: 'Bala dura menta 500 g', en: 'Mint hard candy 500 g', est: 330000, set: 174000, out: 180000, alvo: 25 },
    { pt: 'Goma frutas 200 g', en: 'Fruit gummies 200 g', est: 130000, set: 183000, out: 190000, alvo: 30 },
    { pt: 'Goma ácida 150 g', en: 'Sour gummies 150 g', est: 54000, set: 180000, out: 186000, alvo: 30 },
    { pt: 'Goma ursinhos 1 kg', en: 'Gummy bears 1 kg', est: 17000, set: 18000, out: 18600, alvo: 30 },
    { pt: 'Drágea de chocolate 100 g', en: 'Chocolate dragée 100 g', est: 77000, set: 90000, out: 93000, alvo: 30 },
    { pt: 'Drágea de amendoim 100 g', en: 'Peanut dragée 100 g', est: 62000, set: 66000, out: 68200, alvo: 30 },
    { pt: 'Barra de chocolate ao leite 80 g', en: 'Milk chocolate bar 80 g', est: 119000, set: 126000, out: 130200, alvo: 30 },
    { pt: 'Ovo de chocolate 300 g (sazonal)', en: 'Chocolate egg 300 g (seasonal)', est: 18000, set: 3600, out: 54000, alvo: 25 },
    { pt: 'Ovo de chocolate 150 g (sazonal)', en: 'Chocolate egg 150 g (seasonal)', est: 42000, set: 7500, out: 66000, alvo: 25 }
  ];

  const classificar = r => (r > 1.5 ? 'excesso' : r < 0.5 ? 'risco' : 'ok');
  const calcular = (it, modo) => {
    const diaria = modo === 'tras' ? it.set / DIAS_ATUAL : it.out / DIAS_PROX;
    const dias = it.est / diaria;
    return { dias, razao: dias / it.alvo };
  };
  const el = (tag, cls, texto) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texto != null) n.textContent = texto;
    return n;
  };

  // eixo no topo, na mesma escala das barras
  const eixo = el('div', 'cov-eixo');
  [0, 0.5, 1, 1.5, 2, 3].forEach((v, i) => {
    const t = el('span', null, T.eixo[i]);
    t.style.left = (v / ESCALA * 100) + '%';
    eixo.appendChild(t);
  });
  const cab = el('div', 'cov-linha cov-cab');
  cab.append(el('span'), eixo, el('span'), el('span'), el('span'));
  raiz.appendChild(cab);

  const linhas = ITENS.map(it => {
    const l = el('div', 'cov-linha');
    const nome = el('span', 'cov-nome', EN ? it.en : it.pt);
    nome.title = T.estoque + n0(it.est) + T.un + ' · ' + T.alvo + it.alvo + T.dias;
    const trilho = el('div', 'cov-trilho');
    const barra = el('i', 'cov-barra');
    trilho.appendChild(barra);
    const razao = el('b', 'cov-razao');
    const dias = el('span', 'cov-dias');
    const tag = el('span', 'cov-tag');
    l.append(nome, trilho, razao, dias, tag);
    raiz.appendChild(l);
    return { it, barra, razao, dias, tag, l };
  });

  const formula = $('covFormula');
  const resumo = $('covResumo');
  function $(id) { return document.getElementById(id); }
  const botoes = document.querySelectorAll('#covSeg [data-modo]');

  function desenhar(modo) {
    const contagem = { excesso: 0, risco: 0, ok: 0 };
    linhas.forEach(x => {
      const c = calcular(x.it, modo);
      const classe = classificar(c.razao);
      contagem[classe]++;
      x.barra.style.width = Math.min(c.razao, ESCALA) / ESCALA * 100 + '%';
      x.barra.className = 'cov-barra cov-' + classe + (c.razao > ESCALA ? ' cov-cortada' : '');
      x.barra.title = c.razao > ESCALA ? T.cortada : '';
      x.razao.textContent = n2(c.razao) + 'x';
      x.dias.textContent = n0(c.dias) + T.dias;
      x.tag.textContent = T.classe[classe];
      x.tag.className = 'cov-tag cov-tag-' + classe;
      x.l.setAttribute('aria-label', (EN ? x.it.en : x.it.pt) + ': ' + n0(c.dias) + T.dias + ', ' + n2(c.razao) + 'x, ' + T.classe[classe]);
    });
    formula.textContent = T.formula[modo];
    resumo.textContent = T.resumo(T.nome[modo], contagem.excesso, contagem.risco, contagem.ok);
    botoes.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
    try { sessionStorage.setItem('cov-modo', modo); } catch (e) {}
  }

  botoes.forEach(b => b.addEventListener('click', () => {
    desenhar(b.dataset.modo);
    if (typeof track === 'function') track('grafico-cobertura', { modo: b.dataset.modo });
  }));
  desenhar('tras');
})();
