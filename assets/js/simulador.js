// Simulador de Incoterms: quem paga cada trecho da viagem e onde o risco passa para o comprador

(function () {
  const root = document.getElementById('simulador');
  if (!root) return;

  const PARADAS = ['Fábrica', 'Transportador', 'Cais de origem', 'A bordo', 'Destino', 'Descarregado'];
  const CUSTO_ATE = ['não paga transporte', 'paga até entregar ao transportador', 'paga até o cais de origem',
    'paga até a carga estar a bordo', 'paga o frete até o destino', 'paga até descarregar no destino'];
  const RISCO_EM = ['na fábrica do vendedor', 'na entrega ao transportador', 'no cais, ao lado do navio',
    'quando a carga está a bordo, ainda na origem', 'no destino, antes da descarga', 'no destino, depois da descarga'];
  const SEM_SEGURO = 'sem obrigação no Incoterm';
  // custo: até qual parada o vendedor paga o transporte | risco: em qual parada o risco passa
  const TERMOS = [
    { g: 'E', s: 'EXW', nome: 'Ex Works', custo: 0, risco: 0, exp: 'comprador', imp: 'comprador', seguro: SEM_SEGURO, mar: false },
    { g: 'F', s: 'FCA', nome: 'Free Carrier', custo: 1, risco: 1, exp: 'vendedor', imp: 'comprador', seguro: SEM_SEGURO, mar: false },
    { g: 'F', s: 'FAS', nome: 'Free Alongside Ship', custo: 2, risco: 2, exp: 'vendedor', imp: 'comprador', seguro: SEM_SEGURO, mar: true },
    { g: 'F', s: 'FOB', nome: 'Free On Board', custo: 3, risco: 3, exp: 'vendedor', imp: 'comprador', seguro: SEM_SEGURO, mar: true },
    { g: 'C', s: 'CPT', nome: 'Carriage Paid To', custo: 4, risco: 1, exp: 'vendedor', imp: 'comprador', seguro: SEM_SEGURO, mar: false },
    { g: 'C', s: 'CIP', nome: 'Carriage and Insurance Paid To', custo: 4, risco: 1, exp: 'vendedor', imp: 'comprador', seguro: 'o vendedor contrata, cobertura ampla (cláusula A)', mar: false },
    { g: 'C', s: 'CFR', nome: 'Cost and Freight', custo: 4, risco: 3, exp: 'vendedor', imp: 'comprador', seguro: SEM_SEGURO, mar: true },
    { g: 'C', s: 'CIF', nome: 'Cost, Insurance and Freight', custo: 4, risco: 3, exp: 'vendedor', imp: 'comprador', seguro: 'o vendedor contrata, cobertura mínima (cláusula C)', mar: true },
    { g: 'D', s: 'DAP', nome: 'Delivered at Place', custo: 4, risco: 4, exp: 'vendedor', imp: 'comprador', seguro: SEM_SEGURO, mar: false },
    { g: 'D', s: 'DPU', nome: 'Delivered at Place Unloaded', custo: 5, risco: 5, exp: 'vendedor', imp: 'comprador', seguro: SEM_SEGURO, mar: false },
    { g: 'D', s: 'DDP', nome: 'Delivered Duty Paid', custo: 4, risco: 4, exp: 'vendedor', imp: 'vendedor, com os impostos', seguro: SEM_SEGURO, mar: false }
  ];

  const botoes = root.querySelector('.sim-terms');
  const pista = root.querySelector('.sim-track');
  const saida = root.querySelector('.sim-out');

  // botões agrupados por letra (E, F, C, D)
  let grupo = '';
  TERMOS.forEach(t => {
    if (t.g !== grupo) {
      grupo = t.g;
      const g = document.createElement('span');
      g.className = 'grp';
      g.textContent = 'Grupo ' + grupo;
      botoes.appendChild(g);
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t.s;
    b.dataset.s = t.s;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => { mostrar(t); track('simulador-incoterm', { termo: t.s }); });
    botoes.appendChild(b);
  });

  // pista: 5 trechos entre 6 paradas
  const linha = document.createElement('div');
  linha.className = 'sim-line';
  const trechos = [0, 1, 2, 3, 4].map(() => linha.appendChild(document.createElement('i')));
  const bandeira = document.createElement('div');
  bandeira.className = 'sim-flag';
  bandeira.textContent = 'Risco passa aqui';
  pista.append(linha, bandeira);
  const paradas = PARADAS.map(nome => {
    const p = document.createElement('div');
    p.className = 'sim-stop';
    p.textContent = nome;
    pista.appendChild(p);
    return p;
  });

  function mostrar(t) {
    botoes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === t.s)));
    trechos.forEach((el, i) => { el.className = i < t.custo ? 'vend' : 'comp'; });
    paradas.forEach((p, i) => { p.dataset.lado = i < t.risco ? 'vend' : (i === t.risco ? 'ponto' : 'comp'); });
    bandeira.style.left = ((t.risco + 0.5) / PARADAS.length * 100) + '%';

    const separa = t.custo > t.risco;
    saida.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = t.s + ' · ' + t.nome;
    const ul = document.createElement('ul');
    [
      ['Custo', 'o vendedor ' + CUSTO_ATE[t.custo] + '.'],
      ['Risco', 'passa para o comprador ' + RISCO_EM[t.risco] + '.'],
      ['Seguro', t.seguro + '.'],
      ['Desembaraço', 'exportação pelo ' + t.exp + '; importação pelo ' + t.imp + '.'],
      ['Modal', t.mar ? 'só marítimo e hidroviário.' : 'qualquer modal.']
    ].forEach(([k, v]) => {
      const li = document.createElement('li');
      const b = document.createElement('strong');
      b.textContent = k + ': ';
      li.append(b, v);
      ul.appendChild(li);
    });
    saida.append(h, ul);
    if (separa) {
      const alerta = document.createElement('p');
      alerta.className = 'sim-alert';
      alerta.textContent = 'Atenção: aqui custo e risco se separam. O vendedor paga o frete além do ponto em que o risco já é do comprador.';
      saida.appendChild(alerta);
    }
  }

  mostrar(TERMOS.find(t => t.s === 'CIF'));
})();
