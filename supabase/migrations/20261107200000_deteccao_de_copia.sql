-- Migração: deteccao_de_copia
--
-- COMO FUNCIONA: não dá para impedir que copiem um site, porque todo HTML que chega ao
-- navegador pode ser salvo. O que dá para fazer é saber QUANDO aconteceu e ter prova.
--
-- O código copiado continua chamando a função /api/visita deste domínio. Quando isso
-- acontece de outro endereço, o navegador manda o cabeçalho `Origin` com o domínio de
-- quem copiou, e é esse o sinal. Antes essa chamada era descartada em silêncio.
--
-- Há dois caminhos de detecção, e basta um funcionar:
--   1. a chamada normal do registro de visita, feita de um domínio que não é o nosso;
--   2. o bloco marcaDeCopia em assets/js/main.js, que compara location.hostname e, se
--      estiver fora, avisa pelo endereço absoluto.
--
-- O e-mail sai só na PRIMEIRA vez que cada domínio aparece. Depois disso o contador sobe
-- e a data da última vez é atualizada, sem encher a caixa de entrada.
-- Idempotente: pode ser reaplicada sem duplicar objetos.

create table if not exists public.clones (
  dominio    varchar(160) primary key,
  caminho    varchar(200),
  vezes      int not null default 1,
  primeira   timestamptz not null default now(),
  ultima     timestamptz not null default now()
);
create index if not exists idx_clones_ultima on public.clones (ultima desc);

alter table public.clones enable row level security;
revoke all on public.clones from anon, authenticated;
grant select, delete on public.clones to authenticated;

drop policy if exists clones_select_admin on public.clones;
create policy clones_select_admin on public.clones
  for select to authenticated using ((select public.is_admin()));

drop policy if exists clones_delete_admin on public.clones;
create policy clones_delete_admin on public.clones
  for delete to authenticated using ((select public.is_admin()));

-- Devolve true só quando o domínio aparece pela primeira vez, que é quando vale avisar.
create or replace function public.registrar_clone(p_token text, p_dominio text, p_caminho text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token   text;
  v_dominio text;
  v_novo    boolean := false;
begin
  select token into v_token from public.ingestao_config where id = 1;
  if v_token is not null and v_token <> coalesce(p_token, '') then
    raise exception 'token' using errcode = 'P0001';
  end if;

  v_dominio := lower(nullif(left(btrim(coalesce(p_dominio, '')), 160), ''));
  if v_dominio is null or v_dominio !~ '^[a-z0-9.:-]+$' then
    return false;
  end if;

  -- domínios do próprio Alexandre e ambiente local não são cópia
  if v_dominio = 'alexandrewang.vercel.app'
     or v_dominio like '%.vercel.app'
     or v_dominio in ('localhost', '127.0.0.1', '[::1]')
     or v_dominio like 'localhost:%'
     or v_dominio like '127.0.0.1:%' then
    return false;
  end if;

  -- teto, para um domínio hostil não encher a tabela
  if (select count(*) from public.clones) >= 500 then
    return false;
  end if;

  insert into public.clones (dominio, caminho)
  values (v_dominio, nullif(left(btrim(coalesce(p_caminho, '')), 200), ''))
  on conflict (dominio) do update
    set vezes = public.clones.vezes + 1, ultima = now();

  select (vezes = 1) into v_novo from public.clones where dominio = v_dominio;
  return coalesce(v_novo, false);
end;
$$;

revoke all on function public.registrar_clone(text, text, text) from public;
grant execute on function public.registrar_clone(text, text, text) to anon;
