-- Bloqueio de visitantes, acesso só do estado de São Paulo e tempo de cada jornada no painel.
--
-- 1) Regra "só SP": um interruptor no banco (ingestao_config.so_sp), lido pelo middleware da
--    Vercel. Liga e desliga pelo painel, sem precisar publicar o site.
-- 2) Bloqueio: para poder bloquear alguém depois, cada visita passa a guardar `rede_id`, um
--    código fixo tirado do endereço de rede com o sal secreto. O IP em si continua sem ser
--    gravado; o código não muda de um dia para o outro (diferente da sessão), por isso serve
--    para bloquear. Também dá para bloquear um e-mail, que deixa de entrar como lead.
-- 3) Jornadas: o painel passa a mostrar o tempo somado de cada pessoa e a rede.

alter table public.ingestao_config add column if not exists so_sp boolean not null default true;

alter table public.visitas add column if not exists rede_id char(32);
create index if not exists visitas_rede_id_idx on public.visitas (rede_id);

create table if not exists public.bloqueios (
  id         bigint generated always as identity primary key,
  rede_id    char(32),
  email      varchar(160),
  descricao  varchar(200),
  criado_em  timestamptz not null default now(),
  constraint bloqueios_alvo check (rede_id is not null or email is not null)
);
create unique index if not exists bloqueios_rede_idx on public.bloqueios (rede_id) where rede_id is not null;
create unique index if not exists bloqueios_email_idx on public.bloqueios (email) where email is not null;
alter table public.bloqueios enable row level security;

drop policy if exists "bloqueios admin" on public.bloqueios;
create policy "bloqueios admin" on public.bloqueios
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Código fixo da rede: hash do IP com o sal secreto. Uso interno, ninguém de fora chama.
create or replace function public.rede_do_ip(p_ip text)
returns char(32)
language sql stable security definer
set search_path to ''
as $$
  select case
    when coalesce(btrim(p_ip), '') = '' then null
    else left(encode(extensions.digest(
      'rede|' || btrim(p_ip) || coalesce((select sal from public.ingestao_config where id = 1), ''),
      'sha256'), 'hex'), 32)
  end;
$$;
revoke execute on function public.rede_do_ip(text) from public, anon, authenticated;

-- Pergunta do middleware a cada página: esta rede está bloqueada? A regra só SP está ligada?
-- Devolve só dois sim ou não; não revela nada sobre outras pessoas.
create or replace function public.checar_acesso(p_ip text)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'bloqueado', exists (select 1 from public.bloqueios b where b.rede_id = public.rede_do_ip(p_ip)),
    'so_sp', coalesce((select so_sp from public.ingestao_config where id = 1), true));
$$;
revoke execute on function public.checar_acesso(text) from public;
grant execute on function public.checar_acesso(text) to anon, authenticated;

-- Painel: ler e trocar a regra só SP
create or replace function public.config_acesso()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  return jsonb_build_object('so_sp', coalesce((select so_sp from public.ingestao_config where id = 1), true));
end;
$$;
create or replace function public.definir_so_sp(p_valor boolean)
returns void
language plpgsql security definer
set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  update public.ingestao_config set so_sp = coalesce(p_valor, true) where id = 1;
end;
$$;
revoke execute on function public.config_acesso() from public, anon;
revoke execute on function public.definir_so_sp(boolean) from public, anon;
grant execute on function public.config_acesso() to authenticated;
grant execute on function public.definir_so_sp(boolean) to authenticated;

-- Painel: bloquear a rede de uma jornada. Devolve quantas redes entraram no bloqueio
-- (zero quando a jornada é de antes de existir o rede_id).
create or replace function public.bloquear_sessao(p_sessao text, p_descricao text default null)
returns int
language plpgsql security definer
set search_path to ''
as $$
declare v_n int;
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  insert into public.bloqueios (rede_id, descricao)
  select distinct v.rede_id, left(coalesce(p_descricao, ''), 200)
    from public.visitas v
   where v.sessao = p_sessao and v.rede_id is not null
  on conflict (rede_id) where rede_id is not null do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.bloquear_sessao(text, text) from public, anon;
grant execute on function public.bloquear_sessao(text, text) to authenticated;

-- Gravação da visita: agora recebe o IP para montar o rede_id. O IP não é gravado.
drop function if exists public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);
create or replace function public.registrar_visita(p_token text, p_impressao text, p_caminho text, p_idioma text, p_pais text, p_regiao text, p_cidade text, p_fuso text, p_dispositivo text, p_sistema text, p_navegador text, p_origem text, p_campanha text, p_cep text default null, p_latitude text default null, p_longitude text default null, p_operadora text default null, p_rede_tipo text default null, p_ip text default null)
returns void
language plpgsql security definer
set search_path to ''
as $function$
declare
  v_token  text;
  v_sessao text;
  v_lat    numeric;
  v_lon    numeric;
