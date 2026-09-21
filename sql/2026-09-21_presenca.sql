-- 21/09/2026 — Presença na Dash (quem está usando e onde). Canal PRIVADO do
-- Supabase Realtime "wpf-presenca": só quem está logado E na lista de
-- acesso (wpf_tem_acesso) pode entrar, ver e anunciar presença. Nada é
-- gravado em tabela; estas regras só autorizam o canal.
create policy "equipe presenca le" on realtime.messages for select to authenticated
  using ((select public.wpf_tem_acesso()) and realtime.messages.extension = 'presence' and (select realtime.topic()) = 'wpf-presenca');
create policy "equipe presenca envia" on realtime.messages for insert to authenticated
  with check ((select public.wpf_tem_acesso()) and realtime.messages.extension = 'presence' and (select realtime.topic()) = 'wpf-presenca');
