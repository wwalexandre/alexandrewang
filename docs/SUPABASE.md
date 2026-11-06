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

## Como mexer no banco daqui para frente

Mudança de banco vira uma **nova migração** em `supabase/migrations/` (nunca editar a antiga), aplicada no Supabase e commitada junto com o código que a usa. Mudança de código vai por branch, Pull Request e preview da Vercel, e só depois merge na `main`.

## Pendências

- ~~Criar o usuário admin e liberar em `admins`~~ feito em 06/11/2026 (alexandre01.w@gmail.com). Conferido: `is_admin()` dá true para ele e false para outro usuário logado.
- Testar no preview da Vercel: enviar uma mensagem real pelo formulário e conferir no `/admin/`.
- Decidir sobre ligar o Umami.
