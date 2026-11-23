-- 2026-11-23 — 50 Federações Membros (pj-cl-f14): processo novo nos 13 países
-- em prospecção (guia worker/instrucoes/prospeccao-federacoes.md, senha FEDS50).
-- Aprovado pela Karina em 23/11 (12h30–12h44). Trava: só grava na revisão 21268.
-- Backup: section 'bkp_projetos_2026-11-23_antes_prospeccao'.
-- Volta: update wpf_dashboard_data set data = (select data from wpf_dashboard_data
--   where section='bkp_projetos_2026-11-23_antes_prospeccao'), revision = revision + 1,
--   updated_at = now() where section = 'projetos';

create or replace function pg_temp.agora() returns text language sql as
$$ select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

create or replace function pg_temp.hist(n jsonb, txt text) returns jsonb language sql as $$
  select n || jsonb_build_object('historico', coalesce(n->'historico','[]'::jsonb) ||
    jsonb_build_array(jsonb_build_object('id', 'h-' || (n->>'id') || '-2311-' || substr(md5(txt),1,6),
      'tipo','edicao','autor','Claude (a pedido da Karina)','texto',txt,'quando',pg_temp.agora())))
$$;

create or replace function pg_temp.novo(id text, nome text, resp jsonb, ini text, fim text) returns jsonb language sql as $$
  select jsonb_build_object('id',id,'nome',nome,
    'tags',jsonb_build_object('lugares','[]'::jsonb,'pessoas','[]'::jsonb,'empresas','[]'::jsonb,'associacoes','[]'::jsonb),
    'frente','','status','naoiniciado','startDate',ini,'endDate',fim,'criterio','','objetivo','',
    'subtasks','[]'::jsonb,'assignees',resp,'bloqueios','[]'::jsonb,'checklist','[]'::jsonb,'dependeDe','',
    'historico',jsonb_build_array(jsonb_build_object('id','h-'||id,'tipo','edicao','autor','Claude (a pedido da Karina)',
      'texto','Criou a subtarefa (processo de prospecção, 23/11)','quando',pg_temp.agora())),
    'prioridade','media','dificuldade','media','proximaAcao','','finalizadoEm','')
$$;

create or replace function pg_temp.resp_all(n jsonb, resp jsonb) returns jsonb language plpgsql as $$
declare out jsonb := '[]'; s jsonb;
begin
  for s in select value from jsonb_array_elements(coalesce(n->'subtasks','[]')) loop
    out := out || jsonb_build_array(pg_temp.resp_all(s, resp));
  end loop;
  return n || jsonb_build_object('assignees', resp, 'subtasks', out);
end $$;

create or replace function pg_temp.du(d date) returns date language plpgsql as $$
begin
  loop
    if extract(dow from d) in (0,6) or to_char(d,'MM-DD') in ('12-25','01-01') then d := d + 1;
    else return d; end if;
  end loop;
end $$;

do $$
declare
  rev int; dados jsonb; ci int; pi int; p jsonb; s jsonb; sub jsonb; novo_sub jsonb;
  cfg record; isa jsonb := '["Isabela Castro"]'; kar jsonb := '["Karina Bupp"]';
  t1 date; t2 text; t3 text; t4 text; pq text; fimp text; reset_txt text; uk boolean;
  s1 jsonb; s2 jsonb; s4 jsonb; s6 jsonb; r jsonb; nr jsonb; out jsonb; chave text; n_ok int := 0;
