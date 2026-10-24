// Alexandre Wang | portfólio: comportamento compartilhado entre as páginas

const SITE_URL = 'https://alexandrewang.vercel.app';
const LANG = document.documentElement.lang.startsWith('en') ? 'en' : 'pt';

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

// QR code do portfólio
(function qr() {
  const img = document.getElementById('qrImg');
  if (!img) return;
  const params = new URLSearchParams({
    size: '300x300', data: SITE_URL, color: '0F1C2C', bgcolor: 'FFFFFF', margin: '0', qzone: '1', format: 'svg'
  });
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?' + params.toString();
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
        ['h', 'Sanofi | Demand Planning Analyst, IBP', '2026'],
        ['b', 'Dashboards Power BI de ODR/SLOB, riscos de supply e acuracidade de forecast por família e BU para os fóruns de IBP.'],
        ['b', 'Acompanhamento de MAPE, Bias e FVA (Lag 1 e Lag 3), comparando forecast estatístico e comercial.'],
        ['b', 'Modelo de qualificação de forecast em Power BI e DAX (Syntetos-Boylan, 8 critérios).'],
        ['b', 'Script Python que consolida as bases DR Analysis de cinco BUs; fluxos em Power Automate.'],
        ['h', 'Cia. Hering | Analista Sênior de Planejamento e Abastecimento', '2025 a 2026'],
        ['b', 'Boletins automáticos de ruptura para gerentes e coordenadores de lojas.'],
        ['b', 'KPIs de Ruptura, Giro e Cobertura padronizados com Power BI, SQL e VBA.'],
        ['h', 'Hypera Pharma (Brainfarma) | Analista de PCP', '2024 a 2025'],
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
        ['h', 'Sanofi | Demand Planning Analyst, IBP', '2026'],
        ['b', 'Power BI dashboards for ODR/SLOB, supply risks and forecast accuracy by family and BU for IBP forums.'],
        ['b', 'Tracking of MAPE, Bias and FVA (Lag 1 and Lag 3), comparing statistical and commercial forecasts.'],
        ['b', 'Forecast qualification model in Power BI and DAX (Syntetos-Boylan, 8 criteria).'],
        ['b', 'Python script that consolidates DR Analysis files from five BUs; Power Automate flows.'],
        ['h', 'Cia. Hering | Senior Planning and Replenishment Analyst', '2025 to 2026'],
        ['b', 'Automated stockout bulletins for store managers and coordinators.'],
        ['b', 'Standardized Stockout, Turnover and Coverage KPIs with Power BI, SQL and VBA.'],
        ['h', 'Hypera Pharma (Brainfarma) | Production Planning Analyst', '2024 to 2025'],
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

document.querySelectorAll('[data-cv]').forEach(btn => btn.addEventListener('click', e => {
  e.preventDefault();
  if (!window.jspdf) {
    alert(LANG === 'en' ? 'The PDF library is still loading. Please try again.' : 'A biblioteca de PDF ainda está carregando. Tente de novo.');
    return;
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
}));
