-- 07/10 (Karina): pausa as mensagens por conta própria do Carinha pra
-- Isabela, Leonardo e Roberto enquanto o projeto do assistente é montado.
-- Conversa iniciada por eles continua sendo respondida.
update wpf_agente_pessoas set proativo = false
where nome_tasks in ('Isabela Castro', 'Leonardo Cavarge', 'Roberto Lifschitz');

-- Volta (quando a Karina liberar):
-- update wpf_agente_pessoas set proativo = true
-- where nome_tasks in ('Isabela Castro', 'Leonardo Cavarge', 'Roberto Lifschitz');
