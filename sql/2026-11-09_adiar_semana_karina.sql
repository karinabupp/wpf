-- 2026-11-09 — Projetos: nada desta semana (09–15/11) pra Karina em "50 Federações Membros"
-- e "10 Grupos Fem Membros" (Karina, 09/11 9h32; aprovado 9h37: "1 não inclui, 2 B").
-- Regra B: por grupo (o nível logo abaixo da etapa: o @País na 50 Federações; "Pesquisar os
-- principais grupos femininos por região" e as linhas do Pesquisador de Ações), todas as
-- tarefas ABERTAS de ponta da Karina andam o mesmo número de DIAS ÚTEIS, de forma que a
-- primeira caia em seg 16/11. Só grupos com tarefa dela começando/vencendo até 15/11.
-- Sequência mantida; fim de semana conta como a segunda seguinte. Tarefas da Isabela não mudam.
-- Mães com filha alterada: Início = menor, Fim = maior das filhas vivas (como a Dash calcula).
-- Backup antes: seção bkp_projetos_2026-11-09_antes_adiar_semana (revision 19243).

create or replace function pg_temp.agora() returns text language sql as $$ select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
create or replace function pg_temp.br(d text) returns text language sql as $$ select case when coalesce(d,'')='' then '—' else substr(d,9,2)||'/'||substr(d,6,2)||'/'||substr(d,1,4) end $$;
create or replace function pg_temp.norm(d date) returns date language sql as $$ select case extract(isodow from d) when 6 then d+2 when 7 then d+1 else d end $$;
create or replace function pg_temp.bdiff(a date, b date) returns int language sql as $$ select count(*)::int from generate_series(pg_temp.norm(a)+1, b, '1 day') g where extract(isodow from g) < 6 $$;
create or replace function pg_temp.badd(d date, n int) returns date language plpgsql as $$
declare x date := pg_temp.norm(d); i int := 0;
begin while i < n loop x := x+1; if extract(isodow from x) < 6 then i := i+1; end if; end loop; return x; end $$;

create or replace function pg_temp.hist(n jsonb, texto text) returns jsonb language sql volatile as $$
  select jsonb_set(n, '{historico}', coalesce(n->'historico','[]') || jsonb_build_array(jsonb_build_object(
    'id','h-adia-'||(n->>'id')||'-'||substr(md5(random()::text),1,6),'tipo','edicao','autor','Claude (a pedido da Karina)',
    'texto',texto,'quando',pg_temp.agora()))) $$;

create or replace function pg_temp.aplica(n jsonb, datas jsonb) returns jsonb language plpgsql volatile as $$
declare fs jsonb := '[]'; k jsonb; nk jsonb; mudou bool := false; d jsonb; ini text; fim text; partes text[] := '{}';
begin
  if jsonb_typeof(n) <> 'object' then return n; end if;
  for k in select * from jsonb_array_elements(coalesce(n->'subtasks','[]')) loop
    nk := pg_temp.aplica(k, datas); if nk is distinct from k then mudou := true; end if;
    fs := fs || jsonb_build_array(nk);
  end loop;
  if jsonb_array_length(fs) > 0 then n := jsonb_set(n, '{subtasks}', fs); end if;
  d := datas->(n->>'id');
  if d is not null then
    ini := d->>'s'; fim := d->>'e';
  elsif mudou then
    select min(nullif(f->>'startDate','')), max(nullif(f->>'endDate','')) into ini, fim
      from jsonb_array_elements(fs) f where jsonb_typeof(f)='object' and coalesce(f->>'status','') <> 'cancelado';
    ini := coalesce(ini, nullif(n->>'startDate','')); fim := coalesce(fim, nullif(n->>'endDate',''));
  else
    return n;
  end if;
  if coalesce(ini,'') <> coalesce(n->>'startDate','') then partes := partes || ('Início: '||pg_temp.br(n->>'startDate')||' → '||pg_temp.br(ini)); n := jsonb_set(n,'{startDate}',to_jsonb(coalesce(ini,''))); end if;
  if coalesce(fim,'') <> coalesce(n->>'endDate','') then partes := partes || ('Fim: '||pg_temp.br(n->>'endDate')||' → '||pg_temp.br(fim)); n := jsonb_set(n,'{endDate}',to_jsonb(coalesce(fim,''))); end if;
  if array_length(partes,1) > 0 then
    n := pg_temp.hist(n, case when d is not null then 'Adiado pra semana seguinte (nada de 09–15/11) · ' else 'Calculado pelas tarefas de dentro · ' end || array_to_string(partes,' · '));
  end if;
  return n;
end $$;

with recursive t(node, depth, grp) as (
  select e, 0, null::text from wpf_dashboard_data, jsonb_array_elements(data) e where section='projetos' and e->>'id' in ('pj-cl-f14','pj-v4-0075')
  union all
  select s, depth+1, case when depth+1=2 then s->>'id' else grp end from t, jsonb_array_elements(coalesce(node->'subtasks','[]'::jsonb)) s
), l as (
  select grp, node->>'id' id, nullif(node->>'startDate','')::date sd, nullif(node->>'endDate','')::date ed
  from t where jsonb_array_length(coalesce(node->'subtasks','[]'))=0 and node->>'status' not in ('finalizado','cancelado')
    and node->'assignees' ? 'Karina Bupp'
), g as (
  select grp, pg_temp.bdiff(min(coalesce(sd,ed)), '2026-11-16') delta from l group by grp having bool_or(sd<='2026-11-15' or ed<='2026-11-15')
), mapa as (
  select jsonb_object_agg(id, jsonb_build_object('s', case when sd is not null then pg_temp.badd(sd,delta)::text end,
                                                 'e', case when ed is not null then pg_temp.badd(ed,delta)::text end)) m
  from l join g using (grp)
)
update wpf_dashboard_data p set
  data = (select jsonb_agg(pg_temp.aplica(e, (select m from mapa)) order by o) from jsonb_array_elements(p.data) with ordinality as x(e, o)),
  revision = p.revision + 1, updated_at = now()
where p.section = 'projetos' and p.revision = (select revision from wpf_dashboard_data where section = 'bkp_projetos_2026-11-09_antes_adiar_semana')
returning revision;
