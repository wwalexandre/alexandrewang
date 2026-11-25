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
- **Aviso conhecido do verificador do Supabase:** funções `SECURITY DEFINER` chamáveis por RPC. É de propósito: as de registro (`registrar_visita`, `registrar_evento_visita`, `preparar_aviso`, `registrar_clone`) exigem o token, as de formulário (`enviar_mensagem`, `registrar_lead`) têm limites, `checar_acesso` só devolve `bloqueado` e `so_sp`, e as do painel exigem `is_admin()` por dentro. Desde 24/11/2026, `is_admin()` só é chamável por usuário logado e `sessao_do_dia()` por ninguém de fora.
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

### Por que o CEP saiu do painel

As colunas `cep`, `latitude` e `longitude` continuam sendo gravadas, mas **saíram da tela**. O motivo é empírico: nas primeiras visitas reais, as 7 vieram com o mesmo `01000-000`, que é o centro de São Paulo, e nenhuma delas foi do centro. O provedor devolve o centro da cidade ou o endereço registrado da operadora, e em celular aponta o ponto de saída da rede. Indicador que vem sempre igual e errado é pior que indicador nenhum, porque dá confiança falsa.

No lugar dele entrou **Estados**, que usa a coluna `regiao` e a geolocalização por rede acerta. Para melhorar de verdade só com serviço pago de geolocalização, que no Brasil continua ruim para rede doméstica e celular, ou pedindo permissão de localização ao visitante, o que num portfólio é tiro no pé.

### Tradução dos caminhos no painel

O painel mostrava `/publicacoes/importacao-jogo-en.html`, que não diz nada para quem lê. O dicionário `PAGINAS_NOME` em `assets/js/admin.js` traduz cada caminho para o título real da página, e `ACOES_NOME` traduz os eventos ("Abriu o artigo", "Baixou o currículo"). **Ao criar uma página nova, acrescente a linha nesse dicionário**, senão ela aparece com o nome do arquivo.

No topo da aba há uma frase em português montada pela função `frase()`, do tipo "Nos últimos 30 dias, 2 pessoas abriram 7 páginas. A maior parte de São Paulo, vindo do LinkedIn, pelo computador." Ela existe para o painel ser entendido sem precisar ler gráfico.

`/` e `/index.html` eram contados como páginas diferentes e dividiam a home ao meio. A função `caminho_canonico()` normaliza isso na gravação, e a migração corrigiu o histórico.

### Quem acessou mais, e como bloquear

A função `resumo_extra()` devolve `estados` e `mais_acessos`. O segundo agrupa pelo identificador anônimo do dia, que é por IP mais navegador dentro do mesmo dia, então uma linha com número alto é na prática um acesso só pesando muito. Linha com 30 páginas ou mais em até 10 minutos aparece em vermelho, que é o padrão de robô raspando o site.

**O bloqueio não acontece aqui.** Quem bloqueia é o Firewall da Vercel, em Project Settings e depois Firewall, que vê o endereço de rede na borda e corta antes de chegar ao site. Pela linha de comando é `vercel firewall ip-blocks block <ip>`. Assim o IP nunca precisa entrar neste banco, e a promessa da página de privacidade continua verdadeira.

### Fuso horário

Tudo é gravado em UTC e convertido para `America/Sao_Paulo` na função `resumo_visitas`. As jornadas e a virada do dia no gráfico seguem o horário de Brasília, e o painel diz isso na tela.

### Não precisa de configuração

O registro funciona sem nenhuma variável de ambiente, de propósito: depender de um passo manual para a coisa funcionar já deixou o painel zerado por um dia inteiro.

- O **sal secreto** mora na coluna `sal` de `public.ingestao_config`, tabela sem nenhuma permissão para `anon` e `authenticated`. Só funções `security definer` leem.
- A função `api/visita.js` manda uma **impressão** (sha256 de IP mais navegador, sem segredo). O **IP não chega ao banco**, o que é melhor do que a versão anterior, em que o hash era montado na Vercel.
- `public.sessao_do_dia()` junta impressão, sal e a data em São Paulo, e devolve os 32 caracteres que viram a sessão. Muda à meia-noite, não é reversível.

