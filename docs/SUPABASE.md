# Supabase neste site: contexto e decisões

Documento para quem for mexer no site depois (pessoa ou IA). Não contém nenhum segredo.

## Em uma frase

O site continua sendo HTML estático na Vercel. O Supabase entra só para **guardar mensagens de contato e leads** e para um **painel `/admin/`** onde o Alexandre lê tudo.

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Banco | Projeto Supabase `antgravity` (ref `apezjjrpvlglaawvhqoo`, região us-east-1) |
| Migrações SQL (fonte da verdade do banco) | `supabase/migrations/20261105194119_portfolio_contato_leads_admin.sql` e `supabase/migrations/20261106120000_limites_e_detalhe_dos_leads.sql` |
| Gravação de leads e formulário de contato | `assets/js/main.js` (`sbRpc`, `saveLead`, bloco `contactForm`) |
| Formulário de contato (HTML) | seção de contato de `index.html` (PT) e `en.html` (EN) |
| Painel admin | `admin/index.html`, `assets/js/admin.js`, `assets/css/admin.css` |
| SDK do Supabase (só usado no admin) | `assets/js/vendor/supabase-js.umd.js` (versão 2.119.0, hospedado aqui para manter `script-src 'self'`) |
| CSP e cabeçalhos | `vercel.json` (o Supabase foi liberado em `connect-src`; `/admin` recebe `noindex` e `no-store`) |

## Modelo de dados

- `mensagens_contato`: nome, e-mail, assunto (opcional), mensagem, idioma (`pt` ou `en`), `lida`, data.
- `leads`: e-mail, origem (`curriculo`, `arquivo` ou `demo`), detalhe (nome da demonstração ou do arquivo), idioma, data. Sem IP e sem user agent.
- `admins`: `user_id` de quem pode usar o painel. A função `is_admin()` consulta essa tabela.

## Segurança (o que protege os dados)

- A chave que aparece em `main.js` e `admin.js` é a **publicável**. Ela é pública por design. A proteção real é o **RLS** de todas as tabelas.
- Visitante anônimo **não insere direto nas tabelas**. Ele só chama duas funções, que validam e limitam no servidor:
  - `enviar_mensagem`: até 3 mensagens por e-mail por hora e 30 no total por hora. Acima disso devolve o erro `limite`.
  - `registrar_lead`: ignora repetição (mesmo e-mail, origem e detalhe em 24 h) e para de gravar acima de 500 leads por dia. Nunca devolve erro.
- Visitante não lê, não altera e não apaga nada.
- Só quem está em `admins` lê, atualiza e apaga. Usuário logado que não é admin vê zero linhas.
- **Nunca** coloque a chave secreta (`service_role`) no repositório. O repositório é público.
- O painel insere textos de visitantes com `textContent` (nunca `innerHTML`) e neutraliza fórmulas no CSV exportado.
- Anti-spam do formulário: campo oculto (honeypot), limites de tamanho no banco, intervalo de 60 s no navegador e os limites das funções acima. Isso reduz spam, mas não elimina. Evolução possível: Cloudflare Turnstile.
- Em 06/11/2026 foram testados com a chave publicável: insert direto em `leads` e `mensagens_contato` (401), leitura das duas tabelas (401), lead repetido (gravado uma vez só), e-mail inválido (ignorado), quarta mensagem do mesmo e-mail na hora (erro `limite`) e mensagem curta (recusada).
- Em 05/11/2026 foram testados 18 cenários de acesso direto no banco (anônimo, logado sem ser admin e admin) e todos se comportaram como esperado.

## Como o formulário e os leads funcionam

- Os formulários de currículo, modelos e demos continuam avisando por e-mail via formsubmit.co e agora **também** gravam uma cópia em `leads`. Se o Supabase falhar, o visitante não percebe e o download não é bloqueado.
- O formulário de contato grava pela função `enviar_mensagem` **e** manda um aviso por e-mail via formsubmit.co (com resposta direta para o visitante). Basta um dos dois funcionar para a mensagem não se perder. Se o banco devolver `limite`, nada é enviado e o visitante vê o aviso para esperar. Se os dois falharem, aparece o e-mail direto como alternativa.

