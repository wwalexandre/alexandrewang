// Painel /admin: lê mensagens de contato, leads e visitas do Cloudflare D1, pelas rotas /api/admin/*.
// O login é do Cloudflare Access (fica na frente de /admin/ e de /api/admin/*), e o Worker confere
// o token do Access em cada chamada. Aqui não existe senha nem chave de banco.
// Todo texto vindo de visitantes é inserido com textContent, nunca com innerHTML.

(function () {
  const $ = id => document.getElementById(id);

  // Cliente mínimo das rotas do painel. Devolve { data, error } como o código abaixo já esperava.
  async function api(caminho, opcoes) {
    try {
      const r = await fetch('/api/admin/' + caminho, Object.assign({
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
      }, opcoes || {}));
      let corpo = null;
      try { corpo = await r.json(); } catch (e) {}
      if (!r.ok) return { data: null, error: { status: r.status, motivo: corpo && corpo.erro } };
      return { data: corpo, error: null };
    } catch (e) {
      return { data: null, error: { status: 0, motivo: 'rede' } };
    }
  }

  const views = { boot: $('bootMsg'), denied: $('deniedView'), app: $('appView') };
  const show = name => {
    Object.keys(views).forEach(k => { views[k].hidden = k !== name; });
    $('headActions').hidden = name !== 'app';
  };

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };
  const fmt = iso => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  // ---------- Acesso ----------
  const MOTIVOS = {
    'acesso-nao-configurado': 'O Cloudflare Access ainda não foi configurado no Worker (ACCESS_TEAM_DOMAIN e ACCESS_AUD). Veja docs/CLOUDFLARE.md.',
    'sem-token': 'A requisição chegou sem passar pelo Cloudflare Access. Confira se o aplicativo do Access cobre /admin/* e /api/admin/*.',
    'email': 'Este e-mail não está na lista de administradores.'
  };

  async function boot() {
    const eu = await api('eu');
    if (eu.error) {
      $('deniedMsg').textContent = MOTIVOS[eu.error.motivo]
        || 'Não foi possível confirmar o seu acesso ao painel (erro ' + (eu.error.status || 'de rede') + ').';
      show('denied');
      return;
    }
    $('userEmail').textContent = eu.data.email || '';
    show('app');
    loadMessages();
    loadLeads();
    loadVis();
  }

  // ---------- Abas ----------
  const tabs = [
    { tab: $('tabMsg'), panel: $('panelMsg') },
    { tab: $('tabLeads'), panel: $('panelLeads') },
    { tab: $('tabVis'), panel: $('panelVis') }
  ];
  tabs.forEach(t => t.tab.addEventListener('click', () => {
    tabs.forEach(o => {
      const on = o === t;
      o.tab.setAttribute('aria-selected', on ? 'true' : 'false');
      o.panel.hidden = !on;
    });
  }));

  // ---------- Mensagens ----------
  let messages = [];

  function renderMessages() {
    const list = $('msgList');
    const onlyUnread = $('onlyUnread').checked;
    const unread = messages.filter(m => !m.lida).length;
    $('badgeMsg').hidden = unread === 0;
    $('badgeMsg').textContent = String(unread);
    list.replaceChildren();
    const shown = onlyUnread ? messages.filter(m => !m.lida) : messages;
    $('msgStatus').textContent = shown.length
      ? shown.length + (shown.length === 1 ? ' mensagem' : ' mensagens')
      : (onlyUnread ? 'Nenhuma mensagem não lida.' : 'Nenhuma mensagem ainda.');

    shown.forEach(m => {
      const card = el('article', 'adm-msg' + (m.lida ? '' : ' unread'));

      const top = el('div', 'adm-msg-top');
      top.append(el('span', 'adm-msg-name', m.nome));
      top.append(el('span', 'adm-msg-meta', fmt(m.criado_em) + ' · ' + String(m.idioma).toUpperCase()));
      card.append(top);

      const mail = el('a', '', m.email);
      mail.href = 'mailto:' + encodeURIComponent(m.email);
      const meta = el('div', 'adm-msg-meta');
      meta.append(mail);
      card.append(meta);

      if (m.assunto) card.append(el('div', 'adm-msg-subject', m.assunto));
      card.append(el('p', 'adm-msg-text', m.mensagem));

      const actions = el('div', 'adm-actions');
      const toggle = el('button', 'btn btn-outline btn-sm', m.lida ? 'Marcar como não lida' : 'Marcar como lida');
      toggle.type = 'button';
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        const { error } = await api('mensagens/' + m.id, { method: 'PATCH', body: JSON.stringify({ lida: !m.lida }) });
        if (error) { $('msgStatus').textContent = 'Não foi possível atualizar. Tente novamente.'; toggle.disabled = false; return; }
        m.lida = !m.lida;
        renderMessages();
      });
      const del = el('button', 'btn btn-outline btn-sm adm-danger', 'Excluir');
      del.type = 'button';
      del.addEventListener('click', async () => {
        if (!window.confirm('Excluir esta mensagem de ' + m.nome + '? Não dá para desfazer.')) return;
        del.disabled = true;
        const { error } = await api('mensagens/' + m.id, { method: 'DELETE' });
        if (error) { $('msgStatus').textContent = 'Não foi possível excluir. Tente novamente.'; del.disabled = false; return; }
        messages = messages.filter(x => x.id !== m.id);
        renderMessages();
      });
      actions.append(toggle, del);
      card.append(actions);

      list.append(card);
    });
  }

  async function loadMessages() {
    $('msgStatus').textContent = 'Carregando...';
    const { data, error } = await api('mensagens');
    if (error) { $('msgStatus').textContent = 'Não foi possível carregar as mensagens.'; return; }
    messages = data || [];
    renderMessages();
  }

  $('reloadMsg').addEventListener('click', loadMessages);
  $('onlyUnread').addEventListener('change', renderMessages);

  // ---------- Leads ----------
  let leads = [];
  const ORIGEM = { curriculo: 'Currículo', arquivo: 'Modelo', demo: 'Demonstração' };

  // "Um por e-mail": mantém só o registro mais recente de cada e-mail (a lista já vem do mais novo para o mais antigo)
  function visibleLeads() {
    if (!$('onePerEmail').checked) return leads;
    const seen = new Set();
    return leads.filter(l => {
      const k = String(l.email).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function renderLeads() {
    const body = $('leadBody');
    body.replaceChildren();
    const shown = visibleLeads();
    $('countLeads').textContent = leads.length ? '(' + leads.length + ')' : '';
    $('leadStatus').textContent = !leads.length ? 'Nenhum lead ainda.'
      : (shown.length !== leads.length ? shown.length + ' e-mails diferentes em ' + leads.length + ' registros' : '');
    shown.forEach(l => {
      const tr = el('tr');
      tr.append(el('td', '', fmt(l.criado_em)));
      tr.append(el('td', '', l.email));
      tr.append(el('td', '', ORIGEM[l.origem] || l.origem));
      tr.append(el('td', '', l.detalhe || ''));
      tr.append(el('td', '', String(l.idioma).toUpperCase()));
      const td = el('td');
      const del = el('button', 'btn btn-outline btn-sm adm-danger', 'Excluir');
      del.type = 'button';
      del.addEventListener('click', async () => {
        if (!window.confirm('Excluir o lead ' + l.email + '? Não dá para desfazer.')) return;
        del.disabled = true;
        const { error } = await api('leads/' + l.id, { method: 'DELETE' });
        if (error) { $('leadStatus').textContent = 'Não foi possível excluir. Tente novamente.'; del.disabled = false; return; }
        leads = leads.filter(x => x.id !== l.id);
        renderLeads();
      });
      td.append(del);
      tr.append(td);
      body.append(tr);
    });
  }

  async function loadLeads() {
    $('leadStatus').textContent = 'Carregando...';
    const { data, error } = await api('leads');
    if (error) { $('leadStatus').textContent = 'Não foi possível carregar os leads.'; return; }
    leads = data || [];
    renderLeads();
  }

  $('reloadLeads').addEventListener('click', loadLeads);
  $('onePerEmail').addEventListener('change', renderLeads);

  // CSV: neutraliza células que começam com = + - @ (injeção de fórmula no Excel)
  const csvCell = v => {
    let s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  $('exportLeads').addEventListener('click', () => {
    if (!leads.length) { $('leadStatus').textContent = 'Não há leads para exportar.'; return; }
    const rows = [['data', 'email', 'origem', 'detalhe', 'idioma']].concat(
      visibleLeads().map(l => [l.criado_em, l.email, l.origem, l.detalhe || '', l.idioma])
    );
    const csv = '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ---------- Visitantes ----------
  // Tudo vem pronto de /api/admin/visitas, que só responde para admin.
  // Todo texto é inserido com textContent, porque parte dele (site de origem) vem de fora.
  let visDias = 30;

  const PAISES = {
    BR: 'Brasil', US: 'Estados Unidos', PT: 'Portugal', GB: 'Reino Unido', IE: 'Irlanda',
    DE: 'Alemanha', FR: 'França', ES: 'Espanha', IT: 'Itália', NL: 'Holanda', BE: 'Bélgica',
    CH: 'Suíça', AT: 'Áustria', SE: 'Suécia', NO: 'Noruega', DK: 'Dinamarca', FI: 'Finlândia',
    PL: 'Polônia', CA: 'Canadá', MX: 'México', AR: 'Argentina', CL: 'Chile', CO: 'Colômbia',
    PE: 'Peru', UY: 'Uruguai', PY: 'Paraguai', IN: 'Índia', JP: 'Japão', CN: 'China',
    SG: 'Singapura', AU: 'Austrália', NZ: 'Nova Zelândia', ZA: 'África do Sul', AE: 'Emirados Árabes',
    IL: 'Israel', TR: 'Turquia', RU: 'Rússia', KR: 'Coreia do Sul', AO: 'Angola', MZ: 'Moçambique'
  };
  const bandeira = cc => (/^[A-Za-z]{2}$/.test(cc || '')
    ? String.fromCodePoint.apply(String, cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)))
    : '🌐');
  const nomePais = cc => (PAISES[String(cc).toUpperCase()] || cc || 'desconhecido');
  const fmtSeg = s => {
    s = Math.round(s || 0);
    return s >= 60 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : s + 's';
  };

  // ---------- Tradução: caminho de arquivo vira nome de gente ----------
  // O painel mostrava "/publicacoes/importacao-jogo-en.html", que não diz nada.
  // Os nomes abaixo são os títulos reais das páginas do site.
  const PAGINAS_NOME = {
    '/': 'Início',
    '/en.html': 'Início (inglês)',
    '/privacidade.html': 'Privacidade',
    '/privacy.html': 'Privacidade (inglês)',
    '/404.html': 'Página não encontrada',
    '/projetos/sop-mensal.html': 'Projeto: S&OP mensal',
    '/projetos/sop-mensal-en.html': 'Projeto: S&OP mensal (inglês)',
    '/projetos/validador-documentos.html': 'Projeto: Validador de Documentos',
    '/projetos/validador-documentos-en.html': 'Projeto: Validador de Documentos (inglês)',
    '/projetos/boletim-ruptura.html': 'Projeto: Boletim de Ruptura',
    '/projetos/boletim-ruptura-en.html': 'Projeto: Boletim de Ruptura (inglês)',
    '/projetos/cacador-vencimentos.html': 'Projeto: Caçador de Vencimentos',
    '/projetos/cacador-vencimentos-en.html': 'Projeto: Caçador de Vencimentos (inglês)',
    '/projetos/automacoes.html': 'Projeto: Automações com Power Automate',
    '/projetos/automacoes-en.html': 'Projeto: Automações (inglês)',
    '/publicacoes/incoterms.html': 'Artigo: Incoterms na prática',
    '/publicacoes/incoterms-en.html': 'Artigo: Incoterms (inglês)',
    '/publicacoes/forecast-erro.html': 'Artigo: Seu forecast erra?',
    '/publicacoes/forecast-erro-en.html': 'Artigo: Seu forecast erra? (inglês)',
    '/publicacoes/importacao-jogo.html': 'Artigo: Importação, o jogo dos prazos',
    '/publicacoes/importacao-jogo-en.html': 'Artigo: Importação, o jogo dos prazos (inglês)'
  };
  const nomePagina = c => {
    const s = String(c == null ? '' : c);
    if (PAGINAS_NOME[s]) return PAGINAS_NOME[s];
    if (!s.startsWith('/')) return s;
    // Página que eu não conheço: pelo menos tira a barra, a extensão e os hifens
    return s.replace(/^\//, '').replace(/\.html?$/, '').replace(/[-/]/g, ' ').trim() || s;
  };

  const nomeCurto = c => nomePagina(c).replace(/^(Projeto|Artigo):\s*/, '');

  const ACOES_NOME = {
    projeto: 'Abriu o projeto', publicacao: 'Abriu o artigo', curriculo: 'Baixou o currículo',
    demo: 'Testou a demonstração', contato: 'Clicou em contato', video: 'Assistiu ao vídeo',
    link: 'Saiu para'
  };
  const nomeAcao = c => {
    const s = String(c == null ? '' : c);
    const corte = s.indexOf(': ');
    if (corte < 0) return s;
    const tipo = s.slice(0, corte);
    const valor = s.slice(corte + 2);
    const base = ACOES_NOME[tipo] || tipo;
    return base + ': ' + (valor.startsWith('/') ? nomeCurto(valor) : valor);
  };

  // Verbo no infinitivo, para a frase de resumo correr natural
  const ACOES_FRASE = {
    projeto: 'abrir o projeto', publicacao: 'abrir o artigo', curriculo: 'baixar o currículo',
    demo: 'testar a demonstração', contato: 'clicar em contato', video: 'assistir ao vídeo',
    link: 'sair do site para'
  };
  const acaoEmFrase = c => {
    const s = String(c == null ? '' : c);
    const corte = s.indexOf(': ');
    if (corte < 0) return s;
    const tipo = s.slice(0, corte);
    const valor = s.slice(corte + 2);
    return (ACOES_FRASE[tipo] || tipo) + ' ' + (valor.startsWith('/') ? nomeCurto(valor) : valor);
  };

  // Nome do site de origem como as pessoas escrevem
  const SITES = {
    'linkedin.com': 'LinkedIn', 'google.com': 'Google', 'instagram.com': 'Instagram',
    'gupy.io': 'Gupy', 'facebook.com': 'Facebook', 'youtube.com': 'YouTube',
    'bing.com': 'Bing', 'github.com': 'GitHub', 'direto': 'entrada direta'
  };
  const nomeSite = c => SITES[String(c)] || String(c);

  const REDE_TIPO = {
    empresa: 'rede de empresa', provedor: 'provedor de internet',
    datacenter: 'datacenter ou VPN', desconhecido: 'não identificada'
  };
  const nomeRedeTipo = c => REDE_TIPO[String(c)] || String(c);

  const nomeRota = r => String(r == null ? '' : r).split(' > ').map(nomePagina).join(' → ');

  // Frase em português do que aconteceu no período, para não depender de ler gráfico
  function frase(d) {
    const t = d.totais || {};
    if (!t.visitas) return '';
    const primeiro = lista => (lista && lista.length ? lista[0] : null);
    const pessoas = t.sessoes === 1 ? '1 pessoa' : t.sessoes + ' pessoas';
    const paginas = t.visitas === 1 ? '1 página' : t.visitas + ' páginas';
    const partes = ['Nos últimos ' + (d.dias || 30) + ' dias, ' + pessoas + ' abriram ' + paginas + '.'];

    const cidade = primeiro(d.cidades);
    const origem = primeiro(d.origens);
    const aparelho = primeiro(d.dispositivos);
    if (cidade || origem || aparelho) {
      const onde = [];
      if (cidade) onde.push('a maior parte de ' + String(cidade.chave).replace(/, [A-Z]{2}$/, ''));
      if (origem) onde.push(origem.chave === 'direto' ? 'entrando direto pelo endereço' : 'vindo do ' + nomeSite(origem.chave));
      if (aparelho) onde.push('pelo ' + aparelho.chave);
      const texto = onde.join(', ');
      partes.push(texto.charAt(0).toUpperCase() + texto.slice(1) + '.');
    }

    const pag = primeiro(d.paginas);
    if (pag) partes.push('A página mais aberta foi ' + nomePagina(pag.chave) + '.');

    const sec = primeiro(d.secoes);
    if (sec) partes.push('O que mais prendeu foi a seção ' + sec.chave + ', com ' + fmtSeg(sec.n) + ' somados.');

    const acao = primeiro(d.acoes);
    if (acao) partes.push('A ação mais comum foi ' + acaoEmFrase(acao.chave) + '.');

    return partes.join(' ');
  }

  // ---------- Desenho do relatório ----------
  // Regras seguidas aqui: marca fina, sem bloco saturado gigante; eixo e trilho discretos;
  // número sempre escrito junto da barra (não depende de passar o mouse); lista de um item
  // vira número, porque barra sozinha sempre cheia não informa nada; parte de um todo vira
  // barra segmentada com legenda. Paleta conferida no validador, clara e escura.
  const PCT = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

  function cartao(rotulo, valor, nota) {
    const c = el('div', 'adm-card-num');
    c.append(el('strong', '', valor));
    c.append(el('span', '', rotulo));
    if (nota) c.append(el('small', '', nota));
    return c;
  }

  // Uma caixa de conteúdo do relatório
  function caixa(nome, dica) {
    const sec = el('section', 'adm-rank');
    const h = el('h3', '', nome);
    if (dica) h.append(el('span', 'adm-nota', dica));
    sec.append(h);
    return sec;
  }

  // Lista ordenada com barra proporcional. Um item só vira número, não barra.
  function ranking(nome, itens, formato, enfeite, dica) {
    const sec = caixa(nome, dica);
    if (!itens || !itens.length) {
      sec.append(el('p', 'adm-vazio', 'Sem dados ainda.'));
      return sec;
    }
    let max = 0;
    let total = 0;
    itens.forEach(i => { if (i.n > max) max = i.n; total += i.n; });
    if (!max) max = 1;

    if (itens.length === 1) {
      const u = el('div', 'adm-unico');
      u.append(el('strong', '', formato ? formato(itens[0].n, itens[0].extra) : String(itens[0].n)));
      u.append(el('span', '', enfeite ? enfeite(itens[0].chave) : String(itens[0].chave)));
      sec.append(u);
      return sec;
    }

    const ul = el('ul');
    itens.forEach(i => {
      const li = el('li');
      const topo = el('div', 'adm-rank-topo');
      topo.append(el('span', 'adm-rank-nome', enfeite ? enfeite(i.chave) : String(i.chave)));
      const dir = el('span', 'adm-rank-n');
      dir.append(el('b', '', formato ? formato(i.n, i.extra) : String(i.n)));
      if (!formato) dir.append(el('i', '', PCT(i.n, total) + '%'));
      topo.append(dir);
      const trilho = el('div', 'adm-rank-barra');
      const dentro = el('i');
      dentro.style.width = Math.max(2, Math.round((i.n / max) * 100)) + '%';
      trilho.append(dentro);
      li.append(topo, trilho);
      ul.append(li);
    });
    sec.append(ul);
    return sec;
  }

  // Parte de um todo: uma barra só, fatiada, com legenda e rótulo direto
  function segmentada(nome, itens, enfeite) {
    const sec = caixa(nome);
    if (!itens || !itens.length) {
      sec.append(el('p', 'adm-vazio', 'Sem dados ainda.'));
      return sec;
    }
    let total = 0;
    itens.forEach(i => { total += i.n; });
    const mostra = itens.slice(0, 3);
    const barra = el('div', 'adm-seg');
    mostra.forEach((i, k) => {
      const parte = el('i', 'adm-seg-' + (k + 1));
      parte.style.width = PCT(i.n, total) + '%';
      parte.title = (enfeite ? enfeite(i.chave) : i.chave) + ': ' + i.n;
      barra.append(parte);
    });
    sec.append(barra);
    const leg = el('ul', 'adm-legenda');
    mostra.forEach((i, k) => {
      const li = el('li');
      li.append(el('span', 'adm-ponto adm-seg-' + (k + 1)));
      li.append(el('span', 'adm-legenda-nome', enfeite ? enfeite(i.chave) : String(i.chave)));
      li.append(el('b', '', PCT(i.n, total) + '%'));
      leg.append(li);
    });
    sec.append(leg);
    return sec;
  }

  // Série no tempo. Barra estreita com largura máxima, para um dia só não virar um bloco.
  function grafico(porDia) {
    const caixaG = $('visGrafico');
    caixaG.replaceChildren();
    if (!porDia || !porDia.length) {
      caixaG.append(el('p', 'adm-vazio', 'Sem visitas no período.'));
      return;
    }
    const dados = porDia.slice(-90);
    let max = 0;
    dados.forEach(d => { if (d.n > max) max = d.n; });
    if (!max) max = 1;
    const pico = dados.reduce((a, b) => (b.n > a.n ? b : a), dados[0]);

    const plot = el('div', 'adm-plot');
    const dica = el('div', 'adm-dica');
    dica.hidden = true;
    const dia = chave => chave.slice(8, 10) + '/' + chave.slice(5, 7);

    dados.forEach(d => {
      const col = el('div', 'adm-col');
      const barra = el('i');
      barra.style.height = (d.n > 0 ? Math.max(3, Math.round((d.n / max) * 100)) : 0) + '%';
      col.append(barra);
      col.addEventListener('mouseenter', () => {
        dica.textContent = dia(d.chave) + ': ' + d.n + (d.n === 1 ? ' visita' : ' visitas')
          + ', ' + d.s + (d.s === 1 ? ' pessoa' : ' pessoas');
        dica.hidden = false;
      });
      col.addEventListener('mouseleave', () => { dica.hidden = true; });
      plot.append(col);
    });

    const topo = el('div', 'adm-plot-topo');
    topo.append(el('span', '', max + (max === 1 ? ' visita' : ' visitas') + ' no pico, em ' + dia(pico.chave)));
    topo.append(dica);

    const eixo = el('div', 'adm-eixo');
    eixo.append(el('span', '', dia(dados[0].chave)));
    if (dados.length > 1) eixo.append(el('span', '', dia(dados[dados.length - 1].chave)));

    caixaG.append(topo, plot, eixo);
  }

  // O painel pergunta ao Worker se ele consegue falar com o banco, para não ficar parecendo
  // quebrado quando a gravação está fora do ar.
  let gravacaoLigada = null;
  async function checarGravacao() {
    try {
      const r = await fetch('/api/visita', { headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      const j = await r.json();
      return Boolean(j && j.configurado);
    } catch (e) {
      return null;
    }
  }

  function aviso(titulo, linhas, lista) {
    const cx = $('visAviso');
    cx.replaceChildren();
    if (!titulo) { cx.hidden = true; return; }
    cx.hidden = false;
    cx.append(el('strong', '', titulo));
    linhas.forEach(l => cx.append(el('p', '', l)));
    if (lista && lista.length) {
      const ol = el('ol');
      lista.forEach(i => ol.append(el('li', '', i)));
      cx.append(ol);
    }
  }

  const mostrarDetalhe = ligado => {
    Array.prototype.forEach.call(document.querySelectorAll('[data-vis-detalhe]'), n => { n.hidden = !ligado; });
  };

  function renderVis(d) {
    const tot = d.totais || {};
    const eng = d.engajamento || {};
    const cards = $('visCards');
    cards.replaceChildren();
    cards.append(cartao('visitas de página', String(tot.visitas || 0)));
    cards.append(cartao('pessoas diferentes', String(tot.sessoes || 0), 'contagem por dia'));
    cards.append(cartao('países', String(tot.paises || 0)));
    cards.append(cartao('cidades', String(tot.cidades || 0)));
    cards.append(cartao('tempo médio na página', fmtSeg(eng.tempo_medio)));
    cards.append(cartao('rolagem média', (eng.rolagem_media || 0) + '%',
      (eng.leram_ate_o_fim || 0) + ' chegaram ao fim'));

    const linha = frase(d);
    $('visFrase').textContent = linha;
    $('visFrase').hidden = !linha;

    grafico(d.por_dia);

    const listas = $('visListas');
    listas.replaceChildren();
    const ex = d.extra || {};
    const grupo = (titulo, caixas) => {
      listas.append(el('h3', 'adm-grupo', titulo));
      const grade = el('div', 'adm-colunas');
      caixas.forEach(c => grade.append(c));
      listas.append(grade);
    };

    grupo('De onde vêm', [
      ranking('Países', d.paises, null, c => bandeira(c) + ' ' + nomePais(c)),
      ranking('Estados e regiões', ex.estados || []),
      ranking('Cidades', d.cidades)
    ]);

    const comCampanha = [ranking('Como chegaram', d.origens, null, nomeSite, 'site de onde veio o clique')];
    if (d.campanhas && d.campanhas.length) {
      comCampanha.push(ranking('Etiquetas de link', d.campanhas,
        (n, extra) => n + (extra ? ' · ' + extra + (extra === 1 ? ' pessoa' : ' pessoas') : '')));
    }
    comCampanha.push(segmentada('Aparelho', d.dispositivos));
    comCampanha.push(segmentada('Idioma da página', d.idiomas,
      c => (c === 'en' ? 'Inglês' : 'Português')));
    comCampanha.push(ranking('Rede de onde vieram', ex.redes || [],
      (n, extra) => n + (extra ? ' · ' + nomeRedeTipo(extra) : ''), null,
      'operadora ou empresa dona da conexão'));
    comCampanha.push(segmentada('Tipo de rede', ex.tipos_rede || [], nomeRedeTipo));
    comCampanha.push(ranking('Navegador e sistema', d.navegadores));
    grupo('Como chegaram', comCampanha);

    grupo('O que olharam', [
      ranking('Páginas mais abertas', d.paginas, null, nomePagina),
      ranking('Publicações mais lidas', d.publicacoes, null, nomePagina),
      ranking('Projetos mais vistos', d.projetos, null, nomePagina),
      ranking('Imagens mais clicadas', d.imagens),
      ranking('Cliques e downloads', d.acoes, null, nomeAcao)
    ]);

    grupo('Quanto prendeu', [
      ranking('Seções que mais prenderam', d.secoes,
        (n, extra) => fmtSeg(n) + (extra ? ' · ' + extra + 'x' : ''), null, 'tempo somado'),
      ranking('Tempo médio por página', d.tempo_por_pagina, n => fmtSeg(n), nomePagina)
    ]);

    const semDados = !(d.totais && d.totais.visitas);
    mostrarDetalhe(!semDados);
    if (semDados && gravacaoLigada === false) {
      aviso('O registro de visitas não está respondendo', [
        'O teste de saúde falhou: o Worker não conseguiu falar com o banco D1. Enquanto isso, nenhuma visita é gravada.'
      ], [
        'Confira o banco D1 "alexandrewang" no painel do Cloudflare (Storage e bancos de dados, D1).',
        'Confira se as migrações foram aplicadas: npm run db:aplicar.',
        'Veja os logs do Worker em Workers e Pages, alexandrewang, Logs.'
      ]);
    } else if (semDados) {
      aviso('Nenhuma visita neste período', [
        gravacaoLigada === true
          ? 'A gravação está ligada, só não chegou ninguém ainda no intervalo escolhido.'
          : 'Não consegui rodar o teste de saúde da gravação. Se o painel continuar zerado, me avise.',
        'Para testar, abra o site numa janela anônima. Se o seu navegador estiver com Do Not Track ligado, a sua própria visita não é registrada, que é o combinado da página de privacidade.'
      ]);
    } else {
      aviso(null);
    }

    const abuso = $('visMaisAcessos');
    abuso.replaceChildren();
    const pesados = (d.extra && d.extra.mais_acessos) || [];
    pesados.forEach(m => {
      const tr = el('tr');
      tr.append(el('td', '', m.codigo));
      tr.append(el('td', '', String(m.n)));
      tr.append(el('td', '', m.minutos + (m.minutos === 1 ? ' min' : ' min')));
      tr.append(el('td', '', m.dia + ', ' + m.janela));
      tr.append(el('td', '', m.lugar));
      tr.append(el('td', '', m.rede || ''));
      tr.append(el('td', '', m.aparelho));
      // Robô por dois caminhos: veio de datacenter, ou abriu muita página em pouco tempo
      if (m.robo || (m.n >= 30 && m.minutos <= 10)) tr.className = 'adm-suspeito';
      abuso.append(tr);
    });
    if (!pesados.length) {
      const tr = el('tr');
      const td = el('td', 'adm-vazio', 'Ninguém abriu 5 páginas ou mais no período.');
      td.colSpan = 7;
      tr.append(td);
      abuso.append(tr);
    }
    $('visAbusoDica').textContent = pesados.some(m => m.robo || (m.n >= 30 && m.minutos <= 10))
      ? 'Linha em vermelho é provável robô: ou veio de datacenter e VPN, ou abriu muita página em pouco tempo. Para bloquear, use as regras de WAF do Cloudflare (Segurança, Regras de WAF), que veem o endereço de rede e cortam o acesso antes de chegar ao site.'
      : 'Para bloquear alguém, o caminho são as regras de WAF do Cloudflare (Segurança, Regras de WAF). Elas veem o endereço de rede na borda e cortam o acesso, sem precisar guardar nada aqui.';

    const corpo = $('visJornadas');
    corpo.replaceChildren();
    (d.jornadas || []).forEach(j => {
      const tr = el('tr');
      tr.append(el('td', '', j.inicio));
      tr.append(el('td', '', j.lugar));
      tr.append(el('td', '', j.dispositivo));
      tr.append(el('td', '', j.origem));
      const td = el('td', 'adm-rota');
      td.append(el('span', '', nomeRota(j.rota)));
      tr.append(td);
      corpo.append(tr);
    });
    if (!(d.jornadas || []).length) {
      const tr = el('tr');
      const td = el('td', 'adm-vazio', 'Nenhuma visita registrada ainda.');
      td.colSpan = 5;
      tr.append(td);
      corpo.append(tr);
    }
  }

  async function loadVis() {
    $('visStatus').textContent = 'Carregando...';
    if (gravacaoLigada === null) gravacaoLigada = await checarGravacao();
    const r = await api('visitas?dias=' + visDias);
    if (r.error) {
      $('visStatus').textContent = 'Não foi possível carregar o relatório de visitas.';
      return;
    }
    $('visStatus').textContent = '';
    const dados = (r.data && r.data.resumo) || {};
    dados.extra = (r.data && r.data.extra) || {};
    renderVis(dados);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.adm-seg-periodo button'), b => {
    b.addEventListener('click', () => {
      visDias = Number(b.dataset.dias) || 30;
      Array.prototype.forEach.call(document.querySelectorAll('.adm-seg-periodo button'), o => {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      });
      loadVis();
    });
  });
  $('reloadVis').addEventListener('click', loadVis);

  // ---------- Gerador de links com etiqueta ----------
  const PAGINAS = [
    ['/', 'Início (PT)'],
    ['/en.html', 'Home (EN)'],
    ['/projetos/sop-mensal.html', 'Projeto: S&OP mensal'],
    ['/projetos/validador-documentos.html', 'Projeto: validador de documentos'],
    ['/projetos/boletim-ruptura.html', 'Projeto: boletim de ruptura'],
    ['/projetos/cacador-vencimentos.html', 'Projeto: caçador de vencimentos'],
    ['/projetos/automacoes.html', 'Projeto: automações'],
    ['/publicacoes/incoterms.html', 'Publicação: Incoterms'],
    ['/publicacoes/forecast-erro.html', 'Publicação: erro de forecast'],
    ['/publicacoes/importacao-jogo.html', 'Publicação: importação']
  ];
  const SITE = location.origin;
  const etiqueta = v => String(v || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 40);

  (function gerador() {
    const sel = $('geraPagina');
    const nome = $('geraNome');
    const saida = $('geraLink');
    if (!sel || !nome || !saida) return;
    PAGINAS.forEach(([valor, rotulo]) => {
      const o = document.createElement('option');
      o.value = valor;
      o.textContent = rotulo;
      sel.append(o);
    });
    const montar = () => {
      const marca = etiqueta(nome.value);
      saida.textContent = SITE + sel.value + (marca ? '?ref=' + marca : '');
    };
    sel.addEventListener('change', montar);
    nome.addEventListener('input', montar);
    $('geraCopiar').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(saida.textContent);
        $('geraCopiar').textContent = 'Copiado';
        setTimeout(() => { $('geraCopiar').textContent = 'Copiar'; }, 1500);
      } catch (e) {
        $('geraCopiar').textContent = 'Copie à mão';
      }
    });
    montar();
  })();

  boot();
})();