### Token: ligado em 06/11/2026

A validação por token **está ativa**. A coluna `token` de `public.ingestao_config` tem o mesmo valor da variável `VISITAS_TOKEN` na Vercel (Production e Preview). Sem esse par batendo, a gravação não acontece.

Conferido no dia em que foi ligado: chamada direta ao `registrar_visita` sem token e com token errado voltaram `400` com a mensagem `token`, e a visita pelo site continuou gravando normalmente, com seção, tempo e rolagem.

**Os dois lados andam juntos.** Mudar um sem o outro para a gravação:

1. Banco: `update public.ingestao_config set token = 'novo-valor' where id = 1;`
2. Vercel: `VISITAS_TOKEN` com o mesmo valor, em Production e Preview, e Redeploy.

Para desligar a validação, basta `set token = null` no banco. Aí a variável na Vercel passa a ser ignorada e tudo volta a funcionar sem configuração.

### Barreira de origem

Independente do token, a função descarta chamada cujo cabeçalho `Origin` aponte para outro domínio. Não substitui o token, porque fora do navegador dá para forjar o cabeçalho, mas não custa nada e não precisa de configuração.

### Aviso na hora

Quando alguém de **rede de empresa** faz algo que mostra interesse, o Alexandre recebe um e-mail no mesmo minuto. É o caso que antes não gerava aviso nenhum: a pessoa lê, abre um projeto e vai embora sem deixar contato.

| Peça | Papel |
|---|---|
| `GATILHOS` em `api/visita.js` | currículo, demonstração, contato e projeto; mais tempo de 90 segundos ou mais |
| `public.preparar_aviso()` | decide se vale, e no mesmo passo reserva a vaga da sessão |
| `public.avisos` | uma linha por sessão avisada, com a sessão como chave primária |

**Não dispara** para provedor doméstico nem para datacenter, senão viraria ruído diário. Teto de 10 avisos por dia e um por sessão: como a sessão é chave primária, dois eventos simultâneos disputam a mesma linha e só um ganha.

O e-mail sai pelo mesmo FormSubmit já usado no resto do site, com rede, cidade, páginas abertas, tempo somado, o que a pessoa fez e de onde veio. Se o envio falhar, a visita é gravada do mesmo jeito.

Testado em 06/11/2026 com o envio interceptado: evento fraco não avisou, evento forte avisou com o contexto completo, e o segundo evento forte da mesma sessão não repetiu.

### Detecção de cópia

Não dá para impedir que copiem um site: todo HTML que chega ao navegador pode ser salvo. O que dá é **saber quando aconteceu e ter prova**.

O código copiado continua chamando `/api/visita` deste domínio. Quando a chamada vem de outro endereço, o navegador manda o cabeçalho `Origin` com o domínio de quem copiou. Antes essa chamada era descartada em silêncio; agora ela é o sinal.

| Caminho de detecção | Pega o quê |
|---|---|
| `Origin` diferente em `/api/visita` | cópia que manteve o JavaScript e o endereço relativo |
| Bloco `marcaDeCopia` em `assets/js/main.js` | compara `location.hostname` e avisa pelo endereço absoluto |

O e-mail sai **só na primeira vez** que cada domínio aparece, e no máximo 5 por dia (desde 24/11/2026; no máximo 20 domínios novos gravados por dia). Assim, um `Origin` forjado em série não vira enxurrada de e-mails nem enche a tabela. Depois o contador sobe e a data da última vez é atualizada. Domínios `*.vercel.app` e `localhost` nunca contam como cópia.

O painel mostra o bloco **Cópias do site** só quando existe alguma, com domínio, página, quantas vezes, primeira e última.

**O que isso não faz:** não bloqueia. Para tirar do ar é preciso notificar o provedor do clone, e aí a licença e a data da primeira detecção são a prova.

### Teste de saúde

