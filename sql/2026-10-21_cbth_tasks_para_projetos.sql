-- 2026-10-21 — CBTH: Tasks (tasks2__cbth) → Projetos (projetos__cbth). Conversão direta (Karina, 13h29: "pode").
-- Passo 1 (este arquivo): gera o resultado em tmp_projetos_cbth_2026-10-21, pra conferir antes.
-- Passo 2 (depois do OK): copia pra projetos__cbth. A Tasks da CBTH NÃO é alterada.
--
-- Regras (as mesmas da migração da WPF em 08/10, com 6 níveis):
--   Objetivo   → campo objetivo da entrega (autoridade / alcance / governanca)
--   Meta       → Entrega (nível 0) · Projeto → Etapa · Entregável → Tarefa · o resto → Subtarefa
--   areaLink   → frente (iniciativas → institucional, que aparece como "Eventos", igual à WPF em 20/10)
--   paisLink   → tag de lugar (estado)
--   Status das pontas: Done → finalizado · Cancelled → cancelado · On Hold → bloqueado ·
--     In Progress / Late / Deadline → andamento · Not Started → naoiniciado.
--   Mães: status e datas calculados pelas filhas (mesma regra da Dash, calcularMaes).
--   Nome limpo (regra de 13/10): "(pré CBPE)" → "antes da CBPE"; "(+15%)" sai do nome e vai pro Critério.
--   Ids: pj-cbth-<id antigo>. Histórico: "Migrada da Tasks da CBTH".

create or replace function pg_temp.agora() returns text language sql as $$ select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

create or replace function pg_temp.nome_limpo(n text) returns text language sql as $$
  select btrim(regexp_replace(regexp_replace(n, '\s*\(pré CBPE\)', ' antes da CBPE', 'g'), '\s*\(\+15%\)', '', 'g'))
$$;

create or replace function pg_temp.st_ponta(s text) returns text language sql as $$
  select case s when 'Done' then 'finalizado' when 'Cancelled' then 'cancelado' when 'On Hold' then 'bloqueado'
    when 'Not Started' then 'naoiniciado' else 'andamento' end
$$;

-- Status da mãe (igual a statusDasFilhas da Dash).
create or replace function pg_temp.st_mae(fs jsonb) returns text language sql as $$
  with v as (select f->>'status' s from jsonb_array_elements(fs) f where f->>'status' <> 'cancelado')
  select case
    when not exists (select 1 from v) then 'cancelado'
    when not exists (select 1 from v where s <> 'finalizado') then 'finalizado'
    when not exists (select 1 from v where s not in ('finalizado','bloqueado')) then 'bloqueado'
    when not exists (select 1 from v where s not in ('naoiniciado','detalhar','bloqueado')) then 'naoiniciado'
    else 'andamento' end
$$;

