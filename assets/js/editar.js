// Modo de edição do site. Carregado por main.js só quando o painel /admin abriu a página
// com ?editar=1. Quem não está na tabela "admins" não consegue salvar nada: a regra está
// no banco (RLS), não aqui. A chave usada é a publicável, a mesma de main.js.
// O texto editado é sempre texto puro (textContent), nunca HTML.
(function editor() {
  const T = window.__Textos;
  if (!T || !window.supabase) return;
  const sb = window.supabase.createClient(T.url, T.key, { auth: { persistSession: true, autoRefreshToken: true } });
  const EN = document.documentElement.lang.startsWith('en');

  const barra = document.createElement('div');
  barra.setAttribute('data-sem-edicao', '');
  barra.className = 'ed-barra';
  const aviso = document.createElement('span');
  aviso.setAttribute('role', 'status');
  const sair = document.createElement('button');
  sair.type = 'button';
  sair.textContent = 'Sair da edição';
  barra.append(aviso, sair);

  const estilo = document.createElement('style');
  estilo.textContent =
    '.ed-barra{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;display:flex;gap:14px;align-items:center;' +
    'justify-content:space-between;padding:10px 14px;border-radius:10px;background:#0F1C2C;color:#fff;' +
    'font:500 14px/1.4 system-ui,sans-serif;border:1px solid #F08A24;box-shadow:0 6px 24px rgba(0,0,0,.35)}' +
    '.ed-barra button{font:600 13px/1 system-ui,sans-serif;padding:8px 12px;border-radius:8px;border:1px solid #5a6b7d;' +
    'background:none;color:#fff;cursor:pointer;flex:none}' +
    '.ed-barra a{color:#F5A04A}' +
    'body.ed-on [data-ed]:hover{outline:2px dashed #F08A24;outline-offset:3px;cursor:text}' +
    'body.ed-on [data-ed][contenteditable]{outline:2px solid #F08A24;outline-offset:3px;background:rgba(240,138,36,.12)}' +
    'body.ed-on{padding-bottom:70px}';
  document.head.appendChild(estilo);
  document.body.appendChild(barra);

  const diz = t => { aviso.textContent = t; };
  const PADRAO = 'Modo de edição: clique num texto para corrigir. Enter salva, Esc cancela. ' +
    'Ctrl+clique usa links e botões normalmente.';

  sair.addEventListener('click', () => {
    try { sessionStorage.removeItem('editar'); } catch (e) {}
    const u = new URL(location.href);
    u.searchParams.delete('editar');
    location.replace(u.toString());
  });

  function marca() {
    T.folhas().forEach(n => { if (!n.closest('.ed-barra')) n.setAttribute('data-ed', ''); });
  }

  let editando = null;

  function abre(el) {
    if (editando) return;
    const antes = el.textContent;
    editando = el;
    el.setAttribute('contenteditable', 'plaintext-only');
    if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    el.focus();
    let cancelado = false;

    const tecla = e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      if (e.key === 'Escape') { cancelado = true; el.blur(); }
    };
    const fim = async () => {
      el.removeEventListener('keydown', tecla);
      el.removeAttribute('contenteditable');
      editando = null;
      const novo = T.norm(el.textContent);
      if (cancelado || !novo || novo === T.norm(antes)) { el.textContent = antes; if (!cancelado && !novo) diz('Texto vazio não é salvo.'); return; }
      const original = el.dataset.textoOrig || T.norm(antes);
      el.textContent = novo;
      diz('Salvando...');
      let erro;
      if (novo === original) {
        ({ error: erro } = await sb.from('textos_site').delete().eq('pagina', T.pagina).eq('original', original));
        if (!erro) delete el.dataset.textoOrig;
      } else {
        ({ error: erro } = await sb.from('textos_site')
          .upsert({ pagina: T.pagina, original, novo, atualizado_em: new Date().toISOString() }, { onConflict: 'pagina,original' }));
        if (!erro) el.dataset.textoOrig = original;
      }
      if (erro) { el.textContent = antes; diz('Não salvou: ' + erro.message); return; }
      try { localStorage.removeItem('textos:' + T.pagina); } catch (e) {}
      diz('Salvo. Já vale para quem abrir a página' + (EN ? ' em inglês.' : '.'));
    };
    el.addEventListener('keydown', tecla);
    el.addEventListener('blur', fim, { once: true });
  }

  function liga() {
    document.body.classList.add('ed-on');
    marca();
    diz(PADRAO);
    document.addEventListener('click', e => {
      if (e.ctrlKey || e.metaKey) return;
      const el = e.target.closest && e.target.closest('[data-ed]');
      if (!el || el.closest('.ed-barra')) return;
      if (el === editando) return;
      e.preventDefault();
      e.stopPropagation();
      abre(el);
    }, true);
  }

  (async () => {
    diz('Conferindo seu acesso...');
    const { data } = await sb.auth.getSession();
    const sessao = data && data.session;
    let admin = false;
    if (sessao) {
      // is_admin() no banco já exige o código do app quando a verificação em duas etapas está ativa
      const r = await sb.rpc('is_admin');
      admin = !r.error && r.data === true;
    }
    if (!admin) {
      aviso.textContent = 'Para editar, entre primeiro no ';
      const a = document.createElement('a');
      a.href = new URL('../../admin/', document.querySelector('script[src*="editar.js"]').src).pathname;
      a.textContent = 'painel';
      aviso.append(a, '.');
      return;
    }
    await T.pronto;
    liga();
  })();
})();
