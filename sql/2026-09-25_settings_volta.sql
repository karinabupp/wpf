-- Volta do 2026-09-25_settings.sql: função antiga e sem as colunas novas.
-- Só rodar se a Dash publicada for a de antes da Settings.
begin;
drop function if exists public.wpf_meu_acesso();
create function public.wpf_meu_acesso()
returns table (login text, nome text, papel text, precisa_trocar_senha boolean)
language sql stable security definer set search_path = '' as $$
  select a.login, a.nome, a.papel, a.precisa_trocar_senha
  from public.wpf_acesso a
  join auth.users u on lower(u.email) = a.email
  where u.id = auth.uid();
$$;
revoke all on function public.wpf_meu_acesso() from public, anon;
grant execute on function public.wpf_meu_acesso() to authenticated;
alter table public.wpf_acesso drop column if exists empresas, drop column if exists permissoes;
commit;
