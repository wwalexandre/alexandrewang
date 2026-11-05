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
| `assets/` | CSS, JavaScript, imagens, prévias e vídeos |
| `vercel.json` | Cabeçalhos de segurança (CSP, anti-iframe, nosniff), cache e o redirecionamento por país (quem acessa de fora do Brasil vai para a versão em inglês) |
| `sitemap.xml`, `robots.txt`, `404.html` | Busca no Google e página de erro |

Os dashboards e relatórios de demonstração usam **dados fictícios**. Nenhum dado interno de empresa é publicado aqui.

## Idioma automático

Quem abre o site de fora do Brasil cai direto na versão em inglês. Quem faz isso é a própria Vercel, pelo cabeçalho `x-vercel-ip-country`, nas regras de `redirects` do `vercel.json`:

- vale para a página inicial e para cada projeto e publicação que tem versão `-en`;
- robôs (Google, LinkedIn, WhatsApp) não são redirecionados, então a busca e a prévia do link continuam em português;
- quem clica em PT ou EN no menu ganha o cookie `lang` e a Vercel para de redirecionar essa pessoa;
- na versão em inglês, quem tem o navegador em português recebe o convite "Prefere ler em português?".

Para testar, abra o site com uma VPN fora do Brasil numa janela anônima (sem o cookie `lang`).

## Estatísticas

O site já marca os cliques importantes para o [Umami](https://umami.is) (sem cookies). Para ligar, preencha `UMAMI_ID` no início de `assets/js/main.js`.

## Rodar localmente

```bash
python -m http.server 5500
```

Depois abra http://localhost:5500.

## Publicação

Site estático, sem build. Cada push na branch `main` publica na Vercel automaticamente. Branches diferentes de `main` geram um link de prévia na Vercel, bom para revisar antes de publicar.
