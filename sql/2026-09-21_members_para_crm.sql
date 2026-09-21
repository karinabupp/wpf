-- 21/09/2026 — pedido da Karina: tudo o que a aba Members tinha por país vai
-- pra planilha do CRM (antiga Members 2, seção members2). Os status já foram
-- copiados em 16/09 (regra da época) e não são mexidos aqui. A seção
-- "federations" NÃO é apagada (fica como segurança; a aba saiu do menu).
-- Colunas novas (só entram se ainda não existirem) e valores por país
-- (só onde há valor; o que já estiver na planilha ganha).
with novas(ord, col) as (values
  (1, '{"id":"torneios","nome":"Principais torneios","tipo":"texto"}'::jsonb),
  (2, '{"id":"trading","nome":"Trading","tipo":"select","opcoes":["Sim","Não"]}'),
  (3, '{"id":"redeSocial","nome":"Rede social","tipo":"texto"}'),
  (4, '{"id":"website","nome":"Website","tipo":"texto"}'),
  (5, '{"id":"midiaAtiva","nome":"Mídia ativa","tipo":"select","opcoes":["Sim","Não"]}'),
  (6, '{"id":"campeaoNacional","nome":"Campeão nacional","tipo":"select","opcoes":["Sim","Não"]}'),
  (7, '{"id":"selecaoNacional","nome":"Seleção nacional","tipo":"select","opcoes":["Sim","Não"]}'),
  (8, '{"id":"representanteFeminina","nome":"Representante feminina","tipo":"select","opcoes":["Sim","Não"]}')
),
f as (select e.key pais, e.value v from public.wpf_dashboard_data, jsonb_each(data) e where section = 'federations'),
vals as (
  select pais, jsonb_strip_nulls(jsonb_build_object(
    'torneios', nullif(btrim(v->>'tournaments'), ''),
    'trading', case when v->>'trading' = 'true' then 'Sim' end,
    'redeSocial', nullif(btrim(v->>'social'), ''),
    'website', nullif(btrim(v->>'website'), ''),
    'midiaAtiva', case v->'checklist'->>'activeMedia' when 'true' then 'Sim' when 'false' then 'Não' end,
    'campeaoNacional', case v->'checklist'->>'nationalChampion' when 'true' then 'Sim' when 'false' then 'Não' end,
    'selecaoNacional', case v->'checklist'->>'nationalTeam' when 'true' then 'Sim' when 'false' then 'Não' end,
    'representanteFeminina', case v->'checklist'->>'womanRepresentative' when 'true' then 'Sim' when 'false' then 'Não' end
  )) o from f
),
m as (select data from public.wpf_dashboard_data where section = 'members2'),
colunas as (
  select coalesce(m.data->'colunas', '[]'::jsonb) || coalesce((select jsonb_agg(n.col order by n.ord) from novas n
    where not exists (select 1 from jsonb_array_elements(coalesce(m.data->'colunas','[]'::jsonb)) c where c->>'id' = n.col->>'id')), '[]'::jsonb) c
  from m
),
paises as (
  select coalesce(m.data->'paises', '{}'::jsonb) || coalesce((select jsonb_object_agg(v.pais, v.o || coalesce(m.data->'paises'->v.pais, '{}'::jsonb))
    from vals v where v.o <> '{}'::jsonb), '{}'::jsonb) p
  from m
)
update public.wpf_dashboard_data d
set data = jsonb_set(jsonb_set(d.data, '{colunas}', (select c from colunas)), '{paises}', (select p from paises)),
    updated_at = now()
where d.section = 'members2';
