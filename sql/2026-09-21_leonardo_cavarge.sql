-- 21/09/2026 — pedido da Karina: na Dash o Leonardo passa de "Leonardo Martins"
-- para "Leonardo Cavarge" (o nome que o robô já usa). Troca o nome em todas as
-- seções, inclusive nos históricos, pra uma versão restaurada não trazer o
-- nome antigo de volta. Rodar durante a troca do login (ninguém gravando).
update public.wpf_dashboard_data
set data = replace(data::text, '"Leonardo Martins"', '"Leonardo Cavarge"')::jsonb,
    updated_at = now()
where data::text like '%"Leonardo Martins"%';
