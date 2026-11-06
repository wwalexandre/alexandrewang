// Alexandre Wang | portfólio: comportamento compartilhado entre as páginas

const SITE_URL = 'https://alexandrewang.vercel.app';
const LANG = document.documentElement.lang.startsWith('en') ? 'en' : 'pt';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
const svgIcon = (d, extra) => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (extra || '') + '><path d="' + d + '"/></svg>';

// Estatísticas anônimas (Umami, sem cookies). Para ligar, preencha o Website ID do Umami.
// Só conta visitas no domínio oficial: prévias e testes locais ficam de fora.
const UMAMI_ID = '';
if (UMAMI_ID) {
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.dataset.websiteId = UMAMI_ID;
  s.dataset.domains = 'alexandrewang.vercel.app';
  document.head.appendChild(s);
}
function track(name, data) {
  try { if (window.umami) window.umami.track(name, data); } catch (e) {}
}

// Supabase: grava mensagens de contato e leads (e-mails de quem baixa currículo, modelos ou usa demos).
// A chave abaixo é a PUBLICÁVEL: ela aparece no navegador por design. Quem protege os dados é o RLS do banco
// (visitante não lê nada e só grava pelas funções enviar_mensagem e registrar_lead, que limitam envios
// no servidor). Nunca coloque aqui a chave secreta (service_role).
// Detalhes em docs/SUPABASE.md. A mesma URL e chave estão em assets/js/admin.js.
const SB_URL = 'https://apezjjrpvlglaawvhqoo.supabase.co';
const SB_KEY = 'sb_publishable_eHbHUKdtoOVlIg87zQZAew_DgD-GK6J';
function sbRpc(fn, args) {
  return fetch(SB_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
    body: JSON.stringify(args)
  });
}
// Cópia do lead no banco, com o detalhe (qual demonstração ou arquivo). Nunca segura o download nem mostra erro.
function saveLead(email, origem, detalhe) {
  try {
    sbRpc('registrar_lead', { p_email: email, p_origem: origem, p_idioma: LANG, p_detalhe: detalhe || null }).catch(() => {});
  } catch (e) {}
}
document.querySelectorAll('video').forEach(v => v.addEventListener('play', () => {
  track('video-play', { video: (v.currentSrc || '').split('/').pop() });
}, { once: true }));

// Idioma: quem escolhe PT ou EN no menu fica com essa escolha.
// A Vercel manda quem acessa de fora do Brasil para a versão em inglês, mas só enquanto não existe o cookie "lang".
function setLangCookie(lang) {
  try {
    document.cookie = 'lang=' + lang + '; path=/; max-age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  } catch (e) {}
}
(function langChoice() {
  document.querySelectorAll('.lang a, a[hreflang]').forEach(a => a.addEventListener('click', () => {
    const h = a.getAttribute('hreflang');
    setLangCookie(h ? (h.startsWith('en') ? 'en' : 'pt') : LANG);
  }));

  // Na versão em inglês, quem tem o navegador em português (um brasileiro viajando, por exemplo) recebe um convite discreto
  if (LANG !== 'en' || /(?:^|;\s*)lang=/.test(document.cookie)) return;
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
  if (!langs.some(l => /^pt\b/i.test(l))) return;
  const pt = document.querySelector('.lang a[hreflang^="pt"]');
  if (!pt) return;
  const hint = document.createElement('div');
  hint.className = 'lang-hint';
  hint.lang = 'pt-BR';
  hint.setAttribute('role', 'region');
  hint.setAttribute('aria-label', 'Idioma');
  hint.innerHTML =
    '<span>Prefere ler em português?</span>' +
    '<a class="btn btn-primary btn-sm" hreflang="pt-BR" href="' + pt.getAttribute('href') + '">Ver em português</a>' +
    '<button type="button" class="lang-hint-x" aria-label="Continuar em inglês">' + svgIcon('M6 6l12 12M18 6L6 18') + '</button>';
  const close = () => {
    hint.classList.remove('show');
    document.body.classList.remove('hint-open');
    setTimeout(() => hint.remove(), 450);
  };
  hint.querySelector('a').addEventListener('click', () => setLangCookie('pt'));
  hint.querySelector('button').addEventListener('click', () => { setLangCookie('en'); close(); });
  document.body.appendChild(hint);
  setTimeout(() => {
    hint.classList.add('show');
    document.body.classList.add('hint-open');
  }, 900);
})();

// Tema claro/escuro (respeita o sistema, guarda a escolha do visitante).
// Nos navegadores que suportam, a troca abre como um círculo a partir do botão.
(function theme() {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('theme');
    if (saved) root.dataset.theme = saved;
  } catch (e) {}
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : system.matches);
  const MOON = 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z';
  const SUN = 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4';
  const paint = () => {
    btn.innerHTML = svgIcon(isDark() ? SUN : MOON, ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"');
  };
  paint();
  if (system.addEventListener) system.addEventListener('change', paint);

  const apply = () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    paint();
  };
  btn.addEventListener('click', () => {
    if (!document.startViewTransition || REDUCE.matches) { apply(); return; }
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('vt-theme');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + raio + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 560, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove('vt-theme'));
  });
})();

// Menu no celular: abre com animação, fecha com Esc, com toque fora ou ao escolher um link
(function mobileMenu() {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;
  const BARS = 'M4 7h16M4 12h16M4 17h16';
  const X = 'M6 6l12 12M18 6L6 18';
  const ATTR = ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
  const set = open => {
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.innerHTML = svgIcon(open ? X : BARS, ATTR);
  };
  btn.addEventListener('click', () => set(!menu.classList.contains('open')));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) { set(false); btn.focus(); }
  });
  document.addEventListener('click', e => {
    // composedPath guarda o caminho do clique mesmo depois de o ícone do botão ser trocado
    const path = e.composedPath ? e.composedPath() : [e.target];
    if (menu.classList.contains('open') && !path.includes(menu) && !path.includes(btn)) set(false);
  });
})();

// Barra de leitura no topo, sombra no menu ao rolar e botão de voltar ao topo
(function scrollUi() {
  const nav = document.querySelector('.nav');
  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<i></i>';
  if (nav) nav.appendChild(bar);
  const fill = bar.firstChild;

  const top = document.createElement('button');
  top.type = 'button';
  top.className = 'to-top';
  top.setAttribute('aria-label', LANG === 'en' ? 'Back to top' : 'Voltar ao topo');
  top.innerHTML = svgIcon('M12 19V5M5 12l7-7 7 7');
  top.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: REDUCE.matches ? 'auto' : 'smooth' });
    const brand = document.querySelector('.brand');
    if (brand) brand.focus({ preventScroll: true });
  });
  document.body.appendChild(top);

  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = scrollY;
    fill.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    if (nav) nav.classList.toggle('scrolled', y > 8);
    top.classList.toggle('show', y > innerHeight * 1.2);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
})();

