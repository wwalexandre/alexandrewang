-- Aba Conteudo do painel /admin/: cada card da home (trajetoria, projeto,
-- publicacao) pode ser marcado como oculto. Leitura publica, escrita so admin.
-- Aplicada no Supabase em 13/11/2026; registrada no repositorio em 18/11/2026.

create table if not exists public.itens_site (
  slug text primary key,
  tipo text not null check (tipo in ('trajetoria', 'projeto', 'publicacao')),
  titulo text not null,
  ordem integer not null default 0,
  oculto boolean not null default false,
  atualizado_em timestamptz not null default now()
);

alter table public.itens_site enable row level security;

drop policy if exists "itens_site leitura publica" on public.itens_site;
create policy "itens_site leitura publica"
  on public.itens_site for select
  to anon, authenticated
  using (true);

drop policy if exists "itens_site admin escreve" on public.itens_site;
create policy "itens_site admin escreve"
  on public.itens_site for all
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create or replace function public.itens_site_touch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists itens_site_touch on public.itens_site;
create trigger itens_site_touch
  before update on public.itens_site
  for each row execute function public.itens_site_touch();