`GET /api/visita` chama a própria função de gravação com a impressão vazia, que o banco descarta sem inserir nada, e responde `{"configurado":true,"token":true}` quando rede, função e token estão de pé. O campo `token` diz apenas SE a variável existe na Vercel, nunca o valor, e serve para ligar a validação na ordem certa. O painel usa isso para avisar quando algo está errado, em vez de mostrar caixas vazias.

### Limites e custo

A função é chamada uma vez quando a página abre e, no máximo, mais uma vez quando a pessoa sai (os eventos vão num lote só). O banco recusa acima de 20 mil visitas e 60 mil eventos por dia. Visitas com mais de 12 meses são apagadas pela função `limpar_visitas_antigas()`.

## Como mexer no banco daqui para frente

Mudança de banco vira uma **nova migração** em `supabase/migrations/` (nunca editar a antiga), aplicada no Supabase e commitada junto com o código que a usa. Mudança de código vai por branch, Pull Request e preview da Vercel, e só depois merge na `main`.

## Pendências

- ~~Criar o usuário admin e liberar em `admins`~~ feito em 06/11/2026 (alexandre01.w@gmail.com). Conferido: `is_admin()` dá true para ele e false para outro usuário logado.
- Testar no preview da Vercel: enviar uma mensagem real pelo formulário e conferir no `/admin/`.
- Decidir sobre ligar o Umami.

## Revisão de segurança de 2026-11-16

- `limpar_visitas_antigas()` deixou de ser chamável pela API: ela apaga dados e não checa quem chama. Rode-a só pelo SQL editor do Supabase (ou como `postgres`).
- `resumo_visitas`, `resumo_extra` e `registrar_venda` só são chamáveis por usuário logado. As duas primeiras já exigiam `is_admin()` por dentro.
- A tabela `mensagens_contato` tem limite de tamanho (nome 120, e-mail 160, assunto 200, mensagem 5.000 caracteres), além do limite de envios por hora que a função `enviar_mensagem` já aplicava.
- O Content-Security-Policy do `vercel.json` não libera mais nenhum terceiro: as fontes (`assets/fonts`) e o Chart.js (`assets/js/vendor`) são hospedados no próprio site. Para ligar o Umami ou outro serviço externo, é preciso liberar o domínio em `script-src` e `connect-src`.
- Pendências que só o dono da conta resolve no painel do Supabase: ligar a proteção contra senhas vazadas (Auth, exige plano Pro) e ativar a verificação em duas etapas (TOTP) para o usuário admin. A segunda ganhou botão no painel em 24/11/2026 (ver abaixo).

## Bloqueio e acesso só SP (22/11/2026)

Migração `20261122120000_bloqueio_e_acesso_sp.sql`.

- `ingestao_config.so_sp`: liga a regra "português só no estado de SP" (fora de SP, o middleware redireciona cada página em português para o par `-en`, `en.html` ou `privacy.html`, e deixa o cookie `so_en` para o site esconder o botão PT). Lida pelo `middleware.js` da raiz via `checar_acesso(p_ip)`, que devolve só `bloqueado` e `so_sp`. Painel troca com `definir_so_sp` (admin).
- `visitas.rede_id`: hash fixo de `'rede|' || ip || sal`, feito por `rede_do_ip` (não chamável pela API). Diferente da sessão, não muda à meia-noite; existe só para bloquear. O IP continua sem ser gravado. `registrar_visita` ganhou o argumento `p_ip`.
- `bloqueios` (RLS só admin): por `rede_id` (via `bloquear_sessao`) ou por `email` (via `bloquear_email`). `registrar_lead` ignora e-mail bloqueado. Desbloquear é apagar a linha pelo painel.
- `resumo_visitas`: cada jornada traz `sessao`, `rede`, `segundos` (soma dos eventos `tempo`), `bloqueavel` e `bloqueado`; o resumo traz também `bloqueios` e `so_sp`.
- O middleware guarda a resposta por IP por 5 minutos e deixa passar se o banco falhar ou demorar mais de 0,8 s.

## Painel visual (22/11/2026)

