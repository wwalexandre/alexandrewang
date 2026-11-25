-- Revisão de segurança de 24/11/2026.
-- 1. Verificação em duas etapas (TOTP) para o admin: quem ativou só passa no is_admin()
--    com sessão aal2. Enquanto ninguém ativar, nada muda.
-- 2. Escrita em textos_site e itens_site passa a usar is_admin(), para valer a mesma regra.
-- 3. Funções internas fora do alcance de visitantes anônimos.
-- 4. Teto diário de domínios novos em registrar_clone: um Origin forjado em série
--    não vira enxurrada de e-mails nem enche a tabela.

-- 1. is_admin com duas etapas
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
     and (
       coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
       or not exists (
         select 1 from auth.mfa_factors f
         where f.user_id = (select auth.uid()) and f.status = 'verified'
       )
     );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2. Mesma regra para editar textos e cards do site
drop policy if exists "itens_site admin escreve" on public.itens_site;
create policy "itens_site admin escreve" on public.itens_site
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "textos_site admin escreve" on public.textos_site;
create policy "textos_site admin escreve" on public.textos_site
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- 3. Hash de sessão só é usado dentro das funções de registro (security definer)
revoke execute on function public.sessao_do_dia(text) from public, anon, authenticated;

-- 4. registrar_clone com teto diário
create or replace function public.registrar_clone(p_token text, p_dominio text, p_caminho text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token   text;
  v_dominio text;
  v_existe  boolean;
  v_novos   int := 0;
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

  v_existe := exists (select 1 from public.clones where dominio = v_dominio);

  if not v_existe then
    -- teto total, para um domínio hostil não encher a tabela
    if (select count(*) from public.clones) >= 500 then
      return false;
    end if;
    -- teto diário: no máximo 20 domínios novos gravados por dia
    select count(*) into v_novos from public.clones where primeira > now() - interval '1 day';
    if v_novos >= 20 then
      return false;
    end if;
  end if;

  insert into public.clones (dominio, caminho)
  values (v_dominio, nullif(left(btrim(coalesce(p_caminho, '')), 200), ''))
  on conflict (dominio) do update
    set vezes = public.clones.vezes + 1, ultima = now();

  -- avisa por e-mail só na primeira vez do domínio e no máximo 5 por dia
  return (not v_existe) and v_novos < 5;
end;
$$;
