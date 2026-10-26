// Simulador de Incoterms: quem paga cada trecho da viagem e onde o risco passa para o comprador

(function () {
  const root = document.getElementById('simulador');
  if (!root) return;

  // textos em português e em inglês (o idioma vem do lang da página, como no main.js)
  const EN = document.documentElement.lang.startsWith('en');
  const TX = EN ? {
    paradas: ['Factory', 'Carrier', 'Origin quay', 'On board', 'Destination', 'Unloaded'],
    custoAte: ['pays no transport', 'pays until handing over to the carrier', 'pays up to the origin quay',
      'pays until the cargo is on board', 'pays the freight to destination', 'pays until unloading at destination'],
    riscoEm: ["at the seller's premises", 'on delivery to the carrier', 'at the quay, alongside the ship',
      'once the cargo is on board, still at origin', 'at destination, before unloading', 'at destination, after unloading'],
    semSeguro: 'no obligation under the Incoterm',
    seguroA: 'the seller buys it, broad cover (clause A)',
    seguroC: 'the seller buys it, minimum cover (clause C)',
    lado: { v: 'seller', c: 'buyer', vi: 'seller, including duties' },
    grupo: 'Group ', bandeira: 'Risk passes here',
    custo: 'Cost', risco: 'Risk', seguro: 'Insurance', desemb: 'Clearance', modal: 'Mode',
    vendedor: 'the seller ', passa: 'passes to the buyer ',
    desembTxt: (e, i) => 'export by the ' + e + '; import by the ' + i + '.',
    mar: 'sea and inland waterway only.', qualquer: 'any mode.',
    alerta: 'Watch out: here cost and risk split. The seller pays freight beyond the point where the risk is already the buyer\'s.'
  } : {
    paradas: ['Fábrica', 'Transportador', 'Cais de origem', 'A bordo', 'Destino', 'Descarregado'],
    custoAte: ['não paga transporte', 'paga até entregar ao transportador', 'paga até o cais de origem',
      'paga até a carga estar a bordo', 'paga o frete até o destino', 'paga até descarregar no destino'],
    riscoEm: ['na fábrica do vendedor', 'na entrega ao transportador', 'no cais, ao lado do navio',
      'quando a carga está a bordo, ainda na origem', 'no destino, antes da descarga', 'no destino, depois da descarga'],
    semSeguro: 'sem obrigação no Incoterm',
    seguroA: 'o vendedor contrata, cobertura ampla (cláusula A)',
    seguroC: 'o vendedor contrata, cobertura mínima (cláusula C)',
    lado: { v: 'vendedor', c: 'comprador', vi: 'vendedor, com os impostos' },
    grupo: 'Grupo ', bandeira: 'Risco passa aqui',
    custo: 'Custo', risco: 'Risco', seguro: 'Seguro', desemb: 'Desembaraço', modal: 'Modal',
    vendedor: 'o vendedor ', passa: 'passa para o comprador ',
    desembTxt: (e, i) => 'exportação pelo ' + e + '; importação pelo ' + i + '.',
    mar: 'só marítimo e hidroviário.', qualquer: 'qualquer modal.',
    alerta: 'Atenção: aqui custo e risco se separam. O vendedor paga o frete além do ponto em que o risco já é do comprador.'
  };

  // custo: até qual parada o vendedor paga o transporte | risco: em qual parada o risco passa
  // exp/imp: quem desembaraça (v = vendedor, c = comprador, vi = vendedor com impostos) | seguro: null, 'A' ou 'C'
  const TERMOS = [
    { g: 'E', s: 'EXW', nome: 'Ex Works', custo: 0, risco: 0, exp: 'c', imp: 'c', seguro: null, mar: false },
    { g: 'F', s: 'FCA', nome: 'Free Carrier', custo: 1, risco: 1, exp: 'v', imp: 'c', seguro: null, mar: false },
    { g: 'F', s: 'FAS', nome: 'Free Alongside Ship', custo: 2, risco: 2, exp: 'v', imp: 'c', seguro: null, mar: true },
    { g: 'F', s: 'FOB', nome: 'Free On Board', custo: 3, risco: 3, exp: 'v', imp: 'c', seguro: null, mar: true },
    { g: 'C', s: 'CPT', nome: 'Carriage Paid To', custo: 4, risco: 1, exp: 'v', imp: 'c', seguro: null, mar: false },
    { g: 'C', s: 'CIP', nome: 'Carriage and Insurance Paid To', custo: 4, risco: 1, exp: 'v', imp: 'c', seguro: 'A', mar: false },
    { g: 'C', s: 'CFR', nome: 'Cost and Freight', custo: 4, risco: 3, exp: 'v', imp: 'c', seguro: null, mar: true },
    { g: 'C', s: 'CIF', nome: 'Cost, Insurance and Freight', custo: 4, risco: 3, exp: 'v', imp: 'c', seguro: 'C', mar: true },
    { g: 'D', s: 'DAP', nome: 'Delivered at Place', custo: 4, risco: 4, exp: 'v', imp: 'c', seguro: null, mar: false },
    { g: 'D', s: 'DPU', nome: 'Delivered at Place Unloaded', custo: 5, risco: 5, exp: 'v', imp: 'c', seguro: null, mar: false },
    { g: 'D', s: 'DDP', nome: 'Delivered Duty Paid', custo: 4, risco: 4, exp: 'v', imp: 'vi', seguro: null, mar: false }
  ];
  const seguroDe = t => t.seguro === 'A' ? TX.seguroA : t.seguro === 'C' ? TX.seguroC : TX.semSeguro;

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
      g.textContent = TX.grupo + grupo;
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
  bandeira.textContent = TX.bandeira;
  pista.append(linha, bandeira);
  const paradas = TX.paradas.map(nome => {
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
    bandeira.style.left = ((t.risco + 0.5) / TX.paradas.length * 100) + '%';

    const separa = t.custo > t.risco;
    saida.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = t.s + ' · ' + t.nome;
    const ul = document.createElement('ul');
    [
      [TX.custo, TX.vendedor + TX.custoAte[t.custo] + '.'],
      [TX.risco, TX.passa + TX.riscoEm[t.risco] + '.'],
      [TX.seguro, seguroDe(t) + '.'],
      [TX.desemb, TX.desembTxt(TX.lado[t.exp], TX.lado[t.imp])],
      [TX.modal, t.mar ? TX.mar : TX.qualquer]
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
      alerta.textContent = TX.alerta;
      saida.appendChild(alerta);
    }
  }

  mostrar(TERMOS.find(t => t.s === 'CIF'));
})();
