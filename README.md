# alexandrewang.vercel.app

Portfólio de Alexandre Wang: Supply Chain Analytics e Automação (Demand Planning, IBP/S&OP, PCP).

Site no ar: https://alexandrewang.vercel.app

Este README serve para duas coisas: explicar o site e permitir que **qualquer pessoa ou IA** (Claude, ChatGPT, Gemini, Cursor, Antigravity, Codex) continue o trabalho sem precisar de explicação verbal. Se você é uma IA chegando agora, comece pela seção [Como retomar o trabalho](#como-retomar-o-trabalho-passo-a-passo).

---

## Sumário

1. [Estado atual (leia primeiro)](#estado-atual-leia-primeiro)
2. [Como retomar o trabalho, passo a passo](#como-retomar-o-trabalho-passo-a-passo)
3. [Onde mora o contexto](#onde-mora-o-contexto)
4. [Arquitetura em uma página](#arquitetura-em-uma-página)
5. [Mapa dos arquivos](#mapa-dos-arquivos)
6. [Passo a passo das tarefas comuns](#passo-a-passo-das-tarefas-comuns)
7. [Regras do projeto](#regras-do-projeto)
8. [Decisões tomadas e por quê](#decisões-tomadas-e-por-quê)
9. [Histórico](#histórico)
10. [Pendências](#pendências)

---

## Estado atual (leia primeiro)

Atualizado em 24/11/2026.

| Item | Situação |
|---|---|
| Site em produção | Vercel, publicado a partir da branch `main` |
| Acesso | Português só no estado de São Paulo; de fora, o `middleware.js` leva para a mesma página em inglês (chave no painel, em Visitantes, "Acesso e bloqueios"). Redes bloqueadas veem acesso indisponível. Painel, robôs de busca e de prévia de link sempre liberados |
| Segurança | Revisão de 24/11/2026 contra os 10 ataques mais comuns (tabela em `docs/SUPABASE.md`). Painel com verificação em duas etapas pronta para ativar; o banco passa a exigir o código assim que ela for ativada |
| Proteção do conteúdo | Texto não selecionável, cópia bloqueada, marca d'água e impressão desativada (`style.css` e `main.js`). Desencoraja, não impede |
| Banco em produção | Supabase (projeto `antgravity`), usado por contato, leads, visitas, avisos, textos editados e visibilidade dos cards |
| Migração para Cloudflare | **Decidida, feita na branch `cloudflare-d1`, ainda não publicada.** A branch está atrás da `main` e não tem as mudanças feitas a partir de 07/11/2026 (mapa da trajetória, edição ao vivo, novas publicações e painéis, revisão de segurança). Ver [Pendências](#pendências) |
| Estatísticas Umami | Código pronto, desligado (`UMAMI_ID` vazio em `assets/js/main.js`) |
| Branches abertas | Só `cloudflare-d1`. Todas as outras já foram incorporadas na `main` e servem apenas como registro |

Quando algo desta tabela mudar, atualize a tabela no mesmo commit.

---

## Como retomar o trabalho, passo a passo

Funciona igual para uma pessoa ou para qualquer IA. Siga na ordem.

### 1. Ler o contexto (10 minutos)

1. Este README inteiro, principalmente [Estado atual](#estado-atual-leia-primeiro), [Regras](#regras-do-projeto) e [Pendências](#pendências).
2. `docs/SUPABASE.md`: banco, segurança, painel de visitantes, avisos e detecção de cópia, com o porquê de cada escolha.
3. `docs/HISTORICO.md`: tudo o que foi feito, dia a dia, com o hash do commit.
4. O histórico do Git. As mensagens de commit explicam o motivo de cada mudança, não só o quê:

   ```bash
   git log --format='%n%ad %h %s%n%b' --date=short | less
   ```

   Para entender um arquivo específico: `git log --follow -p caminho/do/arquivo`.

5. Se tiver acesso ao segundo cérebro do Alexandre (ver [Onde mora o contexto](#onde-mora-o-contexto)), leia a pasta `07-Site` e o currículo-mestre antes de mexer em qualquer texto sobre carreira.

### 2. Preparar o ambiente

```bash
git clone https://github.com/wwalexandre/alexandrewang.git
cd alexandrewang
python -m http.server 5500
```

Abra http://localhost:5500. O site é HTML, CSS e JavaScript puros, sem build e sem `npm install`. As funções de `api/` só rodam na Vercel (ou com `vercel dev`).

### 3. Trabalhar

1. Crie uma branch a partir da `main`: `git checkout -b nome-curto-da-mudanca`.
2. Faça a mudança nas **duas línguas** (arquivo PT e arquivo `-en`).
3. Teste localmente no computador e no celular (DevTools, modo responsivo), nos temas claro e escuro.
4. Faça commit seguindo o [padrão de commit](#padrão-de-commit).
5. `git push -u origin nome-curto-da-mudanca`. A Vercel gera um link de prévia para essa branch.
6. Confira a prévia. Se estiver certo, abra o Pull Request e faça o merge na `main`. O merge publica o site.

### 4. Fechar

1. Se mudou o banco, criou página ou tomou decisão, atualize este README (tabela de estado, mapa de arquivos, decisões) e o doc correspondente em `docs/`.
2. Acrescente a linha do dia em `docs/HISTORICO.md`.

---

## Onde mora o contexto

O site é só uma parte. O contexto completo fica em três lugares:

| Lugar | O que tem | Quem consegue ler |
|---|---|---|
| Este repositório | Código, docs técnicos, histórico de commits | Qualquer um (é público) |
| Segundo cérebro (cofre do Obsidian em `D:\Segundo Cérebro`, no computador do Alexandre) | Carreira, currículo-mestre, conversas exportadas com IA, rascunhos de publicações e a pasta `07-Site` | Só no computador dele, ou quando ele compartilhar a pasta |
| Painéis Vercel, Supabase e Cloudflare | Configuração, variáveis secretas, usuários | Só o Alexandre logado |

Partes do site são **geradas fora do repositório**, na pasta `07-Site` do segundo cérebro:

| Gerador | Produz |
|---|---|
| `07-Site/ferramentas/validador-kit/gerar_kit.js` | Kit fictício do validador em `assets/docs/validador/` |
| `07-Site/ferramentas/sop-deck/` (`npm run gerar` e `exportar_slides.ps1`) | Modelo PPTX do S&OP e os prints em `assets/docs/sop/` |

Sem acesso a essa pasta, não regenere esses arquivos: edite só o que já está no repositório.

---

## Arquitetura em uma página

```
Visitante
   │
   ▼
Vercel ──── vercel.json: cabeçalhos de segurança, cache, redirecionamento por país, cron diário
   │
   ├── Páginas estáticas: index.html, en.html, projetos/, publicacoes/, admin/
   │
   ├── api/visita.js  ── grava visita e eventos (sem IP), dispara "aviso na hora", detecta cópia
   ├── api/ping.js    ── cron diário para o Supabase gratuito não pausar
   │
   ▼
Supabase (Postgres + RLS)
   ├── contato e leads (funções enviar_mensagem e registrar_lead, com limites)
   ├── visitas, eventos, avisos, cópias detectadas
   ├── textos_site (edição ao vivo) e visibilidade dos cards
   └── admins (quem entra no /admin/)

formsubmit.co ── e-mails de aviso (contato, download, interesse de empresa, cópia)
```

Na branch `cloudflare-d1`, Vercel e Supabase são trocados por um Worker do Cloudflare, banco D1 e login do `/admin/` pelo Cloudflare Access. Detalhes em `docs/CLOUDFLARE.md` daquela branch.

---

## Mapa dos arquivos

Toda página tem versão em português (`nome.html`) e em inglês (`nome-en.html`), exceto a home (`index.html` e `en.html`) e a privacidade (`privacidade.html` e `privacy.html`).

### Páginas

| Caminho | Conteúdo |
|---|---|
| `index.html`, `en.html` | Página principal: intro, Trajetória (tópicos, STAR, palavras-chave, imagens e mapa), Projetos, Publicações, Conquistas, Contato |
| `projetos/boletim-ruptura.html` | Dashboard de ruptura de lojas (réplica web de um Power BI), com lista de reposição e explicação de cada indicador |
| `projetos/validador-documentos.html` | Validador de documentos de importação no navegador (`assets/js/validador.js`): 12 checagens, relatório, e-mail para o fornecedor |
| `projetos/automacoes.html` | Seis fluxos de Power Automate (Sanofi, Hypera, Abbott) desenhados no formato do editor, com animação (`assets/js/automacoes.js`) |
| `projetos/sop-mensal.html` | S&OP mensal slide a slide (19 slides) com modelo PPTX em PT e EN liberado após o e-mail (`assets/js/sop.js`) |
| `projetos/cacador-vencimentos.html` | Caçador de Vencimentos: app no Lovable que simula consumo FEFO e perda por validade (app em cacador-de-vencimentos.lovable.app) |
| `projetos/painel-invoices.html` | Painel de invoices de importação com dados fictícios (`assets/js/invoices.js`) |
| `projetos/painel-fabrica.html` | Capacidade e cobertura de uma fábrica de confeitos (`assets/js/fabrica.js`) |
| `publicacoes/importacao-jogo.html` | Artigo e vídeo: o fluxo de importação aérea como jogo de tabuleiro |
| `publicacoes/forecast-erro.html` | Artigo e vídeo sobre erro de forecast (erro por família, FVA, Bias), com checklist em PDF |
| `publicacoes/incoterms.html` | Artigo e vídeo sobre os 11 Incoterms 2020, com simulador |
| `publicacoes/ponto-de-pedido.html` | Reposição de estoque (quanto pedir, quando, estoque de segurança), com simulador (`assets/js/reposicao.js`) |
| `publicacoes/cobertura-que-engana.html` | Cobertura de estoque: o mesmo estoque, duas leituras (`assets/js/cobertura.js`) |
| `publicacoes/mps-que-cabe-na-linha.html` | MPS e teto de ocupação da linha, com simulador (`assets/js/mps.js`) |
| `admin/index.html` | Painel privado: mensagens, leads, visitantes, cópias, aba Conteúdo (mostrar ou ocultar cards) e modo de edição ao vivo. Fora do Google |
| `privacidade.html`, `privacy.html` | O que é registrado nas visitas e o que não é |
| `404.html` | Página de erro |

### Código e configuração

| Caminho | Conteúdo |
|---|---|
| `assets/js/main.js` | Script do site inteiro. No topo: `SITE_URL`, `UMAMI_ID`, `SB_URL`, `SB_KEY` (chave publicável, pública por design) |
| `assets/js/mapa.js` | Mapa isométrico da trajetória (um prédio em SVG por empresa) |
| `assets/js/editar.js` | Modo de edição ao vivo (correções salvas em `textos_site`) |
| `assets/js/admin.js`, `assets/css/admin.css` | Painel `/admin/`. Ao criar página nova, acrescente o nome dela em `PAGINAS_NOME` |
| `assets/js/simulador.js`, `ruptura.js` | Simulador de Incoterms e boletim de ruptura |
| `assets/js/vendor/` | Bibliotecas hospedadas aqui (Chart.js, SheetJS, pdf.js, supabase-js) para a CSP não liberar terceiros |
| `assets/fonts/` | Barlow, Barlow Condensed e JetBrains Mono hospedadas no próprio site |
| `assets/img/`, `assets/video/`, `assets/docs/` | Imagens, vídeos com legendas `.vtt` e arquivos para download |
| `api/visita.js` | Função da Vercel que grava visitas, avisos e detecção de cópia |
| `api/ping.js` | Cron diário que mantém o Supabase ativo |
| `supabase/migrations/` | SQL do banco, fonte da verdade. Nunca edite uma migração antiga; crie outra. O projeto Supabase `antgravity` também guarda tabelas de outro projeto (PadariaTech: `produtos`, `vendas`, `itens_venda`, `registrar_venda`), que não pertencem a este site |
| `vercel.json` | CSP e cabeçalhos, cache, redirecionamento por país, cron |
| `sitemap.xml`, `robots.txt`, `.well-known/security.txt` | Busca, regras para robôs (inclusive de IA) e contato de segurança |
| `LICENSE` | Todos os direitos reservados (o código é público para leitura, não para cópia) |
| `docs/SUPABASE.md` | Banco, segurança, painel de visitantes, decisões |
| `docs/HISTORICO.md` | Histórico do projeto dia a dia |

Os dashboards e relatórios de demonstração usam **dados fictícios**. Nenhum dado interno de empresa é publicado aqui.

---

## Passo a passo das tarefas comuns

### Criar uma publicação nova

1. Copie uma publicação existente (por exemplo `publicacoes/ponto-de-pedido.html` e `-en.html`) com o nome novo.
2. Troque título, `description`, `canonical`, `hreflang`, Open Graph e o JSON-LD do `<head>`.
3. Escreva o texto nas duas línguas, na voz do Alexandre, em terceira pessoa quando for sobre ele.
4. Se tiver simulador, crie `assets/js/nome.js` e carregue só nessa página.
5. Acrescente o card na seção Publicações de `index.html` e `en.html`.
6. Acrescente as duas URLs em `sitemap.xml`.
7. Acrescente o caminho em `PAGINAS_NOME` de `assets/js/admin.js`.
8. Se tiver versão `-en`, confira se o redirecionamento por país do `vercel.json` cobre a página.

### Criar um projeto novo

Mesmos passos, em `projetos/`. Se for ligado a uma empresa da trajetória, marque a empresa para o filtro "Projetos ligados à trajetória" funcionar.

### Mexer no banco

1. Crie `supabase/migrations/AAAAMMDDHHMMSS_nome_curto.sql`.
2. Aplique no Supabase (SQL Editor ou CLI).
3. Faça commit da migração junto com o código que a usa.
4. Atualize `docs/SUPABASE.md`.

### Ligar um serviço externo (Umami, por exemplo)

1. Libere o domínio em `script-src` e `connect-src` da CSP em `vercel.json`.
2. Preencha a configuração no topo de `assets/js/main.js` (`UMAMI_ID`).
3. Atualize a página de privacidade nas duas línguas.

### Idioma automático

Quem abre de fora do Brasil vai para a versão em inglês, pelo cabeçalho `x-vercel-ip-country` nas regras de `redirects` do `vercel.json`. Robôs não são redirecionados. Quem clica em PT ou EN ganha o cookie `lang` e deixa de ser redirecionado. Para testar: VPN fora do Brasil, janela anônima.

---

## Regras do projeto

Valem para pessoas e IAs.

1. **Nada de segredo no repositório.** Ele é público. A chave do Supabase em `main.js` é a publicável; a proteção é o RLS. Nunca commite `service_role`, tokens ou `.env`.
2. **Dados sempre fictícios** em demos e painéis. Nenhum dado interno de Sanofi, MicroPort, Hypera, Abbott, Hering ou FUNED.
3. **Duas línguas sempre.** Mudou o PT, muda o EN no mesmo commit.
4. **Sem travessão longo (caractere U+2014) nos textos.** Use vírgula, ponto ou dois-pontos.
5. **Não descrever o Alexandre como farmacêutico.** Ele é formado em Farmácia, mas nunca atuou como farmacêutico.
6. **Sem terceiros na CSP** sem necessidade. Fontes e bibliotecas ficam em `assets/`.
7. **Texto de visitante sempre como texto** (`textContent`, nunca `innerHTML`).
8. **Nada de enfeite que não carrega informação** (decisão de 13/11/2026): animação ou ícone só se ajudar a entender.
9. **Branch, prévia e depois `main`.** Push direto na `main` publica na hora.

### Padrão de commit

- Título em português, no presente, dizendo o resultado: "Publicação sobre MPS que cabe na linha, com simulador".
- Corpo explicando **o porquê** e o que muda para quem visita. Esse corpo é o que permite a outra IA entender a história depois.
- Se uma IA ajudou, acrescente a linha `Co-Authored-By:` dela no fim.

---

## Decisões tomadas e por quê

| Data | Decisão | Motivo |
|---|---|---|
| 23/10/2026 | Site organizado em Trajetória, Projetos e Publicações | Recrutador acha rápido o que procura |
| 24/10/2026 | E-mail antes de baixar currículo e arquivos | Saber quem se interessou |
| 05/11/2026 | Inglês automático fora do Brasil | Vagas internacionais |
| 05/11/2026 | Supabase só para contato, leads e painel; projetos continuam estáticos | Banco para páginas pioraria o SEO e exigiria campos PT e EN |
| 05/11/2026 | Sem depoimentos públicos | Depoimento enviado por visitante pesa pouco para recrutador |
| 06/11/2026 | Visitas sem IP, sessão com hash que muda à meia-noite | Privacidade de verdade e página de privacidade honesta |
| 06/11/2026 | CEP fora do painel, Estados no lugar | Geolocalização por rede devolvia sempre o centro de SP |
| 06/11/2026 | Aviso por e-mail só para rede de empresa | Provedor doméstico viraria ruído diário |
| 07/11/2026 | Detectar cópia em vez de tentar impedir | Impossível impedir; dá para ter prova e data |
| 12/11/2026 | Migrar Vercel e Supabase para Cloudflare (Workers, D1, Access) | Concentrar tudo num lugar e trocar o login do admin pelo Access. Ainda não publicado |
| 13/11/2026 | Tirar enfeites sem informação | Visual mais sério, menos cara de template |
| 16/11/2026 | Currículos em três versões (supply chain, transformação digital e dados, automação) e versão para RH | Cada vaga lê uma coisa |
| 16/11/2026 | Fontes e Chart.js hospedados no site | CSP sem terceiros |
| 24/11/2026 | Duas etapas exigidas pelo banco (`is_admin()` com `aal2`), não só pela tela | Senha vazada sozinha não abre os dados, nem chamando a API direto |

---

## Histórico

Resumo por fase. O registro dia a dia, com hashes, está em [`docs/HISTORICO.md`](docs/HISTORICO.md).

| Fase | Período | O que aconteceu |
|---|---|---|
| 0. Primeira versão | 14/06/2026 | Site enviado por upload no GitHub |
| 1. Redesenho | 23 a 28/10/2026 | Visual novo, versão em inglês, seções Trajetória, Projetos e Publicações, e-mail antes do currículo, primeiras publicações em vídeo (forecast, Incoterms, importação), Caçador de Vencimentos, projetos em inglês, ajustes para tirar cara de template |
| 2. Projetos interativos | 29/10 a 04/11/2026 | Validador de documentos rodando no navegador, automações de Power Automate, S&OP mensal slide a slide, e-mail antes das demos, portfólio de produtos de Sanofi, FUNED, Hering |
| 3. Backend e dados | 05 a 08/11/2026 | Supabase (contato, leads, `/admin/`), painel de visitantes sem IP, aviso na hora para empresas, detecção de cópia e licença, revisão de SEO |
| 4. Migração (branch) | 12/11/2026 | Versão Cloudflare (Worker, D1, Access) na branch `cloudflare-d1`, não publicada |
| 5. Conteúdo e refinamento | 13 a 17/11/2026 | Trajetória com STAR, palavras-chave e mapa isométrico, edição ao vivo pelo painel, currículos por área, três publicações novas com simulador, painéis de invoices e de fábrica, revisão de segurança |
| 6. Documentação | 18/11/2026 | Este README reescrito para permitir retomar o trabalho com qualquer IA, criação do `docs/HISTORICO.md`, `AGENTS.md` e `CLAUDE.md`, e registro no repositório das migrações de `itens_site` e `textos_site`, que só existiam no Supabase |
| 7. Segurança e acesso | 22 a 24/11/2026 | Acesso em português só em SP, bloqueio de visitantes, painel visual e revisão contra os 10 ataques mais comuns, com verificação em duas etapas no painel |

---

## Pendências

Em ordem de prioridade.

1. **Decidir o destino da migração para Cloudflare.** A branch `cloudflare-d1` precisa receber tudo o que entrou na `main` depois de 07/11/2026, incluindo as tabelas novas (`textos_site`, `itens_site`, `clones`, `avisos`) e o endurecimento de funções, antes de publicar. Os passos manuais estão em `docs/CLOUDFLARE.md` daquela branch (login no wrangler, aplicar o D1, criar o aplicativo no Cloudflare Access, preencher `ACCESS_TEAM_DOMAIN` e `ACCESS_AUD`, deploy). Depois de publicar, atualizar este README, `SITE_URL`, canonical e sitemap se o domínio mudar.
2. Enviar uma mensagem real pelo formulário e conferir no `/admin/`.
3. Decidir sobre ligar o Umami.
4. Ativar a verificação em duas etapas no `/admin/` (botão "Ativar duas etapas", só depois do merge na `main`). Ligar a proteção contra senhas vazadas no Supabase (exige plano Pro). Ligar duas etapas também no GitHub e na Vercel.
5. Atualizar o SheetJS (`assets/js/vendor/xlsx.full.min.js`, versão 0.18.5, usado no validador) para 0.20.3, baixando de cdn.sheetjs.com. Risco baixo: só lê o arquivo que o próprio visitante escolhe.
