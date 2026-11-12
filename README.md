# alexandrewang.vercel.app

Portfólio de Alexandre Wang: Supply Chain Analytics e Automação (Demand Planning, IBP/S&OP, PCP).

Site no ar: https://alexandrewang.vercel.app

## O que tem aqui

| Caminho | Conteúdo |
|---|---|
| `index.html` | Página principal em português |
| `en.html` | Página principal em inglês |
| `projetos/boletim-ruptura.html` | Dashboard interativo de ruptura de lojas (réplica web de um projeto em Power BI) |
| `projetos/validador-documentos.html` | Validador de documentos de importação que roda no navegador (`assets/js/validador.js`), com kit fictício em `assets/docs/validador/` gerado por `07-Site/ferramentas/validador-kit/gerar_kit.js` |
| `projetos/automacoes.html` | Seis fluxos de Power Automate (Sanofi, Hypera, Abbott) desenhados no formato do editor, com animação de execução (`assets/js/automacoes.js`) |
| `projetos/sop-mensal.html` | S&OP mensal slide a slide: prints dos 19 slides com o que cada um precisa ter, filtro e visualizador (`assets/js/sop.js`), e o modelo PPTX em PT e EN em `assets/docs/sop/`, liberado depois do e-mail. O deck e os prints saem de `07-Site/ferramentas/sop-deck/` (`npm run gerar` e `exportar_slides.ps1`) |
| `projetos/cacador-vencimentos.html` | Caçador de Vencimentos: app feito no Lovable que simula o consumo FEFO lote a lote e mostra a perda projetada por validade (o app fica em cacador-de-vencimentos.lovable.app) |
| `publicacoes/importacao-jogo.html` | Artigo e vídeo "Importação, o jogo dos prazos": o fluxo de importação aérea como jogo de tabuleiro, com casos reais anonimizados |
| `publicacoes/forecast-erro.html` | Artigo completo e vídeo sobre erro de forecast: erro por família, FVA e Bias, com checklist em PDF |
| `publicacoes/incoterms.html` | Artigo completo e vídeo sobre os 11 Incoterms 2020 |
| `admin/index.html` | Painel privado (`/admin/`) para ler mensagens de contato, leads e visitas, protegido pelo Cloudflare Access. Fora do Google (`noindex` e `robots.txt`) |
| `src/` | Worker do Cloudflare: rotas `/api/*`, validação do Cloudflare Access, resumos do painel e redirecionamento por país |
| `migrations/` | SQL do banco D1, a fonte da verdade do esquema |
| `docs/CLOUDFLARE.md` | Contexto, decisões, segurança e passos manuais do Cloudflare neste site |
| `assets/` | CSS, JavaScript, imagens, prévias e vídeos |
| `wrangler.jsonc`, `_headers`, `_redirects` | Configuração do Worker, cabeçalhos de segurança (CSP, anti-iframe, nosniff), cache e redirecionamentos do WhatsApp |
| `sitemap.xml`, `robots.txt`, `404.html` | Busca no Google e página de erro |

Os dashboards e relatórios de demonstração usam **dados fictícios**. Nenhum dado interno de empresa é publicado aqui.

## Idioma automático

Quem abre o site de fora do Brasil cai direto na versão em inglês. Quem faz isso é o Worker, pelo país que o Cloudflare informa em `request.cf.country` (`src/worker.js`):

- vale para a página inicial e para cada projeto e publicação que tem versão `-en`;
- robôs (Google, LinkedIn, WhatsApp) não são redirecionados, então a busca e a prévia do link continuam em português;
- quem clica em PT ou EN no menu ganha o cookie `lang` e o Worker para de redirecionar essa pessoa;
- na versão em inglês, quem tem o navegador em português recebe o convite "Prefere ler em português?".

Para testar, abra o site com uma VPN fora do Brasil numa janela anônima (sem o cookie `lang`).

## Contato e leads (Cloudflare D1)

O formulário de contato e a cópia dos e-mails de quem baixa o currículo, os modelos ou usa as demos ficam no banco D1. O visitante só consegue enviar pelas rotas `/api/contato` e `/api/lead`, com limites no Worker; quem lê é o painel `/admin/`, que só abre depois do login do Cloudflare Access. Tudo explicado em [`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md), incluindo os passos manuais.

## Estatísticas

O site já marca os cliques importantes para o [Umami](https://umami.is) (sem cookies). Para ligar, preencha `UMAMI_ID` no início de `assets/js/main.js`.

## Rodar localmente

```bash
npm install
npm run db:aplicar:local
npm run dev
```

Depois abra http://localhost:8787. Para testar o painel local, crie `.dev.vars` com `DEV_ADMIN_EMAIL=seu@email` (só vale em localhost).

## Publicação

Worker com arquivos estáticos do Cloudflare. `npm run deploy` publica. Também dá para ligar o repositório no Cloudflare (Workers Builds) para publicar a cada push na `main`.