begin
  select token into v_token from public.ingestao_config where id = 1;
  if v_token is not null and v_token <> coalesce(p_token, '') then
    raise exception 'token' using errcode = 'P0001';
  end if;

  v_sessao := public.sessao_do_dia(p_impressao);
  if v_sessao is null then return; end if;

  if p_caminho is null or p_caminho !~ '^/[A-Za-z0-9/._-]{0,199}$' or p_caminho like '%..%' then
    return;
  end if;
  if (select count(*) from public.visitas where criado_em > now() - interval '1 day') >= 20000 then
    return;
  end if;

  begin
    v_lat := nullif(btrim(coalesce(p_latitude, '')), '')::numeric;
    v_lon := nullif(btrim(coalesce(p_longitude, '')), '')::numeric;
  exception when others then
    v_lat := null; v_lon := null;
  end;
  if v_lat is null or v_lon is null or v_lat not between -90 and 90 or v_lon not between -180 and 180 then
    v_lat := null; v_lon := null;
  end if;

  insert into public.visitas
    (sessao, caminho, idioma, pais, regiao, cidade, fuso, dispositivo, sistema, navegador,
     origem, campanha, cep, latitude, longitude, operadora, rede_tipo, rede_id)
  values (
    v_sessao,
    left(public.caminho_canonico(p_caminho), 200),
    case when p_idioma = 'en' then 'en' else 'pt' end,
    nullif(upper(left(btrim(coalesce(p_pais, '')), 2)), ''),
    nullif(left(btrim(coalesce(p_regiao, '')), 80), ''),
    nullif(left(btrim(coalesce(p_cidade, '')), 120), ''),
    nullif(left(btrim(coalesce(p_fuso, '')), 60), ''),
    nullif(left(btrim(coalesce(p_dispositivo, '')), 12), ''),
    nullif(left(btrim(coalesce(p_sistema, '')), 30), ''),
    nullif(left(btrim(coalesce(p_navegador, '')), 30), ''),
    nullif(left(btrim(coalesce(p_origem, '')), 120), ''),
    nullif(left(btrim(coalesce(p_campanha, '')), 120), ''),
    nullif(left(btrim(coalesce(p_cep, '')), 12), ''),
    v_lat, v_lon,
    nullif(left(btrim(coalesce(p_operadora, '')), 80), ''),
    case when p_rede_tipo in ('empresa', 'provedor', 'datacenter') then p_rede_tipo end,
    public.rede_do_ip(p_ip)
  );
end;
$function$;
revoke execute on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- Lead de e-mail bloqueado não entra
create or replace function public.registrar_lead(p_email text, p_origem text, p_idioma text, p_detalhe text default null)
returns void
language plpgsql security definer
set search_path to ''
as $function$
declare
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_detalhe text := nullif(left(btrim(coalesce(p_detalhe, '')), 120), '');
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160
     or p_origem not in ('curriculo', 'arquivo', 'demo') then
    return;
  end if;
  if exists (select 1 from public.bloqueios where email = v_email) then
    return;
  end if;

  if exists (select 1 from public.leads
              where email = v_email and origem = p_origem
                and detalhe is not distinct from v_detalhe
                and criado_em > now() - interval '24 hours')
     or (select count(*) from public.leads
          where criado_em > now() - interval '24 hours') >= 500 then
    return;
  end if;

  insert into public.leads (email, origem, idioma, detalhe)
  values (v_email, p_origem, case when p_idioma = 'en' then 'en' else 'pt' end, v_detalhe);
end;
$function$;

-- Painel: e-mails bloqueados e redes bloqueadas
create or replace function public.bloquear_email(p_email text, p_descricao text default null)
returns void
language plpgsql security definer
set search_path to ''
as $$
declare v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'acesso negado' using errcode = '42501'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160 then return; end if;
  insert into public.bloqueios (email, descricao)
  values (v_email, left(coalesce(p_descricao, ''), 200))
  on conflict (email) where email is not null do nothing;
end;
$$;
revoke execute on function public.bloquear_email(text, text) from public, anon;
grant execute on function public.bloquear_email(text, text) to authenticated;

