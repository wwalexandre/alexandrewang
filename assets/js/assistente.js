// Aba "Pergunte" / "Ask": conversa com o assistente (api/chat.js).
// Resposta da IA sempre entra como texto (textContent). Só links para o próprio site viram link.
(function () {
  const raiz = document.querySelector('.chat-wrap');
  if (!raiz) return;
  const en = raiz.dataset.idioma === 'en';
  const log = document.getElementById('chatLog');
  const form = document.getElementById('chatForm');
  const campo = document.getElementById('chatPergunta');
  const botao = document.getElementById('chatEnviar');
  const sugestoes = document.getElementById('chatSugestoes');

  const T = en ? {
    pensando: 'Thinking...',
    limite: 'The daily question limit was reached. Please try again tomorrow, or reach me through Contact.',
    cota: 'The assistant is out of free answers for today. Please try again tomorrow, or reach me through Contact.',
    indisponivel: 'The assistant is not available right now. Please reach me through Contact.',
    erro: 'Something went wrong. Please try again in a moment.',
    curta: 'Type a question with at least a few words.'
  } : {
    pensando: 'Pensando...',
    limite: 'O limite diário de perguntas foi atingido. Tente de novo amanhã ou fale comigo pela seção Contato.',
    cota: 'O assistente esgotou as respostas gratuitas de hoje. Tente de novo amanhã ou fale comigo pela seção Contato.',
    indisponivel: 'O assistente não está disponível agora. Fale comigo pela seção Contato.',
    erro: 'Algo deu errado. Tente de novo em instantes.',
    curta: 'Escreva uma pergunta com pelo menos algumas palavras.'
  };

  const historico = [];
  const SITE = /(https:\/\/alexandrewang\.vercel\.app\/[A-Za-z0-9._\/#?=-]*)/g;

  // Texto com links do próprio site clicáveis; o resto fica como texto puro.
  function preencher(no, texto) {
    texto.split(SITE).forEach((parte, i) => {
      if (!parte) return;
      if (i % 2 === 1) {
        const a = document.createElement('a');
        a.href = parte.replace(/[.,;:]+$/, '');
        a.textContent = a.href.replace('https://alexandrewang.vercel.app/', '/') || '/';
        no.appendChild(a);
        const sobra = parte.slice(a.href.length);
        if (sobra) no.appendChild(document.createTextNode(sobra));
      } else {
        no.appendChild(document.createTextNode(parte));
      }
    });
  }

  // Tira marcações de markdown que o modelo às vezes manda: [texto](url) vira só o endereço
  // (ou "texto (endereço)"), e somem asteriscos de ênfase e crases.
  function limpar(t) {
    return t
      .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (m, txt, url) => (txt === url || /^https?:/.test(txt) ? url : txt + ' (' + url + ')'))
      .replace(/\*\*|__|`/g, '')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1$2');
  }

  // Parágrafos e listas simples ("- item" ou "1. item"); negrito em markdown vira texto normal.
  function bolha(de, texto) {
    const caixa = document.createElement('div');
    caixa.className = 'chat-msg ' + de;
    let lista = null;
    limpar(texto).split(/\n+/).forEach(linha => {
      const l = linha.trim();
      if (!l) return;
      const item = l.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (item) {
        if (!lista) { lista = document.createElement('ul'); caixa.appendChild(lista); }
        const li = document.createElement('li');
        preencher(li, item[1]);
        lista.appendChild(li);
      } else {
        lista = null;
        const p = document.createElement('p');
        preencher(p, l.replace(/^#+\s*/, ''));
        caixa.appendChild(p);
      }
    });
    log.appendChild(caixa);
    log.scrollTop = log.scrollHeight;
    return caixa;
  }

  async function perguntar(pergunta) {
    if (pergunta.length < 4) { bolha('aviso', T.curta); return; }
    bolha('eu', pergunta);
    if (sugestoes) sugestoes.hidden = true;
    campo.value = '';
    botao.disabled = true;
    campo.disabled = true;
    const espera = bolha('ia espera', T.pensando);
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: pergunta, historico: historico.slice(-6), idioma: en ? 'en' : 'pt' })
      });
      const dados = await resp.json().catch(() => ({}));
      espera.remove();
      if (resp.ok && dados.resposta) {
        bolha('ia', dados.resposta);
        historico.push({ de: 'eu', texto: pergunta }, { de: 'ia', texto: dados.resposta });
      } else {
        bolha('aviso', T[dados.erro] || T.erro);
      }
    } catch (e) {
      espera.remove();
      bolha('aviso', T.erro);
    } finally {
      botao.disabled = false;
      campo.disabled = false;
      campo.focus();
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!botao.disabled) perguntar(campo.value.trim());
  });
  campo.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  if (sugestoes) sugestoes.addEventListener('click', e => {
    const chip = e.target.closest('.chat-chip');
    if (chip && !botao.disabled) perguntar(chip.textContent.trim());
  });
})();
