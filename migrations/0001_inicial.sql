-- Banco do portfólio no Cloudflare D1 (SQLite). Substitui as 10 migrações do Supabase.
-- Idempotente: pode ser reaplicado sem duplicar nada.
--
-- Diferenças em relação ao Postgres do Supabase:
-- - Não existe RLS nem papel "anon": o banco só é acessado pelo Worker (src/worker.js),
--   que valida, limita envios e confere o login do Cloudflare Access.
-- - Datas ficam em UTC como texto ISO 8601 (2026-11-12T16:57:52.487Z).
--   O painel converte para o horário de Brasília (UTC-3, sem horário de verão desde 2019).
-- - "lida" é 0 ou 1.

CREATE TABLE IF NOT EXISTS mensagens_contato (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT NOT NULL CHECK (length(trim(nome)) >= 2 AND length(nome) <= 100),
  email     TEXT NOT NULL CHECK (length(email) <= 160),
  assunto   TEXT CHECK (assunto IS NULL OR length(assunto) <= 120),
  mensagem  TEXT NOT NULL CHECK (length(trim(mensagem)) >= 10 AND length(mensagem) <= 2000),
  idioma    TEXT NOT NULL DEFAULT 'pt' CHECK (idioma IN ('pt', 'en')),
  lida      INTEGER NOT NULL DEFAULT 0 CHECK (lida IN (0, 1)),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_mensagens_contato_criado_em ON mensagens_contato (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_contato_email_criado_em ON mensagens_contato (email, criado_em DESC);

CREATE TABLE IF NOT EXISTS leads (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  email     TEXT NOT NULL CHECK (length(email) <= 160),
  origem    TEXT NOT NULL CHECK (origem IN ('curriculo', 'arquivo', 'demo')),
  idioma    TEXT NOT NULL DEFAULT 'pt' CHECK (idioma IN ('pt', 'en')),
  detalhe   TEXT CHECK (detalhe IS NULL OR length(detalhe) <= 120),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_criado_em ON leads (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email_criado_em ON leads (email, criado_em DESC);

CREATE TABLE IF NOT EXISTS visitas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao      TEXT NOT NULL,
  caminho     TEXT NOT NULL,
  idioma      TEXT,
  pais        TEXT,
  regiao      TEXT,
  cidade      TEXT,
  fuso        TEXT,
  dispositivo TEXT,
  sistema     TEXT,
  navegador   TEXT,
  origem      TEXT,
  campanha    TEXT,
  cep         TEXT,
  latitude    REAL,
  longitude   REAL,
  operadora   TEXT,
  rede_tipo   TEXT,
  criado_em   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_visitas_criado_em ON visitas (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_visitas_sessao ON visitas (sessao, criado_em);
CREATE INDEX IF NOT EXISTS idx_visitas_operadora ON visitas (operadora);

CREATE TABLE IF NOT EXISTS eventos_visita (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao    TEXT NOT NULL,
  tipo      TEXT NOT NULL,
  valor     TEXT,
  numero    INTEGER,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_visita_criado_em ON eventos_visita (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_visita_sessao ON eventos_visita (sessao, criado_em);

-- Uma linha por sessão avisada por e-mail. A sessão é a chave primária: dois eventos
-- ao mesmo tempo disputam a mesma linha e só um ganha, então o e-mail não se repete.
CREATE TABLE IF NOT EXISTS avisos (
  sessao    TEXT PRIMARY KEY,
  motivo    TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_avisos_criado_em ON avisos (criado_em DESC);

-- Sal secreto do identificador anônimo do dia. O Worker gera sozinho na primeira visita,
-- então não existe passo manual de configuração. Nenhuma rota pública lê esta tabela.
CREATE TABLE IF NOT EXISTS config (
  id  INTEGER PRIMARY KEY CHECK (id = 1),
  sal TEXT NOT NULL
);
