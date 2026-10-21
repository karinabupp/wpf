-- 2026-10-21 — Projetos: datas do Pós-evento do Ladies Weekend 2026 (Karina, 21/10 9h47; "pode" 10h58).
-- Post 1 pronto qui 22/10 · Post 2 sáb 24/10 (aprovação na sexta) · Post 3 qua 28/10.
-- Data nas etapas (folhas); as mães herdam o Fim (maior das filhas), como a Dash calcula.
-- Backup antes: seção bkp_projetos_2026-10-21_antes_lw_pos_evento.

create or replace function pg_temp.agora() returns text language sql as $$ select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
create or replace function pg_temp.br(d text) returns text language sql as $$ select case when coalesce(d,'')='' then '—' else substr(d,9,2)||'/'||substr(d,6,2)||'/'||substr(d,1,4) end $$;

-- Aplica as datas e recalcula o Fim das mães do caminho (maior Fim das filhas vivas).
create or replace function pg_temp.aplica(n jsonb, datas jsonb) returns jsonb language plpgsql volatile as $$
declare fs jsonb := '[]'; k jsonb; novo text; fimMae text;
begin
  if jsonb_typeof(n) <> 'object' then return n; end if;
  for k in select * from jsonb_array_elements(coalesce(n->'subtasks','[]')) loop fs := fs || jsonb_build_array(pg_temp.aplica(k, datas)); end loop;
  n := jsonb_set(n, '{subtasks}', fs);
  novo := datas->>(n->>'id');
  if novo is null and exists (select 1 from jsonb_array_elements(fs) f where jsonb_typeof(f)='object' and coalesce(f->>'status','') <> 'cancelado') then
    select max(f->>'endDate') into fimMae from jsonb_array_elements(fs) f where jsonb_typeof(f)='object' and coalesce(f->>'status','') <> 'cancelado' and coalesce(f->>'endDate','') <> '';
    if fimMae is not null and fimMae is distinct from nullif(n->>'endDate','') then novo := fimMae; end if;
  end if;
  if novo is not null and novo is distinct from coalesce(n->>'endDate','') then
    n := jsonb_set(n, '{historico}', coalesce(n->'historico','[]') || jsonb_build_array(jsonb_build_object(
      'id','h-lwpe-'||(n->>'id')||'-'||substr(md5(random()::text),1,6),'tipo','edicao','autor','Claude (a pedido da Karina)',
      'texto','Fim: '||pg_temp.br(n->>'endDate')||' → '||pg_temp.br(novo),'quando',pg_temp.agora())));
    n := jsonb_set(n, '{endDate}', to_jsonb(novo));
  end if;
  return n;
end $$;

insert into wpf_dashboard_data (section, data, revision, updated_at)
  select 'bkp_projetos_2026-10-21_antes_lw_pos_evento', data, revision, now() from wpf_dashboard_data where section = 'projetos'
on conflict (section) do update set data = excluded.data, revision = excluded.revision, updated_at = now();

update wpf_dashboard_data p set
  data = (select jsonb_agg(pg_temp.aplica(e, '{
    "pj-cl-lw-194":"2026-10-21","pj-cl-lw-195":"2026-10-22","pj-cl-lw-196":"2026-10-22","pj-cl-lw-197":"2026-10-22",
    "pj-cl-lw-199":"2026-10-21","pj-cl-lw-200":"2026-10-23","pj-cl-lw-201":"2026-10-23","pj-cl-lw-202":"2026-10-23","pj-cl-lw-203":"2026-10-24",
    "pj-cl-lw-205":"2026-10-26","pj-cl-lw-206":"2026-10-27","pj-cl-lw-207":"2026-10-27","pj-cl-lw-208":"2026-10-28"}'::jsonb) order by o)
    from jsonb_array_elements(p.data) with ordinality as x(e, o)),
  revision = p.revision + 1, updated_at = now()
where p.section = 'projetos' and p.revision = (select revision from wpf_dashboard_data where section = 'bkp_projetos_2026-10-21_antes_lw_pos_evento')
returning revision;
