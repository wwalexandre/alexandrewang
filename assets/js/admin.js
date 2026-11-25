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

  const views = {
    boot: $('bootMsg'), login: $('loginView'), mfa: $('mfaView'), setup: $('mfaSetupView'),
    denied: $('deniedView'), app: $('appView')
  };
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

  // Verificação em duas etapas (TOTP). Depois de ativada, o banco só libera os dados
  // com sessão aal2 (função is_admin), então senha sozinha não abre mais nada.
  async function nivelAcesso() {
    const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return { atual: 'aal1', proximo: 'aal1' };
    return { atual: data.currentLevel, proximo: data.nextLevel };
  }

  const soDigitos = v => String(v || '').replace(/\D/g, '');

  async function enter(session) {
    if (!(await isAdmin(session.user.id))) {
      await sb.auth.signOut();
      show('denied');
      return;
    }
    const nivel = await nivelAcesso();
    if (nivel.proximo === 'aal2' && nivel.atual !== 'aal2') {
      $('mfaErr').textContent = '';
      $('mfaCode').value = '';
      show('mfa');
      $('mfaCode').focus();
      return;
    }
    abrirPainel(session, nivel);
  }

  let painelCarregado = false;
  function abrirPainel(session, nivel) {
    $('userEmail').textContent = session.user.email || '';
    $('btnMfa').hidden = nivel.proximo === 'aal2';
    show('app');
    if (painelCarregado) return;
    painelCarregado = true;
    loadMessages();
    loadLeads();
    loadVis();
  }

  async function sessaoAtual() {
    const { data } = await sb.auth.getSession();
    return data && data.session;
  }

  $('mfaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('mfaErr');
    const btn = $('btnMfaOk');
    err.textContent = '';
    const code = soDigitos($('mfaCode').value);
    if (code.length !== 6) { err.textContent = 'Digite os 6 números do app.'; return; }
    btn.disabled = true;
    const { data: fatores } = await sb.auth.mfa.listFactors();
    const fator = fatores && fatores.totp && fatores.totp[0];
    if (!fator) { btn.disabled = false; err.textContent = 'Nenhum app autenticador ativo nesta conta.'; return; }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: fator.id, code: code });
    btn.disabled = false;
    if (error) { err.textContent = 'Código inválido ou expirado. Tente o próximo.'; return; }
    $('mfaCode').value = '';
    const session = await sessaoAtual();
    if (session) abrirPainel(session, await nivelAcesso());
    else show('login');
  });

  $('btnMfaSair').addEventListener('click', async () => {
    await sb.auth.signOut();
    show('login');
  });

  // Ativar: cria o fator, mostra o QR code e só confirma depois do primeiro código certo.
  let fatorNovo = null;
  $('btnMfa').addEventListener('click', async () => {
    const btn = $('btnMfa');
    btn.disabled = true;
    // apaga tentativas antigas que não foram confirmadas
    const { data: lista } = await sb.auth.mfa.listFactors();
    for (const f of (lista && lista.all) || []) {
      if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Painel' });
    btn.disabled = false;
    if (error || !data) { window.alert('Não deu para iniciar a verificação em duas etapas. Tente de novo.'); return; }
    fatorNovo = data.id;
    let qr = (data.totp && data.totp.qr_code) || '';
    const prefixo = 'data:image/svg+xml;utf-8,';
    if (qr.indexOf(prefixo) === 0) qr = qr.slice(prefixo.length);
    if (qr.charAt(0) === '<') qr = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr);
    $('mfaQr').src = qr;
    $('mfaSecret').textContent = (data.totp && data.totp.secret) || '';
    $('mfaSetupErr').textContent = '';
    $('mfaSetupCode').value = '';
    show('setup');
  });

  $('mfaSetupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('mfaSetupErr');
    const btn = $('btnMfaAtivar');
    err.textContent = '';
    const code = soDigitos($('mfaSetupCode').value);
    if (code.length !== 6) { err.textContent = 'Digite os 6 números do app.'; return; }
    if (!fatorNovo) { show('app'); return; }
    btn.disabled = true;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: fatorNovo, code: code });
    btn.disabled = false;
    if (error) { err.textContent = 'Código inválido. Confira o relógio do celular e tente o próximo.'; return; }
    fatorNovo = null;
    $('mfaQr').removeAttribute('src');
    $('mfaSecret').textContent = '';
    const session = await sessaoAtual();
    if (session) abrirPainel(session, await nivelAcesso());
    window.alert('Pronto. A partir de agora o painel pede o código do app depois da senha.');
  });

  $('btnMfaCancelar').addEventListener('click', async () => {
    if (fatorNovo) await sb.auth.mfa.unenroll({ factorId: fatorNovo });
    fatorNovo = null;
    $('mfaQr').removeAttribute('src');
    $('mfaSecret').textContent = '';
    show('app');
  });

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
    painelCarregado = false;
    show('login');
  });
  $('btnBack').addEventListener('click', () => show('login'));

  // ---------- Abas ----------
  const tabs = [
    { tab: $('tabMsg'), panel: $('panelMsg') },
    { tab: $('tabLeads'), panel: $('panelLeads') },
    { tab: $('tabVis'), panel: $('panelVis') },
    { tab: $('tabCont'), panel: $('panelCont') }
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
      const bloq = el('button', 'btn btn-outline btn-sm adm-danger', 'Bloquear e-mail');
      bloq.type = 'button';
      bloq.addEventListener('click', async () => {
        if (!window.confirm('Bloquear ' + l.email + '? Ele deixa de entrar como lead. O registro atual continua aqui.')) return;
        bloq.disabled = true;
        const { error } = await sb.rpc('bloquear_email', { p_email: l.email, p_descricao: 'Bloqueado pelos leads em ' + new Date().toLocaleDateString('pt-BR') });
        if (error) { $('leadStatus').textContent = 'Não foi possível bloquear. Tente novamente.'; bloq.disabled = false; return; }
        $('leadStatus').textContent = l.email + ' bloqueado.';
        bloq.textContent = 'Bloqueado';
      });
      td.className = 'adm-acoes';
      td.append(bloq, ' ', del);
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

  // ---------- Painel visual: cartões com tendência, mapa e jornadas ----------
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k]));
    return n;
  };
  const ICONES = {
    pessoas: ['M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20', 'M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7', 'M20 20v-1.4a3.4 3.4 0 0 0-2.5-3.3', 'M15.5 4.7a3.4 3.4 0 0 1 0 6.6'],
    paginas: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 13h6', 'M9 17h4'],
    tempo: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18', 'M12 7v5l3.2 2'],
    leads: ['M4 6h16v12H4z', 'm4 7 8 6 8-6']
  };
  function icone(nome) {
    const s = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    (ICONES[nome] || []).forEach(d => s.append(svgEl('path', { d })));
    return s;
  }

  // Dia de hoje em Brasília, no mesmo formato das chaves do banco (AAAA-MM-DD)
  const diaSP = data => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(data);

  // Série com todos os dias do período (dia sem dado vira zero). Período longo vira semanas.
  function serie(lista, campo, dias, media) {
    const mapa = {};
    (lista || []).forEach(i => { mapa[i.chave] = Number(i[campo]) || 0; });
    const valores = [];
    const hoje = Date.now();
    for (let k = dias - 1; k >= 0; k--) valores.push(mapa[diaSP(new Date(hoje - k * 86400000))] || 0);
    const passo = Math.max(1, Math.ceil(dias / 60));
    if (passo === 1) return valores;
    const juntos = [];
    for (let i = 0; i < valores.length; i += passo) {
      const bloco = valores.slice(i, i + passo);
      const soma = bloco.reduce((a, b) => a + b, 0);
      const cheios = bloco.filter(v => v > 0).length;
      juntos.push(media ? (cheios ? soma / cheios : 0) : soma);
    }
    return juntos;
  }

  // Minilinha do cartão: área suave com a linha por cima
  function minilinha(valores) {
    const L = 120, A = 36, M = 3;
    const s = svgEl('svg', { viewBox: '0 0 ' + L + ' ' + A, preserveAspectRatio: 'none', 'aria-hidden': 'true', class: 'dash-mini' });
    if (!valores.length) return s;
    const max = Math.max.apply(null, valores) || 1;
    const passo = valores.length > 1 ? L / (valores.length - 1) : L;
    const pts = valores.map((v, i) => [valores.length > 1 ? i * passo : L / 2, A - M - (v / max) * (A - M * 2)]);
    const linha = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    s.append(svgEl('path', { d: linha + 'L' + L + ' ' + A + 'L0 ' + A + 'Z', class: 'dash-mini-area' }));
    s.append(svgEl('path', { d: linha, class: 'dash-mini-linha' }));
    return s;
  }

  // Comparação com o período anterior, do mesmo tamanho
  function tendencia(atual, anterior) {
    const chip = el('span', 'dash-tend');
    if (!anterior && !atual) { chip.textContent = 'sem dados'; chip.classList.add('neutra'); return chip; }
    if (!anterior) { chip.textContent = 'novo'; chip.classList.add('neutra'); chip.title = 'Não havia dados no período anterior.'; return chip; }
    const pct = Math.round(((atual - anterior) / anterior) * 100);
    if (pct === 0) { chip.textContent = 'igual'; chip.classList.add('neutra'); return chip; }
    chip.textContent = (pct > 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '%';
    chip.classList.add(pct > 0 ? 'sobe' : 'desce');
    chip.title = 'Período anterior: ' + anterior;
    return chip;
  }

  function renderKpis(d, p) {
    const dias = d.dias || visDias;
    const atual = (p.periodos && p.periodos.atual) || {};
    const ant = (p.periodos && p.periodos.anterior) || {};
    const cx = $('visKpis');
    cx.replaceChildren();
    const itens = [
      { cor: 'k2', ic: 'pessoas', rot: 'Pessoas diferentes', val: atual.sessoes || 0, ant: ant.sessoes || 0, txt: String(atual.sessoes || 0), s: serie(d.por_dia, 's', dias),
        nota: (atual.fora_sp || 0) + ' de fora do estado de SP' },
      { cor: 'k1', ic: 'paginas', rot: 'Páginas abertas', val: atual.visitas || 0, ant: ant.visitas || 0, txt: String(atual.visitas || 0), s: serie(d.por_dia, 'n', dias),
        nota: atual.sessoes ? (atual.visitas / atual.sessoes).toFixed(1).replace('.', ',') + ' por pessoa' : '' },
      { cor: 'k3', ic: 'tempo', rot: 'Tempo médio na página', val: atual.tempo_medio || 0, ant: ant.tempo_medio || 0, txt: fmtSeg(atual.tempo_medio), s: serie(p.tempo_dia, 'n', dias, true),
        nota: ((d.engajamento && d.engajamento.rolagem_media) || 0) + '% de rolagem média' },
      { cor: 'k4', ic: 'leads', rot: 'E-mails deixados', val: atual.leads || 0, ant: ant.leads || 0, txt: String(atual.leads || 0), s: serie(p.leads_dia, 'n', dias),
        nota: atual.sessoes ? Math.round(((atual.leads || 0) / atual.sessoes) * 100) + '% das pessoas' : '' }
    ];
    itens.forEach(i => {
      const c = el('article', 'dash-kpi ' + i.cor);
      const topo = el('div', 'dash-kpi-topo');
      const bola = el('span', 'dash-kpi-ic');
      bola.append(icone(i.ic));
      topo.append(bola, el('span', 'dash-kpi-rot', i.rot));
      const meio = el('div', 'dash-kpi-meio');
      const num = el('div', 'dash-kpi-num');
      num.append(el('strong', '', i.txt), tendencia(i.val, i.ant));
      meio.append(num, minilinha(i.s));
      c.append(topo, meio, el('p', 'dash-kpi-nota', i.nota + (i.nota ? ' · ' : '') + 'vs. ' + dias + ' dias antes'));
      cx.append(c);
    });
  }

  // Mapa: contorno equiretangular (x = lon + 180, y = 90 - lat), pontos do tamanho do volume
  const ZOOMS = { mundo: [0, 8, 360, 142], brasil: [100, 82, 52, 46], sp: [125.6, 108.4, 12, 8.6] };
  let mapaZoom = 'mundo';
  let mapaPontos = [];
  const grupoPonto = p => (p.pais === 'BR' ? (p.regiao === 'SP' ? 'sp' : 'br') : 'fora');
  function renderMapa() {
    const cx = $('visMapa');
    cx.replaceChildren();
    const base = window.MAPA_PAINEL;
    if (!base) { cx.append(el('p', 'adm-vazio', 'Mapa indisponível.')); return; }
    const vb = ZOOMS[mapaZoom];
    const k = vb[2] / 360;
    const s = svgEl('svg', { viewBox: vb.join(' '), role: 'img', 'aria-label': 'Mapa com os lugares de onde vieram as visitas' });
    s.style.aspectRatio = vb[2] + ' / ' + vb[3];
    s.append(svgEl('path', { d: base.mundo, class: 'dash-terra' }));
    s.append(svgEl('path', { d: base.brasil, class: 'dash-terra dash-br' }));
    s.append(svgEl('path', { d: base.sp, class: 'dash-terra dash-uf' }));
    const max = mapaPontos.reduce((a, p) => Math.max(a, p.s || 1), 1);
    mapaPontos.slice().sort((a, b) => b.s - a.s).forEach(p => {
      const x = Number(p.lon) + 180, y = 90 - Number(p.lat);
      const r = (3.6 + 7 * Math.sqrt((p.s || 1) / max)) * k;
      const g = svgEl('g', { class: 'dash-pino ' + grupoPonto(p), tabindex: '0' });
      g.append(svgEl('circle', { cx: x, cy: y, r: r * 1.9, class: 'dash-pino-halo' }));
      g.append(svgEl('circle', { cx: x, cy: y, r, class: 'dash-pino-ponto', 'stroke-width': 1.2 * k }));
      const nome = (p.cidade || 'Cidade desconhecida') + (p.pais === 'BR' ? (p.regiao ? ', ' + p.regiao : '') : ', ' + nomePais(p.pais));
      const texto = nome + ': ' + p.s + (p.s === 1 ? ' pessoa, ' : ' pessoas, ') + p.n + (p.n === 1 ? ' página' : ' páginas');
      const t = svgEl('title');
      t.textContent = texto;
      g.append(t);
      const mostra = () => { $('visMapaDica').textContent = texto; };
      g.addEventListener('mouseenter', mostra);
      g.addEventListener('focus', mostra);
      s.append(g);
    });
    cx.append(s);

    const leg = $('visMapaLegenda');
    leg.replaceChildren();
    const soma = { sp: 0, br: 0, fora: 0 };
    mapaPontos.forEach(p => { soma[grupoPonto(p)] += p.s || 0; });
    [['sp', 'Estado de SP'], ['br', 'Outros estados'], ['fora', 'Fora do Brasil']].forEach(([g, nome]) => {
      const li = el('li');
      li.append(el('span', 'dash-leg-ponto ' + g), el('span', '', nome), el('b', '', String(soma[g])));
      leg.append(li);
    });

    // As cidades com mais pessoas, com barra proporcional na cor do grupo
    const top = $('visMapaTop');
    top.replaceChildren();
    const cores = { sp: 'var(--c1)', br: 'var(--c2)', fora: 'var(--c3)' };
    const lista = mapaPontos.slice().sort((a, b) => b.s - a.s).slice(0, 4);
    const maior = lista.length ? lista[0].s || 1 : 1;
    lista.forEach(p => {
      const li = el('li');
      const barra = el('i');
      barra.style.setProperty('--w', Math.max(3, Math.round(((p.s || 0) / maior) * 100)) + '%');
      barra.style.setProperty('--cor', cores[grupoPonto(p)]);
      li.append(el('span', '', (p.cidade || 'Cidade desconhecida') + (p.pais === 'BR' ? (p.regiao ? ', ' + p.regiao : '') : ', ' + nomePais(p.pais))),
        el('b', '', p.s + (p.s === 1 ? ' pessoa' : ' pessoas')), barra);
      top.append(li);
    });
    top.hidden = !lista.length;
  }
  Array.prototype.forEach.call(document.querySelectorAll('.dash-zoom button'), b => {
    b.addEventListener('click', () => {
      mapaZoom = b.dataset.zoom;
      Array.prototype.forEach.call(document.querySelectorAll('.dash-zoom button'), o => {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      });
      renderMapa();
    });
  });

  // Etiqueta colorida de origem e de tempo, sempre com o texto escrito
  function pilulaOrigem(origem) {
    const o = String(origem || 'direto');
    let cor = 'laranja';
    if (o === 'direto') cor = 'cinza';
    else if (/linkedin/i.test(o)) cor = 'azul';
    else if (/google|bing/i.test(o)) cor = 'verde';
    return el('span', 'dash-pill ' + cor, nomeSite(o));
  }
  function pilulaTempo(seg) {
    const s = Math.round(Number(seg) || 0);
    const cor = s >= 60 ? 'verde' : s >= 10 ? 'azul' : 'cinza';
    return el('span', 'dash-pill ' + cor, duracao(s));
  }
  function celulaLugar(j) {
    const td = el('td', 'dash-lugar');
    const m = String(j.lugar || '').match(/^(.*?), ([A-Z]{2})(?: · .*)?$/);
    const cidade = m ? m[1] : String(j.lugar || '').split(' · ')[0];
    // Bandeira em emoji vira duas letras no Windows, então o país vai escrito (só quando não é o Brasil)
    const forte = el('strong', '', cidade);
    const sub = [m && m[2] !== 'BR' ? nomePais(m[2]) : '', j.rede, j.dispositivo].filter(Boolean).join(' · ');
    td.append(forte);
    if (sub) td.append(el('small', '', sub));
    return td;
  }

  function renderVis(d) {
    const tot = d.totais || {};
    const eng = d.engajamento || {};
    renderKpis(d, d.painel || {});
    mapaPontos = (d.painel && d.painel.pontos) || [];
    renderMapa();
    const cards = $('visCards');
    cards.replaceChildren();
    cards.append(cartao('países', String(tot.paises || 0)));
    cards.append(cartao('cidades', String(tot.cidades || 0)));
    cards.append(cartao('rolagem média', (eng.rolagem_media || 0) + '%',
      (eng.leram_ate_o_fim || 0) + ' chegaram ao fim'));
    cards.append(cartao('maior tempo numa página', fmtSeg(eng.tempo_maximo)));

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
      ? 'Linha em vermelho é provável robô: ou veio de datacenter e VPN, ou abriu muita página em pouco tempo. Para barrar alguém, use o botão Bloquear em Últimas jornadas.'
      : 'Para barrar alguém, use o botão Bloquear em Últimas jornadas: a rede da pessoa deixa de abrir o site.';

    const corpo = $('visJornadas');
    corpo.replaceChildren();
    const jornadas = d.jornadas || [];
    $('visJornadasN').textContent = jornadas.length ? jornadas.length + (jornadas.length === 1 ? ' jornada' : ' jornadas') : '';
    jornadas.forEach(j => {
      const tr = el('tr', j.bloqueado ? 'dash-bloqueada' : '');
      const quando = el('td', 'dash-quando');
      const partes = String(j.inicio || '').split(' ');
      quando.append(el('strong', '', partes[1] || ''), el('small', '', partes[0] || ''));
      tr.append(quando);
      tr.append(celulaLugar(j));
      const orig = el('td');
      orig.append(pilulaOrigem(j.origem));
      tr.append(orig);
      const tempo = el('td');
      tempo.append(pilulaTempo(j.segundos));
      tr.append(tempo);
      const td = el('td', 'dash-rota');
      const rota = nomeRota(j.rota);
      td.title = rota;
      td.append(el('small', '', j.paginas + (j.paginas === 1 ? ' página' : ' páginas')), el('span', '', rota));
      tr.append(td);
      const acao = el('td', 'dash-acao');
      if (j.bloqueado) {
        acao.append(el('span', 'dash-pill vermelho', 'Bloqueada'));
      } else {
        const b = el('button', 'dash-btn-bloq', 'Bloquear');
        b.type = 'button';
        if (!j.bloqueavel) {
          b.classList.add('adm-apagado');
          b.title = 'Visita de antes de 22/11/2026: a rede não foi guardada.';
        }
        b.addEventListener('click', () => {
          if (j.bloqueavel) { bloquearJornada(j, b); return; }
          const sp = $('soSp').checked;
          window.alert('Esta visita é de antes de 22/11/2026, quando o site ainda não guardava a rede de quem acessa. Por isso não dá para bloquear a pessoa por ela.\n\n'
            + (sp ? 'A regra "português só no estado de São Paulo" está ligada: quem acessa de fora do estado de SP só vê a versão em inglês.\n\n' : '')
            + 'Se ela deixou e-mail, use "Bloquear e-mail" na aba Leads. Se voltar a acessar, a nova visita aparece aqui com o botão funcionando.');
        });
        acao.append(b);
      }
      tr.append(acao);
      corpo.append(tr);
    });
    if (!jornadas.length) {
      const tr = el('tr');
      const td = el('td', 'adm-vazio', 'Nenhuma visita registrada ainda.');
      td.colSpan = 6;
      tr.append(td);
      corpo.append(tr);
    }

    renderBloqueios(d.bloqueios || [], d.so_sp !== false);
  }

  // Tempo somado de uma jornada, em texto curto
  function duracao(seg) {
    const s = Math.max(0, Math.round(Number(seg) || 0));
    if (!s) return 'menos de 5 s';
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '');
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  // ---------- Acesso e bloqueios ----------
  async function bloquearJornada(j, botao) {
    const motivo = window.prompt('Bloquear a rede desta pessoa (' + j.lugar + ', ' + j.inicio + ')? Ela deixa de abrir o site.\nMotivo (opcional):', 'Visita suspeita');
    if (motivo === null) return;
    botao.disabled = true;
    const { data, error } = await sb.rpc('bloquear_sessao', { p_sessao: j.sessao, p_descricao: motivo + ' · ' + j.lugar + ', ' + j.inicio });
    if (error) { $('bloqStatus').textContent = 'Não foi possível bloquear. Tente novamente.'; botao.disabled = false; return; }
    $('bloqStatus').textContent = data ? 'Rede bloqueada. Pode levar até 5 minutos para valer.' : 'Esta jornada não tem rede guardada, então não dá para bloquear por ela.';
    loadVis();
  }

  function renderBloqueios(lista, soSp) {
    const chave = $('soSp');
    chave.checked = soSp;
    const corpo = $('bloqLista');
    corpo.replaceChildren();
    const redes = lista.filter(b => b.tipo !== 'email').length;
    $('bloqResumo').textContent = (soSp ? 'Português só em SP' : 'Português liberado para todos') + ' · '
      + redes + (redes === 1 ? ' rede bloqueada' : ' redes bloqueadas') + ' · '
      + (lista.length - redes) + (lista.length - redes === 1 ? ' e-mail' : ' e-mails');
    lista.forEach(b => {
      const tr = el('li');
      const info = el('div');
      info.append(el('strong', '', (b.tipo === 'email' ? 'E-mail: ' : 'Rede: ') + b.alvo));
      info.append(el('small', '', [b.descricao, 'desde ' + b.quando].filter(Boolean).join(' · ')));
      tr.append(info);
      const td = el('span');
      const des = el('button', 'dash-btn-claro', 'Desbloquear');
      des.type = 'button';
      des.addEventListener('click', async () => {
        if (!window.confirm('Desbloquear ' + b.alvo + '?')) return;
        des.disabled = true;
        const { error } = await sb.from('bloqueios').delete().eq('id', b.id);
        if (error) { $('bloqStatus').textContent = 'Não foi possível desbloquear. Tente novamente.'; des.disabled = false; return; }
        $('bloqStatus').textContent = 'Desbloqueado.';
        loadVis();
      });
      td.append(des);
      tr.append(td);
      corpo.append(tr);
    });
    if (!lista.length) corpo.append(el('li', 'dash-vazio', 'Ninguém bloqueado.'));
  }

  $('soSp').addEventListener('change', async e => {
    const valor = e.target.checked;
    if (!valor && !window.confirm('Liberar a versão em português para qualquer lugar?')) { e.target.checked = true; return; }
    e.target.disabled = true;
    const { error } = await sb.rpc('definir_so_sp', { p_valor: valor });
    e.target.disabled = false;
    if (error) { e.target.checked = !valor; $('bloqStatus').textContent = 'Não foi possível mudar a regra.'; return; }
    $('bloqStatus').textContent = valor
      ? 'Ligado: fora do estado de SP, só a versão em inglês. Pode levar até 5 minutos para valer.'
      : 'Desligado: o português abre para todo mundo. Pode levar até 5 minutos para valer.';
  });

  // Cópias do site: o bloco só aparece se alguma tiver sido detectada.
  async function loadCopias() {
    const { data, error } = await sb.from('clones').select('*').order('ultima', { ascending: false }).limit(50);
    const bloco = $('blocoCopias');
    const corpo = $('copiasLista');
    if (error || !data || !data.length) { bloco.hidden = true; return; }
    bloco.hidden = false;
    corpo.replaceChildren();
    data.forEach(c => {
      const tr = el('tr', 'adm-suspeito');
      tr.append(el('td', '', c.dominio));
      tr.append(el('td', '', c.caminho || ''));
      tr.append(el('td', '', String(c.vezes)));
      tr.append(el('td', '', fmt(c.primeira)));
      tr.append(el('td', '', fmt(c.ultima)));
      corpo.append(tr);
    });
  }

  async function loadVis() {
    $('visStatus').textContent = 'Carregando...';
    if (gravacaoLigada === null) gravacaoLigada = await checarGravacao();
    loadCopias();
    const [principal, extra, painel] = await Promise.all([
      sb.rpc('resumo_visitas', { p_dias: visDias }),
      sb.rpc('resumo_extra', { p_dias: visDias }),
      sb.rpc('resumo_painel', { p_dias: visDias })
    ]);
    if (principal.error) {
      $('visStatus').textContent = 'Não foi possível carregar o relatório de visitas.';
      return;
    }
    $('visStatus').textContent = '';
    const dados = principal.data || {};
    dados.extra = extra.error ? {} : (extra.data || {});
    dados.painel = painel.error ? {} : (painel.data || {});
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

  // ---------- Conteúdo: o que aparece na home ----------
  const GRUPOS = [
    { tipo: 'trajetoria', titulo: 'Trajetória' },
    { tipo: 'projeto', titulo: 'Projetos' },
    { tipo: 'publicacao', titulo: 'Publicações' }
  ];

  async function carregarConteudo() {
    const status = $('contStatus');
    const caixa = $('contListas');
    status.textContent = 'Carregando...';
    const { data, error } = await sb.from('itens_site')
      .select('slug, tipo, titulo, oculto')
      .order('ordem', { ascending: true });
    if (error) {
      status.textContent = 'Não consegui carregar: ' + error.message;
      return;
    }
    caixa.textContent = '';
    GRUPOS.forEach(g => {
      const itens = data.filter(d => d.tipo === g.tipo);
      if (!itens.length) return;
      const sec = el('section', 'adm-bloco');
      sec.appendChild(el('h3', null, g.titulo));
      const lista = el('div', 'adm-itens');
      itens.forEach(item => lista.appendChild(linhaConteudo(item, status)));
      sec.appendChild(lista);
      caixa.appendChild(sec);
    });
    const ocultos = data.filter(d => d.oculto).length;
    status.textContent = ocultos
      ? ocultos + (ocultos === 1 ? ' item oculto no site.' : ' itens ocultos no site.')
      : 'Tudo visível no site.';
  }

  function linhaConteudo(item, status) {
    const linha = el('div', 'adm-item');
    linha.appendChild(el('span', 'adm-item-nome', item.titulo));
    const label = el('label', 'sw');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !item.oculto;
    const pino = document.createElement('span');
    const texto = el('b', null, item.oculto ? 'Oculto' : 'Visível');
    label.append(input, pino, texto);
    input.addEventListener('change', async () => {
      const visivel = input.checked;
      input.disabled = true;
      const { error } = await sb.from('itens_site')
        .update({ oculto: !visivel }).eq('slug', item.slug);
      input.disabled = false;
      if (error) {
        input.checked = !visivel;
        status.textContent = 'Não consegui salvar: ' + error.message;
        return;
      }
      item.oculto = !visivel;
      texto.textContent = visivel ? 'Visível' : 'Oculto';
      status.textContent = 'Salvo. ' + item.titulo + (visivel ? ' voltou para o site.' : ' saiu do site.');
    });
    linha.appendChild(label);
    return linha;
  }

  // ---------- Textos editados ao vivo ----------
  async function carregarTextos() {
    const caixa = $('textosLista');
    const { data, error } = await sb.from('textos_site')
      .select('id, pagina, original, novo, atualizado_em')
      .order('atualizado_em', { ascending: false });
    caixa.textContent = '';
    if (error) { caixa.appendChild(el('p', 'adm-nota', 'Não consegui carregar: ' + error.message)); return; }
    if (!data.length) { caixa.appendChild(el('p', 'adm-nota', 'Nenhum texto editado ainda.')); return; }
    data.forEach(t => {
      const linha = el('div', 'adm-item adm-texto');
      const corpo = el('div');
      corpo.appendChild(el('small', null, t.pagina + ' · ' + fmt(t.atualizado_em)));
      corpo.appendChild(el('s', null, t.original));
      corpo.appendChild(el('span', 'adm-item-nome', t.novo));
      const desfaz = el('button', 'btn btn-outline btn-sm', 'Desfazer');
      desfaz.type = 'button';
      desfaz.addEventListener('click', async () => {
        desfaz.disabled = true;
        const { error: e2 } = await sb.from('textos_site').delete().eq('id', t.id);
        if (e2) { desfaz.disabled = false; desfaz.textContent = 'Falhou'; return; }
        linha.remove();
      });
      linha.append(corpo, desfaz);
      caixa.appendChild(linha);
    });
  }

  $('tabCont').addEventListener('click', () => { carregarConteudo(); carregarTextos(); });
  $('reloadCont').addEventListener('click', () => { carregarConteudo(); carregarTextos(); });

  boot();
})();