create or replace function pg_temp.conv(n jsonb, nivel int, objetivo text, frente text, caminho text) returns jsonb language plpgsql volatile as $$
declare fs jsonb := '[]'; k jsonb; r jsonb; nome text := pg_temp.nome_limpo(n->>'name'); st text; ini text; fim text; crit text := '';
begin
  for k in select * from jsonb_array_elements(coalesce(n->'subtasks','[]')) loop
    if jsonb_typeof(k) = 'object' then fs := fs || jsonb_build_array(pg_temp.conv(k, nivel + 1, objetivo, frente, caminho || ' › ' || (n->>'name'))); end if;
  end loop;
  if jsonb_array_length(fs) > 0 then
    st := pg_temp.st_mae(fs);
    select min(f->>'startDate') filter (where coalesce(f->>'startDate','') <> ''), max(f->>'endDate') filter (where coalesce(f->>'endDate','') <> '')
      into ini, fim from jsonb_array_elements(fs) f where f->>'status' <> 'cancelado';
  else
    st := pg_temp.st_ponta(n->>'status');
  end if;
  if n->>'name' ~ '\(\+15%\)' then crit := '• +15% de seguidores'; end if;
  r := jsonb_build_object(
    'id', 'pj-cbth-' || (n->>'id'), 'nome', nome, 'criterio', crit,
    'tags', jsonb_build_object('lugares', case when coalesce(n->>'paisLink','') <> '' then jsonb_build_array(n->>'paisLink') else '[]'::jsonb end,
                               'pessoas','[]'::jsonb,'empresas','[]'::jsonb,'associacoes','[]'::jsonb),
    'frente', case when nivel = 0 then frente else '' end, 'objetivo', case when nivel = 0 then objetivo else '' end,
    'status', st,
    'startDate', coalesce(ini, n->>'startDate', ''), 'endDate', coalesce(fim, n->>'endDate', ''), 'finalizadoEm', '',
    'assignees', coalesce(n->'assignees','[]'::jsonb),
    'prioridade','', 'dificuldade','', 'proximaAcao','', 'dependeDe','',
    'bloqueios','[]'::jsonb, 'checklist','[]'::jsonb, 'subtasks', fs,
    'historico', jsonb_build_array(jsonb_build_object('id','h-cbth-'||(n->>'id'),'tipo','edicao','autor','Claude (a pedido da Karina)',
      'texto','Migrada da Tasks da CBTH (' || caminho || ' › ' || (n->>'name') || '; status lá: ' || coalesce(n->>'status','—') || ')' ||
        case when nome <> n->>'name' then '. Nome antes: ' || (n->>'name') else '' end,
      'quando',pg_temp.agora())));
  return r;
end $$;

-- Objetivo (nível 0 da Tasks) → cada Meta vira uma entrega.
insert into wpf_dashboard_data (section, data, revision, updated_at)
select 'tmp_projetos_cbth_2026-10-21',
  (select jsonb_agg(pg_temp.conv(m, 0,
      case when o->>'name' ilike '%autoridade%' then 'autoridade' when o->>'name' ilike '%alcance%' then 'alcance' when o->>'name' ilike '%governan%' then 'governanca' else '' end,
      case coalesce(nullif(m->>'areaLink',''), o->>'areaLink', '') when 'iniciativas' then 'institucional' else coalesce(nullif(m->>'areaLink',''), o->>'areaLink', '') end,
      o->>'name') order by oo, mo)
   from wpf_dashboard_data d, jsonb_array_elements(d.data) with ordinality x(o, oo), jsonb_array_elements(coalesce(o->'subtasks','[]')) with ordinality y(m, mo)
   where d.section = 'tasks2__cbth' and jsonb_typeof(m) = 'object'),
  0, now()
on conflict (section) do update set data = excluded.data, revision = 0, updated_at = now();

-- Ajuste (Karina, 13h34: "pode"): frente das entregas que vieram sem frente.
update wpf_dashboard_data set data = (
  select jsonb_agg(case
    when e->>'frente' <> '' then e
    when e->>'nome' ilike '%Comitê%' then jsonb_set(e,'{frente}','"comite"')
    when e->>'objetivo' = 'alcance' then jsonb_set(e,'{frente}','"marketing"')
    when e->>'objetivo' = 'governanca' then jsonb_set(e,'{frente}','"federacoes"')
    else e end order by o)
  from jsonb_array_elements(data) with ordinality x(e,o)), updated_at = now()
where section = 'tmp_projetos_cbth_2026-10-21';

-- Passo 2 (Karina, 13h34: "pode"): grava na Projetos da CBTH (a seção não existia; não sobrescreve).
insert into wpf_dashboard_data (section, data, revision, updated_at)
select 'projetos__cbth', data, 1, now() from wpf_dashboard_data where section = 'tmp_projetos_cbth_2026-10-21'
on conflict (section) do nothing
returning section, revision, jsonb_array_length(data) entregas, md5(data::text);
-- Resultado: 12 entregas, md5 c5e573128710109f485f7ce59df68a8f.