// Blocos que aparecem suavemente ao entrar na tela. Só o que começa abaixo da dobra ganha o efeito,
// então nada pisca no carregamento; quem prefere menos movimento vê tudo direto.
const Reveal = (function reveal() {
  const finish = el => { el.classList.remove('reveal', 'in'); el.style.transitionDelay = ''; };
  if (REDUCE.matches || !('IntersectionObserver' in window)) return { finish };
  const SEL = '.sec-head, .tl, .traj-extra > div, .ach, .feat, .sub-h, .proj, .pub-item, .pubs-foot, .contact-list, .cv-card, ' +
    '.pa-item, .sop-ciclo li, .sop-slide, .sop-setores > div, .next-links a, .cta-card';
  const io = new IntersectionObserver(entries => {
    const shown = entries.filter(e => e.isIntersecting).map(e => e.target);
    shown.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
    shown.forEach((el, i) => {
      io.unobserve(el);
      const delay = Math.min(i, 5) * 70;
      el.style.transitionDelay = delay + 'ms';
      el.classList.add('in');
      setTimeout(() => finish(el), 700 + delay);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  const limit = innerHeight * 0.92;
  document.querySelectorAll(SEL).forEach(el => {
    if (el.closest('[hidden]') || el.getBoundingClientRect().top < limit) return;
    el.classList.add('reveal');
    io.observe(el);
  });
  // Ao usar um filtro, o que estava esperando para aparecer aparece na hora
  document.addEventListener('click', e => {
    const f = e.target.closest('.filter');
    if (f) (f.closest('section, main') || document).querySelectorAll('.reveal').forEach(el => { io.unobserve(el); finish(el); });
  });
  return { finish };
})();

// Link ativo no menu conforme a seção visível
(function activeNav() {
  const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.remove('active'));
      const a = map.get(e.target.id);
      if (a) a.classList.add('active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
})();

// Filtro de projetos: os cartões deslizam para o novo lugar (View Transitions) e a contagem é anunciada
(function projectFilter() {
  const buttons = document.querySelectorAll('.filters .filter[data-filter]');
  const cards = [...document.querySelectorAll('.proj')];
  if (!buttons.length || !cards.length) return;
  const group = buttons[0].parentElement;
  const count = document.createElement('span');
  count.className = 'filter-count';
  count.setAttribute('aria-live', 'polite');
  group.appendChild(count);
  const label = n => (LANG === 'en' ? n + (n === 1 ? ' project' : ' projects') : n + (n === 1 ? ' projeto' : ' projetos'));
  count.textContent = label(cards.length);

  const run = f => {
    let n = 0;
    cards.forEach(card => {
      const cats = (card.dataset.cat || '').split(' ');
      card.hidden = !(f === 'all' || cats.includes(f));
      if (!card.hidden) n++;
    });
    count.textContent = label(n);
  };
  buttons.forEach(btn => btn.addEventListener('click', () => {
    if (btn.getAttribute('aria-pressed') === 'true') return;
    buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    const f = btn.dataset.filter;
    cards.forEach(Reveal.finish);
    if (!document.startViewTransition || REDUCE.matches) { run(f); return; }
    const root = document.documentElement;
    cards.forEach((c, i) => { c.style.viewTransitionName = 'proj-' + i; });
    root.classList.add('vt-local');
    const vt = document.startViewTransition(() => run(f));
    vt.finished.finally(() => {
      root.classList.remove('vt-local');
      cards.forEach(c => { c.style.viewTransitionName = ''; });
    });
  }));
})();

// Fotos dos produtos na Trajetória: abrem numa janela com setas, deslize no celular e Esc para fechar
(function mediaViewer() {
  const groups = [...document.querySelectorAll('.tl-media')];
  if (!groups.length) return;
  const T = LANG === 'en'
    ? { title: 'Image viewer', prev: 'Previous image', next: 'Next image', close: 'Close', of: 'of' }
    : { title: 'Visualizador de imagens', prev: 'Imagem anterior', next: 'Próxima imagem', close: 'Fechar', of: 'de' };
  const dlg = document.createElement('dialog');
  dlg.className = 'sop-viewer media-viewer';
  dlg.setAttribute('aria-label', T.title);
  dlg.innerHTML =
    '<img alt="" width="960" height="480">' +
    '<div class="sop-viewer-bar">' +
      '<p class="sop-cap"></p><span class="sop-count" aria-live="polite"></span>' +
      '<button type="button" class="mv-prev" aria-label="' + T.prev + '">' + svgIcon('M15 6l-6 6 6 6') + '</button>' +
      '<button type="button" class="mv-next" aria-label="' + T.next + '">' + svgIcon('M9 6l6 6-6 6') + '</button>' +
      '<button type="button" class="mv-close" aria-label="' + T.close + '">' + svgIcon('M6 6l12 12M18 6L6 18') + '</button>' +
    '</div>';
  document.body.appendChild(dlg);
  const img = dlg.querySelector('img');
  const cap = dlg.querySelector('.sop-cap');
  const count = dlg.querySelector('.sop-count');
  const prev = dlg.querySelector('.mv-prev');
  const next = dlg.querySelector('.mv-next');
  let items = [], k = 0, origin = null;

  const show = (i, dir) => {
    k = (i + items.length) % items.length;
    const a = items[k];
    const thumb = a.querySelector('img');
    img.src = a.getAttribute('href');
    img.alt = thumb ? thumb.alt : '';
    cap.textContent = [a.querySelector('b'), a.querySelector('span')].filter(Boolean).map(e => e.textContent).join(': ');
    count.textContent = (k + 1) + ' ' + T.of + ' ' + items.length;
    prev.hidden = next.hidden = items.length < 2;
    if (dir && !REDUCE.matches && img.animate) {
      img.animate([{ opacity: 0, transform: 'translateX(' + dir * 28 + 'px)' }, { opacity: 1, transform: 'none' }],
        { duration: 280, easing: 'cubic-bezier(.2, .7, .2, 1)' });
    }
  };
  groups.forEach(g => {
    const links = [...g.querySelectorAll('a[href]')];
    links.forEach((a, i) => a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      origin = a; items = links;
      show(i);
      dlg.showModal();
      dlg.querySelector('.mv-close').focus();
    }));
  });
  prev.addEventListener('click', () => show(k - 1, -1));
  next.addEventListener('click', () => show(k + 1, 1));
  dlg.querySelector('.mv-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(k - 1, -1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(k + 1, 1); }
  });
  let x0 = null;
  img.addEventListener('pointerdown', e => { x0 = e.clientX; });
  img.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 45 && items.length > 1) dx < 0 ? show(k + 1, 1) : show(k - 1, -1);
  });
  dlg.addEventListener('close', () => { if (origin) origin.focus(); });
})();

