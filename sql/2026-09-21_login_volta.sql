-- ═══════════════════════════════════════════════════════════════════════
-- VOLTA do passo 1 (só se a troca der errado ANTES do passo 2).
-- Reabre tudo como era antes de 21/09. Voltar também o index.html anterior.
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "equipe le"     on public.wpf_dashboard_data;
drop policy if exists "equipe cria"   on public.wpf_dashboard_data;
drop policy if exists "equipe altera" on public.wpf_dashboard_data;
create policy "Allow anon read"   on public.wpf_dashboard_data for select to public using (true);
create policy "Allow anon write"  on public.wpf_dashboard_data for insert to public with check (true);
create policy "Allow anon update" on public.wpf_dashboard_data for update to public using (true);

drop policy if exists "publico le publicado" on public.wpf_forms;
drop policy if exists "equipe tudo"          on public.wpf_forms;
alter table public.wpf_forms disable row level security;
drop policy if exists "publico envia resposta" on public.wpf_form_responses;
drop policy if exists "equipe tudo"            on public.wpf_form_responses;
alter table public.wpf_form_responses disable row level security;
drop policy if exists "equipe le" on public.wpf_slack_messages;
alter table public.wpf_slack_messages disable row level security;
-- wpf_acesso e as funções podem ficar: sozinhas não mudam nada.
