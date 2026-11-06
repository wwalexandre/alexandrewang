-- Migração: local_aproximado
-- Guarda CEP e coordenadas que a Vercel deduz do endereço de rede.
--
-- LEIA ANTES DE CONFIAR NO DADO: isto NÃO é o endereço do visitante. É o palpite
-- do provedor de geolocalização, que na prática devolve o centro da cidade ou o
-- endereço registrado da operadora. Em celular costuma apontar o ponto de saída
-- da rede, que pode ficar em outra cidade. Serve para separar rede de empresa de
-- acesso doméstico e para agrupar por região, nunca para dizer o bairro de alguém.
-- Por isso o painel chama o bloco de "localização aproximada".
-- Idempotente: pode ser reaplicada sem duplicar objetos.

alter table public.visitas add column if not exists cep       varchar(12);
alter table public.visitas add column if not exists latitude  numeric(8, 4);
alter table public.visitas add column if not exists longitude numeric(8, 4);

-- A assinatura muda, então a versão antiga sai para não ficarem duas sobrecargas
drop function if exists public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text);

create or replace function public.registrar_visita(
  p_token text, p_sessao text, p_caminho text, p_idioma text,
  p_pais text, p_regiao text, p_cidade text, p_fuso text,
  p_dispositivo text, p_sistema text, p_navegador text,
  p_origem text, p_campanha text,
  p_cep text default null, p_latitude text default null, p_longitude text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lat numeric;
  v_lon numeric;
begin
  if not exists (select 1 from public.ingestao_config where id = 1 and token = p_token) then
    raise exception 'token' using errcode = 'P0001';
  end if;
  if p_sessao is null or char_length(p_sessao) <> 32 or coalesce(btrim(p_caminho), '') = '' then
    return;
  end if;
  if (select count(*) from public.visitas where criado_em > now() - interval '1 day') >= 20000 then
    return;
  end if;

  -- Coordenada só entra se for número dentro da faixa válida
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
     origem, campanha, cep, latitude, longitude)
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
    nullif(left(btrim(coalesce(p_campanha, '')), 120), ''),
    nullif(left(btrim(coalesce(p_cep, '')), 12), ''),
    v_lat, v_lon
  );
end;
$$;

revoke all on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon;

-- Soma ao resumo o bloco de localização aproximada
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
          'ordem', to_char(min(criado_em), 'YYYYMMDDHH24MISS'),
          'inicio', to_char(min(criado_em) at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
          'paginas', count(*),
          'lugar', coalesce(max(cidade), 'desconhecida') || coalesce(', ' || max(pais), '')
                   || coalesce(' · ' || max(cep), ''),
          'dispositivo', coalesce(max(dispositivo), ''),
          'origem', coalesce(max(campanha), max(origem), 'direto'),
          'rota', string_agg(caminho, ' > ' order by criado_em)) j
        from v group by sessao order by min(criado_em) desc limit 30) t)
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.resumo_visitas(int) from public;
grant execute on function public.resumo_visitas(int) to authenticated;
