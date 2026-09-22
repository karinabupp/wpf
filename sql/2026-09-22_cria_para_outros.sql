-- 22/09/2026 — Karina: a Isabela pode criar linhas com OUTRAS pessoas como
-- responsáveis (antes só a admin). Permissão por pessoa, no cadastro do robô.
alter table public.wpf_agente_pessoas add column if not exists cria_para_outros boolean not null default false;
update public.wpf_agente_pessoas set cria_para_outros = true where nome_tasks = 'Isabela Castro';
