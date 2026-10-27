# alexandrewang.vercel.app

Portfólio de Alexandre Wang: Supply Chain Analytics e Automação (Demand Planning, IBP/S&OP, PCP).

Site no ar: https://alexandrewang.vercel.app

## O que tem aqui

| Caminho | Conteúdo |
|---|---|
| `index.html` | Página principal em português |
| `en.html` | Página principal em inglês |
| `projetos/boletim-ruptura.html` | Dashboard interativo de ruptura de lojas (réplica web de um projeto em Power BI) |
| `projetos/validador-documentos.html` | Caso do validador de documentos de importação com Python e OCR |
| `projetos/cacador-vencimentos.html` | Caçador de Vencimentos: app feito no Lovable que simula o consumo FEFO lote a lote e mostra a perda projetada por validade (o app fica em cacador-de-vencimentos.lovable.app) |
| `publicacoes/importacao-jogo.html` | Artigo e vídeo "Importação, o jogo dos prazos": o fluxo de importação aérea como jogo de tabuleiro, com casos reais anonimizados |
| `publicacoes/forecast-erro.html` | Artigo completo e vídeo sobre erro de forecast: erro por família, FVA e Bias, com checklist em PDF |
| `publicacoes/incoterms.html` | Artigo completo e vídeo sobre os 11 Incoterms 2020 |
| `assets/` | CSS, JavaScript, imagens, prévias e vídeos |
| `vercel.json` | Cabeçalhos de segurança (CSP, anti-iframe, nosniff) e cache |
| `sitemap.xml`, `robots.txt`, `404.html` | Busca no Google e página de erro |

Os dashboards e relatórios de demonstração usam **dados fictícios**. Nenhum dado interno de empresa é publicado aqui.

## Estatísticas

O site já marca os cliques importantes para o [Umami](https://umami.is) (sem cookies). Para ligar, preencha `UMAMI_ID` no início de `assets/js/main.js`.

## Rodar localmente

```bash
python -m http.server 5500
```

Depois abra http://localhost:5500.

## Publicação

Site estático, sem build. Cada push na branch `main` publica na Vercel automaticamente. Branches diferentes de `main` geram um link de prévia na Vercel, bom para revisar antes de publicar.
