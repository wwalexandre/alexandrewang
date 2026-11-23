-- Painel visual de acessos (22/11/2026)
-- resumo_painel(p_dias): números do período atual e do anterior (para a tendência dos cartões),
-- séries diárias para as minilinhas e os pontos do mapa (coordenada arredondada, sem dado pessoal).

create or replace function public.resumo_painel(p_dias integer default 30)
returns jsonb
language plpgsql security definer
set search_path to ''
as $function$
declare
  v_dias  int := greatest(1, least(coalesce(p_dias, 30), 365));
  v_agora timestamptz := now();
  v_desde timestamptz := v_agora - make_interval(days => v_dias);
  v_antes timestamptz := v_agora - make_interval(days => v_dias * 2);
begin
  if not public.is_admin() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return (
  with v as (select * from public.visitas where criado_em > v_antes),
       e as (select * from public.eventos_visita where criado_em > v_antes and tipo = 'tempo'),
       l as (select * from public.leads where criado_em > v_antes),
       periodo(nome, ini, fim) as (values ('atual', v_desde, v_agora), ('anterior', v_antes, v_desde))
  select jsonb_build_object(
    'dias', v_dias,

    'periodos', (select jsonb_object_agg(p.nome, jsonb_build_object(
        'visitas', (select count(*) from v where criado_em > p.ini and criado_em <= p.fim),
        'sessoes', (select count(distinct sessao) from v where criado_em > p.ini and criado_em <= p.fim),
        'tempo_medio', (select round(coalesce(avg(numero), 0))::int from e where criado_em > p.ini and criado_em <= p.fim),
        'leads', (select count(*) from l where criado_em > p.ini and criado_em <= p.fim),
        'fora_sp', (select count(distinct sessao) from v where criado_em > p.ini and criado_em <= p.fim
                      and not (coalesce(pais, '') = 'BR' and coalesce(regiao, '') = 'SP'))))
      from periodo p),

    'tempo_dia', (select coalesce(jsonb_agg(jsonb_build_object('chave', dia, 'n', n) order by dia), '[]'::jsonb)
        from (select to_char((criado_em at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') dia,
                     round(avg(numero))::int n
              from e where criado_em > v_desde group by 1) t),

    'leads_dia', (select coalesce(jsonb_agg(jsonb_build_object('chave', dia, 'n', n) order by dia), '[]'::jsonb)
        from (select to_char((criado_em at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') dia, count(*) n
              from l where criado_em > v_desde group by 1) t),

    'fora_dia', (select coalesce(jsonb_agg(jsonb_build_object('chave', dia, 'n', n) order by dia), '[]'::jsonb)
        from (select to_char((criado_em at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') dia,
                     count(distinct sessao) n
              from v where criado_em > v_desde
                and not (coalesce(pais, '') = 'BR' and coalesce(regiao, '') = 'SP')
              group by 1) t),

    'pontos', (select coalesce(jsonb_agg(jsonb_build_object(
                  'lat', lat, 'lon', lon, 'cidade', cidade, 'pais', pais, 'regiao', regiao,
                  'n', n, 's', s) order by n desc), '[]'::jsonb)
        from (select round(latitude::numeric, 1) lat, round(longitude::numeric, 1) lon,
                     max(cidade) cidade, max(pais) pais, max(regiao) regiao,
                     count(*) n, count(distinct sessao) s
              from v where criado_em > v_desde and latitude is not null and longitude is not null
              group by 1, 2 order by n desc limit 200) t)
  ));
end;
$function$;

revoke all on function public.resumo_painel(integer) from public, anon;
grant execute on function public.resumo_painel(integer) to authenticated;
