-- 2026-11-09 (2ª) — Projetos: cobrança final da Isabela (12/11) → 23/11 nos 7 países
-- (Ecuador, Portugal, Macao, Malaysia, Philippines, Singapore, Panama). Karina, 09/11 9h45: "Faz pra todas em 23/11".
-- Folha "Fazer a cobrança final › Avisar que não dá pra manter a posição…"; mães recalculadas.
-- Backup antes: bkp_projetos_2026-11-09_antes_cobranca_final (revision 19244).

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
    n := pg_temp.hist(n, case when d is not null then 'Cobrança final adiada pra 23/11 · ' else 'Calculado pelas tarefas de dentro · ' end || array_to_string(partes,' · '));
  end if;
  return n;
end $$;

update wpf_dashboard_data p set
  data = (select jsonb_agg(pg_temp.aplica(e, '{"pj-cl-f14-p26-s4-c4":{"s":"2026-11-23","e":"2026-11-23"},"pj-cl-f14-p41-s4-c4":{"s":"2026-11-23","e":"2026-11-23"},"pj-cl-f14-p42-s4-c4":{"s":"2026-11-23","e":"2026-11-23"},"pj-cl-f14-p45-s4-c4":{"s":"2026-11-23","e":"2026-11-23"},"pj-cl-f14-p46-s4-c4":{"s":"2026-11-23","e":"2026-11-23"},"pj-cl-f14-p57-s4-c4":{"s":"2026-11-23","e":"2026-11-23"},"pj-cl-f14-p60-s4-c4":{"s":"2026-11-23","e":"2026-11-23"}}'::jsonb) order by o) from jsonb_array_elements(p.data) with ordinality as x(e, o)),
  revision = p.revision + 1, updated_at = now()
where p.section = 'projetos' and p.revision = (select revision from wpf_dashboard_data where section = 'bkp_projetos_2026-11-09_antes_cobranca_final')
returning revision;
