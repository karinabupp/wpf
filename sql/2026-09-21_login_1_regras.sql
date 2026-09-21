-- ═══════════════════════════════════════════════════════════════════════
-- WPF Dash — Login de verdade (Supabase Auth) · 21/09/2026 · PASSO 1
-- Aplicado na troca, junto com a publicação da Dash nova.
-- Volta: 2026-09-21_login_volta.sql
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Lista de acesso: quem pode usar a Dash e com qual papel.
--    Para dar/tirar acesso: inserir/apagar linha aqui (e o usuário no Auth).
create table if not exists public.wpf_acesso (
  email text primary key check (email = lower(email)),
  login text not null unique,
  nome text not null,                 -- mesmo nome da seção "users" / Tasks
  papel text not null check (papel in ('adm', 'colab')),
  precisa_trocar_senha boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.wpf_acesso enable row level security;   -- sem política: só pelas funções abaixo
revoke all on public.wpf_acesso from anon, authenticated;

insert into public.wpf_acesso (email, login, nome, papel) values
  ('karina@worldpokerfederation.org',   'karina',   'Karina Bupp',       'adm'),
  ('isabela@worldpokerfederation.org',  'isabela',  'Isabela Castro',    'colab'),
  ('leonardo@worldpokerfederation.org', 'leonardo', 'Leonardo Cavarge',  'colab'),
  ('roberto@worldpokerfederation.org',  'roberto',  'Roberto Lifschitz', 'colab')
on conflict (email) do nothing;

-- 2. Funções (security definer: leem a lista sem abri-la pra ninguém).
create or replace function public.wpf_tem_acesso() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wpf_acesso a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid()
  );
$$;

create or replace function public.wpf_meu_acesso()
returns table (login text, nome text, papel text, precisa_trocar_senha boolean)
language sql stable security definer set search_path = '' as $$
  select a.login, a.nome, a.papel, a.precisa_trocar_senha
  from public.wpf_acesso a
  join auth.users u on lower(u.email) = a.email
  where u.id = auth.uid();
$$;

create or replace function public.wpf_senha_trocada() returns void
language sql volatile security definer set search_path = '' as $$
  update public.wpf_acesso a set precisa_trocar_senha = false
  from auth.users u
  where lower(u.email) = a.email and u.id = auth.uid();
$$;

revoke all on function public.wpf_tem_acesso()    from public, anon;
revoke all on function public.wpf_meu_acesso()    from public, anon;
revoke all on function public.wpf_senha_trocada() from public, anon;
grant execute on function public.wpf_tem_acesso()    to authenticated;
grant execute on function public.wpf_meu_acesso()    to authenticated;
grant execute on function public.wpf_senha_trocada() to authenticated;

-- 3. Dados da Dash: só a equipe logada. (O robô usa a secret key e não muda.)
drop policy if exists "Allow anon read"   on public.wpf_dashboard_data;
drop policy if exists "Allow anon write"  on public.wpf_dashboard_data;
drop policy if exists "Allow anon update" on public.wpf_dashboard_data;
create policy "equipe le"     on public.wpf_dashboard_data for select to authenticated
  using ((select public.wpf_tem_acesso()));
create policy "equipe cria"   on public.wpf_dashboard_data for insert to authenticated
  with check ((select public.wpf_tem_acesso()));
create policy "equipe altera" on public.wpf_dashboard_data for update to authenticated
  using ((select public.wpf_tem_acesso())) with check ((select public.wpf_tem_acesso()));

-- 4. Formulários: o público vê só formulário publicado e só ENVIA resposta.
alter table public.wpf_forms enable row level security;
create policy "publico le publicado" on public.wpf_forms for select to anon
  using (status = 'published');
create policy "equipe tudo" on public.wpf_forms for all to authenticated
  using ((select public.wpf_tem_acesso())) with check ((select public.wpf_tem_acesso()));

alter table public.wpf_form_responses enable row level security;
create policy "publico envia resposta" on public.wpf_form_responses for insert to anon, authenticated
  with check (exists (select 1 from public.wpf_forms f where f.id = form_id and f.status = 'published'));
create policy "equipe tudo" on public.wpf_form_responses for all to authenticated
  using ((select public.wpf_tem_acesso())) with check ((select public.wpf_tem_acesso()));

-- 5. Slack: só a equipe logada lê. (O Worker do Slack grava com a secret key.)
alter table public.wpf_slack_messages enable row level security;
create policy "equipe le" on public.wpf_slack_messages for select to authenticated
  using ((select public.wpf_tem_acesso()));
