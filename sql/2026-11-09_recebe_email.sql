-- 09/11/2026 — Avisos de e-mail do Carinha (pedido do Leonardo, aprovado pela Karina)
-- Aplicado pelo conector do Supabase (projeto "operation dashboard").

-- 1) Contenção: os 3 avisos de e-mail que estavam na fila do Leonardo não saem mais.
update wpf_agente_avisos set avisado_em = now(), via = 'descartado_pedido'
where telefone = '5511996123232' and chave like 'email|%' and avisado_em is null;

-- 2) Por pessoa: false = o e-mail continua guardado, mas não vira aviso.
alter table wpf_agente_pessoas add column if not exists recebe_email boolean not null default true;
update wpf_agente_pessoas set recebe_email = false where telefone = '5511996123232'; -- Leonardo

-- 3) Validade do aviso (convite de reunião: fim do dia do evento).
alter table wpf_agente_avisos add column if not exists valido_ate timestamptz;
