-- Modo de edicao ao vivo: correcoes de texto feitas pelo dono do site
-- (original -> novo, por pagina). A pagina aplica na carga, como texto puro.
-- Aplicada no Supabase em 16/11/2026; registrada no repositorio em 18/11/2026.

create table if not exists public.textos_site (
  id bigint generated always as identity primary key,
  pagina text not null,
  original text not null,
  novo text not null,
  atualizado_em timestamptz not null default now(),
  constraint textos_site_unico unique (pagina, original),
  constraint textos_site_tamanho check (char_length(original) <= 4000 and char_length(novo) <= 4000)
);

alter table public.textos_site enable row level security;

drop policy if exists "textos_site leitura publica" on public.textos_site;
create policy "textos_site leitura publica"
  on public.textos_site for select
  to anon, authenticated
  using (true);

drop policy if exists "textos_site admin escreve" on public.textos_site;
create policy "textos_site admin escreve"
  on public.textos_site for all
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
