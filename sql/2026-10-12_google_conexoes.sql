-- 2026-10-12 — Conexão Google (Gmail + Agenda + Drive) por pessoa
-- Aprovado pela Karina em 12/10. Aplicado pelo conector do Supabase.

-- 1) Conexões Google, uma linha por pessoa. RLS ligado e sem política:
--    só o robô (service role) lê e grava; a Dash nunca vê.
create table if not exists public.wpf_agente_google (
  email           text primary key,          -- conta Google da pessoa (a mesma de wpf_acesso)
  refresh_token   text not null,             -- chave que o Google devolve; nunca sai do robô
  escopos         text,                      -- o que a pessoa autorizou
  gmail_ultimo    text,                      -- historyId: até onde o robô já leu o Gmail
  ativo           boolean not null default true,
  conectado_em    timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
alter table public.wpf_agente_google enable row level security;

-- 2) E-mails passam a ter dono (até hoje só existia o Gmail da Karina).
alter table public.wpf_agente_emails add column if not exists dono text;
update public.wpf_agente_emails set dono = 'karina@worldpokerfederation.org' where dono is null;

-- VOLTA (desfazer):
-- drop table if exists public.wpf_agente_google;
-- alter table public.wpf_agente_emails drop column if exists dono;