## Passos manuais que não dão para automatizar

1. No painel do Supabase, em Authentication, desligar o cadastro público ("Allow new users to sign up").
2. Criar o usuário admin em Authentication, Users.
3. Liberar esse usuário no painel rodando no SQL Editor (trocando o e-mail):
   `insert into public.admins (user_id) select id from auth.users where email = 'SEU_EMAIL';`
4. Acessar `/admin/` no site e entrar com esse e-mail e senha.

## Decisões e o que ficou de fora

- **Sem tabela de eventos ou métricas.** O código já tem marcação de eventos para o Umami, mas o Umami ainda **não está ligado**: `UMAMI_ID` está vazio no início de `assets/js/main.js`. Para ligar, criar o site no Umami e preencher o ID.
- **Projetos continuam estáticos.** Estão em páginas bilíngues, indexáveis e rápidas. Movê-los para o banco exigiria campos PT e EN e pioraria o SEO.
- **Sem depoimentos públicos.** Depoimento enviado por qualquer visitante pesa pouco para recrutadores. Se quiser prova social, cadastrar trechos reais de recomendações (com permissão) numa fase futura.
- **Sem variáveis de ambiente na Vercel.** O site não tem build, então o HTML não lê variáveis. URL e chave publicável ficam no código.
- **Aviso conhecido do verificador do Supabase:** `is_admin()` é `SECURITY DEFINER` e pode ser chamada por RPC. Ela só devolve true ou false sobre quem chama. Se quiser zerar o aviso, mover a função para um schema interno e recriar as políticas.
- **Plano gratuito do Supabase** pode pausar projetos sem atividade por um período. Se pausar, o formulário de contato e os leads deixam de gravar até reativar no painel.

## Painel de visitantes

O site registra as visitas pela função `api/visita.js`, que roda **no servidor da Vercel**. Isso é o que o GitHub Pages sozinho não faria: a Vercel entrega país, região, cidade e fuso nos cabeçalhos da requisição, e o código do servidor guarda o segredo que libera a gravação. O navegador não manda IP, não manda identificador e não consegue forjar visita.

| Peça | Onde |
|---|---|
| Função que grava | `api/visita.js` |
| Coleta no navegador | bloco `visitas()` no fim de `assets/js/main.js` |
| Tabelas e resumo | as migrações `20261106140000_visitas_e_jornada.sql`, `20261106150000_visitas_secoes_e_imagens.sql`, `20261106170000_local_aproximado.sql` e `20261106190000_visitas_sem_configuracao.sql` |
| Aba do painel | `admin/index.html` (`panelVis`), `assets/js/admin.js`, `assets/css/admin.css` |
| Página pública de privacidade | `privacidade.html` e `privacy.html` |

### Como a sessão anônima funciona

A função da Vercel monta `sha256(IP + navegador)` e manda só isso. O banco junta o sal secreto e a data do dia e guarda 32 caracteres. O IP **não** é gravado em lugar nenhum e nem sai da função. Como a data entra na conta, o código muda à meia-noite, então não dá para ligar a visita de hoje com a de amanhã nem voltar do hash para o IP. É por isso que o painel conta "pessoas diferentes" por dia, e não ao longo do mês.

### O que é registrado

- `visitas`: caminho, idioma, país, região, cidade, fuso, aparelho, sistema, navegador, site de origem, campanha e localização aproximada (CEP, latitude e longitude).
- `eventos_visita`: `secao` (segundos por seção), `imagem` (clique, pelo texto alternativo), `tempo` e `rolagem` por página, mais `projeto`, `publicacao`, `curriculo`, `demo`, `video` e `link`.

Nada de sensor, toque, canvas ou impressão digital de aparelho, e nenhum cookie. Quem tem Do Not Track ou Global Privacy Control ligado não é registrado, e isso é checado nos dois lados, navegador e servidor.

### Etiqueta de link (campanha)