// Carrossel das Conquistas: setas, pontos com progresso, deslize, arrastar com o mouse, teclado e rotação automática.
// A rotação pausa com o mouse em cima, com foco dentro, fora da tela ou no botão de pausa, e não liga para quem prefere menos movimento.
(function carousels() {
  const roots = document.querySelectorAll('[data-carousel]');
  if (!roots.length) return;
  const T = LANG === 'en'
    ? { prev: 'Previous', next: 'Next', pause: 'Pause rotation', play: 'Resume rotation', go: 'Go to', of: 'of', slide: 'slide' }
    : { prev: 'Anterior', next: 'Próxima', pause: 'Pausar a rotação', play: 'Retomar a rotação', go: 'Ir para', of: 'de', slide: 'slide' };
  const ICON = { prev: 'M15 6l-6 6 6 6', next: 'M9 6l6 6-6 6', pause: 'M9 5v14M15 5v14', play: 'M8 5.5v13l10.5-6.5z' };
  const pad = n => String(n).padStart(2, '0');

  roots.forEach(root => {
    const track = root.querySelector('.ach-track');
    const cards = track ? [...track.querySelectorAll('.ach-card')] : [];
    const n = cards.length;
    if (!n) return;
    const auto = !REDUCE.matches && n > 1;
    root.classList.add('ready');
    if (!auto) root.classList.add('static');
    cards.forEach((c, i) => {
      c.dataset.n = pad(i + 1);
      c.setAttribute('role', 'group');
      c.setAttribute('aria-roledescription', T.slide);
      c.setAttribute('aria-label', (i + 1) + ' ' + T.of + ' ' + n);
      c.querySelectorAll('img').forEach(im => { im.draggable = false; });
    });

    // Barra de controle
    const bar = document.createElement('div');
    bar.className = 'ach-bar';
    const dots = document.createElement('div');
    dots.className = 'ach-dots';
    cards.forEach((c, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'ach-dot';
      const h = c.querySelector('h3');
      d.setAttribute('aria-label', T.go + ' ' + (i + 1) + (h ? ': ' + h.textContent : ''));
      d.innerHTML = '<i></i>';
      d.addEventListener('click', () => go(i));
      dots.appendChild(d);
    });
    const ctrl = document.createElement('div');
    ctrl.className = 'ach-ctrl';
    const count = document.createElement('span');
    count.className = 'ach-count';
    count.setAttribute('aria-hidden', 'true');
    const mk = (cls, label, icon) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ach-btn ' + cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = svgIcon(icon);
      return b;
    };
    const btnPause = mk('ach-pause', T.pause, ICON.pause);
    const btnPrev = mk('ach-prev', T.prev, ICON.prev);
    const btnNext = mk('ach-next', T.next, ICON.next);
    ctrl.append(count, btnPause, btnPrev, btnNext);
    bar.append(dots, ctrl);
    root.appendChild(bar);

    // Posição: o cartão do meio é o ativo; os vizinhos diminuem e esmaecem conforme a distância
    let index = 0, alvo = null, alvoTimer = 0, raf = 0;
    const gap = () => parseFloat(getComputedStyle(track).columnGap) || 16;
    const centro = c => c.offsetLeft + c.offsetWidth / 2;
    const posicao = i => centro(cards[i]) - track.clientWidth / 2;
    const reiniciar = () => {
      const fills = dots.querySelectorAll('i');
      fills.forEach(f => { f.style.animation = 'none'; });
      void dots.offsetWidth;
      fills.forEach(f => { f.style.animation = ''; });
    };
    const marcar = () => {
      [...dots.children].forEach((d, i) => {
        d.classList.toggle('on', i === index);
        if (i === index) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      cards.forEach((c, i) => c.classList.toggle('is-active', i === index));
      count.textContent = pad(index + 1) + ' / ' + pad(n);
    };
    const medir = () => {
      raf = 0;
      const meio = track.scrollLeft + track.clientWidth / 2;
      const passo = (cards[0].offsetWidth + gap()) || 1;
      let melhor = 0, menor = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(centro(c) - meio) / passo;
        c.style.setProperty('--d', Math.min(d, 1.5).toFixed(3));
        if (d < menor) { menor = d; melhor = i; }
      });
      if (alvo !== null) {
        if (melhor !== alvo) return;
        alvo = null;
      }
      if (melhor !== index) { index = melhor; marcar(); reiniciar(); }
    };
    const go = (i, instant) => {
      index = (i + n) % n;
      alvo = index;
      clearTimeout(alvoTimer);
      alvoTimer = setTimeout(() => { alvo = null; }, 900);
      track.scrollTo({ left: posicao(index), behavior: instant || REDUCE.matches ? 'auto' : 'smooth' });
      marcar();
      reiniciar();
      if (instant) medir();
    };
    track.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(medir); }, { passive: true });

    // Pausas da rotação automática
    const pausa = { user: false, hover: false, foco: false, fora: true, oculta: document.hidden, arrasto: false };
    const sync = () => {
      const p = !auto || Object.values(pausa).some(Boolean);
      root.classList.toggle('paused', p);
    };
    btnPause.addEventListener('click', () => {
      pausa.user = !pausa.user;
      btnPause.setAttribute('aria-label', pausa.user ? T.play : T.pause);
      btnPause.innerHTML = svgIcon(pausa.user ? ICON.play : ICON.pause);
      sync();
    });
    root.addEventListener('mouseenter', () => { pausa.hover = true; sync(); });
    root.addEventListener('mouseleave', () => { pausa.hover = false; sync(); });
    root.addEventListener('focusin', () => { pausa.foco = true; sync(); });
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { pausa.foco = false; sync(); } });
    document.addEventListener('visibilitychange', () => { pausa.oculta = document.hidden; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { pausa.fora = !e.isIntersecting; sync(); }, { threshold: 0.35 }).observe(root);
    } else { pausa.fora = false; }
    dots.addEventListener('animationend', e => {
      if (e.animationName === 'ach-fill' && !root.classList.contains('paused')) go(index + 1);
    });

    btnPrev.addEventListener('click', () => go(index - 1));
    btnNext.addEventListener('click', () => go(index + 1));
    track.addEventListener('keydown', e => {
      if (e.target !== track) return;
      const k = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: n - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      go(k);
    });

    // Arrastar com o mouse (no toque, o próprio navegador desliza)
    let arr = null, bloquearClique = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      arr = { x: e.clientX, left: track.scrollLeft, moveu: false };
    });
    addEventListener('pointermove', e => {
      if (!arr) return;
      const dx = e.clientX - arr.x;
      if (!arr.moveu && Math.abs(dx) > 6) {
        arr.moveu = true;
        track.classList.add('dragging');
        pausa.arrasto = true; sync();
      }
      if (arr.moveu) track.scrollLeft = arr.left - dx;
    });
    addEventListener('pointerup', () => {
      if (!arr) return;
      const moveu = arr.moveu;
      arr = null;
      if (!moveu) return;
      track.classList.remove('dragging');
      pausa.arrasto = false; sync();
      bloquearClique = true;
      setTimeout(() => { bloquearClique = false; }, 0);
      alvo = null;
      medir();
      go(index);
    });

    // Clique num cartão do lado: centraliza esse cartão em vez de abrir o link
    track.addEventListener('click', e => {
      if (bloquearClique) { e.preventDefault(); e.stopPropagation(); return; }
      const card = e.target.closest('.ach-card');
      const i = cards.indexOf(card);
      if (i > -1 && i !== index) { e.preventDefault(); go(i); }
    }, true);

    if ('ResizeObserver' in window) new ResizeObserver(() => go(index, true)).observe(track);
    go(0, true);
    sync();
  });
})();

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Currículo em PDF gerado no navegador (mesmo conteúdo do site)
const CV = {
  pt: {
    file: 'Curriculo-Alexandre-Wang.pdf',
    role: 'Supply Chain Analytics e Automação | Demand Planning, IBP/S&OP, PCP',
    contact: 'alexandre01.w@gmail.com  |  +55 (11) 94402-1458  |  linkedin.com/in/alexandrewwang  |  São Paulo, SP',
    sections: [
      ['Resumo', [
        ['p', 'Farmacêutico (UFMG) com pós em Supply Chain (PUC Goiás) e cerca de 6 anos na indústria de saúde e no varejo. Uno planejamento (IBP/S&OP, demanda, PCP) com analytics e automação (Power BI, Power Automate, Python, SQL, SAP) para transformar dados operacionais em decisões.']
      ]],
      ['Experiência', [
        ['h', 'Sanofi | Demand Planning Analyst, IBP', 'jan 2026 a out 2026'],
        ['b', 'Dashboards Power BI de ODR/SLOB, riscos de supply e acuracidade de forecast por família e BU para os fóruns de IBP.'],
        ['b', 'Acompanhamento de MAPE, Bias e FVA (Lag 1 e Lag 3), comparando forecast estatístico e comercial.'],
        ['b', 'Modelo de qualificação de forecast em Power BI e DAX (Syntetos-Boylan, 8 critérios).'],
        ['b', 'Script Python que consolida as bases DR Analysis de cinco BUs; fluxos em Power Automate.'],
        ['h', 'Cia. Hering | Analista Sênior de Planejamento e Abastecimento', 'out 2025 a jan 2026'],
        ['b', 'Boletins automáticos de ruptura para gerentes e coordenadores de lojas.'],
        ['b', 'KPIs de Ruptura, Giro e Cobertura padronizados com Power BI, SQL e VBA.'],
        ['h', 'Hypera Pharma (Brainfarma) | Analista de PCP', 'ago 2024 a out 2025'],
        ['b', 'Ciclo do MPS e apresentação mensal do plano de produção no MBR.'],
        ['b', 'Rotina de PCP no SAP ECC PP/MM (MD04, MMBE) e follow-up de materiais críticos.'],
        ['b', 'Alerta no Teams para ordens sem material separado em 1 hora; KPIs diários automáticos.'],
        ['h', 'Abbott | Estagiário de Produção', '2022 a 2024'],
        ['b', 'App em Power Apps e dashboard de KPIs da equipe técnica (Excellence Award Achieving, 2024).'],
        ['b', 'Projeto A3 com ganho de capacidade e redução de custo (Excellence Award Pioneering, 2023).'],
        ['h', 'FUNED | Estagiário de Desenvolvimento e Formulação', '2021 a 2022'],
        ['b', 'Lotes piloto, relatórios de desenvolvimento e apoio a dossiês de registro.']
      ]],
      ['Formação', [
        ['b', 'Bacharelado em Farmácia, UFMG (2019 a 2024)'],
        ['b', 'Pós-graduação em Supply Chain, Gestão da Qualidade e Auditoria na Indústria Farmacêutica, PUC Goiás (2024 a 2026)'],
        ['b', 'Lean Six Sigma Yellow Belt; Certificado A3 de Melhoria Contínua (Abbott, 2023)']
      ]],
      ['Habilidades', [
        ['p', 'Power BI (DAX), Excel (Power Query, Power Pivot), Power Automate, Power Apps, Python (pandas), SQL (Snowflake, SQL Server), VBA, SAP ECC (PP/MM), Kinaxis, TM1, SharePoint. IBP/S&OP, MPS, MAPE, Bias, FVA, ABC/XYZ, ruptura, giro e cobertura. Incoterms e documentação de importação. RDC 658, GMP.']
      ]],
      ['Idiomas', [['p', 'Português (nativo), Inglês (avançado), Mandarim (básico)']]]
    ]
  },
  en: {
    file: 'Resume-Alexandre-Wang.pdf',
    role: 'Supply Chain Analytics and Automation | Demand Planning, IBP/S&OP, Production Planning',
    contact: 'alexandre01.w@gmail.com  |  +55 11 94402-1458  |  linkedin.com/in/alexandrewwang  |  São Paulo, Brazil',
    sections: [
      ['Summary', [
        ['p', 'Pharmacist (UFMG) with a postgraduate degree in Supply Chain (PUC Goiás) and about 6 years in healthcare manufacturing and retail. I combine planning (IBP/S&OP, demand, production planning) with analytics and automation (Power BI, Power Automate, Python, SQL, SAP) to turn operational data into decisions.']
      ]],
      ['Experience', [
        ['h', 'Sanofi | Demand Planning Analyst, IBP', 'Jan 2026 to Oct 2026'],
        ['b', 'Power BI dashboards for ODR/SLOB, supply risks and forecast accuracy by family and BU for IBP forums.'],
        ['b', 'Tracking of MAPE, Bias and FVA (Lag 1 and Lag 3), comparing statistical and commercial forecasts.'],
        ['b', 'Forecast qualification model in Power BI and DAX (Syntetos-Boylan, 8 criteria).'],
        ['b', 'Python script that consolidates DR Analysis files from five BUs; Power Automate flows.'],
        ['h', 'Cia. Hering | Senior Planning and Replenishment Analyst', 'Oct 2025 to Jan 2026'],
        ['b', 'Automated stockout bulletins for store managers and coordinators.'],
        ['b', 'Standardized Stockout, Turnover and Coverage KPIs with Power BI, SQL and VBA.'],
        ['h', 'Hypera Pharma (Brainfarma) | Production Planning Analyst', 'Aug 2024 to Oct 2025'],
        ['b', 'MPS cycle and monthly production plan review in the MBR.'],
        ['b', 'Production planning in SAP ECC PP/MM (MD04, MMBE) and critical material follow-up.'],
        ['b', 'Teams alert for orders without picked material within 1 hour; automated daily KPIs.'],
        ['h', 'Abbott | Production Intern', '2022 to 2024'],
        ['b', 'Power Apps app and KPI dashboard for the technical team (Excellence Award Achieving, 2024).'],
        ['b', 'A3 project with capacity gain and cost reduction (Excellence Award Pioneering, 2023).'],
        ['h', 'FUNED | Development and Formulation Intern', '2021 to 2022'],
        ['b', 'Pilot batches, development reports and support for registration dossiers.']
      ]],
      ['Education', [
        ['b', 'B.Sc. in Pharmacy, UFMG (2019 to 2024)'],
        ['b', 'Postgraduate degree in Supply Chain, Quality Management and Auditing in the Pharmaceutical Industry, PUC Goiás (2024 to 2026)'],
        ['b', 'Lean Six Sigma Yellow Belt; A3 Continuous Improvement Certificate (Abbott, 2023)']
      ]],
      ['Skills', [
        ['p', 'Power BI (DAX), Excel (Power Query, Power Pivot), Power Automate, Power Apps, Python (pandas), SQL (Snowflake, SQL Server), VBA, SAP ECC (PP/MM), Kinaxis, TM1, SharePoint. IBP/S&OP, MPS, MAPE, Bias, FVA, ABC/XYZ, stockout, turnover and coverage. Incoterms and import documentation. GMP.']
      ]],
      ['Languages', [['p', 'Portuguese (native), English (advanced), Mandarin (basic)']]]
    ]
  }
};

