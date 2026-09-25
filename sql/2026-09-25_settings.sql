-- ═══════════════════════════════════════════════════════════════════════
-- WPF Dash — Aba Settings (etapa 1 do plano "Settings e Carinha") · 25/09/2026
-- Rodar ANTES de publicar a Dash e o Worker novos. Nada muda pra ninguém no
-- dia: todos continuam com WPF e CBTH e com tudo liberado.
-- Volta: 2026-09-25_settings_volta.sql
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- 1. Colunas novas na lista de acesso.
--    empresas: por empresa, "responsavel" (aparece como responsável) e
--    "acesso" (vê a empresa). Canário entra só como opção, desligada.
--    permissoes: chave → true/false. Chave que não estiver aqui vale o
--    padrão do papel (adm ligado, colab desligado) — é assim que uma
--    permissão nova "nasce".
alter table public.wpf_acesso
  add column if not exists empresas jsonb not null default
    '{"wpf":{"responsavel":true,"acesso":true},"cbth":{"responsavel":true,"acesso":true},"canario":{"responsavel":false,"acesso":false}}'::jsonb,
  add column if not exists permissoes jsonb not null default '{}'::jsonb;

-- 2. "Tudo liberado", como hoje, pras pessoas que já existem (as chaves do
--    CATALOGO_PERMISSOES de 25/09). Settings e Carinha NÃO estão aqui: são
--    só da Karina, travados no código e no Worker.
update public.wpf_acesso set permissoes = '{
  "tabTasks":true,"tasksCreate":true,"tasksEditName":true,"tasksEditDates":true,
  "tasksEditAssignee":true,"tasksEditKpi":true,"tasksDelete":true,"tasksRestore":true,
  "tabCrm":true,"crmEdit":true,"crmEditColors":true,
  "tabMarketing":true,
  "tabForms":true,"formsDeleteForm":true,"formsDeleteResponse":true
}'::jsonb
where permissoes = '{}'::jsonb;

-- 3. wpf_meu_acesso passa a devolver empresas e permissões. O tipo de
--    retorno muda, então a função é recriada (dentro da transação: a Dash
--    não fica sem ela).
drop function if exists public.wpf_meu_acesso();
create function public.wpf_meu_acesso()
returns table (login text, nome text, papel text, precisa_trocar_senha boolean, empresas jsonb, permissoes jsonb)
language sql stable security definer set search_path = '' as $$
  select a.login, a.nome, a.papel, a.precisa_trocar_senha, a.empresas, a.permissoes
  from public.wpf_acesso a
  join auth.users u on lower(u.email) = a.email
  where u.id = auth.uid();
$$;
revoke all on function public.wpf_meu_acesso() from public, anon;
grant execute on function public.wpf_meu_acesso() to authenticated;

commit;

-- Conferir depois de rodar:
--   select login, papel, empresas, permissoes from public.wpf_acesso order by login;
