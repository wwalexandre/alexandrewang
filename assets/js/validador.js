// Validador de documentos de importação, versão no navegador.
// Refaz em JavaScript as 12 checagens do script em Python (check_shipment.py).
// Os arquivos são lidos aqui mesmo: nada é enviado para servidor.
(function validador() {
  const root = document.getElementById('validador');
  if (!root) return;

  const EN = document.documentElement.lang.startsWith('en');
  const t = (pt, en) => (EN ? en : pt);
  const JS = new URL('.', document.currentScript.src);
  const KIT_URL = new URL('../docs/validador/', JS);
  const MIN_SHELF = 18;   // meses de validade mínima na chegada
  const MAX_MFG = 6;      // fabricação mais antiga que isso (antes da invoice) vira ATENÇÃO
  const DIA = 86400000;
  const MES = 30.44 * DIA;
  // Anuências cadastradas nesta demo (fictícias): lote fabricado antes da data não pode ser importado
  const ANUENCIAS = [{ chave: 'SKU-2214', data: '2025-06-01' }];

  const KIT = [
    { file: 'INV-2026-0418_Invoice.xlsx', type: 'invoice' },
    { file: 'INV-2026-0418_Packing_List.xlsx', type: 'packing' },
    { file: 'INV-2026-0418_Shipping_List.xlsx', type: 'shipping' },
    { file: 'INV-2026-0418_COA.pdf', type: 'coa' },
    { file: 'INV-2026-0418_INV-PL_assinado.pdf', type: 'final' },
  ];
  const TIPOS = {
    invoice: 'Invoice', packing: 'Packing list', shipping: 'Shipping list',
    coa: t('Certificado de análise', 'Certificate of analysis'),
    final: t('PDF assinado', 'Signed PDF'), outro: t('Não reconhecido', 'Not recognized'),
  };
  const TIPOS_EMAIL = { invoice: 'invoice', packing: 'packing list', shipping: 'shipping list', coa: 'COA', final: 'signed PDF' };

  const $ = sel => root.querySelector(sel);
  const ui = {
    runKit: $('#vdRunKit'), drop: $('#vdDrop'), input: $('#vdInput'), files: $('#vdFiles'),
    run: $('#vdRun'), status: $('#vdStatus'), report: $('#vdReport'),
  };
  const track = (nome, dados) => { try { if (window.umami) window.umami.track(nome, dados); } catch (e) {} };

  // ---------- bibliotecas (carregadas só quando precisa) ----------
  const libs = {};
  function carregar(arquivo) {
    if (!libs[arquivo]) libs[arquivo] = new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = new URL('vendor/' + arquivo, JS).href;
      s.onload = ok;
      s.onerror = () => erro(new Error(arquivo));
      document.head.appendChild(s);
    });
    return libs[arquivo];
  }
  const precisaExcel = () => carregar('xlsx.full.min.js');
  const precisaPdf = () => carregar('pdf.min.js').then(() => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.js', JS).href;
  });

  // ---------- texto, números e datas ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const rotulo = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();   // "N.W. (kg)" vira "N W KG"
  const chave = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const vazio = v => v == null || String(v).trim() === '';

  function numero(v) {
    if (typeof v === 'number') return v;
    const m = String(v ?? '').replace(/\s/g, '').match(/-?\d[\d.,]*/);
    if (!m) return null;
    let s = m[0];
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  const MESES = { JAN: 1, FEB: 2, FEV: 2, MAR: 3, APR: 4, ABR: 4, MAY: 5, MAI: 5, JUN: 6, JUL: 7, AUG: 8, AGO: 8, SEP: 9, SET: 9, OCT: 10, OUT: 10, NOV: 11, DEC: 12, DEZ: 12 };
  const iso = d => d.toISOString().slice(0, 10);
  const montar = (a, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);
  function data(v) {   // devolve 'AAAA-MM-DD' ou null
    if (vazio(v)) return null;
    if (typeof v === 'number') return v > 20000 && v < 80000 ? iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DIA)) : null;
    const s = String(v).trim().toUpperCase();
    let m;
    if ((m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return montar(+m[1], +m[2], +m[3]);
    if ((m = s.match(/(\d{1,2})[-/. ]([A-Z]{3})[A-Z]*[-/. ,]+(\d{4})/))) return montar(+m[3], MESES[m[2]], +m[1]);
    if ((m = s.match(/([A-Z]{3})[A-Z]*[-/. ]+(\d{1,2}),?[-/. ]+(\d{4})/))) return montar(+m[3], MESES[m[1]], +m[2]);
    if ((m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return +m[2] > 12 ? montar(+m[3], +m[1], +m[2]) : montar(+m[3], +m[2], +m[1]);
    return null;
  }
  const ms = s => Date.parse(s + 'T00:00:00Z');
  const verData = s => (s ? (EN ? s : s.split('-').reverse().join('/')) : '');
  const dataEmail = s => { const [a, m, d] = s.split('-'); return `${d}-${'JanFebMarAprMayJunJulAugSepOctNovDec'.substr((m - 1) * 3, 3)}-${a}`; };
  const fmt = (n, casas = 0) => Number(n).toLocaleString(EN ? 'en-US' : 'pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const fmtEn = (n, casas = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const lista = arr => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + t(' e ', ' and ') + arr[arr.length - 1]);
  const listaEn = arr => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);

  // ---------- séries, lotes e CNPJ ----------
  function series(txt) {
    const out = [];
    String(txt ?? '').split(/[,;]/).forEach(p => {
      p = p.trim();
      if (!p) return;
      const r = p.match(/^\D*?(\d+)\s*(?:~|-|–|TO)\s*\D*?(\d+)$/i);
      if (r) {
        const a = +r[1], b = +r[2];
        if (b >= a && b - a < 5000) for (let n = a; n <= b; n++) out.push(n);
      } else {
        const u = p.match(/^\D*(\d+)$/);
        if (u) out.push(+u[1]);
      }
    });
    return out.filter(n => n > 0);
  }
  function faixas(nums) {   // [31..40] vira "031~040"
    const s = [...new Set(nums)].sort((a, b) => a - b);
    const out = [];
    const p = n => String(n).padStart(3, '0');
    for (let i = 0; i < s.length; i++) {
      let j = i;
      while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      out.push(i === j ? p(s[i]) : `${p(s[i])}~${p(s[j])}`);
      i = j;
    }
    return out.join(', ');
  }
  function lote(txt) {   // 'L2405(001~040)' vira { base: 'L2405', series: [1..40], par: true }
    const s = String(txt ?? '').trim();
    if (!s) return { base: null, series: [], par: false };
    const m = s.match(/^(\S+?)\s*\(([^)]*)\)\s*$/);
    return m ? { base: m[1].toUpperCase(), series: series(m[2]), par: true } : { base: s.toUpperCase(), series: [], par: false };
  }
  const CONFUNDE = ['35', '1I', '1L', '0O', '5S', '8B', '17', '08', '65', '2Z'];
  function parecido(a, b) {   // difere só por caracteres que se confundem na leitura (O e 0, I e 1...)
    a = String(a || '').toUpperCase(); b = String(b || '').toUpperCase();
    if (a === b) return true;
    if (a.length === b.length) {
      const dif = [...a].map((c, i) => [c, b[i]]).filter(([x, y]) => x !== y);
      return dif.length <= 2 && dif.every(([x, y]) => CONFUNDE.includes(x + y) || CONFUNDE.includes(y + x));
    }
    const [maior, menor] = a.length > b.length ? [a, b] : [b, a];
    return maior.length - menor.length === 1 && [...maior].some((_, i) => maior.slice(0, i) + maior.slice(i + 1) === menor);
  }
  function cnpjValido(c) {
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const dv = (n, pesos) => { const r = pesos.reduce((s, p, i) => s + +n[i] * p, 0) % 11; return r < 2 ? 0 : 11 - r; };
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    return dv(c, p1) === +c[12] && dv(c, [6, ...p1]) === +c[13];
  }
  const fmtCnpj = c => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

  // ---------- leitura dos arquivos ----------
  // Os dois formatos viram a mesma coisa: linhas com células { x, s }.
  // No Excel, x é o número da coluna. No PDF, é a posição horizontal do texto.
  const textoDe = linhas => linhas.map(l => l.map(c => c.s).join(' ')).join('\n');

  function lerPlanilha(buf) {
    const wb = window.XLSX.read(buf, { type: 'array', cellNF: true });
    const folhas = wb.SheetNames.map(n => {
      const ws = wb.Sheets[n];
      if (!ws['!ref']) return [];
      const r = window.XLSX.utils.decode_range(ws['!ref']);
      const linhas = [];
      for (let R = r.s.r; R <= r.e.r; R++) {
        const cel = [];
        for (let C = r.s.c; C <= r.e.c; C++) {
          const c = ws[window.XLSX.utils.encode_cell({ r: R, c: C })];
          if (!c || vazio(c.v)) continue;
          let v = c.v;
          if (c.t === 'n' && c.z && window.XLSX.SSF.is_date(c.z)) v = data(c.v);
          else if (c.t === 'd') v = iso(c.v);
          cel.push({ x: C, s: v, w: c.w });
        }
        linhas.push(cel);
      }
      return linhas;
    });
    return { kind: 'sheet', folhas, texto: folhas.map(textoDe).join('\n') };
  }

  async function lerPdf(buf) {
    const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const folhas = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      folhas.push(linhasPdf(tc.items.filter(i => i.str && i.str.trim())));
    }
    const texto = folhas.map(textoDe).join('\n');
    return { kind: 'pdf', folhas, paginas: doc.numPages, texto, escaneado: texto.replace(/\s/g, '').length < 40 * doc.numPages };
  }

  function linhasPdf(itens) {
    const linhas = [];
    itens.map(i => ({ x: i.transform[4], y: i.transform[5], w: i.width, s: i.str }))
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .forEach(i => {
        let l = linhas.find(l => Math.abs(l.y - i.y) < 2.5);
        if (!l) linhas.push((l = { y: i.y, itens: [] }));
        l.itens.push(i);
      });
    return linhas.map(l => {
      const cel = [];
      l.itens.sort((a, b) => a.x - b.x).forEach(i => {
        const u = cel[cel.length - 1];
        const vao = u ? i.x - (u.x + u.w) : Infinity;
        if (vao < 6) { u.s += (vao > 1 ? ' ' : '') + i.s; u.w = i.x + i.w - u.x; }
        else cel.push({ x: i.x, w: i.w, s: i.s });
      });
      return cel.map(c => ({ x: c.x, s: c.s.replace(/\s+/g, ' ').trim() }));
    });
  }

  function classificar(dados, nome) {
    const T = rotulo(dados.texto);
    const N = rotulo(nome);
    if (/CERTIFICATE OF (ANALYSIS|CONFORMITY|QUALITY)|CERTIFICADO DE ANALISE/.test(T) || /\bCOA\b/.test(N)) return 'coa';
    if (dados.kind === 'pdf') {
      if (/INVOICE|PACKING LIST|SHIPPING LIST/.test(T)) return 'final';
      return dados.escaneado ? 'coa' : 'outro';
    }
    if (/SHIPPING LIST/.test(T) || /SHIPPING/.test(N)) return 'shipping';
    if (/PACKING LIST/.test(T) || /PACKING/.test(N)) return 'packing';
    if (/INVOICE/.test(T) || /\bINV/.test(N)) return 'invoice';
    return 'outro';
  }

  // ---------- cabeçalho e tabelas ----------
  const CAMPOS = {
    exporter: ['EXPORTER', 'SHIPPER', 'SELLER', 'MANUFACTURER', 'VENDOR', 'SUPPLIER'],
    invoiceNo: ['INVOICE NO', 'INVOICE NUMBER', 'INVOICE N', 'INV NO', 'INVOICE'],
    invoiceDate: ['INVOICE DATE', 'DATE OF INVOICE'],
    orderNo: ['ORDER NO', 'ORDER NUMBER', 'PO NO', 'PO NUMBER', 'P O NO', 'PO', 'PURCHASE ORDER', 'CUSTOMER PO'],
    invoiceTo: ['INVOICE TO', 'BILL TO', 'SOLD TO', 'BUYER', 'CUSTOMER', 'IMPORTER', 'MESSRS'],
    shipTo: ['SHIP TO', 'DELIVER TO', 'CONSIGNEE', 'DELIVERY ADDRESS'],
    attn: ['ATTN', 'ATTENTION', 'CONTACT'],
    tel: ['TEL', 'PHONE', 'TELEPHONE', 'TEL NO'],
    eta: ['ETA', 'ESTIMATED ARRIVAL'],
  };
  const ROTULOS = new Map(Object.entries(CAMPOS).flatMap(([k, ls]) => ls.map(l => [l, k])));

  function cabecalho(linhas) {
    const h = {};
    linhas.forEach(l => l.forEach((c, i) => {
      const s = String(c.s);
      const dp = s.indexOf(':');
      const campo = ROTULOS.get(rotulo(dp > 0 ? s.slice(0, dp) : s));
      if (!campo || h[campo] != null) return;
      let v = dp > 0 ? s.slice(dp + 1).trim() : '';
      if (!v && l[i + 1]) v = l[i + 1].s;   // valor na célula seguinte
      if (!vazio(v) && !ROTULOS.has(rotulo(String(v).split(':')[0]))) h[campo] = String(v).trim();
    }));
    if (h.invoiceDate) h.invoiceDate = data(h.invoiceDate);
    if (h.eta) h.eta = data(h.eta);
    return h;
  }

  const COLUNAS = {
    invoice: { code: /\b(CODE|PART NO|PART NUMBER|SKU|REF|MATERIAL|ITEM CODE|ITEM NO)\b/, desc: /DESC/, qty: /\b(QTY|QUANTITY|QTD|QUANTIDADE)\b/, price: /PRICE|PRECO/, amount: /\b(AMOUNT|VALUE|VALOR)\b/ },
    packing: { desc: /DESC/, qty: /\b(QTY|QUANTITY|QTD|PCS)\b/, cartons: /\b(CARTONS?|CTNS?|PACKAGES|BOXES|CAIXAS)\b/, nw: /^(N W|NW|NET)\b/, gw: /^(G W|GW|GROSS)\b/ },
    shipping: { crt: /\b(CARTON NO|CTN NO|CRT NO|C NO|BOX NO|CASE NO|CARTON)\b/, code: /\b(CODE|PART NO|SKU|REF|MATERIAL)\b/, desc: /DESC/, lot: /\b(LOT|BATCH|LOTE)\b/, serials: /\b(SERIAL|SERIALS|SN|S N)\b/, qty: /\b(QTY|QUANTITY|QTD)\b/, mfg: /\b(MFG|MANUF|PROD)/, exp: /\b(EXP|EXPIRY|EXPIRATION|VALID)/ },
    coa: { code: /\b(CODE|PART NO|SKU|REF|MATERIAL)\b/, lot: /\b(LOT|BATCH|LOTE)\b/, serials: /\b(SERIAL|SN|S N)\b/, qty: /\b(QTY|QUANTITY|QTD)\b/, mfg: /\b(MFG|MANUF|PROD)/, exp: /\b(EXP|EXPIRY|EXPIRATION|VALID)/ },
  };
  const OBRIG = { invoice: ['code', 'qty'], packing: ['desc', 'qty'], shipping: ['lot', 'qty'], coa: ['lot'] };

  // Acha a linha de cabeçalho da tabela e lê as linhas de baixo até o TOTAL ou o fim
  function tabela(linhas, tipo, pdf) {
    const spec = COLUNAS[tipo], obrig = OBRIG[tipo];
    for (let i = 0; i < linhas.length; i++) {
      const col = {};
      linhas[i].forEach(c => {
        const r = rotulo(c.s);
        if (!r || r.length > 40) return;
        const campo = Object.keys(spec).find(k => !(k in col) && spec[k].test(r));
        if (campo) col[campo] = c.x;
      });
      if (!obrig.every(k => k in col) || Object.keys(col).length < 2) continue;
      const xs = Object.entries(col).sort((a, b) => a[1] - b[1]);
      const qual = c => {
        if (!pdf) { const e = xs.find(([, x]) => x === c.x); return e && e[0]; }
        let campo = null;
        for (const [k, x] of xs) if (c.x >= x - 8) campo = k;
        return campo;
      };
      const linhasDados = [];
      let total = {}, fora = 0;
      for (let j = i + 1; j < linhas.length; j++) {
        if (!linhas[j].length) { if (linhasDados.length) break; continue; }
        const reg = {};
        linhas[j].forEach(c => { const k = qual(c); if (k && reg[k] == null) reg[k] = c.s; });
        if (linhas[j].some(c => /^TOTAL\b/.test(rotulo(c.s)))) { total = reg; break; }
        if (obrig.every(k => !vazio(reg[k]))) { reg.linha = j + 1; linhasDados.push(reg); fora = 0; }
        else if (linhasDados.length && ++fora > 3) break;
      }
      if (linhasDados.length) return { linhas: linhasDados, total };
    }
    return null;
  }
  function tabelaEm(dados, tipo) {
    for (const folha of dados.folhas) {
      const tb = tabela(folha, tipo, dados.kind === 'pdf');
      if (tb) return tb;
    }
    return null;
  }

  function totaisTexto(texto) {
    const T = texto.toUpperCase();
    const pega = re => { const m = T.match(re); return m ? numero(m[1]) : null; };
    return {
      cartons: pega(/TOTAL\s*(?:CARTONS?|CTNS?)\s*:?\s*(\d+)/),
      nw: pega(/TOTAL\s*N\.?\s*W\.?\s*(?:\(KG\))?\s*:?\s*([\d.,]+)/),
      gw: pega(/TOTAL\s*G\.?\s*W\.?\s*(?:\(KG\))?\s*:?\s*([\d.,]+)/),
    };
  }

  // Transforma o que foi lido em dados de cada tipo de documento
  function interpretar(arq) {
    const d = arq.dados, tipo = arq.tipo;
    const todas = d.folhas.flat();
    const doc = { tipo, nome: arq.nome, texto: d.texto, cab: cabecalho(todas), aviso: null, linhas: [] };
    const sem = () => { doc.aviso = t('Não achei a tabela neste arquivo.', 'Could not find the table in this file.'); };
    if (tipo === 'invoice') {
      const tb = tabelaEm(d, 'invoice');
      if (!tb) sem();
      else {
        doc.linhas = tb.linhas.map(r => ({ code: String(r.code).trim(), desc: r.desc, qty: numero(r.qty) ?? 0, price: numero(r.price), amount: numero(r.amount), linha: r.linha }));
        doc.total = { qty: numero(tb.total.qty), amount: numero(tb.total.amount) };
      }
    } else if (tipo === 'packing') {
      const tb = tabelaEm(d, 'packing');
      if (!tb) sem();
      else {
        doc.linhas = tb.linhas.map(r => ({ desc: String(r.desc).trim(), qty: numero(r.qty) ?? 0, cartons: numero(r.cartons), nw: numero(r.nw), gw: numero(r.gw) }));
        const tx = totaisTexto(d.texto);
        doc.total = { qty: numero(tb.total.qty), cartons: numero(tb.total.cartons) ?? tx.cartons, nw: numero(tb.total.nw) ?? tx.nw, gw: numero(tb.total.gw) ?? tx.gw };
      }
      doc.tamanhos = [];
      todas.forEach((l, i) => {
        if (!l.some(c => /^CARTON (SIZE|DIMENSIONS?)$/.test(rotulo(c.s)))) return;
        for (let j = i + 1; j < todas.length && todas[j].length >= 2; j++) {
          const n = numero(todas[j][todas[j].length - 1].s);
          if (n == null) break;
          doc.tamanhos.push([todas[j][0].s, n]);
        }
      });
    } else if (tipo === 'shipping') {
      const tb = tabelaEm(d, 'shipping');
      if (!tb) sem();
      else doc.linhas = tb.linhas.map(r => {
        const lt = lote(r.lot);
        if (!lt.par && !vazio(r.serials)) { lt.series = series(r.serials); lt.par = lt.series.length > 0; }
        return {
          crt: series(r.crt), crtTxt: vazio(r.crt) ? '' : String(r.crt), code: String(r.code ?? '').trim(), desc: String(r.desc ?? '').trim(),
          lote: lt, loteTxt: String(r.lot), qty: numero(r.qty), mfg: data(r.mfg), exp: data(r.exp), linha: r.linha,
        };
      });
    } else if (tipo === 'coa') {
      doc.escaneado = d.kind === 'pdf' && d.escaneado;
      const tb = doc.escaneado ? null : tabelaEm(d, 'coa');
      if (!tb && !doc.escaneado) sem();
      if (tb) doc.linhas = tb.linhas.map(r => {
        const lt = lote(r.lot);
        return { code: String(r.code ?? '').trim(), lot: lt.base, serials: lt.par ? lt.series : series(r.serials), qty: numero(r.qty), mfg: data(r.mfg), exp: data(r.exp) };
      });
    } else if (tipo === 'final') {
      doc.inv = tabelaEm(d, 'invoice');
      // a página da invoice também tem Description e Qty: procura o packing só onde está escrito PACKING LIST
      const pk = tabelaEm({ ...d, folhas: d.folhas.filter(f => /PACKING LIST/.test(rotulo(textoDe(f)))) }, 'packing');
      const tx = totaisTexto(d.texto);
      doc.totais = { cartons: (pk && numero(pk.total.cartons)) ?? tx.cartons, nw: (pk && numero(pk.total.nw)) ?? tx.nw, gw: (pk && numero(pk.total.gw)) ?? tx.gw };
    }
    return doc;
  }

  // ---------- as 12 checagens ----------
  function conferir(lidos) {
    const um = tipo => lidos.find(d => d.tipo === tipo && (d.linhas.length || tipo === 'final'));
    const inv = um('invoice'), pack = um('packing'), ship = um('shipping');
    const coas = lidos.filter(d => d.tipo === 'coa');
    const finais = lidos.filter(d => d.tipo === 'final');
    const R = [];
    const sec = (id, titulo, sub) => { const s = { id, titulo, sub, itens: [] }; R.push(s); return s; };
    const add = (s, nivel, msg, email) => s.itens.push({ nivel, msg, email });
    const falta = (s, ...tipos) => add(s, 'warn', t(`Faltou ${lista(tipos.map(x => TIPOS[x].toLowerCase()))} para esta checagem.`, `Missing ${lista(tipos.map(x => TIPOS[x].toLowerCase()))} for this check.`));
    const fontes = lidos.filter(d => d.tipo !== 'outro');

    // A. Cabeçalho
    const sA = sec('A', t('Cabeçalho', 'Header'), t('Exportador, invoice, pedido, faturado para, entregar para, contato', 'Exporter, invoice, order, invoice to, ship to, contact'));
    const NOMES = {
      exporter: [t('Exportador', 'Exporter'), 'exporter name'], invoiceNo: [t('Número da invoice', 'Invoice number'), 'invoice number'],
      orderNo: [t('Pedido', 'Order number'), 'order number'], invoiceTo: [t('Faturado para', 'Invoice to'), '"Invoice to"'],
      shipTo: [t('Entregar para', 'Ship to'), '"Ship to"'], attn: [t('Contato', 'Attention'), 'contact (Attn)'], tel: [t('Telefone', 'Phone'), 'phone number'],
    };
    if (fontes.length < 2) add(sA, 'warn', t('Precisa de pelo menos dois documentos para comparar.', 'Needs at least two documents to compare.'));
    else {
      let campos = 0;
      for (const [campo, [nome, nomeEmail]] of Object.entries(NOMES)) {
        const vals = fontes.filter(d => !vazio(d.cab[campo])).map(d => [d, d.cab[campo]]);
        if (vals.length < 2) continue;
        campos++;
        const norm = v => (campo === 'tel' ? String(v).replace(/\D/g, '') : chave(v));
        if (new Set(vals.map(([, v]) => norm(v))).size > 1) {
          add(sA, 'fail', `${nome} ${t('diferente', 'differs')}: ${vals.map(([d, v]) => `${TIPOS[d.tipo]} "${esc(v)}"`).join(', ')}.`,
            `The ${nomeEmail} is not the same in all documents (${vals.map(([d, v]) => `${TIPOS_EMAIL[d.tipo]}: ${v}`).join('; ')}).`);
        }
      }
      if (!sA.itens.length) add(sA, campos ? 'ok' : 'warn', campos
        ? t(`${campos} campos iguais em ${fontes.length} documentos.`, `${campos} fields match across ${fontes.length} documents.`)
        : t('Não achei campos de cabeçalho para comparar.', 'No header fields found to compare.'));
    }

    // A2. CNPJ do importador
    const sA2 = sec('A2', t('CNPJ do importador', 'Importer tax ID (CNPJ)'), t('Presente, válido e igual em todos', 'Present, valid and the same everywhere'));
    const achados = fontes.map(d => [d, (d.texto.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || []).map(c => c.replace(/\D/g, ''))]).filter(([, l]) => l.length);
    if (!achados.length) add(sA2, 'warn', t('CNPJ não encontrado nos documentos.', 'No CNPJ found in the documents.'));
    else {
      const todos = [...new Set(achados.flatMap(([, l]) => l))];
      todos.filter(c => !cnpjValido(c)).forEach(c => add(sA2, 'fail', t(`CNPJ ${fmtCnpj(c)} com dígito verificador inválido.`, `CNPJ ${fmtCnpj(c)} has invalid check digits.`),
        `The importer CNPJ ${fmtCnpj(c)} is not valid. Please correct it.`));
      if (todos.length > 1) add(sA2, 'fail', t(`CNPJs diferentes entre os documentos: ${todos.map(fmtCnpj).join(', ')}.`, `Different CNPJs across documents: ${todos.map(fmtCnpj).join(', ')}.`),
        `The importer CNPJ is not the same in all documents (${todos.map(fmtCnpj).join(', ')}).`);
      if (!sA2.itens.length) add(sA2, 'ok', t(`${fmtCnpj(todos[0])} válido e igual em ${achados.length} documentos.`, `${fmtCnpj(todos[0])} is valid and the same in ${achados.length} documents.`));
    }

    // B. Quantidade por SKU
    const sB = sec('B', t('Quantidade por SKU', 'Quantity per SKU'), 'Invoice x shipping list');
    const somaPor = (linhas, k) => linhas.reduce((m, r) => m.set(chave(r[k]), (m.get(chave(r[k])) || 0) + (r.qty || 0)), new Map());
    const nomeCod = new Map();
    [inv, ship].forEach(d => d && d.linhas.forEach(r => nomeCod.set(chave(r.code), r.code)));
    if (!inv || !ship) falta(sB, ...[!inv && 'invoice', !ship && 'shipping'].filter(Boolean));
    else {
      const a = somaPor(inv.linhas, 'code'), b = somaPor(ship.linhas, 'code');
      [...new Set([...a.keys(), ...b.keys()])].sort().forEach(k => {
        const qa = a.get(k) || 0, qb = b.get(k) || 0, c = nomeCod.get(k);
        if (qa !== qb) add(sB, 'fail', t(`${esc(c)}: invoice ${fmt(qa)} un, shipping list ${fmt(qb)} un.`, `${esc(c)}: invoice ${fmt(qa)} pcs, shipping list ${fmt(qb)} pcs.`),
          `${c}: the invoice shows ${fmtEn(qa)} pcs but the shipping list shows ${fmtEn(qb)} pcs.`);
      });
      const rep = inv.linhas.map(r => r.code).filter((c, i, arr) => arr.findIndex(x => chave(x) === chave(c)) !== i);
      if (rep.length) add(sB, 'warn', t(`Código repetido em mais de uma linha da invoice: ${esc([...new Set(rep)].join(', '))}.`, `Code repeated in more than one invoice line: ${esc([...new Set(rep)].join(', '))}.`));
      if (!sB.itens.length) add(sB, 'ok', t(`${a.size} SKUs com a mesma quantidade nos dois documentos.`, `${a.size} SKUs with the same quantity in both documents.`));
    }

    // C. Quantidade por família e total geral
    const sC = sec('C', t('Quantidade por família e total', 'Quantity per family and total'), 'Shipping list x packing list, invoice x packing list');
    if (!ship || !pack) falta(sC, ...[!ship && 'shipping', !pack && 'packing'].filter(Boolean));
    else {
      const sb = somaPor(ship.linhas, 'desc'), pb = somaPor(pack.linhas, 'desc');
      const nomes = new Map([...ship.linhas, ...pack.linhas].map(r => [chave(r.desc), r.desc]));
      [...new Set([...sb.keys(), ...pb.keys()])].sort().forEach(k => {
        if ((sb.get(k) || 0) !== (pb.get(k) || 0)) add(sC, 'fail', t(`"${esc(nomes.get(k))}": shipping list ${fmt(sb.get(k) || 0)}, packing list ${fmt(pb.get(k) || 0)}.`, `"${esc(nomes.get(k))}": shipping list ${fmt(sb.get(k) || 0)}, packing list ${fmt(pb.get(k) || 0)}.`),
          `"${nomes.get(k)}": the shipping list shows ${fmtEn(sb.get(k) || 0)} pcs and the packing list shows ${fmtEn(pb.get(k) || 0)} pcs.`);
      });
      const soma = d => d.linhas.reduce((s, r) => s + (r.qty || 0), 0);
      const ts = soma(ship), tp = soma(pack), ti = inv ? soma(inv) : null;
      if (ti != null && !(ti === ts && ts === tp)) add(sC, 'fail', t(`Total de peças: invoice ${fmt(ti)}, shipping list ${fmt(ts)}, packing list ${fmt(tp)}.`, `Total pieces: invoice ${fmt(ti)}, shipping list ${fmt(ts)}, packing list ${fmt(tp)}.`),
        `Total quantity does not match: invoice ${fmtEn(ti)}, shipping list ${fmtEn(ts)}, packing list ${fmtEn(tp)} pcs.`);
      if (inv && inv.total && inv.total.qty != null && inv.total.qty !== ti) add(sC, 'fail', t(`Linha TOTAL da invoice (${fmt(inv.total.qty)}) diferente da soma das linhas (${fmt(ti)}).`, `Invoice TOTAL line (${fmt(inv.total.qty)}) differs from the sum of lines (${fmt(ti)}).`),
        `The invoice TOTAL line (${fmtEn(inv.total.qty)} pcs) does not match the sum of the lines (${fmtEn(ti)} pcs).`);
      if (pack.total && pack.total.qty != null && pack.total.qty !== tp) add(sC, 'fail', t(`Linha TOTAL do packing list (${fmt(pack.total.qty)}) diferente da soma das linhas (${fmt(tp)}).`, `Packing list TOTAL line (${fmt(pack.total.qty)}) differs from the sum of lines (${fmt(tp)}).`),
        `The packing list TOTAL line (${fmtEn(pack.total.qty)} pcs) does not match the sum of the lines (${fmtEn(tp)} pcs).`);
      if (!sC.itens.length) add(sC, 'ok', t(`${sb.size} famílias e o total batem: ${fmt(ts)} un.`, `${sb.size} families and the total match: ${fmt(ts)} pcs.`));
    }

    // D. Valores da invoice
    const sD = sec('D', t('Valores da invoice', 'Invoice values'), t('Quantidade x preço unitário = valor', 'Quantity x unit price = amount'));
    if (!inv) falta(sD, 'invoice');
    else {
      let n = 0, soma = 0;
      inv.linhas.forEach(r => {
        if (r.price == null || r.amount == null) return;
        n++; soma += r.amount;
        if (Math.abs(r.qty * r.price - r.amount) > 0.01) add(sD, 'fail', t(`${esc(r.code)}: ${fmt(r.qty)} x ${fmt(r.price, 2)} = ${fmt(r.qty * r.price, 2)}, mas a linha mostra ${fmt(r.amount, 2)}.`, `${esc(r.code)}: ${fmt(r.qty)} x ${fmt(r.price, 2)} = ${fmt(r.qty * r.price, 2)}, but the line shows ${fmt(r.amount, 2)}.`),
          `${r.code}: ${fmtEn(r.qty)} x ${fmtEn(r.price, 2)} = ${fmtEn(r.qty * r.price, 2)}, but the invoice line shows ${fmtEn(r.amount, 2)}.`);
      });
      if (!n) add(sD, 'warn', t('Não achei as colunas de preço e valor.', 'Could not find the price and amount columns.'));
      else if (inv.total && inv.total.amount != null && Math.abs(soma - inv.total.amount) > 0.01) add(sD, 'fail', t(`Total da invoice ${fmt(inv.total.amount, 2)} diferente da soma das linhas ${fmt(soma, 2)}.`, `Invoice total ${fmt(inv.total.amount, 2)} differs from the sum of lines ${fmt(soma, 2)}.`),
        `The invoice total (${fmtEn(inv.total.amount, 2)}) does not match the sum of the lines (${fmtEn(soma, 2)}).`);
      if (!sD.itens.length) add(sD, 'ok', t(`${n} linhas conferidas. Total ${fmt(soma, 2)}.`, `${n} lines checked. Total ${fmt(soma, 2)}.`));
    }

    // E. Pesos do packing list
    const sE = sec('E', t('Pesos', 'Weights'), t('Soma das linhas x totais do packing list', 'Sum of lines x packing list totals'));
    if (!pack) falta(sE, 'packing');
    else {
      const nw = pack.linhas.reduce((s, r) => s + (r.nw || 0), 0), gw = pack.linhas.reduce((s, r) => s + (r.gw || 0), 0);
      const T = pack.total || {};
      if (T.nw == null && T.gw == null) add(sE, 'warn', t('Não achei os pesos totais declarados.', 'Could not find the declared total weights.'));
      if (T.nw != null && Math.abs(nw - T.nw) > 0.05) add(sE, 'fail', t(`Peso líquido: soma das linhas ${fmt(nw, 2)} kg, total declarado ${fmt(T.nw, 2)} kg.`, `Net weight: lines add up to ${fmt(nw, 2)} kg, declared total ${fmt(T.nw, 2)} kg.`),
        `Net weight: the lines add up to ${fmtEn(nw, 2)} kg but the declared total is ${fmtEn(T.nw, 2)} kg.`);
      if (T.gw != null && Math.abs(gw - T.gw) > 0.05) add(sE, 'warn', t(`Peso bruto: soma das linhas ${fmt(gw, 2)} kg, total declarado ${fmt(T.gw, 2)} kg. Se a diferença for o peso dos pallets, ok.`, `Gross weight: lines add up to ${fmt(gw, 2)} kg, declared total ${fmt(T.gw, 2)} kg. Fine if the difference is the pallets.`));
      if (T.nw != null && T.gw != null && T.nw > T.gw) add(sE, 'fail', t('Peso líquido maior que o peso bruto.', 'Net weight is higher than gross weight.'), 'The net weight is higher than the gross weight.');
      if (!sE.itens.length) add(sE, 'ok', t(`Pesos batem: ${fmt(nw, 2)} kg líquido e ${fmt(gw, 2)} kg bruto.`, `Weights match: ${fmt(nw, 2)} kg net and ${fmt(gw, 2)} kg gross.`));
    }

    // F. Caixas
    const sF = sec('F', t('Caixas', 'Cartons'), 'Shipping list x packing list');
    if (!ship || !pack) falta(sF, ...[!ship && 'shipping', !pack && 'packing'].filter(Boolean));
    else {
      const caixas = new Set(ship.linhas.flatMap(r => r.crt));
      const declarado = pack.total && pack.total.cartons;
      if (!caixas.size || !declarado) add(sF, 'warn', t('Não consegui ler o número das caixas em um dos documentos.', 'Could not read the carton numbers in one of the documents.'));
      else {
        const mx = Math.max(...caixas);
        if (mx !== declarado || caixas.size !== declarado) add(sF, 'fail', t(`Shipping list vai até a caixa ${mx} (${caixas.size} caixas), packing list declara ${declarado}.`, `Shipping list goes up to carton ${mx} (${caixas.size} cartons), packing list declares ${declarado}.`),
          `The shipping list has ${caixas.size} cartons but the packing list declares ${declarado}.`);
        const faltando = [];
        for (let n = 1; n <= mx; n++) if (!caixas.has(n)) faltando.push(n);
        if (faltando.length) add(sF, 'fail', t(`Caixas faltando na sequência do shipping list: ${faltando.slice(0, 20).join(', ')}.`, `Cartons missing from the shipping list sequence: ${faltando.slice(0, 20).join(', ')}.`),
          `Carton numbers missing from the shipping list: ${faltando.slice(0, 20).join(', ')}.`);
        if (pack.tamanhos.length) {
          const s = pack.tamanhos.reduce((a, [, q]) => a + q, 0);
          if (s !== declarado) add(sF, 'fail', t(`Tabela de tamanhos soma ${s} caixas, total declarado ${declarado}.`, `Carton size table adds up to ${s}, declared total ${declarado}.`),
            `The carton size table adds up to ${s} cartons but the total is ${declarado}.`);
        }
        if (!sF.itens.length) add(sF, 'ok', t(`${declarado} caixas nos dois documentos.`, `${declarado} cartons in both documents.`));
      }
    }

    // G. Lotes e séries do shipping list
    const sG = sec('G', t('Lotes e séries', 'Lots and serial numbers'), t('Quantidade = séries, sem repetição, um código por lote', 'Quantity = serials, no repeats, one code per lot'));
    const lotes = new Map();
    if (!ship) falta(sG, 'shipping');
    else {
      const vistos = new Map();
      ship.linhas.forEach(r => {
        const b = r.lote.base;
        const onde = r.crtTxt ? t(`caixa ${r.crtTxt}`, `carton ${r.crtTxt}`) : t(`linha ${r.linha}`, `row ${r.linha}`);
        if (r.qty == null) add(sG, 'fail', t(`${esc(r.code)}, lote ${esc(b)} (${onde}): sem quantidade.`, `${esc(r.code)}, lot ${esc(b)} (${onde}): no quantity.`), `${r.code} lot ${b}: the quantity is missing.`);
        else if (r.lote.par && r.lote.series.length !== r.qty) add(sG, 'fail', t(`${esc(r.code)}, lote ${esc(b)} (${onde}): quantidade ${fmt(r.qty)}, mas ${r.lote.series.length} séries.`, `${esc(r.code)}, lot ${esc(b)} (${onde}): quantity ${fmt(r.qty)}, but ${r.lote.series.length} serial numbers.`),
          `${r.code} lot ${b} (carton ${r.crtTxt}): the quantity is ${fmtEn(r.qty)} but there are ${r.lote.series.length} serial numbers.`);
        r.lote.series.forEach(s => {
          const k = b + '|' + s;
          if (!vistos.has(k)) vistos.set(k, []);
          vistos.get(k).push(r.crtTxt || String(r.linha));
        });
        const L = lotes.get(b) || { base: b, codes: new Set(), exp: new Set(), mfg: new Set(), qty: 0, series: [] };
        L.codes.add(r.code); if (r.exp) L.exp.add(r.exp); if (r.mfg) L.mfg.add(r.mfg);
        L.qty += r.qty || 0; L.series.push(...r.lote.series); L.desc = r.desc;
        lotes.set(b, L);
      });
      const dup = new Map();   // por lote e caixas envolvidas
      vistos.forEach((onde, k) => {
        if (onde.length < 2) return;
        const [b, s] = k.split('|');
        const id = b + '|' + [...new Set(onde)].join(',');
        if (!dup.has(id)) dup.set(id, { b, caixas: [...new Set(onde)], series: [] });
        dup.get(id).series.push(+s);
      });
      dup.forEach(({ b, caixas, series: ss }) => add(sG, 'fail',
        t(`Lote ${esc(b)}: séries ${faixas(ss)} aparecem mais de uma vez (caixas ${lista(caixas)}).`, `Lot ${esc(b)}: serial numbers ${faixas(ss)} appear more than once (cartons ${lista(caixas)}).`),
        `Lot ${b}: serial numbers ${faixas(ss)} appear more than once (cartons ${listaEn(caixas)}).`));
      lotes.forEach(L => {
        if (L.codes.size > 1) add(sG, 'fail', t(`Lote ${esc(L.base)} aparece em mais de um código: ${esc([...L.codes].join(', '))}.`, `Lot ${esc(L.base)} appears under more than one code: ${esc([...L.codes].join(', '))}.`),
          `Lot ${L.base} appears under more than one product code (${[...L.codes].join(', ')}).`);
        if (L.exp.size > 1) add(sG, 'fail', t(`Lote ${esc(L.base)} com mais de uma validade: ${[...L.exp].map(verData).join(', ')}.`, `Lot ${esc(L.base)} has more than one expiry date: ${[...L.exp].join(', ')}.`),
          `Lot ${L.base} shows more than one expiry date (${[...L.exp].join(', ')}).`);
      });
      if (!sG.itens.length) add(sG, 'ok', t(`${lotes.size} lotes, quantidade igual ao número de séries, sem série repetida.`, `${lotes.size} lots, quantity equal to serial count, no repeated serials.`));
    }

    // H. Validade mínima na chegada e fabricação recente
    const hoje = iso(new Date());
    const chegada = (inv && (inv.cab.eta || inv.cab.invoiceDate)) || hoje;
    const dataInv = (inv && inv.cab.invoiceDate) || hoje;
    const sH = sec('H', t('Validade e fabricação', 'Shelf life and manufacturing'), t(`Mínimo de ${MIN_SHELF} meses na chegada (${verData(chegada)})`, `At least ${MIN_SHELF} months at arrival (${verData(chegada)})`));
    if (!ship) falta(sH, 'shipping');
    else {
      let ok = 0;
      lotes.forEach(L => {
        const cod = [...L.codes].join('/');
        if (!L.exp.size) { add(sH, 'fail', t(`Lote ${esc(L.base)} (${esc(cod)}) sem data de validade.`, `Lot ${esc(L.base)} (${esc(cod)}) has no expiry date.`), `${cod} lot ${L.base}: the expiry date is missing.`); return; }
        let bom = true;
        L.exp.forEach(e => {
          const meses = (ms(e) - ms(chegada)) / MES;
          if (meses < MIN_SHELF) {
            bom = false;
            add(sH, 'fail', t(`Lote ${esc(L.base)} (${esc(cod)}) vence em ${verData(e)}: chega com ${fmt(meses, 1)} meses de validade, abaixo do mínimo de ${MIN_SHELF}.`, `Lot ${esc(L.base)} (${esc(cod)}) expires on ${e}: arrives with ${fmt(meses, 1)} months of shelf life, below the ${MIN_SHELF}-month minimum.`),
              `${cod} lot ${L.base} expires on ${dataEmail(e)}, which leaves only ${fmtEn(meses, 1)} months of shelf life at arrival. Our minimum is ${MIN_SHELF} months. Please replace this lot.`);
          }
        });
        L.mfg.forEach(m => {
          if (ms(m) > ms(dataInv) + DIA) { bom = false; add(sH, 'fail', t(`Lote ${esc(L.base)} (${esc(cod)}): fabricação ${verData(m)} depois da data da invoice.`, `Lot ${esc(L.base)} (${esc(cod)}): manufactured ${m}, after the invoice date.`), `${cod} lot ${L.base}: the manufacturing date (${dataEmail(m)}) is after the invoice date.`); }
          else if (ms(dataInv) - ms(m) > MAX_MFG * MES) { bom = false; add(sH, 'warn', t(`Lote ${esc(L.base)} (${esc(cod)}) fabricado em ${verData(m)}, mais de ${MAX_MFG} meses antes da invoice.`, `Lot ${esc(L.base)} (${esc(cod)}) manufactured on ${m}, more than ${MAX_MFG} months before the invoice.`)); }
          L.exp.forEach(e => { if (ms(e) <= ms(m)) { bom = false; add(sH, 'fail', t(`Lote ${esc(L.base)}: validade ${verData(e)} antes da fabricação ${verData(m)}.`, `Lot ${esc(L.base)}: expiry ${e} is before manufacturing ${m}.`), `${cod} lot ${L.base}: the expiry date is before the manufacturing date.`); } });
        });
        if (bom) ok++;
      });
      if (ok) add(sH, 'ok', t(`${ok} de ${lotes.size} lotes dentro do prazo.`, `${ok} of ${lotes.size} lots within limits.`));
    }

    // I. Certificado de análise x shipping list, lote a lote
    const sI = sec('I', t('Certificado de análise', 'Certificate of analysis'), t('Lote, código, séries e validade x shipping list', 'Lot, code, serials and expiry x shipping list'));
    const coaLinhas = coas.flatMap(d => d.linhas);
    if (!coas.length) add(sI, 'fail', t('Certificado de análise não enviado. Ele é obrigatório para liberar o embarque.', 'Certificate of analysis not provided. It is required to release the shipment.'),
      'Please send the certificate of analysis (COA) for all lots in this shipment.');
    else if (!ship) falta(sI, 'shipping');
    else {
      coas.filter(d => d.escaneado).forEach(d => add(sI, 'warn', t(`"${esc(d.nome)}" é um PDF escaneado, sem texto. A demo no navegador não roda OCR: o script em Python lê esse arquivo com Tesseract. Confira no olho.`, `"${esc(d.nome)}" is a scanned PDF with no text. The browser demo does not run OCR (the Python script reads it with Tesseract). Check it by eye.`)));
      const usados = new Set();
      const basesShip = new Set([...lotes.keys()].map(chave));
      let ok = 0;
      if (coaLinhas.length) lotes.forEach(L => {
        const cod = [...L.codes].join('/');
        let c = coaLinhas.find(r => chave(r.lot) === chave(L.base));
        if (!c) {
          // só entre os lotes do certificado que não batem com outro lote do embarque (L2405 e L2406 também "se parecem")
          c = coaLinhas.find(r => !basesShip.has(chave(r.lot)) && parecido(r.lot, L.base));
          if (c) add(sI, 'warn', t(`Lote ${esc(L.base)} aparece como "${esc(c.lot)}" no certificado. Provável erro de digitação ou de leitura: conferir no PDF.`, `Lot ${esc(L.base)} appears as "${esc(c.lot)}" in the certificate. Probably a typo or misread: check the PDF.`));
        }
        if (!c) { add(sI, 'fail', t(`Lote ${esc(L.base)} (${esc(cod)}) não aparece no certificado.`, `Lot ${esc(L.base)} (${esc(cod)}) is not in the certificate.`), `${cod} lot ${L.base} is not listed in the COA. Please send the certificate for this lot.`); return; }
        usados.add(c);
        let bom = chave(c.lot) === chave(L.base);
        if (c.code && !L.codes.has(c.code) && ![...L.codes].some(x => chave(x) === chave(c.code))) { bom = false; add(sI, 'fail', t(`Lote ${esc(L.base)}: código ${esc(c.code)} no certificado, ${esc(cod)} no shipping list.`, `Lot ${esc(L.base)}: code ${esc(c.code)} in the certificate, ${esc(cod)} in the shipping list.`), `Lot ${L.base}: the COA shows code ${c.code} but the shipping list shows ${cod}.`); }
        if (c.exp && L.exp.size && !L.exp.has(c.exp)) { bom = false; add(sI, 'fail', t(`Lote ${esc(L.base)}: validade ${verData(c.exp)} no certificado, ${[...L.exp].map(verData).join(', ')} no shipping list.`, `Lot ${esc(L.base)}: expiry ${c.exp} in the certificate, ${[...L.exp].join(', ')} in the shipping list.`), `Lot ${L.base}: the COA shows expiry ${dataEmail(c.exp)} but the shipping list shows ${[...L.exp].map(dataEmail).join(', ')}.`); }
        if (c.serials.length && L.series.length) {
          const doCoa = new Set(c.serials);
          const fora = [...new Set(L.series)].filter(s => !doCoa.has(s));
          if (fora.length) { bom = false; add(sI, 'fail', t(`Lote ${esc(L.base)}: séries ${faixas(fora)} do shipping list não estão no certificado.`, `Lot ${esc(L.base)}: serials ${faixas(fora)} from the shipping list are not in the certificate.`), `Lot ${L.base}: serial numbers ${faixas(fora)} are in the shipping list but not in the COA.`); }
        }
        if (bom) ok++;
      });
      coaLinhas.filter(r => !usados.has(r) && r.lot).forEach(r => add(sI, 'warn', t(`Lote ${esc(r.lot)} está no certificado, mas não no shipping list.`, `Lot ${esc(r.lot)} is in the certificate but not in the shipping list.`)));
      if (!coaLinhas.length && !coas.some(d => d.escaneado)) add(sI, 'warn', t('Não achei a tabela de lotes no certificado.', 'Could not find the lot table in the certificate.'));
      if (ok) add(sI, 'ok', t(`${ok} de ${lotes.size} lotes iguais no certificado: código, séries e validade.`, `${ok} of ${lotes.size} lots match the certificate: code, serials and expiry.`));
    }

    // J. Documentos finais assinados (PDF) x planilhas
    const sJ = sec('J', t('Documentos finais assinados', 'Signed final documents'), t('PDF assinado x planilhas', 'Signed PDF x spreadsheets'));
    if (!finais.length) add(sJ, 'warn', t('Invoice e packing list assinados (PDF) não enviados.', 'Signed invoice and packing list (PDF) not provided.'));
    else finais.forEach(f => {
      const antes = sJ.itens.length;
      if (inv && inv.cab.invoiceNo && !chave(f.texto).includes(chave(inv.cab.invoiceNo))) add(sJ, 'fail', t(`"${esc(f.nome)}" não cita a invoice ${esc(inv.cab.invoiceNo)}.`, `"${esc(f.nome)}" does not mention invoice ${esc(inv.cab.invoiceNo)}.`), `The signed PDF does not show invoice number ${inv.cab.invoiceNo}.`);
      if (inv && f.inv) {
        const q = somaPor(f.inv.linhas.map(r => ({ code: r.code, qty: numero(r.qty) })), 'code');
        inv.linhas.forEach(r => {
          const k = chave(r.code);
          if (!q.has(k)) add(sJ, 'fail', t(`${esc(r.code)} não aparece no PDF assinado.`, `${esc(r.code)} is not in the signed PDF.`), `${r.code} is missing from the signed invoice.`);
          else if (q.get(k) !== r.qty) add(sJ, 'fail', t(`${esc(r.code)}: PDF assinado ${fmt(q.get(k))} un, planilha ${fmt(r.qty)} un.`, `${esc(r.code)}: signed PDF ${fmt(q.get(k))} pcs, spreadsheet ${fmt(r.qty)} pcs.`), `${r.code}: the signed invoice shows ${fmtEn(q.get(k))} pcs but the Excel invoice shows ${fmtEn(r.qty)} pcs.`);
        });
      } else if (inv) add(sJ, 'warn', t(`Não achei a tabela de itens em "${esc(f.nome)}".`, `Could not find the item table in "${esc(f.nome)}".`));
      if (pack && pack.total) {
        [['cartons', t('caixas', 'cartons'), 'cartons', 0], ['nw', t('peso líquido', 'net weight'), 'net weight', 2], ['gw', t('peso bruto', 'gross weight'), 'gross weight', 2]].forEach(([k, nome, nomeEn, casas]) => {
          const a = f.totais[k], b = pack.total[k];
          if (a != null && b != null && Math.abs(a - b) > 0.05) add(sJ, 'fail', t(`${nome[0].toUpperCase() + nome.slice(1)}: PDF assinado ${fmt(a, casas)}, packing list ${fmt(b, casas)}.`, `${nome[0].toUpperCase() + nome.slice(1)}: signed PDF ${fmt(a, casas)}, packing list ${fmt(b, casas)}.`), `Total ${nomeEn}: the signed packing list shows ${fmtEn(a, casas)} but the Excel packing list shows ${fmtEn(b, casas)}.`);
        });
      }
      if (sJ.itens.length === antes) add(sJ, 'ok', t(`"${esc(f.nome)}" bate com as planilhas: invoice, quantidades, caixas e pesos.`, `"${esc(f.nome)}" matches the spreadsheets: invoice, quantities, cartons and weights.`));
    });

    // K. Anuência: lote fabricado antes da data da anuência do produto não pode entrar
    const sK = sec('K', t('Anuência regulatória', 'Regulatory authorization'), t('Fabricação x data da anuência do produto', 'Manufacturing x product authorization date'));
    if (!ship) falta(sK, 'shipping');
    else {
      let regras = 0;
      ANUENCIAS.forEach(a => {
        const doLote = new Map();
        ship.linhas.filter(r => chave(r.code).startsWith(chave(a.chave))).forEach(r => doLote.set(r.lote.base, r));
        if (!doLote.size) return;
        regras++;
        let ok = 0;
        doLote.forEach((r, b) => {
          if (!r.mfg) add(sK, 'fail', t(`${esc(r.code)} lote ${esc(b)}: sem data de fabricação. Não dá para garantir que pode entrar.`, `${esc(r.code)} lot ${esc(b)}: no manufacturing date, so it cannot be cleared.`), `${r.code} lot ${b} has no manufacturing date. We need it to confirm the lot was made after the product authorization.`);
          else if (ms(r.mfg) < ms(a.data)) add(sK, 'fail', t(`${esc(r.code)} lote ${esc(b)}: fabricado em ${verData(r.mfg)}, antes da anuência (${verData(a.data)}). Esse lote não pode ser importado.`, `${esc(r.code)} lot ${esc(b)}: manufactured on ${r.mfg}, before the authorization (${a.data}). This lot cannot be imported.`),
            `${r.code} lot ${b} was manufactured on ${dataEmail(r.mfg)}, before the product authorization granted on ${dataEmail(a.data)}. This lot cannot be imported. Please replace it with a lot made after that date.`);
          else ok++;
        });
        if (ok) add(sK, 'ok', t(`${esc(a.chave)}: ${ok} ${ok > 1 ? 'lotes fabricados' : 'lote fabricado'} depois da anuência de ${verData(a.data)}.`, `${esc(a.chave)}: ${ok} ${ok > 1 ? 'lots' : 'lot'} made after the ${a.data} authorization.`));
      });
      if (!regras) add(sK, 'ok', t('Nenhum produto do embarque tem anuência cadastrada nesta demo.', 'No product in this shipment has an authorization registered in this demo.'));
    }

    const PESO = { fail: 2, warn: 1, ok: 0 };
    R.forEach(s => { s.nivel = s.itens.reduce((n, i) => (PESO[i.nivel] > PESO[n] ? i.nivel : n), 'ok'); });
    return { secoes: R, inv, ship, lotes, chegada };
  }

  // ---------- relatório ----------
  const NIVEL = { fail: t('FALHA', 'FAIL'), warn: t('ATENÇÃO', 'CHECK'), ok: 'OK' };
  const pill = n => `<span class="pill ${n}">${NIVEL[n]}</span>`;

  function email(res) {
    const itens = res.secoes.flatMap(s => s.itens.filter(i => i.nivel === 'fail' && i.email).map(i => i.email));
    const cab = res.inv ? res.inv.cab : {};
    const ref = [cab.invoiceNo && `invoice ${cab.invoiceNo}`, cab.orderNo && `order ${cab.orderNo}`].filter(Boolean).join(', ');
    const quem = cab.exporter ? `${cab.exporter} team` : 'team';
    if (!itens.length) return `Subject: ${cab.invoiceNo || 'Shipment'}: documents approved\n\nDear ${quem},\n\nWe checked the documents${ref ? ` for ${ref}` : ''} and everything matches. You can proceed with the shipment.\n\nBest regards,`;
    return `Subject: ${cab.invoiceNo || 'Shipment'}${cab.orderNo ? ' / ' + cab.orderNo : ''}: corrections needed before approval\n\nDear ${quem},\n\nWe checked the documents${ref ? ` for ${ref}` : ''} and found the points below. Please send corrected documents before we approve the shipment.\n\n${itens.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nThank you,`;
  }

  function mostrar(res, lidos) {
    const cont = { fail: 0, warn: 0, ok: 0 };
    res.secoes.forEach(s => cont[s.nivel]++);
    const cab = res.inv ? res.inv.cab : {};
    const nCaixas = res.ship ? new Set(res.ship.linhas.flatMap(r => r.crt)).size : 0;
    const resumo = [
      res.inv && `${res.inv.linhas.length} SKUs`,
      res.lotes.size && `${res.lotes.size} ${t('lotes', 'lots')}`,
      nCaixas && `${nCaixas} ${t('caixas', 'cartons')}`,
      `${t('chegada', 'arrival')} ${verData(res.chegada)}`,
    ].filter(Boolean).join(' · ');
    ui.report.innerHTML = `
      <div class="vd-head">
        <div><small>${t('Resultado', 'Result')}</small><b>${cab.invoiceNo ? 'Invoice ' + esc(cab.invoiceNo) : t('Conferência', 'Check')}</b>${cab.exporter ? `<span>${esc(cab.exporter)}</span>` : ''}</div>
        <div class="vd-count"><span class="pill fail">${cont.fail} ${cont.fail === 1 ? NIVEL.fail : t('FALHAS', 'FAILS')}</span><span class="pill warn">${cont.warn} ${NIVEL.warn}</span><span class="pill ok">${cont.ok} OK</span></div>
        <p class="vd-meta">${esc(resumo)} · ${lidos.length} ${t('documentos', 'documents')}</p>
      </div>
      <div class="vd-checks">${res.secoes.map(s => `
        <details class="vd-check ${s.nivel}"${s.nivel === 'ok' ? '' : ' open'}>
          <summary><span class="vd-id">${s.id}</span><span class="vd-t"><b>${s.titulo}</b><small>${esc(s.sub)}</small></span>${pill(s.nivel)}</summary>
          <ul>${s.itens.map(i => `<li>${pill(i.nivel)}<span>${i.msg}</span></li>`).join('')}</ul>
        </details>`).join('')}
      </div>
      <div class="vd-mail">
        <div class="vd-mail-top"><h3>${t('Rascunho de e-mail para o fornecedor', 'Draft email to the supplier')}</h3>
          <div class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="vdCopy">${t('Copiar e-mail', 'Copy email')}</button><button type="button" class="btn btn-outline btn-sm" id="vdXlsx">${t('Baixar relatório (Excel)', 'Download report (Excel)')}</button></div></div>
        <textarea readonly rows="10" aria-label="${t('Rascunho de e-mail', 'Draft email')}">${esc(email(res))}</textarea>
      </div>`;
    ui.report.hidden = false;
    $('#vdCopy').addEventListener('click', async e => {
      try { await navigator.clipboard.writeText($('.vd-mail textarea').value); e.target.textContent = t('Copiado', 'Copied'); }
      catch (err) { $('.vd-mail textarea').select(); }
    });
    $('#vdXlsx').addEventListener('click', () => baixarExcel(res));
    return cont;
  }

  function baixarExcel(res) {
    const X = window.XLSX;
    const limpo = s => String(s).replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
    const resumo = [[t('Checagem', 'Check'), 'Status', t('Detalhe', 'Detail')]];
    res.secoes.forEach(s => s.itens.forEach(i => resumo.push([`${s.id}. ${s.titulo}`, NIVEL[i.nivel], limpo(i.msg)])));
    const lotes = [[t('Lote', 'Lot'), t('Código', 'Code'), t('Qtd', 'Qty'), t('Fabricação', 'Manufactured'), t('Validade', 'Expiry'), t('Meses na chegada', 'Months at arrival')]];
    res.lotes.forEach(L => {
      const e = [...L.exp].sort()[0];
      lotes.push([L.base, [...L.codes].join('/'), L.qty, [...L.mfg].sort()[0] || '', e || '', e ? Math.round((ms(e) - ms(res.chegada)) / MES * 10) / 10 : '']);
    });
    const wb = X.utils.book_new();
    const a = X.utils.aoa_to_sheet(resumo); a['!cols'] = [{ wch: 34 }, { wch: 10 }, { wch: 110 }];
    const b = X.utils.aoa_to_sheet(lotes); b['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    X.utils.book_append_sheet(wb, a, t('Resumo', 'Summary'));
    X.utils.book_append_sheet(wb, b, t('Lotes', 'Lots'));
    X.writeFile(wb, `${t('Conferencia', 'Check')}_${(res.inv && res.inv.cab.invoiceNo) || 'embarque'}.xlsx`);
    track('validador-relatorio');
  }

  // ---------- arquivos na tela ----------
  let arquivos = [];   // { nome, tamanho, origem: 'kit' | 'voce', buf, dados, tipo }

  function listar() {
    ui.files.innerHTML = arquivos.map((a, i) => `
      <li>
        <span class="vd-ext ${/\.pdf$/i.test(a.nome) ? 'pdf' : 'xls'}">${/\.pdf$/i.test(a.nome) ? 'PDF' : 'XLS'}</span>
        <span class="vd-name"><b>${esc(a.nome)}</b><small>${a.origem === 'kit' ? t('kit de exemplo', 'sample kit') : t('seu arquivo', 'your file')} · ${fmt(a.tamanho / 1024)} KB${a.aviso ? ` · <em>${esc(a.aviso)}</em>` : ''}</small></span>
        <select data-i="${i}" aria-label="${t('Tipo do documento', 'Document type')}">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}"${a.tipo === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <button type="button" class="vd-x" data-x="${i}" aria-label="${t('Remover', 'Remove')} ${esc(a.nome)}">×</button>
      </li>`).join('');
    ui.files.hidden = !arquivos.length;
    ui.run.hidden = !arquivos.length;
  }
  ui.files.addEventListener('change', e => {
    const i = e.target.dataset.i;
    if (i != null) { arquivos[i].tipo = e.target.value; arquivos[i].aviso = null; }
  });
  ui.files.addEventListener('click', e => {
    const i = e.target.dataset.x;
    if (i != null) { arquivos.splice(+i, 1); listar(); }
  });

  const status = (msg, erro) => { ui.status.textContent = msg; ui.status.classList.toggle('err', !!erro); };

  async function ler(a) {
    if (a.dados) return;
    if (/\.pdf$/i.test(a.nome)) { await precisaPdf(); a.dados = await lerPdf(a.buf); }
    else { await precisaExcel(); a.dados = lerPlanilha(a.buf); }
    if (!a.tipo) a.tipo = classificar(a.dados, a.nome);
  }

  async function adicionar(lista, origem) {
    status(t('Lendo os arquivos...', 'Reading files...'));
    const novos = [];
    for (const f of lista) {
      if (!/\.(xlsx|xlsm|xls|csv|pdf)$/i.test(f.name)) { status(t(`"${f.name}" não é Excel nem PDF.`, `"${f.name}" is not an Excel or PDF file.`), true); continue; }
      const a = { nome: f.name, tamanho: f.size, origem, buf: await f.arrayBuffer(), tipo: f.tipo };
      try { await ler(a); novos.push(a); }
      catch (err) { status(t(`Não consegui ler "${f.name}".`, `Could not read "${f.name}".`), true); }
    }
    // arquivo seu substitui o do kit do mesmo tipo
    if (origem === 'voce') arquivos = arquivos.filter(a => !(a.origem === 'kit' && novos.some(n => n.tipo === a.tipo)));
    arquivos.push(...novos);
    listar();
    if (novos.length) status(t(`${arquivos.length} arquivos prontos. Clique em Conferir.`, `${arquivos.length} files ready. Click Check.`));
  }

  async function rodar() {
    if (!arquivos.length) return;
    ui.run.disabled = ui.runKit.disabled = true;
    status(t('Conferindo...', 'Checking...'));
    try {
      await precisaExcel();
      const lidos = arquivos.map(a => { const d = interpretar(a); a.aviso = d.aviso; return d; });
      const res = conferir(lidos);
      listar();
      const c = mostrar(res, lidos);
      status(t(`Pronto: ${c.fail} com falha, ${c.warn} para conferir no olho e ${c.ok} OK.`, `Done: ${c.fail} failed, ${c.warn} to check by eye and ${c.ok} OK.`));
      track('validador-conferir', { origem: arquivos.every(a => a.origem === 'kit') ? 'kit' : 'arquivos' });
      ui.report.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } catch (err) {
      status(t('Algo deu errado na conferência. Confira se os arquivos são os documentos do embarque.', 'Something went wrong. Check that the files are the shipment documents.'), true);
      console.error(err);
    } finally {
      ui.run.disabled = ui.runKit.disabled = false;
    }
  }

  async function usarKit() {
    ui.runKit.disabled = true;
    status(t('Baixando o kit de exemplo...', 'Loading the sample kit...'));
    try {
      const arqs = await Promise.all(KIT.map(async k => {
        const r = await fetch(new URL(k.file, KIT_URL));
        if (!r.ok) throw new Error(k.file);
        const b = await r.blob();
        return Object.assign(new File([b], k.file), { tipo: k.type });
      }));
      arquivos = [];
      await adicionar(arqs, 'kit');
      await rodar();
      track('validador-kit');
    } catch (err) {
      status(t('Não consegui baixar o kit de exemplo. Tente de novo.', 'Could not load the sample kit. Please try again.'), true);
      ui.runKit.disabled = false;
    }
  }

  ui.runKit.addEventListener('click', usarKit);
  ui.run.addEventListener('click', rodar);
  ui.input.addEventListener('change', () => { adicionar([...ui.input.files], 'voce'); ui.input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => ui.drop.addEventListener(ev, e => { e.preventDefault(); ui.drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(ev => ui.drop.addEventListener(ev, e => { e.preventDefault(); ui.drop.classList.remove('on'); }));
  ui.drop.addEventListener('drop', e => adicionar([...e.dataTransfer.files], 'voce'));

  // ---------- "Ver" de uma planilha do kit ----------
  const dlg = document.createElement('dialog');
  dlg.className = 'vd-dialog';
  dlg.innerHTML = `<div class="vd-dialog-top"><b></b><button type="button" class="vd-x" aria-label="${t('Fechar', 'Close')}">×</button></div><div class="vd-sheet"></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.vd-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  root.querySelectorAll('[data-ver]').forEach(btn => btn.addEventListener('click', async () => {
    const nome = btn.dataset.ver;
    btn.disabled = true;
    try {
      await precisaExcel();
      const buf = await (await fetch(new URL(nome, KIT_URL))).arrayBuffer();
      const linhas = lerPlanilha(buf).folhas[0];
      const cols = Math.max(...linhas.map(l => (l.length ? l[l.length - 1].x + 1 : 0)));
      dlg.querySelector('b').textContent = nome;
      // parece uma planilha: letras das colunas, número das linhas e títulos ocupando a linha toda
      const letras = Array.from({ length: cols }, (_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join('');
      dlg.querySelector('.vd-sheet').innerHTML = `<table><tr><th></th>${letras}</tr>${linhas.map((l, n) => {
        const val = c => esc(/^\d{4}-\d{2}-\d{2}$/.test(c.s) ? verData(c.s) : c.w ?? c.s);
        if (l.length === 1 && l[0].x === 0) return `<tr><th>${n + 1}</th><td colspan="${cols}">${val(l[0])}</td></tr>`;
        const cel = Array(cols).fill('');
        l.forEach(c => { cel[c.x] = val(c); });
        return `<tr><th>${n + 1}</th>${cel.map(v => `<td>${v}</td>`).join('')}</tr>`;
      }).join('')}</table>`;
      dlg.showModal();
      track('validador-ver', { arquivo: nome });
    } catch (err) {
      window.open(new URL(nome, KIT_URL), '_blank', 'noopener');
    } finally {
      btn.disabled = false;
    }
  }));

  if (location.hash === '#exemplo') usarKit();
})();