// A biblioteca de PDF só é baixada quando alguém pede o currículo (o site carrega mais rápido)
const JSPDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const JSPDF_SRI = 'sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==';
let jspdfPromise;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve();
  jspdfPromise = jspdfPromise || new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSPDF_SRC; s.integrity = JSPDF_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
    s.onload = resolve;
    s.onerror = () => { jspdfPromise = null; reject(new Error('jspdf')); };
    document.head.appendChild(s);
  });
  return jspdfPromise;
}

// Gera e baixa o PDF. Devolve false se a biblioteca não carregou
async function generateCV() {
  try { await loadJsPDF(); } catch (e) {
    alert(LANG === 'en' ? 'Could not load the PDF. Check your connection and try again.' : 'Não foi possível gerar o PDF. Confira a conexão e tente de novo.');
    return false;
  }
  const cv = CV[LANG];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const NAVY = [15, 28, 44], GREEN = [27, 127, 91], ORANGE = [240, 138, 36], INK = [20, 32, 48], MUTED = [83, 97, 113];
  const L = 44, W = 507, BOTTOM = 790;
  let y;

  doc.setFillColor(...NAVY); doc.rect(0, 0, 595, 104, 'F');
  doc.setFillColor(...ORANGE); doc.rect(0, 104, 595, 4, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(255, 255, 255);
  doc.text('Alexandre Wang', L, 50);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...ORANGE);
  doc.text(cv.role, L, 72);
  doc.setFontSize(9); doc.setTextColor(220, 228, 236);
  doc.text(cv.contact, L, 90);
  y = 138;

  const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = 56; } };
  const write = (text, size, style, color, indent = 0) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, W - indent);
    ensure(lines.length * size * 1.35);
    doc.text(lines, L + indent, y);
    y += lines.length * size * 1.35;
  };

  cv.sections.forEach(([title, items]) => {
    ensure(40);
    doc.setFillColor(...GREEN); doc.rect(L, y - 11, W, 16, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), L + 6, y);
    y += 20;
    items.forEach(([kind, text, extra]) => {
      if (kind === 'h') {
        y += 4; ensure(30);
        write(text, 10.5, 'bold', INK);
        y -= 2; write(extra, 9, 'normal', MUTED); y += 2;
      } else if (kind === 'b') {
        ensure(14);
        doc.setFillColor(...ORANGE); doc.circle(L + 4, y - 3, 1.6, 'F');
        write(text, 9.5, 'normal', INK, 12);
      } else {
        write(text, 9.5, 'normal', INK);
      }
    });
    y += 10;
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(SITE_URL.replace('https://', '') + '   ' + i + '/' + pages, L, 820);
  }
  doc.save(cv.file);
  return true;
}

