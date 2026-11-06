-- Migração: junta_home
--
-- `/` e `/index.html` são a mesma página, mas apareciam como duas linhas separadas no
-- painel, o que dividia a contagem da home ao meio. O mesmo vale para `/en.html`, que já
-- era único. A partir daqui o caminho é normalizado na hora de gravar, e o histórico que
-- já existe é corrigido de uma vez.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

-- 1) Normaliza na gravação
create or replace function public.caminho_canonico(p_caminho text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_caminho in ('/index.html', '/index.htm') then '/'
    when p_caminho like '/%/' and length(p_caminho) > 1 then rtrim(p_caminho, '/')
    else p_caminho
  end;
$$;
revoke all on function public.caminho_canonico(text) from public;

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
    v_lat, v_lon
  );
end;
$$;

revoke all on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.registrar_visita(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon;

-- 2) Mesma normalização nos eventos, onde o caminho vai no campo valor
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
  v_valor  text;
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

  v_valor := nullif(left(btrim(coalesce(p_valor, '')), 160), '');
  if p_tipo in ('rolagem', 'tempo', 'projeto', 'publicacao') and v_valor like '/%' then
    v_valor := public.caminho_canonico(v_valor);
  end if;

  insert into public.eventos_visita (sessao, tipo, valor, numero)
  values (v_sessao, p_tipo, v_valor,
          case when p_numero between 0 and 100000 then p_numero end);
end;
$$;

revoke all on function public.registrar_evento_visita(text, text, text, text, int) from public;
grant execute on function public.registrar_evento_visita(text, text, text, text, int) to anon;

-- 3) Corrige o histórico de uma vez
update public.visitas set caminho = '/' where caminho in ('/index.html', '/index.htm');
update public.eventos_visita set valor = '/'
 where valor in ('/index.html', '/index.htm')
   and tipo in ('rolagem', 'tempo', 'projeto', 'publicacao');
