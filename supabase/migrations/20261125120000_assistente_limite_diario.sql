-- Assistente do site (aba "Pergunte"): limite diário de perguntas.
-- O plano gratuito do Gemini tem cota diária pequena. Sem limite, uma pessoa sozinha
-- gastaria a cota do dia inteiro. Aqui fica só a contagem: nem o IP nem o texto da
-- pergunta são gravados, apenas o código fixo da rede (o mesmo do bloqueio) e a hora.

create table if not exists public.perguntas_chat (
  id        bigint generated always as identity primary key,
  rede_id   char(32),
  criado_em timestamptz not null default now()
);
create index if not exists perguntas_chat_criado_em on public.perguntas_chat (criado_em);
create index if not exists perguntas_chat_rede on public.perguntas_chat (rede_id, criado_em);

alter table public.perguntas_chat enable row level security;
revoke all on public.perguntas_chat from anon, authenticated;
grant select on public.perguntas_chat to authenticated;
create policy "perguntas_chat admin le" on public.perguntas_chat
  for select to authenticated using ((select public.is_admin()));

-- Chamada só pela função api/chat.js (com o token). Devolve true se a pergunta pode seguir.
create or replace function public.registrar_pergunta(p_token text, p_ip text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_rede  char(32);
begin
  select token into v_token from public.ingestao_config where id = 1;
  if v_token is not null and v_token <> coalesce(p_token, '') then
    raise exception 'token' using errcode = 'P0001';
  end if;

  v_rede := public.rede_do_ip(p_ip);

  -- rede bloqueada no painel não pergunta
  if v_rede is not null and exists (select 1 from public.bloqueios b where b.rede_id = v_rede) then
    return false;
  end if;

  -- 20 perguntas por rede e 200 no total, a cada 24 horas
  if v_rede is not null and (select count(*) from public.perguntas_chat
        where rede_id = v_rede and criado_em > now() - interval '1 day') >= 20 then
    return false;
  end if;
  if (select count(*) from public.perguntas_chat where criado_em > now() - interval '1 day') >= 200 then
    return false;
  end if;

  insert into public.perguntas_chat (rede_id) values (v_rede);
  delete from public.perguntas_chat where criado_em < now() - interval '3 days';
  return true;
end;
$$;

revoke execute on function public.registrar_pergunta(text, text) from public, authenticated;
grant execute on function public.registrar_pergunta(text, text) to anon;
