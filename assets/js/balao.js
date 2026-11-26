// Balão do assistente: botão flutuante no canto da tela que abre o chat (api/chat.js).
// Carregado pelo main.js em todas as páginas, menos na própria aba Pergunte / Ask,
// que já mostra o chat em tela cheia. A conversa em si fica no assistente.js.
// Tudo é montado com createElement e textContent, sem innerHTML.
(function () {
  if (document.querySelector('.chat-wrap')) return;
  const eu = [...document.scripts].find(s => /\/balao\.js(\?|$)/.test(s.src));
  if (!eu) return;
  const base = eu.src.replace(/balao\.js.*$/, '');
  const raizSite = base.replace(/assets\/js\/$/, '');
  const en = document.documentElement.lang.startsWith('en');

  const T = en ? {
    abrir: 'Ask the AI assistant',
    rotulo: 'Ask',
    titulo: 'Ask about Alexandre',
    sub: 'AI assistant, answers from the site content',
    fechar: 'Close the assistant',
    ola: 'Hi. Ask about Alexandre\'s experience, his projects or his publications.',
    chips: ['What does he do in supply chain?', 'Explain the Cash Check project simply.', 'What is his most recent project?'],
    campo: 'Your question',
    placeholder: 'Type your question',
    enviar: 'Ask',
    nota1: 'AI answers (Google Gemini) can be wrong. Do not type personal data: the question goes to Google. ',
    nota2: 'Privacy',
    privacidade: 'privacy.html#assistant'
  } : {
    abrir: 'Perguntar ao assistente com IA',
    rotulo: 'Pergunte',
    titulo: 'Pergunte sobre o Alexandre',
    sub: 'Assistente com IA, responde com o conteúdo do site',
    fechar: 'Fechar o assistente',
    ola: 'Olá. Pode perguntar sobre a experiência do Alexandre, os projetos ou as publicações.',
    chips: ['O que ele faz em supply chain?', 'Explique o projeto Conferência do Caixa de um jeito simples.', 'Qual é o projeto mais recente dele?'],
    campo: 'Sua pergunta',
    placeholder: 'Escreva sua pergunta',
    enviar: 'Perguntar',
    nota1: 'Respostas geradas por IA (Google Gemini) podem conter erros. Não digite dados pessoais: a pergunta vai para o Google. ',
    nota2: 'Privacidade',
    privacidade: 'privacidade.html#assistente'
  };

  function el(tag, props, filhos) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'texto') n.textContent = v;
      else if (k in n && typeof v !== 'string') n[k] = v;
      else n.setAttribute(k, v);
    });
    (filhos || []).forEach(f => f && n.appendChild(f));
    return n;
  }
  function icone(d) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return svg;
  }
  const BALAO = 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z M8.5 9.5h.01 M12 9.5h.01 M15.5 9.5h.01';
  const X = 'M6 6l12 12M18 6L6 18';

  const botao = el('button', { type: 'button', class: 'balao-botao', 'aria-label': T.abrir, 'aria-expanded': 'false', 'aria-controls': 'balaoPainel' },
    [icone(BALAO), el('span', { class: 'balao-rotulo', texto: T.rotulo })]);

  const fechar = el('button', { type: 'button', class: 'balao-fechar', 'aria-label': T.fechar }, [icone(X)]);
  const cabeca = el('div', { class: 'balao-cabeca' }, [
    el('div', {}, [el('strong', { id: 'balaoTitulo', texto: T.titulo }), el('span', { texto: T.sub })]),
    fechar
  ]);

  const log = el('div', { class: 'chat-log', id: 'chatLog', role: 'log', 'aria-live': 'polite' },
    [el('div', { class: 'chat-msg ia' }, [el('p', { texto: T.ola })])]);
  const sugestoes = el('div', { class: 'chat-sugestoes', id: 'chatSugestoes' },
    T.chips.map(c => el('button', { type: 'button', class: 'chat-chip', texto: c })));
  const form = el('form', { class: 'chat-form', id: 'chatForm', novalidate: '' }, [
    el('label', { class: 'sr-only', for: 'chatPergunta', texto: T.campo }),
    el('textarea', { id: 'chatPergunta', rows: '2', maxlength: '600', placeholder: T.placeholder, required: '' }),
    el('button', { type: 'submit', class: 'btn btn-primary', id: 'chatEnviar', texto: T.enviar })
  ]);
  const nota = el('p', { class: 'chat-nota' }, [
    document.createTextNode(T.nota1),
    el('a', { href: raizSite + T.privacidade, texto: T.nota2 })
  ]);
  const wrap = el('div', { class: 'chat-wrap', 'data-idioma': en ? 'en' : 'pt' },
    [el('section', { class: 'chat' }, [log, sugestoes, form, nota])]);

  const painel = el('div', { class: 'balao-painel', id: 'balaoPainel', role: 'dialog', 'aria-labelledby': 'balaoTitulo', hidden: true },
    [cabeca, wrap]);

  document.body.appendChild(painel);
  document.body.appendChild(botao);
  document.body.classList.add('tem-balao');

  let carregado = false;
  function abrir() {
    painel.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    document.body.classList.add('balao-aberto');
    if (!carregado) {
      carregado = true;
      const s = document.createElement('script');
      s.src = base + 'assistente.js';
      document.head.appendChild(s);
    }
    setTimeout(() => document.getElementById('chatPergunta').focus(), 50);
  }
  function fecharPainel() {
    painel.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('balao-aberto');
    botao.focus();
  }

  botao.addEventListener('click', () => (painel.hidden ? abrir() : fecharPainel()));
  fechar.addEventListener('click', fecharPainel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !painel.hidden) fecharPainel(); });

  // O link "Pergunte" / "Ask" do menu abre o balão em vez de trocar de página.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (!/(^|\/)assistente(-en)?\.html$/.test(a.getAttribute('href'))) return;
    e.preventDefault();
    const menu = document.querySelector('#menuBtn[aria-expanded="true"]');
    if (menu) menu.click();
    abrir();
  });
})();