-- Resumo do painel: igual ao anterior; cada jornada ganha sessão, rede, tempo somado e bloqueio
create or replace function public.resumo_visitas(p_dias integer default 30)
returns jsonb
language plpgsql security definer
set search_path to ''
as $function$
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

    'locais', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(cidade, 'cidade desconhecida') || ' · ' || coalesce(cep, 'sem CEP') k,
                     count(*) n from v where cep is not null or cidade is not null
              group by 1 order by n desc limit 20) t),

    'origens', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(origem, 'direto') k, count(*) n from v group by 1 order by n desc limit 20) t),

    'campanhas', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n, 'extra', s) order by n desc), '[]'::jsonb)
        from (select campanha k, count(*) n, count(distinct sessao) s
              from v where campanha is not null group by 1 order by n desc limit 25) t),

    'paginas', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select caminho k, count(*) n from v group by 1 order by n desc limit 25) t),

    'publicacoes', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select caminho k, count(*) n from v where caminho like '/publicacoes/%' group by 1 order by n desc limit 15) t),

    'projetos', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select caminho k, count(*) n from v where caminho like '/projetos/%' group by 1 order by n desc limit 15) t),

    'dispositivos', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(dispositivo, 'desconhecido') k, count(*) n from v group by 1 order by n desc) t),

    'navegadores', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(navegador, 'desconhecido') || ' / ' || coalesce(sistema, 'desconhecido') k,
                     count(*) n from v group by 1 order by n desc limit 12) t),

    'idiomas', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(idioma, 'pt') k, count(*) n from v group by 1) t),

    'secoes', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', seg, 'extra', vistas) order by seg desc), '[]'::jsonb)
        from (select valor k, round(sum(numero))::int seg, count(*) vistas
              from e where tipo = 'secao' and valor is not null and numero is not null
              group by 1 order by 2 desc limit 20) t),

    'imagens', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select valor k, count(*) n from e where tipo = 'imagem' and valor is not null
              group by 1 order by 2 desc limit 20) t),

    'acoes', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select tipo || coalesce(': ' || valor, '') k, count(*) n
              from e where tipo in ('projeto', 'curriculo', 'demo', 'contato', 'publicacao', 'video', 'link')
              group by 1 order by 2 desc limit 25) t),

    'engajamento', (select jsonb_build_object(
        'tempo_medio', round(coalesce(avg(numero) filter (where tipo = 'tempo'), 0))::int,
        'tempo_maximo', coalesce(max(numero) filter (where tipo = 'tempo'), 0),
        'rolagem_media', round(coalesce(avg(numero) filter (where tipo = 'rolagem'), 0))::int,
        'leram_ate_o_fim', count(*) filter (where tipo = 'rolagem' and numero >= 90)) from e),

    'tempo_por_pagina', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', seg) order by seg desc), '[]'::jsonb)
        from (select coalesce(ev.valor, 'desconhecida') k, round(avg(ev.numero))::int seg
              from e ev where ev.tipo = 'tempo' and ev.valor is not null
              group by 1 having count(*) >= 1 order by 2 desc limit 20) t),

    'jornadas', (select coalesce(jsonb_agg(j order by j->>'ordem' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'ordem', to_char(min(vv.criado_em), 'YYYYMMDDHH24MISS'),
          'inicio', to_char(min(vv.criado_em) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
          'paginas', count(*),
          'lugar', coalesce(max(vv.cidade), 'desconhecida') || coalesce(', ' || max(vv.pais), '')
                   || coalesce(' · ' || max(vv.cep), ''),
          'dispositivo', coalesce(max(vv.dispositivo), ''),
          'origem', coalesce(max(vv.campanha), max(vv.origem), 'direto'),
          'rota', string_agg(vv.caminho, ' > ' order by vv.criado_em),
          'sessao', vv.sessao,
          'rede', coalesce(max(vv.operadora), ''),
          'segundos', (select round(coalesce(sum(ev.numero), 0))::int from e ev
                        where ev.sessao = vv.sessao and ev.tipo = 'tempo'),
          'bloqueavel', bool_or(vv.rede_id is not null),
          'bloqueado', exists (select 1 from public.bloqueios b
                                where b.rede_id is not null and b.rede_id = any (array_agg(vv.rede_id)))) j
        from v vv group by vv.sessao order by min(vv.criado_em) desc limit 30) t),

    'bloqueios', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', b.id, 'tipo', case when b.email is not null then 'email' else 'rede' end,
          'alvo', coalesce(b.email, 'rede ' || left(b.rede_id, 6)),
          'descricao', coalesce(b.descricao, ''),
          'quando', to_char(b.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
        order by b.criado_em desc), '[]'::jsonb) from public.bloqueios b),

    'so_sp', coalesce((select so_sp from public.ingestao_config where id = 1), true)
  ) into v_res;

  return v_res;
end;
$function$;
