-- Migração: rede_do_visitante
--
-- CONTEXTO: o pedido era deixar o CEP preciso. Testei uma base de geolocalização melhor
-- que a da Vercel e a conclusão é que **não dá**. São Paulo cai em -23.5475, -46.6361
-- (Praça da Sé) em qualquer provedor, porque é assim que geolocalização por IP funciona.
-- O CEP melhora um pouco fora de São Paulo (Brasília devolveu 70640-000), e só.
--
-- O QUE A BASE MELHOR DARIA DE VERDADE: o dono da rede. Um IP de teste voltou como
-- "Amazon / A100 ROW SERVICOS DE DADOS BRASIL", ou seja, datacenter e não pessoa. Isso
-- responde "quem está acessando" muito melhor que um CEP genérico:
--   - rede de empresa mostra o nome da empresa, que é o sinal que interessa a quem procura vaga;
--   - datacenter e VPN ficam marcados como provável robô.
--
-- ESTADO: o banco está pronto para receber esse dado, mas **a coleta ainda NÃO está ligada**.
-- Ligar exige consultar um serviço externo com o IP do visitante, o que é uma mudança de
-- privacidade real e precisa da decisão do Alexandre mais a atualização da página de
-- privacidade. Enquanto isso, `operadora` e `rede_tipo` ficam nulos e o painel não mostra
-- os blocos correspondentes.
--
-- Aplicada no Supabase em partes: rede_colunas, rede_registrar_visita, rede_resumo_extra
-- e rede_remove_assinatura_antiga.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

alter table public.visitas add column if not exists operadora varchar(80);
alter table public.visitas add column if not exists rede_tipo varchar(12);
create index if not exists idx_visitas_operadora on public.visitas (operadora);

-- registrar_visita ganha os dois campos novos. A assinatura de 16 argumentos foi removida
-- para não ficarem duas sobrecargas disputando a mesma chamada no PostgREST.
create or replace function public.registrar_visita(
  p_token text, p_impressao text, p_caminho text, p_idioma text,
  p_pais text, p_regiao text, p_cidade text, p_fuso text,
  p_dispositivo text, p_sistema text, p_navegador text,
  p_origem text, p_campanha text,
  p_cep text, p_latitude text, p_longitude text,
  p_operadora text, p_rede_tipo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
     origem, campanha, cep, latitude, longitude, operadora, rede_tipo)
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
    case when p_rede_tipo in ('empresa', 'provedor', 'datacenter') then p_rede_tipo end
  );
end;
$$;

drop function if exists public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);

revoke all on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon;

-- Resumo: soma por rede e marca provável robô. Fica vazio enquanto a coleta não for ligada.
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
              from v group by 1 order by count(*) desc limit 20) t),

    'redes', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n, 'extra', tipo) order by n desc), '[]'::jsonb)
        from (select operadora k, max(rede_tipo) tipo, count(*) n
              from v where operadora is not null group by 1 order by count(*) desc limit 20) t),

    'tipos_rede', (select coalesce(jsonb_agg(jsonb_build_object('chave', k, 'n', n) order by n desc), '[]'::jsonb)
        from (select coalesce(rede_tipo, 'desconhecido') k, count(*) n from v group by 1 order by count(*) desc) t),

    'mais_acessos', (select coalesce(jsonb_agg(j order by (j->>'n')::int desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'codigo', left(sessao, 6),
          'n', count(*),
          'lugar', coalesce(max(cidade), 'desconhecida') || coalesce(', ' || max(pais), ''),
          'rede', coalesce(max(operadora), ''),
          'robo', coalesce(max(rede_tipo) = 'datacenter', false),
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
