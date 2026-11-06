-- Migração: aviso_na_hora
--
-- Manda um e-mail no momento em que alguém de REDE DE EMPRESA faz algo que mostra
-- interesse de verdade no site. É o caso que hoje não gera aviso nenhum: a pessoa lê,
-- olha um projeto e vai embora sem deixar contato, e o Alexandre nunca fica sabendo.
--
-- Provedor doméstico e datacenter NÃO geram aviso, senão viraria ruído diário.
-- Quem dispara é a função api/visita.js da Vercel, ao receber um evento forte
-- (currículo, demonstração, contato, projeto) ou um tempo de 90 segundos ou mais.
--
-- A tabela `avisos` existe para não mandar e-mail repetido: a sessão é a chave primária,
-- então dois eventos ao mesmo tempo disputam a mesma linha e só um ganha.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

create table if not exists public.avisos (
  sessao    char(32) primary key,
  motivo    varchar(24),
  criado_em timestamptz not null default now()
);
create index if not exists idx_avisos_criado_em on public.avisos (criado_em desc);

alter table public.avisos enable row level security;
revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;

drop policy if exists avisos_select_admin on public.avisos;
create policy avisos_select_admin on public.avisos
  for select to authenticated using ((select public.is_admin()));

-- Decide se vale avisar e, no mesmo passo, reserva a vaga da sessão.
-- Devolve o contexto da visita quando vale, ou NULL quando não vale.
create or replace function public.preparar_aviso(p_token text, p_impressao text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token  text;
  v_sessao text;
  v_rede   text;
  v_vagas  int;
  v_res    jsonb;
begin
  select token into v_token from public.ingestao_config where id = 1;
  if v_token is not null and v_token <> coalesce(p_token, '') then
    raise exception 'token' using errcode = 'P0001';
  end if;

  v_sessao := public.sessao_do_dia(p_impressao);
  if v_sessao is null then return null; end if;

  -- só rede de empresa: provedor e datacenter ficam de fora
  select max(rede_tipo) into v_rede from public.visitas where sessao = v_sessao;
  if v_rede is distinct from 'empresa' then return null; end if;

  -- teto diário, para um robô mal classificado não virar enxurrada de e-mail
  if (select count(*) from public.avisos where criado_em > now() - interval '1 day') >= 10 then
    return null;
  end if;

  insert into public.avisos (sessao, motivo)
  values (v_sessao, nullif(left(btrim(coalesce(p_motivo, '')), 24), ''))
  on conflict (sessao) do nothing;
  get diagnostics v_vagas = row_count;
  if v_vagas = 0 then return null; end if;

  select jsonb_build_object(
    'rede', max(operadora),
    'lugar', coalesce(max(cidade), 'desconhecida') || coalesce(', ' || max(pais), ''),
    'aparelho', coalesce(max(dispositivo), '') || coalesce(' e ' || max(navegador), ''),
    'veio_de', coalesce(max(campanha), max(origem), 'direto'),
    'inicio', to_char(min(criado_em) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    'quantas_paginas', count(*)
  ) into v_res
  from public.visitas where sessao = v_sessao;

  v_res := v_res || jsonb_build_object(
    'paginas', coalesce((select string_agg(distinct caminho, ', ') from public.visitas where sessao = v_sessao), ''),
    'segundos', coalesce((select sum(numero)::int from public.eventos_visita
                          where sessao = v_sessao and tipo = 'tempo'), 0),
    'acoes', coalesce((select string_agg(distinct tipo || coalesce(': ' || valor, ''), ' | ')
                       from public.eventos_visita
                       where sessao = v_sessao
                         and tipo in ('curriculo', 'demo', 'contato', 'projeto', 'publicacao')), 'nenhuma')
  );

  return v_res;
end;
$$;

revoke all on function public.preparar_aviso(text, text, text) from public;
grant execute on function public.preparar_aviso(text, text, text) to anon;
