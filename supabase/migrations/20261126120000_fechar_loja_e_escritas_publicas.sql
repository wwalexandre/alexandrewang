-- Fecha as tabelas de loja que o site não usa e tira escritas que o público não precisa.
-- 26/11/2026. Por que: as regras antigas deixavam qualquer conta logada criar produto e venda
-- com o preço que quisesse (pedido falso, preço alterado). As tabelas estão vazias e sem uso.

-- 1. Loja (produtos, vendas, itens_venda): só o admin, com duas etapas, mexe.
drop policy if exists produtos_select_policy on public.produtos;
drop policy if exists produtos_insert_policy on public.produtos;
drop policy if exists produtos_update_policy on public.produtos;
drop policy if exists produtos_delete_policy on public.produtos;
drop policy if exists vendas_select_policy on public.vendas;
drop policy if exists vendas_insert_policy on public.vendas;
drop policy if exists itens_venda_select_policy on public.itens_venda;
drop policy if exists itens_venda_insert_policy on public.itens_venda;

revoke all on public.produtos, public.vendas, public.itens_venda from anon, authenticated;
grant select, insert, update, delete on public.produtos, public.vendas, public.itens_venda to authenticated;

create policy "produtos admin" on public.produtos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "vendas admin" on public.vendas for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "itens_venda admin" on public.itens_venda for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- A função de venda não fica mais exposta na API.
revoke execute on function public.registrar_venda(jsonb) from public, anon, authenticated;

-- 2. Escritas que o público não precisa: o visitante só lê textos e itens do site.
revoke insert, update, delete, truncate on public.itens_site, public.textos_site from anon;
revoke all on public.bloqueios from anon;
