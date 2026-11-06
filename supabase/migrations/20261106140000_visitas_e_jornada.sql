-- Migração: visitas_e_jornada
-- Painel de visitantes do site. Os dados chegam SÓ pela função /api/visita da Vercel,
-- que roda no servidor, lê a geolocalização dos cabeçalhos da Vercel e guarda um
-- identificador de sessão anônimo (hash de IP + navegador + sal secreto + dia).
-- O IP nunca é gravado e o hash muda todo dia, então ninguém é identificado nem seguido
-- de um dia para o outro. Nada aqui é lido ou escrito direto pelo navegador.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

-- 1) Segredo compartilhado entre a função da Vercel e o banco.
--    O valor NÃO fica no repositório: é gravado uma vez pelo painel do Supabase
--    e a mesma string vira a variável VISITAS_TOKEN na Vercel.
create table if not exists public.ingestao_config (
  id        int primary key default 1,
  token     text not null,
  criado_em timestamptz not null default now(),
  constraint ingestao_config_linha_unica check (id = 1)
);
alter table public.ingestao_config enable row level security;
revoke all on public.ingestao_config from anon, authenticated;

-- 2) Uma linha por página aberta
create table if not exists public.visitas (
  id          bigint generated always as identity primary key,
  sessao      char(32)     not null,
  caminho     varchar(200) not null,
  idioma      varchar(2),
  pais        char(2),
  regiao      varchar(80),
  cidade      varchar(120),
  fuso        varchar(60),
  dispositivo varchar(12),
  sistema     varchar(30),
  navegador   varchar(30),
  origem      varchar(120),
  campanha    varchar(120),
  criado_em   timestamptz  not null default now()
);
create index if not exists idx_visitas_criado_em on public.visitas (criado_em desc);
create index if not exists idx_visitas_sessao    on public.visitas (sessao, criado_em);

-- 3) O que a pessoa fez dentro da visita
create table if not exists public.eventos_visita (
  id        bigint generated always as identity primary key,
  sessao    char(32)    not null,
  tipo      varchar(24) not null,
  valor     varchar(160),
  numero    integer,
  criado_em timestamptz not null default now()
);
create index if not exists idx_eventos_visita_criado_em on public.eventos_visita (criado_em desc);
create index if not exists idx_eventos_visita_sessao    on public.eventos_visita (sessao, criado_em);

-- 4) Ninguém lê sem ser admin, e ninguém escreve sem ser pela função
alter table public.visitas        enable row level security;
alter table public.eventos_visita enable row level security;
revoke all on public.visitas        from anon, authenticated;
revoke all on public.eventos_visita from anon, authenticated;
grant select on public.visitas        to authenticated;
grant select on public.eventos_visita to authenticated;

drop policy if exists visitas_select_admin on public.visitas;
create policy visitas_select_admin on public.visitas
  for select to authenticated using ((select public.is_admin()));

drop policy if exists eventos_visita_select_admin on public.eventos_visita;
create policy eventos_visita_select_admin on public.eventos_visita
  for select to authenticated using ((select public.is_admin()));

-- 5) Gravação, só com o token correto
create or replace function public.registrar_visita(
  p_token text, p_sessao text, p_caminho text, p_idioma text,
  p_pais text, p_regiao text, p_cidade text, p_fuso text,
  p_dispositivo text, p_sistema text, p_navegador text,
  p_origem text, p_campanha text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.ingestao_config where id = 1 and token = p_token) then
    raise exception 'token' using errcode = 'P0001';
  end if;
  if p_sessao is null or char_length(p_sessao) <> 32 or coalesce(btrim(p_caminho), '') = '' then
    return;
  end if;
  -- teto diário: protege o plano gratuito de uma enxurrada
  if (select count(*) from public.visitas where criado_em > now() - interval '1 day') >= 20000 then
    return;
  end if;

  insert into public.visitas
    (sessao, caminho, idioma, pais, regiao, cidade, fuso, dispositivo, sistema, navegador, origem, campanha)
  values (
    p_sessao,
    left(btrim(p_caminho), 200),
    case when p_idioma = 'en' then 'en' else 'pt' end,
    nullif(upper(left(btrim(coalesce(p_pais, '')), 2)), ''),
    nullif(left(btrim(coalesce(p_regiao, '')), 80), ''),
    nullif(left(btrim(coalesce(p_cidade, '')), 120), ''),
    nullif(left(btrim(coalesce(p_fuso, '')), 60), ''),
    nullif(left(btrim(coalesce(p_dispositivo, '')), 12), ''),
    nullif(left(btrim(coalesce(p_sistema, '')), 30), ''),
    nullif(left(btrim(coalesce(p_navegador, '')), 30), ''),
    nullif(left(btrim(coalesce(p_origem, '')), 120), ''),
    nullif(left(btrim(coalesce(p_campanha, '')), 120), '')
  );
