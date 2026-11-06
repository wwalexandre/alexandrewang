// Painel /admin: lê mensagens de contato e leads do Supabase.
// Só funciona para quem está na tabela "admins" (RLS no banco). A chave abaixo é a PUBLICÁVEL (pública por design).
// Mesma URL e chave de assets/js/main.js. Nunca coloque aqui a chave secreta (service_role).
// Todo texto vindo de visitantes é inserido com textContent, nunca com innerHTML.

(function () {
  const SB_URL = 'https://apezjjrpvlglaawvhqoo.supabase.co';
  const SB_KEY = 'sb_publishable_eHbHUKdtoOVlIg87zQZAew_DgD-GK6J';

  const $ = id => document.getElementById(id);
  const sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const views = { boot: $('bootMsg'), login: $('loginView'), denied: $('deniedView'), app: $('appView') };
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

  // ---------- Sessão e acesso ----------
  async function isAdmin(userId) {
    const { data, error } = await sb.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
    return !error && !!data;
  }

  async function enter(session) {
    if (!(await isAdmin(session.user.id))) {
      await sb.auth.signOut();
      show('denied');
      return;
    }
    $('userEmail').textContent = session.user.email || '';
    show('app');
    loadMessages();
    loadLeads();
    loadVis();
  }

  async function boot() {
    const { data } = await sb.auth.getSession();
    if (data && data.session) await enter(data.session);
    else show('login');
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('loginErr');
    const btn = $('btnLogin');
    err.textContent = '';
    const email = $('loginEmail').value.trim();
    const password = $('loginPass').value;
    if (!email || !password) { err.textContent = 'Informe e-mail e senha.'; return; }
    btn.disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });
    btn.disabled = false;
    if (error || !data.session) { err.textContent = 'E-mail ou senha incorretos.'; return; }
    $('loginPass').value = '';
    await enter(data.session);
  });

  $('btnLogout').addEventListener('click', async () => {
    await sb.auth.signOut();
    $('msgList').replaceChildren();
    $('leadBody').replaceChildren();
    show('login');
  });
  $('btnBack').addEventListener('click', () => show('login'));

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
        const { error } = await sb.from('mensagens_contato').update({ lida: !m.lida }).eq('id', m.id);
        if (error) { $('msgStatus').textContent = 'Não foi possível atualizar. Tente novamente.'; toggle.disabled = false; return; }
        m.lida = !m.lida;
        renderMessages();
      });
      const del = el('button', 'btn btn-outline btn-sm adm-danger', 'Excluir');
      del.type = 'button';
      del.addEventListener('click', async () => {
        if (!window.confirm('Excluir esta mensagem de ' + m.nome + '? Não dá para desfazer.')) return;
        del.disabled = true;
        const { error } = await sb.from('mensagens_contato').delete().eq('id', m.id);
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
    const { data, error } = await sb.from('mensagens_contato').select('*').order('criado_em', { ascending: false }).limit(200);
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
        const { error } = await sb.from('leads').delete().eq('id', l.id);
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
    const { data, error } = await sb.from('leads').select('*').order('criado_em', { ascending: false }).limit(1000);
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
  // Tudo vem pronto da função resumo_visitas do banco, que só responde para admin.
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

  function cartao(rotulo, valor, nota) {
    const c = el('div', 'adm-card-num');
    c.append(el('strong', '', valor));
    c.append(el('span', '', rotulo));
    if (nota) c.append(el('small', '', nota));
    return c;
  }

  // Lista com barra proporcional. "formato" muda como o número aparece.
  function ranking(nome, itens, formato, enfeite) {
    const sec = el('section', 'adm-rank');
    sec.append(el('h3', '', nome));
    if (!itens || !itens.length) {
      sec.append(el('p', 'adm-vazio', 'Sem dados ainda.'));
      return sec;
    }
    let max = 1;
    itens.forEach(i => { if (i.n > max) max = i.n; });
    const ul = el('ul');
    itens.forEach(i => {
      const li = el('li');
      const topo = el('div', 'adm-rank-topo');
      topo.append(el('span', 'adm-rank-nome', enfeite ? enfeite(i.chave) : String(i.chave)));
      topo.append(el('span', 'adm-rank-n', formato ? formato(i.n, i.extra) : String(i.n)));
      const barra = el('div', 'adm-rank-barra');
      const dentro = el('i');
      dentro.style.width = Math.max(3, Math.round((i.n / max) * 100)) + '%';
      barra.append(dentro);
      li.append(topo, barra);
      ul.append(li);
    });
    sec.append(ul);
    return sec;
  }

  function grafico(porDia) {
    const caixa = $('visGrafico');
    caixa.replaceChildren();
    if (!porDia || !porDia.length) {
      caixa.append(el('p', 'adm-vazio', 'Sem visitas no período.'));
      return;
    }
    let max = 1;
    porDia.forEach(d => { if (d.n > max) max = d.n; });
    porDia.slice(-90).forEach(d => {
      const col = el('div', 'adm-col');
      const barra = el('i');
      barra.style.height = Math.max(2, Math.round((d.n / max) * 100)) + '%';
      const partes = String(d.chave).split('-');
      col.title = partes[2] + '/' + partes[1] + ': ' + d.n + (d.n === 1 ? ' visita' : ' visitas')
        + ', ' + d.s + (d.s === 1 ? ' pessoa' : ' pessoas');
      col.append(barra);
      caixa.append(col);
    });
  }

  // A gravação só funciona com as duas variáveis na Vercel. O painel pergunta para a
  // própria função se elas existem, para não ficar parecendo quebrado quando faltam.
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

    grafico(d.por_dia);

    const listas = $('visListas');
    listas.replaceChildren();
    listas.append(ranking('De onde são', d.paises, null, c => bandeira(c) + ' ' + nomePais(c)));
    listas.append(ranking('Cidades', d.cidades));
    listas.append(ranking('Estados', (d.extra && d.extra.estados) || []));
    listas.append(ranking('Como chegaram', d.origens));
    listas.append(ranking('Páginas mais abertas', d.paginas));
    listas.append(ranking('Seções que mais prenderam', d.secoes,
      (n, extra) => fmtSeg(n) + (extra ? ' · ' + extra + 'x' : '')));
    listas.append(ranking('Tempo médio por página', d.tempo_por_pagina, n => fmtSeg(n)));
    listas.append(ranking('Publicações mais lidas', d.publicacoes));
    listas.append(ranking('Projetos mais vistos', d.projetos));
    listas.append(ranking('Imagens mais clicadas', d.imagens));
    listas.append(ranking('Cliques e downloads', d.acoes));
    listas.append(ranking('Aparelhos', d.dispositivos));
    listas.append(ranking('Navegador e sistema', d.navegadores));
    listas.append(ranking('Idioma da página', d.idiomas, null,
      c => (c === 'en' ? 'Inglês' : 'Português')));
    if (d.campanhas && d.campanhas.length) {
      listas.append(ranking('Campanhas', d.campanhas,
        (n, extra) => n + (extra ? ' · ' + extra + (extra === 1 ? ' pessoa' : ' pessoas') : '')));
    }

    const semDados = !(d.totais && d.totais.visitas);
    mostrarDetalhe(!semDados);
    if (semDados && gravacaoLigada === false) {
      aviso('O registro de visitas não está respondendo', [
        'O teste de saúde falhou: a função /api/visita não conseguiu falar com o banco. Enquanto isso, nenhuma visita é gravada.'
      ], [
        'Confira se o projeto do Supabase não está pausado por inatividade.',
        'Se a coluna token de ingestao_config estiver preenchida, a variável VISITAS_TOKEN precisa existir na Vercel com o mesmo valor.',
        'Veja os logs da função em Vercel, Deployments, Functions.'
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
      tr.append(el('td', '', m.aparelho));
      // Muita página em pouco tempo é o padrão de robô ou de quem está raspando o site
      if (m.n >= 30 && m.minutos <= 10) tr.className = 'adm-suspeito';
      abuso.append(tr);
    });
    if (!pesados.length) {
      const tr = el('tr');
      const td = el('td', 'adm-vazio', 'Ninguém abriu 5 páginas ou mais no período.');
      td.colSpan = 6;
      tr.append(td);
      abuso.append(tr);
    }
    $('visAbusoDica').textContent = pesados.some(m => m.n >= 30 && m.minutos <= 10)
      ? 'Tem linha marcada em vermelho: muita página em pouco tempo, que é padrão de robô. Para bloquear, use o Firewall da Vercel, em Project Settings e depois Firewall, que vê o endereço de rede e corta o acesso antes de chegar ao site.'
      : 'Para bloquear alguém, o caminho é o Firewall da Vercel, em Project Settings e depois Firewall. Ele vê o endereço de rede na borda e corta o acesso, sem precisar guardar nada aqui.';

    const corpo = $('visJornadas');
    corpo.replaceChildren();
    (d.jornadas || []).forEach(j => {
      const tr = el('tr');
      tr.append(el('td', '', j.inicio));
      tr.append(el('td', '', j.lugar));
      tr.append(el('td', '', j.dispositivo));
      tr.append(el('td', '', j.origem));
      const td = el('td', 'adm-rota');
      td.append(el('span', '', j.rota));
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
    const [principal, extra] = await Promise.all([
      sb.rpc('resumo_visitas', { p_dias: visDias }),
      sb.rpc('resumo_extra', { p_dias: visDias })
    ]);
    if (principal.error) {
      $('visStatus').textContent = 'Não foi possível carregar o relatório de visitas.';
      return;
    }
    $('visStatus').textContent = '';
    const dados = principal.data || {};
    dados.extra = extra.error ? {} : (extra.data || {});
    renderVis(dados);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.adm-seg button'), b => {
    b.addEventListener('click', () => {
      visDias = Number(b.dataset.dias) || 30;
      Array.prototype.forEach.call(document.querySelectorAll('.adm-seg button'), o => {
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
  const SITE = 'https://alexandrewang.vercel.app';
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
