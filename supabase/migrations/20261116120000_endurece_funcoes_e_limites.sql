-- Endurecimento depois da revisão de segurança de 2026-11-16.
--
-- 1. Funções que o visitante anônimo não precisa chamar perdem o EXECUTE.
--    O Supabase concede EXECUTE direto a anon e authenticated, então revogar de public não basta.
--    - limpar_visitas_antigas: apaga dados e não checa quem chama. Fica só para o dono (SQL editor).
--    - resumo_visitas e resumo_extra: já checam is_admin() por dentro; o painel chama logado.
--    - registrar_venda: exige auth.uid(); é do projeto do curso e só faz sentido logado.
-- 2. Limite de tamanho nas mensagens de contato, para um robô não encher o banco com textos enormes
--    (o limite de envios por hora já existe na função enviar_mensagem).
--
-- Para desfazer: grant execute on function <função> to anon, authenticated;
--                alter table public.mensagens_contato drop constraint mensagens_contato_tamanho;

revoke execute on function public.limpar_visitas_antigas() from public, anon, authenticated;

revoke execute on function public.resumo_visitas(integer) from public, anon;
revoke execute on function public.resumo_extra(integer) from public, anon;
revoke execute on function public.registrar_venda(jsonb) from public, anon;
grant execute on function public.resumo_visitas(integer) to authenticated;
grant execute on function public.resumo_extra(integer) to authenticated;
grant execute on function public.registrar_venda(jsonb) to authenticated;

alter table public.mensagens_contato
  add constraint mensagens_contato_tamanho check (
    char_length(nome) <= 120
    and char_length(email) <= 160
    and char_length(coalesce(assunto, '')) <= 200
    and char_length(mensagem) <= 5000
  );
