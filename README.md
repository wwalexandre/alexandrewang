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
| `publicacoes/incoterms.html` | Artigo completo e vídeo sobre os 11 Incoterms 2020 |
| `assets/` | CSS, JavaScript, imagens, prévias e vídeo |

Os dashboards e relatórios de demonstração usam **dados fictícios**. Nenhum dado interno de empresa é publicado aqui.

## Rodar localmente

```bash
python -m http.server 5500
```

Depois abra http://localhost:5500.

## Publicação

Site estático, sem build. Cada push na branch `main` publica na Vercel automaticamente. Branches diferentes de `main` geram um link de prévia na Vercel, bom para revisar antes de publicar.