// Antes do download: pede o e-mail do visitante, avisa o Alexandre e oferece o WhatsApp
const LEAD_ENDPOINT = 'https://formsubmit.co/ajax/alexandre01.w@gmail.com';
const CV_TXT = {
  pt: {
    title: 'Baixar currículo',
    lead: 'Deixe seu e-mail para baixar o PDF.',
    label: 'Seu e-mail',
    placeholder: 'nome@empresa.com',
    submit: 'Baixar currículo',
    cancel: 'Cancelar',
    privacy: 'Uso seu e-mail só para saber quem baixou o currículo e, se fizer sentido, entrar em contato. Não compartilho com ninguém.',
    invalid: 'Digite um e-mail válido.',
    doneTitle: 'Currículo baixado',
    doneText: 'Obrigado! Se quiser conversar, me chama no WhatsApp.',
    whatsapp: 'Falar no WhatsApp',
    close: 'Fechar',
    msg: 'Olá, Alexandre! Acessei o seu currículo e tenho interesse no seu perfil. Podemos conversar?',
    subject: 'Novo download do currículo'
  },
  en: {
    title: 'Download resume',
    lead: 'Leave your email to download the PDF.',
    label: 'Your email',
    placeholder: 'name@company.com',
    submit: 'Download resume',
    cancel: 'Cancel',
    privacy: 'I only use your email to know who downloaded my resume and, if it makes sense, to get in touch. I never share it.',
    invalid: 'Please enter a valid email.',
    doneTitle: 'Resume downloaded',
    doneText: 'Thank you! If you would like to talk, message me on WhatsApp.',
    whatsapp: 'Message on WhatsApp',
    close: 'Close',
    msg: 'Hi Alexandre! I saw your resume and I am interested in your profile. Can we talk?',
    subject: 'New resume download (EN)'
  }
};

(function cvGate() {
  const t = CV_TXT[LANG];
  const waLink = LANG === 'en' ? '/whatsapp/resume' : '/whatsapp/curriculo';
  const dlg = document.createElement('dialog');
  dlg.className = 'cv-dialog';
  dlg.setAttribute('aria-labelledby', 'cvTitle');
  dlg.innerHTML =
    '<form method="dialog" id="cvForm" novalidate>' +
      '<h2 id="cvTitle">' + t.title + '</h2>' +
      '<p>' + t.lead + '</p>' +
      '<label for="cvEmail">' + t.label + '</label>' +
      '<input type="email" id="cvEmail" name="email" autocomplete="email" placeholder="' + t.placeholder + '" required>' +
      '<input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<span class="err" id="cvErr" role="alert"></span>' +
      '<small>' + t.privacy + '</small>' +
      '<div class="row"><button type="button" class="btn btn-outline btn-sm" id="cvCancel">' + t.cancel + '</button>' +
      '<button type="submit" class="btn btn-primary btn-sm">' + t.submit + '</button></div>' +
    '</form>' +
    '<div class="done" id="cvDone" hidden>' +
      '<h2>' + t.doneTitle + '</h2>' +
      '<p>' + t.doneText + '</p>' +
      '<div class="row"><button type="button" class="btn btn-outline btn-sm" id="cvClose">' + t.close + '</button>' +
      '<a class="btn btn-wa btn-sm" href="' + waLink + '" target="_blank" rel="noopener">' + t.whatsapp + '</a></div>' +
    '</div>';
  document.body.appendChild(dlg);

  const form = dlg.querySelector('#cvForm');
  const done = dlg.querySelector('#cvDone');
  const email = dlg.querySelector('#cvEmail');
  const err = dlg.querySelector('#cvErr');

  const showDone = () => { form.hidden = true; done.hidden = false; };
  const show = () => (dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''));
  const open = () => {
    err.textContent = '';
    let saved = '';
    try { saved = localStorage.getItem('cv_email') || ''; } catch (e) {}
    if (saved) {
      // Quem já deixou o e-mail baixa direto
      generateCV().then(ok => {
        if (!ok) return;
        track('curriculo-baixado', { repetido: true });
        showDone(); show();
      });
      return;
    }
    form.hidden = false; done.hidden = true;
    show();
    email.focus();
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const value = email.value.trim();
    if (!email.checkValidity() || !value) { err.textContent = t.invalid; email.focus(); return; }
    if (!form._honey.value) {
      saveLead(value, 'curriculo');
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: value, idioma: LANG, pagina: location.href, _subject: t.subject, _template: 'table', _captcha: 'false' })
      }).catch(() => {});
    }
    generateCV().then(ok => {
      if (!ok) return;
      try { localStorage.setItem('cv_email', value); } catch (e) {}
      track('curriculo-baixado');
      showDone();
    });
  });

  const close = () => (dlg.close ? dlg.close() : dlg.removeAttribute('open'));
  dlg.querySelector('#cvCancel').addEventListener('click', close);
  dlg.querySelector('#cvClose').addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  document.querySelectorAll('[data-cv]').forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    open();
  }));
})();

// Arquivos para baixar (modelos): mesma janela do currículo. O aviso nunca segura o download
const FILE_TXT = {
  pt: {
    title: 'Baixar o modelo',
    lead: 'Deixe seu e-mail para baixar o arquivo.',
    label: 'Seu e-mail',
    placeholder: 'nome@empresa.com',
    submit: 'Baixar',
    cancel: 'Cancelar',
    privacy: 'Uso seu e-mail só para saber quem baixou o modelo e, se fizer sentido, entrar em contato. Não compartilho com ninguém.',
    invalid: 'Digite um e-mail válido.',
    doneTitle: 'Download iniciado',
    doneText: 'Obrigado! Se quiser trocar ideia sobre S&amp;OP, me chama no WhatsApp.',
    whatsapp: 'Falar no WhatsApp',
    close: 'Fechar',
    subject: 'Novo download: '
  },
  en: {
    title: 'Download the template',
    lead: 'Leave your email to download the file.',
    label: 'Your email',
    placeholder: 'name@company.com',
    submit: 'Download',
    cancel: 'Cancel',
    privacy: 'I only use your email to know who downloaded the template and, if it makes sense, to get in touch. I never share it.',
    invalid: 'Please enter a valid email.',
    doneTitle: 'Download started',
    doneText: 'Thank you! If you would like to talk about S&amp;OP, message me on WhatsApp.',
    whatsapp: 'Message on WhatsApp',
    close: 'Close',
    subject: 'New download: '
  }
};

