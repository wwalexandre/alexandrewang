// Painel de invoices de importação: demonstração com dados fictícios gerados no navegador.
// Mostra como acompanhar cada invoice por Incoterm, etapa e prazo. Nenhum dado real é usado.
(function invoices() {
  const corpo = document.getElementById('ivCorpo');
  if (!corpo) return;
  const EN = document.documentElement.lang.startsWith('en');
  const $ = id => document.getElementById(id);
  const LOCALE = EN ? 'en-US' : 'pt-BR';
  const HOJE = new Date(2026, 10, 16); // posição fixa, para a demonstração ser sempre igual
  const DIA = 86400000;
  const data = d => d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
  const usd = v => 'US$ ' + Math.round(v).toLocaleString(LOCALE);

  const T = EN ? {
    etapas: ['Email received', 'Attachment saved', 'Data extracted and checked', 'Shipped', 'In customs clearance', 'Delivered'],
    status: { aguardando: 'Awaiting shipment', transito: 'In transit', desembaraco: 'In customs', entregue: 'Delivered' },
    atrasada: 'Late', dias: ' days late', modal: { aereo: 'Air', maritimo: 'Sea' },
    frete: { comprador: 'Buyer', vendedor: 'Seller' }, nenhuma: 'No invoice matches these filters.',
    detalhe: 'Invoice ', fornecedor: 'Supplier', origem: 'Origin', valor: 'Value', previsao: 'Expected arrival',
    quemFrete: 'Who contracts the main freight', risco: 'Where the risk passes', acompanhar: 'What to track',
    pendente: 'pending', de: ' of ', invoices: n => n + (n === 1 ? ' invoice' : ' invoices'),
    inc: {
      EXW: ['at the seller\'s premises, before loading', 'Pickup at origin, export clearance and the whole journey are on the buyer.'],
      FCA: ['when the goods are handed to the carrier named by the buyer', 'Confirm the handover to the carrier and the export clearance done by the seller.'],
      FOB: ['when the goods are on board the vessel at the port of shipment', 'Confirm the on-board date on the bill of lading. Sea freight only.'],
      CIF: ['on board at the port of shipment, although the seller pays freight and insurance', 'The seller books the vessel: ask for the bill of lading and the insurance policy. Sea freight only.'],
      DAP: ['at the named place of destination, ready for unloading', 'The seller brings the goods to destination. Import clearance stays with the buyer.']
    }
  } : {
    etapas: ['E-mail recebido', 'Anexo salvo', 'Dados extraídos e conferidos', 'Embarcada', 'Em desembaraço', 'Entregue'],
    status: { aguardando: 'Aguardando embarque', transito: 'Em trânsito', desembaraco: 'Em desembaraço', entregue: 'Entregue' },
    atrasada: 'Atrasada', dias: ' dias de atraso', modal: { aereo: 'Aéreo', maritimo: 'Marítimo' },
    frete: { comprador: 'Comprador', vendedor: 'Vendedor' }, nenhuma: 'Nenhuma invoice com esses filtros.',
    detalhe: 'Invoice ', fornecedor: 'Fornecedor', origem: 'Origem', valor: 'Valor', previsao: 'Previsão de chegada',
    quemFrete: 'Quem contrata o frete principal', risco: 'Onde o risco passa', acompanhar: 'O que acompanhar',
    pendente: 'pendente', de: ' de ', invoices: n => n + (n === 1 ? ' invoice' : ' invoices'),
    inc: {
      EXW: ['no local do vendedor, antes de carregar', 'Coleta na origem, desembaraço de exportação e o trajeto inteiro ficam com o comprador.'],
      FCA: ['quando a carga é entregue ao transportador indicado pelo comprador', 'Confirmar a entrega ao transportador e o desembaraço de exportação, que é do vendedor.'],
      FOB: ['quando a carga está a bordo do navio no porto de embarque', 'Confirmar a data de embarque no conhecimento (BL). Vale só para transporte marítimo.'],
      CIF: ['a bordo no porto de embarque, embora o vendedor pague frete e seguro', 'O vendedor reserva o navio: pedir o conhecimento (BL) e a apólice de seguro. Vale só para transporte marítimo.'],
      DAP: ['no local de destino combinado, pronta para descarregar', 'O vendedor traz a carga até o destino. O desembaraço de importação continua com o comprador.']
    }
  };
  const FRETE = { EXW: 'comprador', FCA: 'comprador', FOB: 'comprador', CIF: 'vendedor', DAP: 'vendedor' };
  const SO_MAR = { FOB: true, CIF: true };

  // Gerador com semente fixa: todo visitante vê as mesmas invoices
  let semente = 20261116;
  const rand = () => { semente = (semente * 1664525 + 1013904223) % 4294967296; return semente / 4294967296; };
  const sorteia = lista => lista[Math.floor(rand() * lista.length)];
  const FORN = [
    ['Northfield Devices Ltd.', EN ? 'United Kingdom' : 'Reino Unido'], ['Aurora Biomed GmbH', EN ? 'Germany' : 'Alemanha'],
    ['Kestrel Surgical Inc.', EN ? 'United States' : 'Estados Unidos'], ['Lumen Diagnostics BV', EN ? 'Netherlands' : 'Holanda'],
    ['Sakura Medtech K.K.', EN ? 'Japan' : 'Japão'], ['Helix Implants SA', EN ? 'Switzerland' : 'Suíça']
  ];
  const INCS = ['FCA', 'FCA', 'FCA', 'EXW', 'FOB', 'CIF', 'DAP', 'DAP'];

  const lista = Array.from({ length: 30 }, (_, i) => {
    const inc = sorteia(INCS);
    const modal = SO_MAR[inc] ? 'maritimo' : (rand() < 0.75 ? 'aereo' : 'maritimo');
    const forn = sorteia(FORN);
    let email = new Date(HOJE.getTime() - Math.floor(2 + rand() * 44) * DIA);
    const preparo = 3 + Math.floor(rand() * 8);
    const viagem = modal === 'aereo' ? 4 + Math.floor(rand() * 5) : 24 + Math.floor(rand() * 14);
    const alfandega = 3 + Math.floor(rand() * 7);
    let embarque = new Date(email.getTime() + preparo * DIA);
    let chegada = new Date(embarque.getTime() + viagem * DIA);
    let eta = new Date(chegada.getTime() + alfandega * DIA);
    const atraso = rand() < 0.4 ? 4 + Math.floor(rand() * 12) : 0;
    // em que etapa a invoice está hoje, contando o atraso
    const passou = dias => HOJE.getTime() >= dias;
    let etapa = 3;
    if (passou(embarque.getTime() + atraso * DIA)) etapa = 4;
    if (passou(chegada.getTime() + atraso * DIA)) etapa = 5;
    if (passou(eta.getTime() + atraso * DIA)) etapa = 6;
    // uma em cada seis fica atrasada de propósito: a previsão já passou e a carga ainda não chegou
    if (i % 6 === 2) {
      const ajuste = HOJE.getTime() - (2 + (i % 7)) * DIA - eta.getTime();
      [email, embarque, chegada, eta] = [email, embarque, chegada, eta].map(d => new Date(d.getTime() + ajuste));
      etapa = i % 4 < 2 ? 4 : 5;
    }
    const chave = etapa <= 3 ? 'aguardando' : etapa === 4 ? 'transito' : etapa === 5 ? 'desembaraco' : 'entregue';
    const atrasada = etapa < 6 && eta.getTime() < HOJE.getTime();
    return {
      num: 'INV-2026-' + String(401 + i * 3).padStart(4, '0'), forn: forn[0], origem: forn[1], inc, modal,
      valor: 8000 + Math.round(rand() * 142000), email, embarque, chegada, eta, etapa, chave, atrasada,
      diasAtraso: atrasada ? Math.round((HOJE.getTime() - eta.getTime()) / DIA) : 0
    };
  });
  // atrasadas primeiro, depois as abertas por previsão de chegada, e as entregues no fim
  const peso = x => (x.atrasada ? 0 : x.etapa < 6 ? 1 : 2);
  lista.sort((a, b) => peso(a) - peso(b) || a.eta - b.eta);

  const fInc = $('fInc'), fStatus = $('fStatus'), fBusca = $('fBusca');
  let aberta = null;

  function filtradas() {
    const q = fBusca.value.trim().toLowerCase();
    return lista.filter(x =>
      (fInc.value === 'all' || x.inc === fInc.value) &&
      (fStatus.value === 'all' || (fStatus.value === 'atrasada' ? x.atrasada : x.chave === fStatus.value)) &&
      (!q || x.num.toLowerCase().includes(q) || x.forn.toLowerCase().includes(q)));
  }

  const el = (tag, cls, texto) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texto != null) n.textContent = texto;
    return n;
  };

  function detalhe(x) {
    const caixa = $('ivDetalhe');
    caixa.textContent = '';
    if (!x) { caixa.hidden = true; return; }
    caixa.hidden = false;
    caixa.appendChild(el('h3', null, T.detalhe + x.num + ' · ' + x.inc + ' · ' + T.modal[x.modal]));
    const grade = el('dl', 'iv-ficha');
    [[T.fornecedor, x.forn], [T.origem, x.origem], [T.valor, usd(x.valor)], [T.previsao, data(x.eta)],
     [T.quemFrete, T.frete[FRETE[x.inc]]], [T.risco, T.inc[x.inc][0]], [T.acompanhar, T.inc[x.inc][1]]]
      .forEach(([k, v]) => { const d = el('div'); d.append(el('dt', null, k), el('dd', null, v)); grade.appendChild(d); });
    caixa.appendChild(grade);
    const datas = [x.email, x.email, x.email, x.embarque, x.chegada, x.eta];
    const trilha = el('ol', 'iv-trilha');
    T.etapas.forEach((nome, i) => {
      const li = el('li', i + 1 < x.etapa ? 'feita' : i + 1 === x.etapa ? 'atual' : 'falta');
      li.append(el('b', null, nome), el('span', null, i + 1 <= x.etapa ? data(datas[i]) : T.pendente));
      trilha.appendChild(li);
    });
    caixa.appendChild(trilha);
  }

  function render() {
    const f = filtradas();
    const conta = chave => f.filter(x => x.chave === chave).length;
    const atrasadas = f.filter(x => x.atrasada).length;
    $('kTot').textContent = f.length;
    $('kTran').textContent = conta('transito');
    $('kDes').textContent = conta('desembaraco');
    $('kAtr').textContent = atrasadas;
    $('kVal').textContent = usd(f.filter(x => x.etapa < 6).reduce((s, x) => s + x.valor, 0));

    // barra de status: cada trecho proporcional ao número de invoices, com o número escrito
    const barra = $('ivBarra'), legenda = $('ivLegenda');
    barra.textContent = ''; legenda.textContent = '';
    ['aguardando', 'transito', 'desembaraco', 'entregue'].forEach(chave => {
      const n = conta(chave);
      if (n) { const s = el('i', 'iv-' + chave); s.style.flexGrow = n; barra.appendChild(s); }
      const item = el('span'); item.append(el('i', 'iv-' + chave), T.status[chave] + ': ' + n); legenda.appendChild(item);
    });

    // invoices por Incoterm
    const porInc = $('ivInc');
    porInc.textContent = '';
    const grupos = ['EXW', 'FCA', 'FOB', 'CIF', 'DAP'].map(i => [i, f.filter(x => x.inc === i).length]);
    const maior = Math.max(1, ...grupos.map(g => g[1]));
    grupos.forEach(([inc, n]) => {
      const linha = el('div', 'iv-inc-linha');
      const b = el('i'); b.style.width = (n / maior * 100) + '%';
      const trilho = el('div', 'iv-inc-trilho'); trilho.appendChild(b);
      linha.append(el('b', null, inc), trilho, el('span', null, String(n)));
      porInc.appendChild(linha);
    });

    corpo.textContent = '';
    f.forEach(x => {
      const tr = el('tr');
      tr.tabIndex = 0;
      tr.setAttribute('aria-selected', String(aberta === x.num));
      const st = el('td');
      st.appendChild(el('span', 'iv-tag iv-' + x.chave, T.status[x.chave]));
      if (x.atrasada) st.appendChild(el('span', 'iv-tag iv-atrasada', T.atrasada + ' · ' + x.diasAtraso + (EN ? 'd' : 'd')));
      [x.num, x.forn, x.inc, T.modal[x.modal]].forEach(v => tr.appendChild(el('td', null, v)));
      tr.appendChild(el('td', 'num', usd(x.valor)));
      tr.appendChild(el('td', 'num', data(x.eta)));
      tr.appendChild(st);
      const abre = () => { aberta = aberta === x.num ? null : x.num; render(); if (typeof track === 'function') track('invoice-aberta', { incoterm: x.inc }); };
      tr.addEventListener('click', abre);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abre(); } });
      corpo.appendChild(tr);
    });
    $('ivVazio').textContent = f.length ? '' : T.nenhuma;
    $('ivConta').textContent = T.invoices(f.length) + T.de + lista.length;
    detalhe(f.find(x => x.num === aberta) || null);
  }

  [fInc, fStatus].forEach(c => c.addEventListener('change', () => { render(); if (typeof track === 'function') track('dashboard-filtro', { filtro: c.id }); }));
  fBusca.addEventListener('input', render);
  render();
})();