end;
$$;

create or replace function public.registrar_evento_visita(
  p_token text, p_sessao text, p_tipo text, p_valor text, p_numero int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.ingestao_config where id = 1 and token = p_token) then
    raise exception 'token' using errcode = 'P0001';
  end if;
  if p_sessao is null or char_length(p_sessao) <> 32
     or p_tipo not in ('rolagem', 'tempo', 'projeto', 'curriculo', 'demo', 'contato', 'publicacao', 'video') then
    return;
  end if;
  if (select count(*) from public.eventos_visita where criado_em > now() - interval '1 day') >= 60000 then
    return;
  end if;

  insert into public.eventos_visita (sessao, tipo, valor, numero)
  values (p_sessao, p_tipo, nullif(left(btrim(coalesce(p_valor, '')), 160), ''),
          case when p_numero between 0 and 100000 then p_numero end);
end;
$$;

-- 6) Resumo para o painel: devolve tudo em um JSON só, para o admin não baixar milhares de linhas
create or replace function public.resumo_visitas(p_dias int default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz;
  v_res   jsonb;
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  v_desde := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));

  with v as (select * from public.visitas where criado_em > v_desde),
       e as (select * from public.eventos_visita where criado_em > v_desde)
  select jsonb_build_object(
    'dias', greatest(1, least(coalesce(p_dias, 30), 365)),
    'totais', (select jsonb_build_object(
        'visitas', count(*), 'sessoes', count(distinct sessao),
        'paises', count(distinct pais), 'cidades', count(distinct cidade)) from v),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('chave', dia, 'n', n, 's', s) order by dia), '[]'::jsonb)
        from (select to_char((criado_em at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') dia,
                     count(*) n, count(distinct sessao) s
              from v group by 1) t),
    'paises', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(pais, '??') k, count(*) n from v group by 1 order by n desc limit 20) t),
    'cidades', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(cidade, 'desconhecida') || coalesce(', ' || pais, '') k, count(*) n
              from v group by 1 order by n desc limit 20) t),
    'origens', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(origem, 'direto') k, count(*) n from v group by 1 order by n desc limit 20) t),
    'campanhas', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select campanha k, count(*) n from v where campanha is not null group by 1 order by n desc limit 20) t),
    'paginas', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select caminho k, count(*) n from v group by 1 order by n desc limit 25) t),
    'dispositivos', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(dispositivo, 'desconhecido') k, count(*) n from v group by 1 order by n desc) t),
    'navegadores', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(navegador, 'desconhecido') || ' / ' || coalesce(sistema, 'desconhecido') k,
                     count(*) n from v group by 1 order by n desc limit 12) t),
    'idiomas', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(idioma, 'pt') k, count(*) n from v group by 1) t),
    'acoes', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select tipo || coalesce(': ' || valor, '') k, count(*) n
              from e where tipo <> 'tempo' and tipo <> 'rolagem' group by 1 order by n desc limit 25) t),
    'engajamento', (select jsonb_build_object(
        'tempo_medio', round(coalesce(avg(numero) filter (where tipo = 'tempo'), 0)),
        'rolagem_media', round(coalesce(avg(numero) filter (where tipo = 'rolagem'), 0))) from e),
    'jornadas', (select coalesce(jsonb_agg(j order by j->>'inicio' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'inicio', to_char(min(criado_em) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
          'paginas', count(*),
          'lugar', coalesce(max(cidade), 'desconhecida') || coalesce(', ' || max(pais), ''),
          'dispositivo', coalesce(max(dispositivo), ''),
          'origem', coalesce(max(origem), 'direto'),
          'rota', string_agg(caminho, ' > ' order by criado_em)) j
        from v group by sessao order by min(criado_em) desc limit 30) t)
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.registrar_evento_visita(text, text, text, text, int) from public;
revoke all on function public.resumo_visitas(int) from public;
grant execute on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text) to anon;
grant execute on function public.registrar_evento_visita(text, text, text, text, int) to anon;
grant execute on function public.resumo_visitas(int) to authenticated;

-- 7) Limpeza: visitas e eventos com mais de 12 meses saem sozinhos (LGPD, dado mínimo necessário)
create or replace function public.limpar_visitas_antigas()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.visitas where criado_em < now() - interval '12 months';
  delete from public.eventos_visita where criado_em < now() - interval '12 months';
$$;
revoke all on function public.limpar_visitas_antigas() from public;
