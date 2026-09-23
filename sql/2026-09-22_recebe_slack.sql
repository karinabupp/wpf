-- 22/09/2026 — REGRA DA KARINA (não pode quebrar), o que cada um recebe:
--   Leonardo e Roberto: só o que é das tarefas deles.
--   Isabela: as tarefas dela + Slack.
--   Karina: as dela + Slack + e-mail + tarefas dos outros SÓ quando pedir.
-- Slack passa a ser por pessoa:
alter table public.wpf_agente_pessoas add column if not exists recebe_slack boolean not null default false;
update public.wpf_agente_pessoas set recebe_slack = (nome_tasks in ('Karina Bupp', 'Isabela Castro'));
