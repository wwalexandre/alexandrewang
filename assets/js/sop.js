// Página do S&OP mensal: filtro por etapa e visualizador dos slides em tela cheia.
// O visualizador anda só entre os slides visíveis no filtro e devolve o foco ao slide clicado.
(function sop() {
  const slides = [...document.querySelectorAll('.sop-slide')];
  if (!slides.length) return;
  const EN = document.documentElement.lang.startsWith('en');
  const T = EN
    ? { titulo: 'Slide viewer', anterior: 'Previous slide', proximo: 'Next slide', fechar: 'Close', de: 'of' }
    : { titulo: 'Visualizador de slides', anterior: 'Slide anterior', proximo: 'Próximo slide', fechar: 'Fechar', de: 'de' };

  // Filtro por etapa
  const botoes = document.querySelectorAll('.sop-filters .filter');
  botoes.forEach(b => b.addEventListener('click', () => {
    botoes.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    slides.forEach(s => { s.hidden = !(b.dataset.etapa === 'todos' || s.dataset.etapa === b.dataset.etapa); });
  }));

  // Visualizador
  const icone = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const dlg = document.createElement('dialog');
  dlg.className = 'sop-viewer';
  dlg.setAttribute('aria-label', T.titulo);
  dlg.innerHTML =
    '<img alt="" width="1600" height="900">' +
    '<div class="sop-viewer-bar">' +
      '<p class="sop-cap"></p><span class="sop-count" aria-live="polite"></span>' +
      `<button type="button" class="sop-prev" aria-label="${T.anterior}">${icone('M15 6l-6 6 6 6')}</button>` +
      `<button type="button" class="sop-next" aria-label="${T.proximo}">${icone('M9 6l6 6-6 6')}</button>` +
      `<button type="button" class="sop-close" aria-label="${T.fechar}">${icone('M6 6l12 12M18 6L6 18')}</button>` +
    '</div>';
  document.body.appendChild(dlg);

  const img = dlg.querySelector('img');
  const cap = dlg.querySelector('.sop-cap');
  const count = dlg.querySelector('.sop-count');
  let visiveis = [], atual = 0, origem = null;

  const mostrar = k => {
    atual = (k + visiveis.length) % visiveis.length;
    const s = visiveis[atual];
    const mini = s.querySelector('.sop-shot img');
    img.src = mini.currentSrc || mini.src;
    img.alt = mini.alt;
    cap.textContent = `${s.querySelector('.sop-num b').textContent}. ${s.querySelector('h3').textContent}`;
    count.textContent = `${atual + 1} ${T.de} ${visiveis.length}`;
  };
  const fechar = () => dlg.close();

  slides.forEach(s => s.querySelector('.sop-shot').addEventListener('click', e => {
    origem = e.currentTarget;
    visiveis = slides.filter(x => !x.hidden);
    mostrar(visiveis.indexOf(s));
    dlg.showModal();
    dlg.querySelector('.sop-close').focus();
  }));
  dlg.querySelector('.sop-prev').addEventListener('click', () => mostrar(atual - 1));
  dlg.querySelector('.sop-next').addEventListener('click', () => mostrar(atual + 1));
  dlg.querySelector('.sop-close').addEventListener('click', fechar);
  dlg.addEventListener('click', e => { if (e.target === dlg) fechar(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(atual - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrar(atual + 1); }
  });
  // Esc fecha pelo próprio <dialog>; em qualquer saída o foco volta ao slide que abriu
  dlg.addEventListener('close', () => { if (origem) origem.focus(); });
})();