Migração `20261122150000_painel_visual.sql`. `resumo_painel(p_dias)` (só admin) devolve `periodos.atual` e `periodos.anterior` (visitas, sessoes, tempo_medio, leads, fora_sp) para a tendência dos cartões, as séries `tempo_dia`, `leads_dia` e `fora_dia` para as minilinhas e `pontos` (latitude e longitude arredondadas a 0,1 grau, cidade, país, região, páginas e pessoas) para o mapa.

## Revisão de segurança de 24/11/2026

Migração `20261124120000_seguranca_duas_etapas_e_funcoes_internas.sql`.

- **Verificação em duas etapas (TOTP) no painel.** Botão "Ativar duas etapas" no topo do `/admin/`: mostra o QR code, pede o primeiro código e só então ativa. Depois disso, o login pede a senha e o código do app.
- **O banco exige o código, não só a tela.** `is_admin()` devolve true só se a sessão for `aal2` ou se o admin ainda não tiver fator verificado. Com o app ativado, quem descobrir a senha passa do login mas não lê nem altera nada. Enquanto ninguém ativar, nada muda.
- Escrita em `textos_site` e `itens_site` passou a usar `is_admin()`, para valer a mesma regra. A edição ao vivo (`editar.js`) confere o acesso pela mesma função.
- `is_admin()` não é mais chamável por visitante anônimo (só por usuário logado, porque as políticas precisam dela). `sessao_do_dia()` não é chamável por ninguém de fora; só as funções de registro usam.
- `registrar_clone`: teto diário (5 e-mails e 20 domínios novos por dia).
- `.gitignore` novo bloqueia `.env`, chaves e a pasta `.vercel`.

Testado com a chave publicável depois da migração: `sessao_do_dia` e `is_admin` (permissão negada), `registrar_clone` com token errado (erro `token`), leitura de `leads` (permissão negada), insert em `admins` (permissão negada), leitura pública de `itens_site` e `textos_site` (200) e `checar_acesso` (funciona). No banco: admin sem fator continua admin, outro usuário com `aal2` não é admin, e 25 domínios falsos geraram 20 gravados e 5 avisos (teste desfeito em seguida).

**Ordem para ativar:** só depois que esta mudança estiver na `main`. Se ativar pela prévia, o painel publicado (versão antiga, sem a tela do código) deixa de abrir os dados até o merge.

**Se perder o celular:** no painel do Supabase, Authentication, Users, abrir o usuário e apagar o fator (ou, no SQL editor, `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'SEU_EMAIL');`). Depois ativar de novo pelo painel.

### Os 10 ataques comuns e como o site responde

| Ataque | Situação |
|---|---|
| Trocar o ID na URL para ver dado de outro | Protegido. Páginas são estáticas; dados só saem pelo RLS, que filtra por `is_admin()` ou pelo dono (`auth.uid()`) |
| Achar a chave de API no navegador | Só a chave publicável aparece, e ela é pública por design. Nenhuma chave secreta no código nem no histórico do Git |
| Mudar o preço (Pix pago 100 vezes) | Não existe pagamento no site. A função `registrar_venda` (demo) pega o preço da tabela no servidor, não do navegador |
| Liberar o prêmio sem pagar | Não se aplica: não há compra nem área paga |
| Virar admin no cadastro | Cadastro público desligado; `admins` não aceita insert de ninguém pela API |
| Adivinhar a senha do login | Limite de tentativas do Supabase e, a partir de agora, código do app (duas etapas). Falta ligar a proteção contra senhas vazadas (plano Pro) |
| Mandar a IA ignorar as instruções | Não há IA no site. Cuidado ao pedir para uma IA ler mensagens do formulário: trate o texto como dado |
| Script no nome de usuário (XSS) | Protegido. Texto de visitante sempre com `textContent` e CSP sem scripts de fora nem `unsafe-inline` |
| Senhas no GitHub | Nenhuma encontrada no código nem no histórico. `.gitignore` bloqueia `.env` e chaves |
| Banco aberto sem proteção | RLS em todas as tabelas, sem bucket de arquivos e funções internas fechadas |
