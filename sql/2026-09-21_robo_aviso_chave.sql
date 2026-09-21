-- 21/09/2026 — robô: cada mensagem de aviso guarda de qual assunto é, pros
-- botões (Ver detalhes / Falar com… / Já vi) saberem do que se trata.
alter table public.wpf_whatsapp_messages add column if not exists aviso_chave text;
create index if not exists wpf_whatsapp_messages_wa_id on public.wpf_whatsapp_messages (wa_message_id);
