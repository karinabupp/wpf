-- 2026-10-13 — Projetos: nada de parênteses nem "Nome: detalhe" (Karina, 13/10)
-- Aplicado pelo conector do Supabase depois do OK da Karina (18h23).
-- Backup antes: seção bkp_projetos_2026-10-13_antes_parenteses.
-- Passo 1: gera o resultado em tmp_projetos_2026-10-13 (conferido antes de trocar).

create or replace function pg_temp.agora() returns text language sql as $$ select to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
create or replace function pg_temp.novo_id() returns text language sql volatile as $$ select 'pj-cl-np-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10) $$;

-- Linha nova (mesmos campos das outras).
create or replace function pg_temp.no(nome text, status text, filhos jsonb default '[]', extra jsonb default '{}') returns jsonb language plpgsql volatile as $$
declare i text := pg_temp.novo_id();
begin
  return jsonb_build_object(
    'id', i, 'nome', nome,
    'tags', jsonb_build_object('lugares','[]'::jsonb,'pessoas','[]'::jsonb,'empresas','[]'::jsonb,'associacoes','[]'::jsonb),
    'frente','', 'status', coalesce(status,'naoiniciado'), 'endDate','', 'criterio','', 'objetivo','',
    'assignees','[]'::jsonb, 'bloqueios','[]'::jsonb, 'checklist','[]'::jsonb, 'dependeDe','', 'startDate','',
    'prioridade','', 'dificuldade','', 'proximaAcao','', 'finalizadoEm','',
    'subtasks', coalesce(filhos,'[]'::jsonb),
    'historico', jsonb_build_array(jsonb_build_object('id','h-'||i,'tipo','edicao','autor','Claude (a pedido da Karina)','texto','Criou (reorganização sem parênteses)','quando',pg_temp.agora()))
  ) || extra;
end $$;

create or replace function pg_temp.hist(n jsonb, texto text) returns jsonb language sql volatile as $$
  select jsonb_set(n, '{historico}', coalesce(n->'historico','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id','h-np-'||(n->>'id')||'-'||substr(md5(random()::text),1,6),'tipo','edicao','autor','Claude (a pedido da Karina)','texto',texto,'quando',pg_temp.agora())))
$$;
create or replace function pg_temp.ren(n jsonb, novo text) returns jsonb language sql volatile as $$
  select case when n->>'nome' = novo then n else pg_temp.hist(jsonb_set(n,'{nome}',to_jsonb(novo)), 'Nome: '||(n->>'nome')||' → '||novo) end
$$;
-- Status herdado pelas sublinhas novas: finalizado/cancelado passa; o resto nasce não iniciado.
create or replace function pg_temp.herda(n jsonb) returns text language sql as $$
  select case when n->>'status' in ('finalizado','cancelado') then n->>'status' else 'naoiniciado' end
$$;
-- Divide a linha em sublinhas (mantém o que já existia dentro).
create or replace function pg_temp.divide(n jsonb, novo text, partes text[]) returns jsonb language plpgsql volatile as $$
declare r jsonb := pg_temp.ren(n, novo); p text; extra jsonb;
begin
  extra := jsonb_build_object('assignees', coalesce(n->'assignees','[]'::jsonb));
  foreach p in array partes loop
    r := jsonb_set(r, '{subtasks}', coalesce(r->'subtasks','[]'::jsonb) || jsonb_build_array(pg_temp.no(p, pg_temp.herda(n), '[]', extra)));
  end loop;
  return r;
end $$;
create or replace function pg_temp.addresp(n jsonb, nomes text[]) returns jsonb language sql as $$
  select jsonb_set(n,'{assignees}', (select coalesce(jsonb_agg(distinct x),'[]') from (select jsonb_array_elements_text(coalesce(n->'assignees','[]')) x union select unnest(nomes)) u))
$$;
-- Status da linha-mãe nova a partir das de dentro.
create or replace function pg_temp.agrega(filhos jsonb) returns text language sql as $$
  select case when not exists (select 1 from jsonb_array_elements(filhos) f where f->>'status' not in ('finalizado','cancelado')) then 'finalizado'
              when exists (select 1 from jsonb_array_elements(filhos) f where f->>'status' in ('andamento','finalizado','bloqueado')) then 'andamento'
              else 'naoiniciado' end
$$;
-- Cópia com ids novos (pros Reels 2), sem histórico antigo.
create or replace function pg_temp.copia(n jsonb) returns jsonb language plpgsql volatile as $$
declare i text := pg_temp.novo_id(); k jsonb; fs jsonb := '[]';
begin
  for k in select * from jsonb_array_elements(coalesce(n->'subtasks','[]')) loop fs := fs || jsonb_build_array(pg_temp.copia(k)); end loop;
  return n || jsonb_build_object('id', i, 'subtasks', fs, 'historico', jsonb_build_array(jsonb_build_object('id','h-'||i,'tipo','edicao','autor','Claude (a pedido da Karina)','texto','Criou (Reels separados)','quando',pg_temp.agora())));
