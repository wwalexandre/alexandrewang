-- Migração: limites_e_detalhe_dos_leads
-- 1) Visitante deixa de inserir direto nas tabelas: passa a gravar por duas funções
--    que validam os dados e limitam envios no servidor (o intervalo do navegador era fácil de contornar).
-- 2) Leads ganham a coluna "detalhe" (qual demonstração ou arquivo pediu o e-mail).
-- Idempotente: pode ser reaplicada sem duplicar objetos.

-- Detalhe do lead
alter table public.leads add column if not exists detalhe varchar(120);

-- Índices usados pelas checagens de limite
create index if not exists idx_mensagens_contato_email_criado_em
  on public.mensagens_contato (email, criado_em desc);
create index if not exists idx_leads_email_criado_em
  on public.leads (email, criado_em desc);

-- Fim do insert direto pelo visitante
drop policy if exists mensagens_insert_publico on public.mensagens_contato;
drop policy if exists leads_insert_publico on public.leads;
revoke insert on public.mensagens_contato from anon, authenticated;
revoke insert on public.leads from anon, authenticated;

-- Mensagem de contato: até 3 por e-mail por hora e 30 no total por hora.
-- Erro "limite" quando passa do limite; o site mostra "aguarde" e não reenvia.
create or replace function public.enviar_mensagem(
  p_nome text, p_email text, p_assunto text, p_mensagem text, p_idioma text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if (select count(*) from public.mensagens_contato
       where email = v_email and criado_em > now() - interval '1 hour') >= 3
     or (select count(*) from public.mensagens_contato
       where criado_em > now() - interval '1 hour') >= 30 then
    raise exception 'limite' using errcode = 'P0001';
  end if;

  insert into public.mensagens_contato (nome, email, assunto, mensagem, idioma)
  values (
    btrim(p_nome),
    v_email,
    nullif(btrim(coalesce(p_assunto, '')), ''),
    btrim(p_mensagem),
    case when p_idioma = 'en' then 'en' else 'pt' end
  );
end;
$$;

-- Lead: ignora repetição (mesmo e-mail, origem e detalhe em 24 h) e para de gravar
-- acima de 500 por dia. Nunca devolve erro ao visitante.
create or replace function public.registrar_lead(
  p_email text, p_origem text, p_idioma text, p_detalhe text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_detalhe text := nullif(left(btrim(coalesce(p_detalhe, '')), 120), '');
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160
     or p_origem not in ('curriculo', 'arquivo', 'demo') then
    return;
  end if;

  if exists (select 1 from public.leads
              where email = v_email and origem = p_origem
                and detalhe is not distinct from v_detalhe
                and criado_em > now() - interval '24 hours')
     or (select count(*) from public.leads
          where criado_em > now() - interval '24 hours') >= 500 then
    return;
  end if;

  insert into public.leads (email, origem, idioma, detalhe)
  values (v_email, p_origem, case when p_idioma = 'en' then 'en' else 'pt' end, v_detalhe);
end;
$$;

revoke all on function public.enviar_mensagem(text, text, text, text, text) from public;
revoke all on function public.registrar_lead(text, text, text, text) from public;
grant execute on function public.enviar_mensagem(text, text, text, text, text) to anon, authenticated;
grant execute on function public.registrar_lead(text, text, text, text) to anon, authenticated;
