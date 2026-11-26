# Histórico do site

Registro dia a dia de tudo o que entrou no site, do mais antigo para o mais novo. Cada linha traz o hash do commit: para ver o motivo completo e o que mudou, rode `git show HASH`.

Ao terminar um trabalho, acrescente as linhas do dia no fim deste arquivo, no mesmo formato.

## Fase 0. Primeira versão

### 14/06/2026

- `a33e972` Add files via upload

## Fase 1. Redesenho

### 23/10/2026

- `2e458ce` Redesenha o portfólio e adiciona projetos e publicações
- `dfd3bc5` Versão em inglês no novo visual e imagem de compartilhamento
- `0402cf8` Reorganiza o site em Trajetória, Projetos e Publicações
- `3064b4b` Adiciona o GitHub nos contatos do site

### 24/10/2026

- `c0856a5` Pede o e-mail antes de baixar o currículo e oferece o WhatsApp
- `2441458` Publica o vídeo e o artigo sobre erro de forecast
- `012663e` Troca o vídeo de Incoterms pela versão narrada, com legendas
- `55e8909` Segurança, SEO, engajamento e simulador de Incoterms
- `3401c87` Publica o vídeo e o artigo "Importação, o jogo dos prazos"
- `7087fe4` Coloca o artigo de importação no padrão novo do site

### 26/10/2026

- `bbdadda` Publicações em inglês
- `4dd256b` Troca o vídeo do forecast pela versão com efeitos

### 27/10/2026

- `de2d25d` Adiciona o projeto Caçador de Vencimentos
- `a7edcce` Troca o vídeo de Incoterms por um Reel vertical refeito
- `0d24258` Tira os sinais de template do visual do site
- `6c4fb64` Junta os ajustes de design na main

### 28/10/2026

- `70c1820` Publicações na voz do Alexandre e WhatsApp sem número à mostra
- `7deed3d` Projetos em inglês com seletor PT/EN

## Fase 2. Projetos interativos

### 29/10/2026

- `9830ee6` Validador de documentos roda no navegador
- `4376d8d` Página de automações com Power Automate

### 03/11/2026

- `7254b53` Modelo de S&OP mensal (PPTX PT e EN) e prints dos slides
- `ffb1b72` Download de arquivo liberado pelo e-mail (mesma janela do currículo)
- `66f72e7` Página S&OP mensal slide a slide
- `e7f8b6e` S&OP page in English
- `4de5b6c` Slide do waterfall do forecast no S&OP (19 slides)
- `b5bf0e8` Card do S&OP na home, sitemap e prévia
- `fb1acbe` Correções da revisão: trânsito pelo pipeline, SLOB do estoque e lag 3 convergindo
- `45c5982` SLOB lote a lote: unidades, valor, provisão e estratégia por faixa
- `5cbf2ac` E-mail antes de usar as demonstrações (validador, boletim, automações e app)

### 04/11/2026

- `8270e8c` Produtos da Sanofi na trajetória, com fotos do Wikimedia Commons
- `ec725bb` Produtos da Sanofi: principais marcas de Established Products em fundo branco
- `9084b1b` Portfolio Sanofi: Specialty Care e Vacinas
- `48f08f3` Portfolio Sanofi: legendas por business unit
- `f0a1f5f` Portfolio Funed: BU de medicamentos sinteticos
- `72ba546` Portfolio Funed: sem BU, Entecavir como PDP com Farmanguinhos
- `ff6b4cc` Funed: volta a descricao completa do estagio (tres itens)
- `d3dcac9` Portfolio Hering: piramide de produto (basicos, sazonal, newness)

## Fase 3. Backend e dados

### 05/11/2026

- `c1f13ed` Ingles automatico fora do Brasil, Conquistas em carrossel e novas transicoes
- `c8ca41a` Intro mais tecnica e novo texto do projeto A3 (PT e EN)
- `d1dc88e` Contato e leads gravam no Supabase
- `d7f936a` Painel /admin para ler mensagens e leads
- `36b3b49` Docs e migracao do Supabase no repositorio

### 06/11/2026

- `3f100f5` Supabase: limites no servidor, aviso por e-mail e detalhe dos leads
- `8feb0f1` Docs: admin criado e liberado no Supabase
- `5bea5c7` Visitas: registro de acesso e jornada, com paginas de privacidade
- `f77bd41` Trajetoria: produtos da linha Epic da Abbott, com tamanhos
- `4555a85` Painel de visitantes: formato de tempo, sitemap e documentacao
- `6ef79b5` Visitas: localizacao aproximada, etiqueta de link e fuso de Brasilia
- `e1b2d15` Painel de visitantes diz o que falta em vez de ficar zerado
- `131207f` Visitas funcionam sem variavel de ambiente nenhuma
- `313cf9e` Corrige o tempo por secao, que nunca era registrado
- `cf4ce68` Validacao: barreira de origem e teste de saude mostrando o token
- `3d0cd35` Docs: validacao por token ligada e barreira de origem
- `77932a2` Painel: quem acessou mais, estados no lugar do CEP
- `7fbf367` Redesenha os graficos do painel de visitantes
- `7dc77af` Painel em portugues: traduz caminhos e junta a home
- `4722aba` Banco pronto para guardar o dono da rede, coleta ainda desligada
- `cdeed81` Painel mostra o dono da rede, com aviso de privacidade atualizado
- `2b4e405` Hero ganha cartao de indicadores com numeros que sobem
- `2077989` Revert "Hero ganha cartao de indicadores com numeros que sobem"
- `cbc9238` Trajetoria: a linha acompanha a leitura e os pontos acendem
- `4c3d095` Progresso de leitura nas paginas longas
- `99d36e4` Aviso na hora quando alguem de empresa se interessa