begin
  select revision, data into rev, dados from wpf_dashboard_data where section='projetos' for update;
  if rev <> 21268 then raise exception 'Trava: revisão mudou (%), refazer em cima da versão atual', rev; end if;
  if dados->0->>'id' <> 'pj-cl-f14' then raise exception 'Entrega 0 não é pj-cl-f14'; end if;

  for cfg in select * from (values
    ('p66','2026-11-25','2026-11-26'),('p50','2026-11-25','2026-11-26'),
    ('p12','2026-11-26','2026-11-30'),('p21','2026-11-26','2026-11-30'),
    ('p23','2026-11-30','2026-12-01'),('p29','2026-11-30','2026-12-01'),
    ('p30','2026-12-01','2026-12-02'),('p31','2026-12-01','2026-12-02'),
    ('p73','2026-12-02','2026-12-03'),('p02','2026-12-02','2026-12-03'),
    ('p07','2026-12-03','2026-12-04'),('p10','2026-12-03','2026-12-04'),
    ('p35','2026-12-04', null)) v(cod, pesq, tent1)
  loop
    -- achar o país
    ci := null;
    for ci_i in 0 .. jsonb_array_length(dados->0->'subtasks')-1 loop
      for pi_i in 0 .. jsonb_array_length(dados->0->'subtasks'->ci_i->'subtasks')-1 loop
        if dados->0->'subtasks'->ci_i->'subtasks'->pi_i->>'id' = 'pj-cl-f14-'||cfg.cod then ci := ci_i; pi := pi_i; end if;
      end loop;
    end loop;
    if ci is null then raise exception 'País % não encontrado', cfg.cod; end if;
    p := dados->0->'subtasks'->ci->'subtasks'->pi;
    chave := 'pj-cl-f14-'||cfg.cod;
    uk := cfg.cod = 'p35';
    pq := cfg.pesq;
    if cfg.tent1 is not null then
      t1 := cfg.tent1::date;
      t2 := pg_temp.du(t1 + 7)::text; t3 := pg_temp.du(t1 + 14)::text; t4 := pg_temp.du(t1 + 21)::text;
      fimp := t4;
    else t2 := ''; t3 := ''; t4 := ''; fimp := pq; end if;
    reset_txt := case when cfg.cod in ('p02','p07','p10')
      then 'Reiniciado a pedido da Karina (23/11): o contato de 26–27/10 foi desconsiderado. '
      else '' end;

    -- conferir estrutura
    s1 := null; s2 := null; s4 := null; s6 := null;
    for s in select value from jsonb_array_elements(p->'subtasks') loop
      if s->>'id' = chave||'-s1' then s1 := s; elsif s->>'id' = chave||'-s2' then s2 := s;
      elsif s->>'id' = chave||'-s4' then s4 := s; elsif s->>'id' = chave||'-s6' then s6 := s; end if;
    end loop;
    if s1 is null or s2 is null or s4 is null or s6 is null or jsonb_array_length(p->'subtasks') <> 8
       or jsonb_array_length(s1->'subtasks') <> 4 or jsonb_array_length(s2->'subtasks') <> 0
       or jsonb_array_length(s6->'subtasks') <> 3 then
      raise exception 'Estrutura inesperada em %', chave;
    end if;

    -- s1: Buscar e contatar candidato (Isabela)
    out := '[]';
    for r in select value from jsonb_array_elements(s1->'subtasks') loop
      nr := r || jsonb_build_object('status','naoiniciado','finalizadoEm','','assignees',isa);
      if r->>'id' = chave||'-s1-r1' then
        out := out || jsonb_build_array(pg_temp.hist(nr || jsonb_build_object('nome','Pesquisar candidato','startDate',pq,'endDate',pq),
                 reset_txt||'Processo de prospecção (23/11): responsável Isabela Castro; data '||pq||'.'));
        out := out || jsonb_build_array(pg_temp.novo(chave||'-s1-r5','Coletar os contatos',isa,pq,pq));
        out := out || jsonb_build_array(pg_temp.novo(chave||'-s1-r6','Escrever e revisar o e-mail',isa,pq,pq));
      elsif r->>'id' = chave||'-s1-r2' then
        out := out || jsonb_build_array(pg_temp.hist(nr || jsonb_build_object('nome','Fazer a 1ª tentativa','startDate',coalesce(cfg.tent1,''),'endDate',coalesce(cfg.tent1,'')),
                 reset_txt||'Contatar candidato → Fazer a 1ª tentativa (23/11); responsável Isabela Castro'||case when uk then '; UK: enviar só com liberação da Karina.' else '.' end));
      elsif r->>'id' = chave||'-s1-r3' then
        out := out || jsonb_build_array(pg_temp.hist(nr || jsonb_build_object('nome','Fazer a 2ª tentativa','startDate',t2,'endDate',t2),
                 'Receber a resposta → Fazer a 2ª tentativa (1 semana depois da 1ª), 23/11; responsável Isabela Castro.'));
      elsif r->>'id' = chave||'-s1-r4' then
        out := out || jsonb_build_array(pg_temp.hist(nr || jsonb_build_object('nome','Fazer a 3ª tentativa','startDate',t3,'endDate',t3),
                 'Recontatar candidato → Fazer a 3ª tentativa (2 semanas depois da 1ª), 23/11; responsável Isabela Castro.'));
        out := out || jsonb_build_array(pg_temp.novo(chave||'-s1-r7','Contatar a próxima opção',isa,t4,t4));
      else raise exception 'Subtarefa inesperada % em %', r->>'id', chave; end if;
    end loop;
    if jsonb_array_length(out) <> 7 then raise exception 'r em % deu %', chave, jsonb_array_length(out); end if;
    s1 := pg_temp.hist(s1 || jsonb_build_object('subtasks',out,'status','naoiniciado','finalizadoEm','','assignees',isa,'startDate',pq,'endDate',fimp),
            reset_txt||'Processo de prospecção (23/11): 7 passos, 3 tentativas semanais e troca de opção na 3ª semana; responsável Isabela Castro.');

    -- s2: Apresentar a WPF (Isabela)
    s2 := pg_temp.hist(s2 || jsonb_build_object('assignees',isa,'subtasks',jsonb_build_array(
            pg_temp.novo(chave||'-s2-a1','Responder as dúvidas',isa,'',''),
            pg_temp.novo(chave||'-s2-a2','Confirmar que o candidato topa seguir',isa,'',''),
            pg_temp.novo(chave||'-s2-a3','Coletar o WhatsApp do contato',isa,'',''),
            pg_temp.novo(chave||'-s2-a4','Marcar reunião',isa,'',''))),
          'Quebrada em 4 passos e responsável Isabela Castro (23/11).');

    -- s4: Coletar documentos — tudo Karina
    s4 := pg_temp.hist(pg_temp.resp_all(s4, kar), 'Documentação passa toda pra Karina Bupp (23/11).');

    -- s6: Coletar informações pro site (Isabela)
    out := jsonb_build_array(pg_temp.novo(chave||'-s6-i1','Coletar os dados da federação',isa,'',''));
    for r in select value from jsonb_array_elements(s6->'subtasks') loop
      nr := r || jsonb_build_object('assignees',isa);
      if r->>'nome' = 'Links' then nr := pg_temp.hist(nr || '{"nome":"Coletar os links de mídia"}', 'Links → Coletar os links de mídia; responsável Isabela Castro (23/11).');
      elsif r->>'nome' = 'Fotos' then nr := pg_temp.hist(nr || '{"nome":"Coletar as fotos"}', 'Fotos → Coletar as fotos; responsável Isabela Castro (23/11).');
      elsif r->>'nome' = 'Board' then nr := pg_temp.hist(nr || '{"nome":"Coletar a diretoria"}', 'Board → Coletar a diretoria; responsável Isabela Castro (23/11).');
      else raise exception 'Filha inesperada de s6 em %: %', chave, r->>'nome'; end if;
      out := out || jsonb_build_array(nr);
    end loop;
    -- ordem: dados, links, diretoria, fotos, bio
    out := jsonb_build_array(out->0,
             (select value from jsonb_array_elements(out) where value->>'nome'='Coletar os links de mídia'),
             (select value from jsonb_array_elements(out) where value->>'nome'='Coletar a diretoria'),
             (select value from jsonb_array_elements(out) where value->>'nome'='Coletar as fotos'),
             pg_temp.novo(chave||'-s6-i5','Coletar a bio curta',isa,'',''));
    s6 := pg_temp.hist(s6 || jsonb_build_object('assignees',isa,'subtasks',out), 'Responsável Isabela Castro; 5 passos (23/11).');

    -- montar a lista do país na ordem nova
    novo_sub := '[]';
    for s in select value from jsonb_array_elements(p->'subtasks') loop
      if s->>'id' = chave||'-s1' then novo_sub := novo_sub || jsonb_build_array(s1);
      elsif s->>'id' = chave||'-s2' then
        novo_sub := novo_sub || jsonb_build_array(s2);
        novo_sub := novo_sub || jsonb_build_array(pg_temp.novo(chave||'-s9','Fazer reunião', case when uk then kar else isa end,'',''));
      elsif s->>'id' = chave||'-s4' then novo_sub := novo_sub || jsonb_build_array(s4);
      elsif s->>'id' = chave||'-s5' then
        novo_sub := novo_sub || jsonb_build_array(s);
        novo_sub := novo_sub || jsonb_build_array(pg_temp.novo(chave||'-s10','Dar as boas-vindas',kar,'','') ||
          jsonb_build_object('subtasks', jsonb_build_array(
            pg_temp.novo(chave||'-s10-b1','Mandar o e-mail de boas-vindas',kar,'',''),
            pg_temp.novo(chave||'-s10-b2','Fazer o contato no WhatsApp',kar,'',''))));
      elsif s->>'id' = chave||'-s6' then novo_sub := novo_sub || jsonb_build_array(s6);
      else novo_sub := novo_sub || jsonb_build_array(s); end if;
    end loop;
    if jsonb_array_length(novo_sub) <> 10 then raise exception 'País % ficou com % passos', chave, jsonb_array_length(novo_sub); end if;

    p := pg_temp.hist(p || jsonb_build_object('subtasks',novo_sub,'status','naoiniciado','finalizadoEm','','startDate',pq,'endDate',fimp),
           reset_txt||'Processo de prospecção (23/11, guia FEDS50): contato inicial com a Isabela; reunião de países grandes, documentação e boas-vindas com a Karina.');
    dados := jsonb_set(dados, array['0','subtasks',ci::text,'subtasks',pi::text], p);
    n_ok := n_ok + 1;
  end loop;

  if n_ok <> 13 then raise exception 'Só % países', n_ok; end if;
  update wpf_dashboard_data set data = dados, revision = revision + 1, updated_at = now() where section='projetos';
  raise notice 'OK: % países, revisão % → %', n_ok, rev, rev+1;
end $$;