end $$;
create or replace function pg_temp.acha(lista jsonb, i text) returns jsonb language sql as $$ select f from jsonb_array_elements(lista) f where f->>'id' = i $$;
create or replace function pg_temp.sem(lista jsonb, ids text[]) returns jsonb language sql as $$
  select coalesce(jsonb_agg(y.f order by y.ord),'[]') from jsonb_array_elements(lista) with ordinality y(f,ord) where not (y.f->>'id' = any(ids))
$$;

create or replace function pg_temp.t(n jsonb) returns jsonb language plpgsql volatile as $$
declare
  k jsonb; fs jsonb := '[]'; nome text; id text := n->>'id'; a jsonb; b jsonb; c jsonb; xv jsonb; nv jsonb; tmp jsonb;
  resp text[] := array['Karina Bupp','Roberto Lifschitz','Isabela Castro'];
  pais text; paises text[] := array['Brazil','USA','Liechtenstein','Bulgaria','France','Estonia','UK','Israel','Taiwan','Hong Kong','Japan','Philippines','Nigeria','South Africa'];
  passos text[] := array['Coletar agendas e atrações','Coletar mídia','Criar copy do post','Aplicar template/criar post','Definir legenda','Postar'];
  st text; p text;
begin
  for k in select * from jsonb_array_elements(coalesce(n->'subtasks','[]')) loop fs := fs || jsonb_build_array(pg_temp.t(k)); end loop;

  -- ── Operações na lista de dentro (pelo id da linha-mãe) ──
  if id = 'pj-v4-0087' then -- Promover Nations Cups
    a := pg_temp.ren(pg_temp.acha(fs,'pj-v4-0084'),'Infos'); b := pg_temp.ren(pg_temp.acha(fs,'pj-v4-0085'),'Promoção'); c := pg_temp.ren(pg_temp.acha(fs,'pj-v4-0086'),'Definir o plano de ação');
    fs := jsonb_build_array(pg_temp.no('Asia Nations Cup', pg_temp.agrega(jsonb_build_array(a,b)), jsonb_build_array(a,b)),
                            pg_temp.no('PANAM Nations Cup', pg_temp.agrega(jsonb_build_array(c)), jsonb_build_array(c)))
          || pg_temp.sem(fs, array['pj-v4-0084','pj-v4-0085','pj-v4-0086']);
  end if;
  if pg_temp.acha(fs,'pj-v4-0103') is not null and pg_temp.acha(fs,'pj-v4-0104') is not null then -- SEO
    a := pg_temp.ren(pg_temp.acha(fs,'pj-v4-0103'),'Estruturação'); b := pg_temp.ren(pg_temp.acha(fs,'pj-v4-0104'),'Produção');
    nv := pg_temp.no('SEO', pg_temp.agrega(jsonb_build_array(a,b)), jsonb_build_array(a,b));
    select coalesce(jsonb_agg(case when y.f->>'id'='pj-v4-0103' then nv else y.f end order by y.ord),'[]') into fs from jsonb_array_elements(fs) with ordinality y(f,ord) where y.f->>'id' <> 'pj-v4-0104';
  end if;
  if id = 'pj-mig-0588' then -- Publicar as páginas das federações novas
    a := pg_temp.ren(pg_temp.acha(fs,'pj-mig-0588-ck0'),'Coletar infos'); b := pg_temp.ren(pg_temp.acha(fs,'pj-mig-0588-ck1'),'Colocar no ar');
    c := pg_temp.ren(pg_temp.acha(fs,'pj-mig-0588-ck2'),'Colocar no ar'); xv := pg_temp.ren(pg_temp.acha(fs,'pj-mig-0588-ck3'),'Colocar no ar');
    fs := jsonb_build_array(pg_temp.no('Armenia', pg_temp.agrega(jsonb_build_array(a,b)), jsonb_build_array(a,b)),
                            pg_temp.no('Sweden', pg_temp.agrega(jsonb_build_array(c)), jsonb_build_array(c)),
                            pg_temp.no('Mongolia', pg_temp.agrega(jsonb_build_array(xv)), jsonb_build_array(xv)))
          || pg_temp.sem(fs, array['pj-mig-0588-ck0','pj-mig-0588-ck1','pj-mig-0588-ck2','pj-mig-0588-ck3']);
  end if;
  -- Relembrar de ler as instruções (1ª vez / 2ª vez)
  a := null; b := null;
  select y.f into a from jsonb_array_elements(fs) y(f) where y.f->>'nome' = 'Relembrar de ler as instruções (1ª vez)';
  select y.f into b from jsonb_array_elements(fs) y(f) where y.f->>'nome' = 'Relembrar de ler as instruções (2ª vez)';
  if a is not null and b is not null then
    a := pg_temp.ren(a,'1ª vez'); b := pg_temp.ren(b,'2ª vez');
    nv := pg_temp.no('Relembrar de ler as instruções', pg_temp.agrega(jsonb_build_array(a,b)), jsonb_build_array(a,b));
    select coalesce(jsonb_agg(case when y.f->>'nome'='Relembrar de ler as instruções (1ª vez)' then nv else y.f end order by y.ord),'[]') into fs
      from jsonb_array_elements(fs) with ordinality y(f,ord) where y.f->>'nome' <> 'Relembrar de ler as instruções (2ª vez)';
  end if;
  if id = 'pj-v4-0039' then -- Reels colaborativos: um bloco por Reels
    a := pg_temp.ren(pg_temp.acha(fs,'pj-cl-lw-166'),'Pedir os vídeos aos hosts');
    b := pg_temp.ren(pg_temp.acha(fs,'pj-mig-0744'),'Enviar os vídeos pra Nina');
    c := pg_temp.ren(pg_temp.acha(fs,'pj-mig-0746'),'Produzir o Reels');
    xv := pg_temp.addresp(pg_temp.ren(pg_temp.acha(fs,'pj-cl-lw-170'),'Aprovar o Reels'), resp);
    tmp := jsonb_build_array(a,b,c,xv, pg_temp.ren(pg_temp.acha(fs,'pj-mig-0748'),'Postar'));
    nv := pg_temp.no('Reels 1 word to define LW', pg_temp.agrega(tmp), tmp);
    tmp := jsonb_build_array(pg_temp.copia(a), pg_temp.copia(b), pg_temp.copia(c), pg_temp.copia(xv), pg_temp.ren(pg_temp.acha(fs,'pj-mig-0750'),'Postar'));
    fs := jsonb_build_array(nv, pg_temp.no('Reels Faltam 2 dias', pg_temp.agrega(tmp), tmp))
          || pg_temp.sem(fs, array['pj-cl-lw-166','pj-mig-0744','pj-mig-0746','pj-cl-lw-170','pj-mig-0748','pj-mig-0750']);
  end if;
  if id = 'pj-v4-0071' then fs := pg_temp.sem(fs, array['pj-v4-0062']); end if; -- PPT sai de Comunicação
  if id = 'pj-cl-lw-210' then select fs || jsonb_build_array(q.ppt) into fs from pj_ppt q; end if; -- e entra no Fechamento
  if id = 'pj-cl-lw-124' then -- Posts Individuais dos Países, depois do Sorteio Mundial
    tmp := '[]';
    foreach pais in array paises loop
      st := case when pais in ('UK','Brazil','Bulgaria') then 'finalizado' else 'naoiniciado' end;
      xv := '[]';
      foreach p in array passos loop xv := xv || jsonb_build_array(pg_temp.no(p, st)); end loop;
      tmp := tmp || jsonb_build_array(pg_temp.no(pais, st, xv));
    end loop;
    nv := pg_temp.no('Posts Individuais dos Países', 'andamento', tmp);
    select coalesce(jsonb_agg(z.el order by z.pos, z.ext),'[]') into fs from (
      select y.f el, y.ord pos, 0 ext from jsonb_array_elements(fs) with ordinality y(f,ord)
      union all select nv, (select w.ord from jsonb_array_elements(fs) with ordinality w(f,ord) where w.f->>'id'='pj-v4-0038'), 1) z;
  end if;
  if id = 'pj-v4-0067' then -- Definir as datas dos Holidays
    fs := fs || jsonb_build_array(
      pg_temp.no('Natal','naoiniciado','[]', '{"endDate":"2026-12-25"}'),
      pg_temp.no('Ano Novo','naoiniciado','[]', '{"endDate":"2027-01-01"}'),
      pg_temp.no('Ano Novo Lunar','naoiniciado','[]', '{"endDate":"2027-02-06"}'),
      pg_temp.no('Dia Internacional da Mulher','naoiniciado','[]', '{"endDate":"2027-03-08"}'));
  end if;
  -- País que só tem "Buscar e contatar candidato" em andamento → não iniciado (Karina, 18h32).
  if exists (select 1 from jsonb_array_elements(fs) y(f) where y.f->>'nome' = 'Buscar e contatar candidato' and y.f->>'status' = 'andamento')
     and not exists (select 1 from jsonb_array_elements(fs) y(f) where y.f->>'nome' <> 'Buscar e contatar candidato' and y.f->>'status' <> 'naoiniciado') then
    select coalesce(jsonb_agg(case when y.f->>'nome' = 'Buscar e contatar candidato' then pg_temp.hist(jsonb_set(y.f,'{status}','"naoiniciado"'),'Status: Em andamento → Não iniciado') else y.f end order by y.ord),'[]')
      into fs from jsonb_array_elements(fs) with ordinality y(f,ord);
    if n->>'status' = 'andamento' then n := pg_temp.hist(jsonb_set(n,'{status}','"naoiniciado"'),'Status: Em andamento → Não iniciado'); end if;
  end if;
  n := jsonb_set(n, '{subtasks}', fs);

  -- ── A própria linha (pelo nome) ──
  nome := n->>'nome';
  n := case nome
    when 'Coletar documentos (estatuto e registro)' then pg_temp.divide(n,'Coletar documentos',array['Estatuto','Registro'])
    when 'Coletar informações pro site (links, fotos, board)' then pg_temp.divide(n,'Coletar informações pro site',array['Links','Fotos','Board'])
    when 'Aplicar mudanças estruturais (URLs, redirecionamentos e etc)' then pg_temp.divide(n,'Aplicar mudanças estruturais',array['URLs','Redirecionamentos'])
    when 'Organizar drive: detalhes em texto editorial e material visual' then pg_temp.divide(n,'Organizar drive',array['Texto editorial','Material visual'])
    when 'Conferir as participações (segue a @wpf e marca uma amiga)' then pg_temp.divide(n,'Conferir as participações',array['Seguiu o perfil da WPF','Marcou uma amiga'])
    when 'Pokernews (global e br)' then pg_temp.divide(n,'Pokernews',array['Global','BR'])
    when 'Preparar o press release (texto, fotos e vídeos)' then pg_temp.ren(n,'Preparar o press release')
    when 'Aprovar o post (Karina, Lifas e Isa)' then pg_temp.addresp(pg_temp.ren(n,'Aprovar o post'), resp)
    when 'Aprovar (Karina, Lifas e Isa)' then pg_temp.addresp(pg_temp.ren(n,'Aprovar'), resp)
    when 'Cobertura do stop (Rafael)' then pg_temp.addresp(pg_temp.ren(n,'Cobertura do stop'), array['Rafael'])
    when 'Receber portfólio de imagens (Andressa)' then pg_temp.addresp(pg_temp.ren(n,'Receber portfólio de imagens'), array['Andressa'])
    when 'Receber portfólio de vídeos (Andressa)' then pg_temp.addresp(pg_temp.ren(n,'Receber portfólio de vídeos'), array['Andressa'])
    when 'Sorteio Mundial (semanas 6 e 7)' then pg_temp.ren(n,'Sorteio Mundial')
    when 'Consolidar o relatório do LW 2026 (cópia)' then pg_temp.ren(n,'Consolidar o relatório do LW 2026')
    when 'Passar o contato de mídia (DMC)' then pg_temp.ren(n,'Passar o contato de mídia')
    when 'Receber o formulário preenchido (details submission)' then pg_temp.ren(n,'Receber o details submission preenchido')
    when 'Coletar todos os nums (buy ins, entries, etc)' then pg_temp.ren(n,'Coletar todos os números')
    when 'Adwords: budget' then pg_temp.ren(n,'Budget')
    when 'Adwords: campanha' then pg_temp.ren(n,'Campanha')
    when 'Adwords: cpc' then pg_temp.ren(n,'CPC')
    when 'Liechenstein' then pg_temp.ren(n,'Liechtenstein')
    else n end;
  return n;