### 07/11/2026

- `18872b4` Bandeiras do Brasil e dos EUA no seletor de idioma
- `73cad00` Protecao contra copia: deteccao, regras para robos e licenca

### 08/11/2026

- `a14e591` Revisao de SEO: dados estruturados, hreflang x-default e head das paginas de privacidade

## Fase 4. Migração para Cloudflare (branch)

### 12/11/2026

- `ef0c922` Migra Supabase e Vercel para Cloudflare (Workers + D1 + Access) **[branch `cloudflare-d1`, não está na `main`]**

## Fase 5. Conteúdo e refinamento

### 13/11/2026

- `2f00953` Tira os enfeites que nao carregam informacao
- `1543cb9` Trajetoria com modo STAR e painel que oculta itens da home

### 16/11/2026

- `08df388` Faixa de produtos na Hypera, com as marcas de maior valor
- `2be883f` Projetos ligados a trajetoria: filtro por empresa
- `595652e` Edicao ao vivo, palavras-chave, curriculo por area e ping do banco
- `338d6f2` Mapa da trajetoria, boletim detalhado e curriculos impessoais
- `da83009` Publicacao sobre reposicao de estoque, com simulador
- `1f0cea0` Painel de invoices de importacao, com dados ficticios
- `9da303b` Publicacao sobre cobertura de estoque que engana
- `d6d000f` Publicacao sobre MPS que cabe na linha, com simulador
- `85589a7` Painel de capacidade e cobertura de uma fabrica de confeitos
- `43dbed5` Revisao de seguranca, mapa com letreiros e animacoes

### 17/11/2026

- `b54c2c4` Mapa com estados em marca d'agua e Abbott em vidro
- `02f671e` Mapa: FUNED como a sede real e letreiros legiveis no telhado

## Fase 6. Documentação

### 18/11/2026

- `7bffa82` README reescrito com passo a passo para retomar com qualquer IA, e este histórico
- `306f04a` Migrações de `itens_site` (13/11) e `textos_site` (16/11) copiadas do Supabase para `supabase/migrations/`

## Fase 7. Segurança e acesso

### 22/11/2026

- Site liberado só para o estado de São Paulo (`middleware.js`), com chave no painel para desligar
- Mesmo dia, ajuste: fora de SP o site não fecha mais, leva para a versão em inglês; Últimas jornadas no topo do painel
- Bloqueio de visitantes: `rede_id` (hash fixo do IP com o sal, IP não gravado), tabela `bloqueios`, botão Bloquear nas jornadas e Bloquear e-mail nos leads
- Tempo no site e rede em cada jornada do painel
- Texto não selecionável, cópia e atalhos bloqueados, marca d'água e impressão desativada
- Aba Visitantes virou painel visual: 4 cartões com tendência contra o período anterior e minilinha, jornadas com etiquetas coloridas, mapa de acessos (mundo, Brasil, SP) e cartão escuro de acesso e bloqueios. Nova função `resumo_painel` e contornos em `assets/js/admin-mapa.js`

### 24/11/2026

- Revisão de segurança contra os 10 ataques mais comuns (tabela em `docs/SUPABASE.md`)
- Verificação em duas etapas (TOTP) no `/admin/`, exigida também pelo banco via `is_admin()`
- `is_admin()` e `sessao_do_dia()` fechadas para visitante anônimo; escrita de `textos_site` e `itens_site` pela mesma regra do painel
- Teto diário nos avisos de cópia; `.gitignore` contra `.env` e chaves

### 25/11/2026

- Aba Pergunte (PT) e Ask (EN): assistente com IA (Google Gemini, plano gratuito) que responde sobre a trajetória, os projetos e o código do site
- Base de conhecimento gerada só com conteúdo público (`scripts/gerar_conhecimento.py`)
- Limite diário por rede no banco (`registrar_pergunta`) e seção nova na página de privacidade
- O assistente virou um balão flutuante em todas as páginas (`assets/js/balao.js`), com modelo reserva quando o Gemini está sobrecarregado
- O assistente deixou de explicar como o site foi construído: README do site fora da base, regra de recusa e sugestões de pergunta trocadas
