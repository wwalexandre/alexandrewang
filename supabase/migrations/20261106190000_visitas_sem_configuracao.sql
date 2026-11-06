-- Migração: visitas_sem_configuracao
--
-- POR QUE: o registro de visitas dependia de duas variáveis de ambiente criadas à mão na
-- Vercel. Enquanto elas não existissem, nada era gravado e o painel ficava zerado para
-- sempre. Depender de um passo manual para a coisa funcionar é defeito de projeto.
--
-- O QUE MUDA: o sal secreto passa a morar no banco, numa tabela que ninguém lê, e o
-- identificador de sessão passa a ser montado aqui dentro. A função da Vercel manda só
-- uma impressão (sha256 de IP + navegador, sem segredo), então **o IP nem chega ao banco**,
-- o que é melhor do que era antes. Nenhuma variável de ambiente é necessária.
--
-- O token continua existindo, mas agora é OPCIONAL: só é exigido se a coluna `token`
-- estiver preenchida. Deixando NULL, qualquer chamada válida grava. Para fechar depois,
-- basta preencher o token aqui e criar VISITAS_TOKEN na Vercel com o mesmo valor.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

alter table public.ingestao_config add column if not exists sal text;
alter table public.ingestao_config alter column token drop not null;

insert into public.ingestao_config (id, token, sal) values (1, null, null)
  on conflict (id) do nothing;

-- Sal aleatório, gerado uma vez só. Trocar o sal apenas reinicia a contagem de pessoas do dia.
update public.ingestao_config
   set sal = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where id = 1 and (sal is null or sal = '');

-- O token deixa de ser exigido: o painel precisa funcionar sem configuração manual
update public.ingestao_config set token = null where id = 1;

drop function if exists public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);
drop function if exists public.registrar_evento_visita(text, text, text, text, int);

-- Monta o identificador anônimo do dia: impressão da Vercel + sal secreto + data.
-- Muda à meia-noite, não é reversível e o IP nunca passa por aqui.
create or replace function public.sessao_do_dia(p_impressao text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(btrim(p_impressao), '') = '' then null
    else left(encode(extensions.digest(
      btrim(p_impressao) || coalesce((select sal from public.ingestao_config where id = 1), '')
        || (now() at time zone 'America/Sao_Paulo')::date::text, 'sha256'), 'hex'), 32)
  end;
$$;
revoke all on function public.sessao_do_dia(text) from public;

create or replace function public.registrar_visita(
  p_token text, p_impressao text, p_caminho text, p_idioma text,
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

  -- Caminho tem que parecer caminho do site, para não entrar lixo
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
     origem, campanha, cep, latitude, longitude)
  values (
    v_sessao,
    left(p_caminho, 200),
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

create or replace function public.registrar_evento_visita(
  p_token text, p_impressao text, p_tipo text, p_valor text, p_numero int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token  text;
  v_sessao text;
begin
  select token into v_token from public.ingestao_config where id = 1;
  if v_token is not null and v_token <> coalesce(p_token, '') then
    raise exception 'token' using errcode = 'P0001';
  end if;

  v_sessao := public.sessao_do_dia(p_impressao);
  if v_sessao is null then return; end if;

  if p_tipo not in ('rolagem', 'tempo', 'projeto', 'curriculo', 'demo', 'contato',
                    'publicacao', 'video', 'imagem', 'secao', 'link') then
    return;
  end if;
  if (select count(*) from public.eventos_visita where criado_em > now() - interval '1 day') >= 60000 then
    return;
  end if;

  insert into public.eventos_visita (sessao, tipo, valor, numero)
  values (v_sessao, p_tipo, nullif(left(btrim(coalesce(p_valor, '')), 160), ''),
          case when p_numero between 0 and 100000 then p_numero end);
end;
$$;

revoke all on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.registrar_evento_visita(text, text, text, text, int) from public;
grant execute on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon;
grant execute on function public.registrar_evento_visita(text, text, text, text, int) to anon;