end $$;

-- Aplicação (13/10, 18h3x): backup + troca na mesma instrução, a partir da
-- versão atual (a 1ª tentativa foi barrada porque a Karina editou às 18h28).
create temp table pj_ppt as
  select pg_temp.ren(s, 'PPT Ladies Weekend') as ppt
  from wpf_dashboard_data d, jsonb_array_elements(d.data) e, jsonb_array_elements(e->'subtasks') s
  where d.section = 'projetos' and s->>'id' = 'pj-v4-0062';
insert into wpf_dashboard_data (section, data, revision, updated_at)
  select 'bkp_projetos_2026-10-13_antes_parenteses', data, revision, now() from wpf_dashboard_data where section = 'projetos'
on conflict (section) do update set data = excluded.data, revision = excluded.revision, updated_at = now();
update wpf_dashboard_data p
  set data = (select jsonb_agg(pg_temp.t(y.e) order by y.ord) from jsonb_array_elements(p.data) with ordinality y(e,ord)),
      revision = p.revision + 1, updated_at = now()
  where p.section = 'projetos' and exists (select 1 from pj_ppt);
-- (o rascunho tmp_projetos_2026-10-13 fica pra apagar depois)

-- VOLTA: update wpf_dashboard_data set data = (select data from wpf_dashboard_data where section = 'bkp_projetos_2026-10-13_antes_parenteses'), updated_at = now() where section = 'projetos';
