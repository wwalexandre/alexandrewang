-- Migração: visitas_secoes_e_imagens
-- Soma ao painel de visitantes: qual imagem foi clicada, em que seção a pessoa
-- passou mais tempo e quais publicações e projetos foram mais lidos.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

-- 1) Dois tipos novos de evento: clique em imagem e tempo por seção
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
     or p_tipo not in ('rolagem', 'tempo', 'projeto', 'curriculo', 'demo', 'contato',
                       'publicacao', 'video', 'imagem', 'secao', 'link') then
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

-- 2) Resumo completo do painel
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

    -- Seções: ordenadas pelo tempo total que as pessoas passaram olhando
    'secoes', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', seg, 'extra', vistas) order by seg desc), '[]'::jsonb)
        from (select valor k, round(sum(numero))::int seg, count(*) vistas
              from e where tipo = 'secao' and valor is not null and numero is not null
              group by 1 order by 2 desc limit 20) t),

    -- Imagens mais clicadas
    'imagens', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select valor k, count(*) n from e where tipo = 'imagem' and valor is not null
              group by 1 order by 2 desc limit 20) t),

    -- Cliques e downloads
    'acoes', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select tipo || coalesce(': ' || valor, '') k, count(*) n
              from e where tipo in ('projeto', 'curriculo', 'demo', 'contato', 'publicacao', 'video', 'link')
              group by 1 order by 2 desc limit 25) t),

    'engajamento', (select jsonb_build_object(
        'tempo_medio', round(coalesce(avg(numero) filter (where tipo = 'tempo'), 0))::int,
        'tempo_maximo', coalesce(max(numero) filter (where tipo = 'tempo'), 0),
        'rolagem_media', round(coalesce(avg(numero) filter (where tipo = 'rolagem'), 0))::int,
        'leram_ate_o_fim', count(*) filter (where tipo = 'rolagem' and numero >= 90)) from e),

    -- Tempo médio por página, para saber onde a pessoa realmente para
    'tempo_por_pagina', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', seg) order by seg desc), '[]'::jsonb)
        from (select coalesce(ev.valor, 'desconhecida') k, round(avg(ev.numero))::int seg
              from e ev where ev.tipo = 'tempo' and ev.valor is not null
              group by 1 having count(*) >= 1 order by 2 desc limit 20) t),

    'jornadas', (select coalesce(jsonb_agg(j order by j->>'ordem' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'ordem', to_char(min(criado_em), 'YYYYMMDDHH24MISS'),
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

revoke all on function public.registrar_evento_visita(text, text, text, text, int) from public;
revoke all on function public.resumo_visitas(int) from public;
grant execute on function public.registrar_evento_visita(text, text, text, text, int) to anon;
grant execute on function public.resumo_visitas(int) to authenticated;