(function fileGate() {
  const botoes = document.querySelectorAll('a[data-lead-file]');
  if (!botoes.length) return;
  const t = FILE_TXT[LANG];
  const dlg = document.createElement('dialog');
  dlg.className = 'cv-dialog file-dialog';
  dlg.setAttribute('aria-labelledby', 'fileTitle');
  dlg.innerHTML =
    '<form method="dialog" id="fileForm" novalidate>' +
      '<h2 id="fileTitle">' + t.title + '</h2>' +
      '<p>' + t.lead + '</p>' +
      '<label for="fileEmail">' + t.label + '</label>' +
      '<input type="email" id="fileEmail" name="email" autocomplete="email" placeholder="' + t.placeholder + '" required>' +
      '<input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<span class="err" id="fileErr" role="alert"></span>' +
      '<small>' + t.privacy + '</small>' +
      '<div class="row"><button type="button" class="btn btn-outline btn-sm" id="fileCancel">' + t.cancel + '</button>' +
      '<button type="submit" class="btn btn-primary btn-sm">' + t.submit + '</button></div>' +
    '</form>' +
    '<div class="done" id="fileDone" hidden>' +
      '<h2>' + t.doneTitle + '</h2>' +
      '<p>' + t.doneText + '</p>' +
      '<div class="row"><button type="button" class="btn btn-outline btn-sm" id="fileClose">' + t.close + '</button>' +
      '<a class="btn btn-wa btn-sm" href="' + (LANG === 'en' ? '/whatsapp/en' : '/whatsapp') + '" target="_blank" rel="noopener">' + t.whatsapp + '</a></div>' +
    '</div>';
  document.body.appendChild(dlg);

  const form = dlg.querySelector('#fileForm');
  const done = dlg.querySelector('#fileDone');
  const email = dlg.querySelector('#fileEmail');
  const err = dlg.querySelector('#fileErr');
  let atual = null; // botão que abriu a janela

  const show = () => (dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', ''));
  const avisar = value => {
    saveLead(value, 'arquivo', atual.dataset.leadFile);
    return fetch(LEAD_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: value, idioma: LANG, pagina: location.href, arquivo: atual.dataset.leadFile, _subject: t.subject + atual.dataset.leadFile, _template: 'table', _captcha: 'false' })
    }).catch(() => {});
  };
  const baixar = repetido => {
    const a = document.createElement('a');
    a.href = atual.getAttribute('href');
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    track('modelo-sop-baixado', { arquivo: atual.dataset.leadFile, repetido: !!repetido });
    form.hidden = true; done.hidden = false;
  };
  const salvo = () => {
    try { return localStorage.getItem('lead_email') || localStorage.getItem('cv_email') || ''; } catch (e) { return ''; }
  };

  const open = btn => {
    atual = btn;
    err.textContent = '';
    const ja = salvo();
    if (ja) {
      // Quem já deixou o e-mail (aqui ou no currículo) baixa direto, e o aviso sai do mesmo jeito
      avisar(ja);
      baixar(true);
      show();
      return;
    }
    form.hidden = false; done.hidden = true;
    show();
    email.focus();
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const value = email.value.trim();
    if (!email.checkValidity() || !value) { err.textContent = t.invalid; email.focus(); return; }
    if (!form._honey.value) {
      avisar(value);
      try { localStorage.setItem('lead_email', value); } catch (e) {}
    }
    baixar(false);
  });

  const close = () => {
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    if (atual) atual.focus();
  };
  dlg.querySelector('#fileCancel').addEventListener('click', close);
  dlg.querySelector('#fileClose').addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  botoes.forEach(btn => btn.addEventListener('click', e => {
    e.preventDefault();
    open(btn);
  }));
})();

// Antes de usar uma demonstração (validador, dashboard, fluxos, app): pede o e-mail uma vez e avisa o Alexandre
const DEMO_TXT = {
  pt: {
    title: 'Testar o projeto',
    lead: 'Deixe seu e-mail para usar a demonstração.',
    label: 'Seu e-mail',
    placeholder: 'nome@empresa.com',
    submit: 'Liberar a demonstração',
    cancel: 'Cancelar',
    privacy: 'Uso seu e-mail só para saber quem testou o projeto e, se fizer sentido, entrar em contato. Não compartilho com ninguém.',
    invalid: 'Digite um e-mail válido.',
    doneTitle: 'Pronto, pode testar',
    doneText: 'Obrigado! Se quiser conversar sobre o projeto, me chama no WhatsApp.',
    whatsapp: 'Falar no WhatsApp',
    go: 'Testar agora',
    subject: 'Novo teste: '
  },
  en: {
    title: 'Try the project',
    lead: 'Leave your email to use the demo.',
    label: 'Your email',
    placeholder: 'name@company.com',
    submit: 'Unlock the demo',
    cancel: 'Cancel',
    privacy: 'I only use your email to know who tried the project and, if it makes sense, to get in touch. I never share it.',
    invalid: 'Please enter a valid email.',
    doneTitle: 'All set, go ahead',
    doneText: 'Thank you! If you would like to talk about the project, message me on WhatsApp.',
    whatsapp: 'Message on WhatsApp',
    go: 'Try it now',
    subject: 'New demo user (EN): '
  }
};

