-- 23/09/2026 — Carinha na Dash (janelinha da Karina). Mesma conversa do
-- WhatsApp, mas as mensagens da Dash ficam marcadas: a janela de 24h do
-- WhatsApp só pode contar mensagens do WhatsApp.
alter table public.wpf_whatsapp_messages add column if not exists canal text; -- null = WhatsApp; 'dash' = Dash
