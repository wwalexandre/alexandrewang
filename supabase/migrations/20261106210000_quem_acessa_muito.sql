-- Migração: quem_acessa_muito
--
-- Dois blocos novos para o painel, numa função separada para não reescrever resumo_visitas:
--
-- 1) `mais_acessos`: quem abriu muitas páginas, agrupado pelo identificador anônimo do dia.
--    Como esse identificador é por IP mais navegador dentro do mesmo dia, uma linha com
--    número alto é, na prática, um acesso só pesando muito. Serve para enxergar abuso
--    SEM guardar IP. O bloqueio em si é feito no Firewall da Vercel, que vê o IP na borda
--    e nunca precisa que ele entre aqui.
--
-- 2) `estados`: contagem por estado ou região, que é a informação geográfica que a
--    geolocalização por rede realmente acerta. O CEP vem quase sempre igual (o centro da
--    cidade), então ele sai do painel e fica guardado só para quem quiser olhar na tabela.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

create or replace function public.resumo_extra(p_dias int default 30)
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

  with v as (select * from public.visitas where criado_em > v_desde)
  select jsonb_build_object(
    'estados', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(regiao, 'sem regiao') || coalesce(' (' || pais || ')', '') k, count(*) n
              from v group by 1 order by n desc limit 20) t),

    'mais_acessos', (select coalesce(jsonb_agg(j order by (j->>'n')::int desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'codigo', left(sessao, 6),
          'n', count(*),
          'lugar', coalesce(max(cidade), 'desconhecida') || coalesce(', ' || max(pais), ''),
          'aparelho', coalesce(max(dispositivo), '') || coalesce(' · ' || max(navegador), ''),
          'dia', to_char(min(criado_em) at time zone 'America/Sao_Paulo', 'DD/MM'),
          'janela', to_char(min(criado_em) at time zone 'America/Sao_Paulo', 'HH24:MI')
                    || ' às ' || to_char(max(criado_em) at time zone 'America/Sao_Paulo', 'HH24:MI'),
          'minutos', greatest(1, round(extract(epoch from (max(criado_em) - min(criado_em))) / 60))) j
        from v group by sessao having count(*) >= 5 order by count(*) desc limit 15) t)
  ) into v_res;

  return v_res;
end;
$$;

revoke all on function public.resumo_extra(int) from public;
grant execute on function public.resumo_extra(int) to authenticated;