A campanha vem de `?ref=`, `utm_campaign` ou `utm_source`, nessa ordem de prioridade, e fica guardada em `sessionStorage` enquanto a aba estiver aberta. Por isso **a visita inteira é creditada ao lugar onde o link foi divulgado**, e não só a primeira página. O painel tem um gerador que monta o link e transforma o texto em etiqueta limpa, por exemplo `Grupo Supply WhatsApp` vira `grupo-supply-wpp`.

Esse é o jeito confiável de segmentar o público, porque não depende de adivinhar nada pelo endereço de rede.

### Localização aproximada: o que ela não é

As colunas `cep`, `latitude` e `longitude` guardam o palpite do provedor de geolocalização da Vercel. **Não é o endereço do visitante.** Na prática o valor cai no centro da cidade ou no endereço registrado da operadora, e em celular aponta o ponto de saída da rede, que pode ficar em outra cidade. Serve para separar acesso de rede corporativa e para agrupar por região. Não serve para dizer o bairro de ninguém, e é por isso que o painel chama o bloco de "localização aproximada".

### Fuso horário

Tudo é gravado em UTC e convertido para `America/Sao_Paulo` na função `resumo_visitas`. As jornadas e a virada do dia no gráfico seguem o horário de Brasília, e o painel diz isso na tela.

### Não precisa de configuração

O registro funciona sem nenhuma variável de ambiente, de propósito: depender de um passo manual para a coisa funcionar já deixou o painel zerado por um dia inteiro.

- O **sal secreto** mora na coluna `sal` de `public.ingestao_config`, tabela sem nenhuma permissão para `anon` e `authenticated`. Só funções `security definer` leem.
- A função `api/visita.js` manda uma **impressão** (sha256 de IP mais navegador, sem segredo). O **IP não chega ao banco**, o que é melhor do que a versão anterior, em que o hash era montado na Vercel.
- `public.sessao_do_dia()` junta impressão, sal e a data em São Paulo, e devolve os 32 caracteres que viram a sessão. Muda à meia-noite, não é reversível.

### Token, se um dia quiser fechar

A coluna `token` de `ingestao_config` começa `NULL`, e com ela nula **qualquer chamada válida grava**. O risco disso é alguém descobrir o endereço e injetar visita falsa, o que num portfólio pessoal é um risco de papel, contido pelos tetos diários (20 mil visitas, 60 mil eventos) e pela validação do caminho.

Para fechar, dois passos que andam juntos:

1. `update public.ingestao_config set token = 'uma-string-aleatoria' where id = 1;`
2. Criar `VISITAS_TOKEN` na Vercel com a mesma string, em Production e Preview, e dar Redeploy.

Se preencher um sem o outro, a gravação para e o painel avisa, porque o teste de saúde passa a falhar.

### Teste de saúde

`GET /api/visita` chama a própria função de gravação com a impressão vazia, que o banco descarta sem inserir nada, e responde `{"configurado":true}` quando rede, função e token estão de pé. O painel usa isso para avisar quando algo está errado, em vez de mostrar caixas vazias.

### Limites e custo

A função é chamada uma vez quando a página abre e, no máximo, mais uma vez quando a pessoa sai (os eventos vão num lote só). O banco recusa acima de 20 mil visitas e 60 mil eventos por dia. Visitas com mais de 12 meses são apagadas pela função `limpar_visitas_antigas()`.

## Como mexer no banco daqui para frente

Mudança de banco vira uma **nova migração** em `supabase/migrations/` (nunca editar a antiga), aplicada no Supabase e commitada junto com o código que a usa. Mudança de código vai por branch, Pull Request e preview da Vercel, e só depois merge na `main`.

## Pendências

- ~~Criar o usuário admin e liberar em `admins`~~ feito em 06/11/2026 (alexandre01.w@gmail.com). Conferido: `is_admin()` dá true para ele e false para outro usuário logado.
- Testar no preview da Vercel: enviar uma mensagem real pelo formulário e conferir no `/admin/`.
- Decidir sobre ligar o Umami.
