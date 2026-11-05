-- Migração: portfolio_contato_leads_admin
-- Já aplicada no projeto Supabase "antgravity" em 2026-11-05 (versão 20261105194119).
-- Idempotente: pode ser reaplicada sem duplicar objetos.

-- 1) Administradores
create table if not exists public.admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) Mensagens de contato
create table if not exists public.mensagens_contato (
  id        bigint generated always as identity primary key,
  nome      varchar(100)  not null check (char_length(btrim(nome)) >= 2),
  email     varchar(160)  not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  assunto   varchar(120),
  mensagem  varchar(2000) not null check (char_length(btrim(mensagem)) >= 10),
  idioma    varchar(2)    not null default 'pt' check (idioma in ('pt', 'en')),
  lida      boolean       not null default false,
  criado_em timestamptz   not null default now()
);

create index if not exists idx_mensagens_contato_criado_em
  on public.mensagens_contato (criado_em desc);

-- 3) Leads
create table if not exists public.leads (
  id        bigint generated always as identity primary key,
  email     varchar(160) not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  origem    varchar(30)  not null check (origem in ('curriculo', 'arquivo', 'demo')),
  idioma    varchar(2)   not null default 'pt' check (idioma in ('pt', 'en')),
  criado_em timestamptz  not null default now()
);

create index if not exists idx_leads_criado_em
  on public.leads (criado_em desc);

-- 4) RLS em todas as tabelas
alter table public.admins            enable row level security;
alter table public.mensagens_contato enable row level security;
alter table public.leads             enable row level security;

-- 5) Privilégios mínimos
revoke all on public.admins            from anon, authenticated;
revoke all on public.mensagens_contato from anon, authenticated;
revoke all on public.leads             from anon, authenticated;

grant select on public.admins to authenticated;
grant insert on public.mensagens_contato to anon, authenticated;
grant select, update, delete on public.mensagens_contato to authenticated;
grant insert on public.leads to anon, authenticated;
grant select, delete on public.leads to authenticated;

-- 6) Políticas: admins
drop policy if exists admins_select_proprio on public.admins;
create policy admins_select_proprio on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 7) Políticas: mensagens_contato
drop policy if exists mensagens_insert_publico on public.mensagens_contato;
create policy mensagens_insert_publico on public.mensagens_contato
  for insert to anon, authenticated
  with check (lida = false);

drop policy if exists mensagens_select_admin on public.mensagens_contato;
create policy mensagens_select_admin on public.mensagens_contato
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists mensagens_update_admin on public.mensagens_contato;
create policy mensagens_update_admin on public.mensagens_contato
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists mensagens_delete_admin on public.mensagens_contato;
create policy mensagens_delete_admin on public.mensagens_contato
  for delete to authenticated
  using ((select public.is_admin()));

-- 8) Políticas: leads
drop policy if exists leads_insert_publico on public.leads;
create policy leads_insert_publico on public.leads
  for insert to anon, authenticated
  with check (origem in ('curriculo', 'arquivo', 'demo'));

drop policy if exists leads_select_admin on public.leads;
create policy leads_select_admin on public.leads
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists leads_delete_admin on public.leads;
create policy leads_delete_admin on public.leads
  for delete to authenticated
  using ((select public.is_admin()));
