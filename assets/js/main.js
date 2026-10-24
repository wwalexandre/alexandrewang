// Alexandre Wang | portfólio: comportamento compartilhado entre as páginas

const SITE_URL = 'https://alexandrewang.vercel.app';
const LANG = document.documentElement.lang.startsWith('en') ? 'en' : 'pt';

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
document.querySelectorAll('video').forEach(v => v.addEventListener('play', () => {
  track('video-play', { video: (v.currentSrc || '').split('/').pop() });
}, { once: true }));

// Tema claro/escuro (respeita o sistema, guarda a escolha do visitante)
(function theme() {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('theme');
    if (saved) root.dataset.theme = saved;
  } catch (e) {}
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  });
})();

// Menu no celular
(function mobileMenu() {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }));
})();

// Animação de entrada
(function reveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
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

// Filtro de projetos
(function projectFilter() {
  const buttons = document.querySelectorAll('.filter');
  const cards = document.querySelectorAll('.proj');
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    const f = btn.dataset.filter;
    cards.forEach(card => {
      const cats = (card.dataset.cat || '').split(' ');
      card.hidden = !(f === 'all' || cats.includes(f));
    });
  }));
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
const WHATSAPP = '5511944021458';
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
  const waLink = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(t.msg);
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