(function demoGate() {
  const areas = document.querySelectorAll('[data-lead-demo]');
  if (!areas.length) return;
  const t = DEMO_TXT[LANG];
  const dlg = document.createElement('dialog');
  dlg.className = 'cv-dialog file-dialog';
  dlg.setAttribute('aria-labelledby', 'demoTitle');
  dlg.innerHTML =
    '<form method="dialog" id="demoForm" novalidate>' +
      '<h2 id="demoTitle">' + t.title + '</h2>' +
      '<p>' + t.lead + '</p>' +
      '<label for="demoEmail">' + t.label + '</label>' +
      '<input type="email" id="demoEmail" name="email" autocomplete="email" placeholder="' + t.placeholder + '" required>' +
      '<input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<span class="err" id="demoErr" role="alert"></span>' +
      '<small>' + t.privacy + '</small>' +
      '<div class="row"><button type="button" class="btn btn-outline btn-sm" id="demoCancel">' + t.cancel + '</button>' +
      '<button type="submit" class="btn btn-primary btn-sm">' + t.submit + '</button></div>' +
    '</form>' +
    '<div class="done" id="demoDone" hidden>' +
      '<h2>' + t.doneTitle + '</h2>' +
      '<p>' + t.doneText + '</p>' +
      '<div class="row"><a class="btn btn-wa btn-sm" href="' + (LANG === 'en' ? '/whatsapp/en' : '/whatsapp') + '" target="_blank" rel="noopener">' + t.whatsapp + '</a>' +
      '<button type="button" class="btn btn-primary btn-sm" id="demoGo">' + t.go + '</button></div>' +
    '</div>';
  document.body.appendChild(dlg);

  const form = dlg.querySelector('#demoForm');
  const done = dlg.querySelector('#demoDone');
  const email = dlg.querySelector('#demoEmail');
  const err = dlg.querySelector('#demoErr');
  let atual = null; // área ou link que pediu o e-mail
  let voltar = null; // onde o foco volta ao fechar

  const salvo = () => {
    try { return localStorage.getItem('lead_email') || localStorage.getItem('cv_email') || ''; } catch (e) { return ''; }
  };
  const chave = nome => 'lead_demo_' + nome;
  const avisado = nome => { try { return !!localStorage.getItem(chave(nome)); } catch (e) { return false; } };
  // Um aviso por demonstração em cada navegador, para não repetir a cada clique
  const avisar = (value, nome) => {
    try { localStorage.setItem(chave(nome), '1'); } catch (e) {}
    saveLead(value, 'demo', nome);
    fetch(LEAD_ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: value, idioma: LANG, pagina: location.href, demonstracao: nome, _subject: t.subject + nome, _template: 'table', _captcha: 'false' })
    }).catch(() => {});
    track('demo-liberada', { demonstracao: nome });
  };

  const show = () => { if (!dlg.open) (dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '')); };
  const close = () => {
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    if (voltar && voltar.focus) voltar.focus();
  };
  const pedir = (area, alvo) => {
    atual = area; voltar = alvo;
    err.textContent = '';
    form.hidden = false; done.hidden = true;
    show();
    email.focus();
  };

  // Devolve true quando a demonstração pode seguir; senão abre a janela do e-mail
  const liberar = (area, alvo) => {
    const nome = area.dataset.leadDemo;
    const ja = salvo();
    if (ja) {
      if (!avisado(nome)) avisar(ja, nome);
      return true;
    }
    pedir(area, alvo);
    return false;
  };
  const barrar = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  const INTERATIVO = 'a,button,input,select,textarea,label,summary,[role="button"]';

  areas.forEach(area => {
    if (area.matches('a')) {
      area.addEventListener('click', e => { if (!liberar(area, area)) barrar(e); });
      return;
    }
    area.addEventListener('click', e => {
      const alvo = e.target.closest(INTERATIVO);
      if (alvo && area.contains(alvo) && !liberar(area, alvo)) barrar(e);
    }, true);
    area.addEventListener('focusin', e => {
      if (e.target.matches('input,select,textarea') && !salvo()) { e.target.blur(); pedir(area, e.target); }
    }, true);
    area.addEventListener('drop', e => { if (!liberar(area, area)) barrar(e); }, true);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const value = email.value.trim();
    if (!email.checkValidity() || !value) { err.textContent = t.invalid; email.focus(); return; }
    if (!form._honey.value) {
      try { localStorage.setItem('lead_email', value); } catch (e) {}
      avisar(value, atual.dataset.leadDemo);
    }
    if (atual.matches('a')) window.open(atual.href, '_blank', 'noopener');
    form.hidden = true; done.hidden = false;
    dlg.querySelector('#demoGo').focus();
  });

  dlg.querySelector('#demoCancel').addEventListener('click', close);
  dlg.querySelector('#demoGo').addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
})();

// Botões de compartilhar nas publicações (cada rede leva um marcador para aparecer nas estatísticas)
(function shareBars() {
  const bars = document.querySelectorAll('[data-share]');
  if (!bars.length) return;
  const canon = (document.querySelector('link[rel="canonical"]') || {}).href || location.href.split('#')[0];
  const title = (document.querySelector('meta[property="og:title"]') || {}).content || document.title;
  const T = LANG === 'en'
    ? { copy: 'Copy link', copied: 'Link copied', more: 'More options' }
    : { copy: 'Copiar link', copied: 'Link copiado', more: 'Mais opções' };
  const url = src => canon + (canon.includes('?') ? '&' : '?') + 'utm_source=' + src + '&utm_medium=share';
  const ICON = {
    linkedin: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2a2 2 0 110 4 2 2 0 010-4z',
    whatsapp: 'M21 12a9 9 0 01-13.3 7.9L3 21l1.2-4.5A9 9 0 1121 12z',
    link: 'M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1 1M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1-1',
    more: 'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v13'
  };
  const make = (tag, icon, label) => {
    const el = document.createElement(tag);
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICON[icon] + '"/></svg>';
    el.append(label);
    return el;
  };
  bars.forEach(bar => {
    const slug = bar.dataset.share;
    const li = make('a', 'linkedin', 'LinkedIn');
    li.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url('linkedin'));
    const wa = make('a', 'whatsapp', 'WhatsApp');
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(title + ' ' + url('whatsapp'));
    [li, wa].forEach(a => {
      a.target = '_blank'; a.rel = 'noopener';
      a.addEventListener('click', () => track('compartilhar', { rede: a.textContent, pagina: slug }));
    });
    const copy = make('button', 'link', T.copy);
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url('link'));
        copy.lastChild.textContent = T.copied;
        setTimeout(() => { copy.lastChild.textContent = T.copy; }, 2000);
        track('compartilhar', { rede: 'link', pagina: slug });
      } catch (e) {}
    });
    bar.append(li, wa, copy);
    if (navigator.share) {
      const more = make('button', 'more', T.more);
      more.type = 'button';
      more.addEventListener('click', () => {
        navigator.share({ title, url: url('nativo') }).then(() => track('compartilhar', { rede: 'nativo', pagina: slug })).catch(() => {});
      });
      bar.append(more);
    }
  });
})();

// Formulário de contato: grava a mensagem no Supabase (função enviar_mensagem) e avisa por e-mail (FormSubmit).
// Basta um dos dois funcionar para a mensagem não se perder. Se o banco recusar por limite, nada é enviado.
// Anti-spam: campo oculto (honeypot), limites de tamanho, intervalo neste navegador e limite no servidor.
(function contactForm() {
  const form = document.getElementById('msgForm');
  if (!form) return;
  const T = LANG === 'en'
    ? {
        invalid: 'Please fill in your name, a valid email and a message with at least 10 characters.',
        wait: 'You just sent a message. Please wait a minute before sending another.',
        sending: 'Sending...',
        ok: 'Message sent. Thank you! I will reply by email.',
        fail: 'Could not send right now. Please email me directly at alexandre01.w@gmail.com.',
        limit: 'You have already sent several messages. Please try again later or email me at alexandre01.w@gmail.com.',
        subject: 'Website contact: '
      }
    : {
        invalid: 'Preencha o nome, um e-mail válido e uma mensagem com pelo menos 10 caracteres.',
        wait: 'Você acabou de enviar uma mensagem. Aguarde um minuto para enviar outra.',
        sending: 'Enviando...',
        ok: 'Mensagem enviada. Obrigado! Respondo por e-mail.',
        fail: 'Não consegui enviar agora. Escreva direto para alexandre01.w@gmail.com.',
        limit: 'Você já enviou várias mensagens. Tente mais tarde ou escreva para alexandre01.w@gmail.com.',
        subject: 'Contato pelo site: '
      };
  const status = form.querySelector('#msgStatus');
  const btn = form.querySelector('button[type="submit"]');
  const setStatus = (text, kind) => { status.textContent = text; status.className = 'msg-status' + (kind ? ' ' + kind : ''); };
  const MIN_INTERVAL = 60000;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form._honey.value) return;
    const nome = form.nome.value.trim();
    const email = form.email.value.trim();
    const assunto = form.assunto.value.trim();
    const mensagem = form.mensagem.value.trim();
    if (nome.length < 2 || !form.email.checkValidity() || !email || mensagem.length < 10) {
      setStatus(T.invalid, 'err');
      return;
    }
    let last = 0;
    try { last = Number(localStorage.getItem('msg_last')) || 0; } catch (err) {}
    if (Date.now() - last < MIN_INTERVAL) { setStatus(T.wait, 'err'); return; }

    btn.disabled = true;
    setStatus(T.sending);
    try {
      // 1) Banco. "limite" = muitos envios recentes: avisa e para aqui, sem mandar e-mail.
      let noBanco = false;
      try {
        const res = await sbRpc('enviar_mensagem', {
          p_nome: nome, p_email: email, p_assunto: assunto, p_mensagem: mensagem, p_idioma: LANG
        });
        if (res.ok) noBanco = true;
        else {
          const corpo = await res.json().catch(() => ({}));
          if (corpo && corpo.message === 'limite') { setStatus(T.limit, 'err'); return; }
        }
      } catch (err) {}

      // 2) Aviso por e-mail. Também é o plano B se o banco estiver fora do ar.
      const noEmail = await fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nome: nome, email: email, assunto: assunto, mensagem: mensagem, idioma: LANG,
          gravada_no_banco: noBanco ? 'sim' : 'não',
          _replyto: email, _subject: T.subject + (assunto || nome), _template: 'table', _captcha: 'false'
        })
      }).then(r => r.ok).catch(() => false);

      if (!noBanco && !noEmail) throw new Error('falhou');
      try { localStorage.setItem('msg_last', String(Date.now())); } catch (err) {}
      form.reset();
      setStatus(T.ok, 'ok');
      track('mensagem-enviada');
    } catch (err) {
      setStatus(T.fail, 'err');
    } finally {
      btn.disabled = false;
    }
  });
})();

