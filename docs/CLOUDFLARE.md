# Cloudflare neste site

Tudo que antes era Supabase e Vercel roda agora no Cloudflare.

## Peças

- **Worker** (`src/worker.js`): serve os arquivos estáticos, recebe `/api/contato`, `/api/lead`, `/api/visita` e `/api/admin/*`, e faz o redirecionamento por país.
- **D1** (`migrations/0001_inicial.sql`): tabelas `mensagens_contato`, `leads`, `visitas`, `eventos_visita`, `avisos` e `config`.
- **Cloudflare Access**: protege `/admin/*` e `/api/admin/*`. O Worker confere o JWT (`Cf-Access-Jwt-Assertion`) e responde 503 se `ACCESS_TEAM_DOMAIN` ou `ACCESS_AUD` estiverem vazios.

## Limites no lugar do RLS

Contato: 3 mensagens por e-mail por hora e 30 por hora no total. Leads: sem repetição em 24 h e 500 por dia. Visitas: 20000 por dia e eventos 60000 por dia. Avisos: 10 por dia e 1 por sessão.

## Privacidade

O IP nunca é gravado. A sessão anônima é um hash de IP e navegador com sal próprio e a data, trocado todo dia.

## Passos manuais

1. `npm install` e `npx wrangler login`.
2. `npm run db:aplicar` (cria as tabelas no D1).
3. Zero Trust, Access, Applications: criar um aplicativo self-hosted cobrindo `/admin/*` e `/api/admin/*`, com política permitindo só o seu e-mail. Copiar o AUD tag.
4. Em `wrangler.jsonc`, preencher `vars.ACCESS_TEAM_DOMAIN` (ex.: `seutime.cloudflareaccess.com`) e `vars.ACCESS_AUD`.
5. `npm run deploy`.
6. Se usar domínio próprio, apontar o domínio para o Worker e atualizar canonical, sitemap e `SITE_URL` em `assets/js/main.js`.

## Desenvolvimento local

`.dev.vars` com `DEV_ADMIN_EMAIL=seu@email` libera o painel só em localhost.
