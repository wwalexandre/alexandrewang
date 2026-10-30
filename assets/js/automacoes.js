// Diagramas dos fluxos de Power Automate (página de automações).
// Cada fluxo é desenhado no formato do editor do Power Automate e pode "rodar":
// os passos acendem em ordem, como no histórico de execução.
(function automacoes() {
  const EN = document.documentElement.lang.startsWith('en');
  const t = par => (Array.isArray(par) ? par[EN ? 1 : 0] : par);
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Ícones genéricos (não são os logos da Microsoft), na cor de cada serviço
  const IC = {
    mail: ['#0F6CBD', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
    pasta: ['#03787C', '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>'],
    lista: ['#03787C', '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'],
    excel: ['#107C41', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>'],
    script: ['#6B4FBB', '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12"/>'],
    teams: ['#5B5FC7', '<path d="M4 5h16v11H9l-5 4z"/>'],
    planner: ['#31752F', '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l3 3 5-6"/>'],
    aprova: ['#0F6CBD', '<circle cx="12" cy="12" r="8"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'],
    relogio: ['#0F6CBD', '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'],
    cond: ['#484644', '<path d="M12 4v6M12 10l-6 6M12 10l6 6"/><circle cx="6" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/>'],
    laco: ['#484644', '<path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>'],
    filtro: ['#484644', '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>'],
    tabela: ['#484644', '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M9 10v9M15 10v9"/>'],
    pbi: ['#B08800', '<path d="M6 20V11M12 20V5M18 20v-6"/>'],
    app: ['#742774', '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 18h4"/>'],
    relatorio: ['#1F5D9E', '<path d="M6 3h9l3 3v15H6z"/><path d="M9 12h6M9 16h6M9 8h3"/>'],
    nada: ['#8A8886', '<path d="M7 12h10"/>'],
  };

  const SIM = ['Sim', 'Yes'], NAO = ['Não', 'No'];
  const COND = ['Condição', 'Condition'];
  const TEAMS_MSG = ['Publicar mensagem em um chat ou canal', 'Post message in a chat or channel'];
  const NADA = { ic: 'nada', t: ['Nada a fazer', 'Do nothing'], fim: true };

  // Passos: ic, t (título da ação), d (detalhe), filhos (escopo), sim/nao (condição)
  const FLUXOS = {
    'sanofi-anexos': [
      { ic: 'mail', gatilho: true, t: ['Quando um novo email chegar (V3)', 'When a new email arrives (V3)'], d: ['Assunto combinado com o time, só e-mails com anexo', 'Subject agreed with the team, only emails with attachments'] },
      { ic: 'laco', t: ['Aplicar a cada', 'Apply to each'], d: ['Cada anexo do e-mail', 'Each attachment of the email'], filhos: [
        { ic: 'cond', t: COND, d: ['O anexo é um .xlsx?', 'Is the attachment an .xlsx?'],
          sim: [
            { ic: 'pasta', t: ['Criar arquivo', 'Create file'], d: ['Pasta do mês anterior (2026 › 04. ABR), nome BASE_ODR_04.26.xlsx', 'Previous month folder (2026 › 04. APR), named BASE_ODR_04.26.xlsx'] },
            { ic: 'script', t: ['Executar script', 'Run script'], d: ['Office Script apaga as abas extras e deixa só o mês de referência', 'Office Script deletes extra sheets and keeps only the reference month'] },
          ],
          nao: [{ ic: 'nada', t: ['Ignorar', 'Skip'], d: ['Imagem da assinatura', 'Signature image'], fim: true }] },
      ] },
    ],
    'sanofi-planner': [
      { ic: 'teams', gatilho: true, t: ['Para uma mensagem selecionada', 'For a selected message'], d: ['Alguém escolhe a ação numa mensagem do Teams', 'Someone picks the action on a Teams message'] },
      { ic: 'planner', t: ['Criar uma tarefa', 'Create a task'], d: ['Título, responsável, prazo e link da mensagem', 'Title, owner, due date and link to the message'] },
      { ic: 'aprova', t: ['Iniciar e aguardar uma aprovação', 'Start and wait for an approval'], d: ['Vai para quem aprova, com o contexto', 'Goes to the approver, with context'] },
      { ic: 'cond', t: COND, d: ['Aprovado?', 'Approved?'],
        sim: [{ ic: 'planner', t: ['Atualizar uma tarefa', 'Update a task'], d: ['Segue com a tarefa liberada', 'Moves on with the task cleared'] }],
        nao: [{ ic: 'teams', t: TEAMS_MSG, d: ['Avisa quem pediu, com o comentário', 'Tells the requester, with the comment'] }] },
    ],
    'hypera-alerta': [
      { ic: 'relogio', gatilho: true, t: ['Recorrência', 'Recurrence'], d: ['Roda ao longo do turno', 'Runs throughout the shift'] },
      { ic: 'excel', t: ['Listar linhas presentes em uma tabela', 'List rows present in a table'], d: ['Ordens liberadas, hora da liberação e status da separação', 'Released orders, release time and picking status'] },
      { ic: 'filtro', t: ['Filtrar matriz', 'Filter array'], d: ['Liberada há mais de 1 hora e sem material separado', 'Released over 1 hour ago with no material picked'] },
      { ic: 'cond', t: COND, d: ['Sobrou alguma ordem?', 'Any order left?'],
        sim: [{ ic: 'teams', t: TEAMS_MSG, d: ['Ordem, produto, linha e há quanto tempo espera', 'Order, product, line and how long it has waited'] }],
        nao: [NADA] },
    ],
    'hypera-kpis': [
      { ic: 'relogio', gatilho: true, t: ['Recorrência', 'Recurrence'], d: ['Todo dia, depois do fechamento da produção', 'Every day, after production closes'] },
      { ic: 'pbi', t: ['Executar uma consulta em um conjunto de dados', 'Run a query against a dataset'], d: ['Volume produzido por linha', 'Volume produced per line'] },
      { ic: 'tabela', t: ['Criar tabela HTML', 'Create HTML table'], d: ['Uma linha por linha de produção', 'One row per production line'] },
      { ic: 'teams', t: TEAMS_MSG, d: ['Canal da gestão, todo dia. No fim do trimestre, o consolidado', 'Management channel, every day. At quarter end, the consolidated view'] },
    ],
    'abbott-extracao': [
      { ic: 'mail', gatilho: true, t: ['Quando um novo email chegar (V3)', 'When a new email arrives (V3)'], d: ['Relatório agendado do SAP BO', 'Scheduled SAP BO report'] },
      { ic: 'pasta', t: ['Criar arquivo', 'Create file'], d: ['Substitui a base do indicador', 'Replaces the KPI base file'] },
      { ic: 'pbi', t: ['Atualizar um conjunto de dados', 'Refresh a dataset'], d: ['Indicadores atualizados no Power BI', 'KPIs refreshed in Power BI'] },
    ],
    'abbott-app': [
      { ic: 'app', gatilho: true, t: ['Quando o Power Apps chama um fluxo (V2)', 'When Power Apps calls a flow (V2)'], d: ['Técnico registra atividade ou desvio no app', 'A technician logs an activity or deviation in the app'] },
      { ic: 'lista', t: ['Criar item', 'Create item'], d: ['Lista com data, área, tipo e responsável', 'List with date, area, type and owner'] },
      { ic: 'cond', t: COND, d: ['É não conformidade?', 'Is it a non-conformity?'],
        sim: [{ ic: 'mail', t: ['Enviar um email (V2)', 'Send an email (V2)'], d: ['Avisa o treinador responsável', 'Notifies the trainer in charge'] }],
        nao: [{ ic: 'nada', t: ['Só registra', 'Just log it'], fim: true }] },
      { ic: 'pbi', t: ['Dashboard no Power BI', 'Power BI dashboard'], d: ['KPIs e não conformidades da equipe', 'Team KPIs and non-conformities'], fim: true },
    ],
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icone = nome => {
    const [cor, svg] = IC[nome];
    return `<span class="pa-ic" style="background:${cor}"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg></span>`;
  };
  function passo(p) {
    const cab = `<div class="pa-card${p.gatilho ? ' pa-trigger' : ''}${p.fim ? ' pa-end' : ''}">${icone(p.ic)}<span class="pa-txt">${p.gatilho ? `<em>${t(['Gatilho', 'Trigger'])}</em>` : ''}<b>${esc(t(p.t))}</b>${p.d ? `<small>${esc(t(p.d))}</small>` : ''}</span><span class="pa-ok" aria-hidden="true"></span></div>`;
    if (p.filhos) return `<li class="pa-step pa-scope">${cab}<ol class="pa-steps">${p.filhos.map(passo).join('')}</ol></li>`;
    if (p.sim) return `<li class="pa-step pa-cond">${cab}<div class="pa-branches">
      <div class="pa-yes"><span class="pa-lbl">${t(SIM)}</span><ol class="pa-steps">${p.sim.map(passo).join('')}</ol></div>
      <div class="pa-no"><span class="pa-lbl">${t(NAO)}</span><ol class="pa-steps">${p.nao.map(passo).join('')}</ol></div></div></li>`;
    return `<li class="pa-step">${cab}</li>`;
  }

  // "Ver rodar": acende os cartões em ordem, pelo caminho do Sim, como no histórico de execução
  function rodar(box, btn) {
    const cards = [...box.querySelectorAll('.pa-card')];
    cards.forEach(c => c.classList.remove('on', 'pa-skip'));
    box.querySelectorAll('.pa-no .pa-card').forEach(c => c.classList.add('pa-skip'));
    const ordem = cards.filter(c => !c.closest('.pa-no'));
    btn.disabled = true;
    if (reduzir) { ordem.forEach(c => c.classList.add('on')); btn.disabled = false; return; }
    ordem.forEach((c, i) => setTimeout(() => {
      c.classList.add('on');
      if (i === ordem.length - 1) btn.disabled = false;
    }, 450 * (i + 1)));
  }

  document.querySelectorAll('[data-fluxo]').forEach(box => {
    const passos = FLUXOS[box.dataset.fluxo];
    if (!passos) return;
    box.innerHTML = `<ol class="pa-steps pa-root">${passos.map(passo).join('')}</ol>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm pa-run';
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/></svg>${t(['Ver o fluxo rodar', 'Watch it run'])}`;
    btn.addEventListener('click', () => rodar(box, btn));
    box.after(btn);
    // roda sozinho uma vez, quando o diagrama aparece na tela
    if (!reduzir && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { io.disconnect(); rodar(box, btn); }
      }), { threshold: 0.6 });
      io.observe(box);
    }
  });

  // Filtro por empresa
  const botoes = document.querySelectorAll('.pa-filters .filter');
  botoes.forEach(b => b.addEventListener('click', () => {
    botoes.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    document.querySelectorAll('.pa-item').forEach(it => {
      it.hidden = !(b.dataset.co === 'all' || it.dataset.co === b.dataset.co);
    });
  }));
})();