// Painel de visitantes: manda para /api/visita, que é uma função da Vercel rodando no servidor.
// O navegador não envia IP, nome nem identificador: quem monta a sessão anônima é o servidor,
// com um hash que troca todo dia. Quem usa "Do Not Track" não é registrado.
// Detalhes e o que é guardado: docs/SUPABASE.md e a página de privacidade.
(function visitas() {
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl) return;

  const ROTA = location.pathname;
  const enviar = dados => {
    try {
      const corpo = JSON.stringify(dados);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/visita', new Blob([corpo], { type: 'application/json' }));
        return;
      }
      fetch('/api/visita', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: corpo
      }).catch(() => {});
    } catch (e) {}
  };

  // 1) A visita em si. A geolocalização vem dos cabeçalhos da Vercel, não daqui.
  const busca = new URLSearchParams(location.search);
  // A etiqueta do link (?ref=, utm_campaign ou utm_source) vale para a visita inteira, não só
  // para a primeira página: fica guardada enquanto a aba estiver aberta, então toda a jornada
  // é creditada ao lugar onde o link foi divulgado.
  let campanha = busca.get('ref') || busca.get('utm_campaign') || busca.get('utm_source') || null;
  try {
    if (campanha) sessionStorage.setItem('campanha', campanha);
    else campanha = sessionStorage.getItem('campanha');
  } catch (e) {}
  enviar({ caminho: ROTA, idioma: LANG, veio_de: document.referrer || null, campanha: campanha });

  // 2) Fila de eventos, enviada de uma vez só quando a pessoa sai da página
  const fila = [];
  const juntar = (evento, valor, numero) => {
    if (fila.length < 12) fila.push({ evento: evento, valor: valor || null, numero: numero });
  };
  // Clique vai na hora, porque a pessoa pode sair da página logo depois
  const jaVai = (evento, valor) => enviar({ evento: evento, valor: valor || null });

  // 3) Cliques: imagem, projeto, publicação, currículo e link de fora
  const nomeDaImagem = img => {
    const alt = (img.getAttribute('alt') || '').trim();
    if (alt) return alt.slice(0, 120);
    return (img.getAttribute('src') || '').split('/').pop().split('?')[0];
  };
  document.addEventListener('click', e => {
    const img = e.target.closest('img');
    if (img) jaVai('imagem', nomeDaImagem(img));

    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    let url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }

    if (url.origin !== location.origin) {
      jaVai('link', url.hostname.replace(/^www\./, ''));
      return;
    }
    if (/\/projetos\//.test(url.pathname)) jaVai('projeto', url.pathname);
    else if (/\/publicacoes\//.test(url.pathname)) jaVai('publicacao', url.pathname);
    else if (/\.(pdf|xlsx|docx|pptx|csv|zip)$/i.test(url.pathname)) {
      jaVai(/curriculo|resume|cv/i.test(url.pathname) ? 'curriculo' : 'link', url.pathname.split('/').pop());
    }
  }, true);

  // 4) Quanto tempo a pessoa passa em cada seção, para saber qual parte prende mais
  const tempos = new Map();
  const entrou = new Map();
  const titulo = sec => {
    const h = sec.querySelector('h1, h2, h3');
    const t = h ? h.textContent.trim() : '';
    return (t || sec.id || 'sem nome').replace(/\s+/g, ' ').slice(0, 100);
  };
  const secoes = Array.from(document.querySelectorAll('main section[id], main > section, article[id]')).slice(0, 20);
  if (secoes.length && 'IntersectionObserver' in window) {
    const olho = new IntersectionObserver(entradas => {
      entradas.forEach(en => {
        const nome = titulo(en.target);
        if (en.isIntersecting) {
          if (!entrou.has(nome)) entrou.set(nome, Date.now());
        } else if (entrou.has(nome)) {
          tempos.set(nome, (tempos.get(nome) || 0) + (Date.now() - entrou.get(nome)));
          entrou.delete(nome);
        }
      });
    }, {
      // Conta a seção que está na faixa central da tela. Usar porcentagem da seção não
      // funcionava: seção mais alta que a tela nunca chega a 40% visível e nunca contava.
      rootMargin: '-35% 0px -35% 0px',
      threshold: 0
    });
    secoes.forEach(s => olho.observe(s));
  }

  // 5) Até onde rolou
  let rolagemMax = 0;
  const medirRolagem = () => {
    const alturaUtil = document.documentElement.scrollHeight - window.innerHeight;
    const pct = alturaUtil > 0 ? Math.round(((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100) : 100;
    if (pct > rolagemMax) rolagemMax = Math.min(100, pct);
  };
  window.addEventListener('scroll', medirRolagem, { passive: true });
  medirRolagem();

  // 6) Na saída: tempo na página, rolagem e tempo das seções que ela realmente olhou
  const comeco = Date.now();
  let despachado = false;
  const despachar = () => {
    if (despachado) return;
    despachado = true;
    entrou.forEach((inicio, nome) => tempos.set(nome, (tempos.get(nome) || 0) + (Date.now() - inicio)));

    const segundos = Math.round((Date.now() - comeco) / 1000);
    if (segundos >= 2) juntar('tempo', ROTA, Math.min(segundos, 3600));
    if (rolagemMax > 0) juntar('rolagem', ROTA, rolagemMax);

    Array.from(tempos.entries())
      .map(([nome, ms]) => [nome, Math.round(ms / 1000)])
      .filter(([, s]) => s >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([nome, s]) => juntar('secao', nome, Math.min(s, 3600)));

    if (fila.length) enviar({ lote: fila });
  };
  window.addEventListener('pagehide', despachar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') despachar(); });
})();
