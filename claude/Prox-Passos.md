# Prox Passos — WPF Dash

Tudo que ficou pendente, em aberto ou identificado como melhoria futura.
Cada item precisa de contexto suficiente para a próxima sessão retomar sem
reconstruir o raciocínio.

**Formato de cada item:**

- **[ ] Título do item** — o que precisa ser feito
  - *Contexto:* por que isso apareceu, o que já foi tentado/decidido
  - *Onde:* arquivo, aba ou componente
  - *Aberto em:* data

---

## Em aberto

- [ ] **Agente do WhatsApp: construir o modo conversacional** — hoje ele
  responde por palavra-chave; o pedido da Karina é outro.
  - *Como deve funcionar (definido em 17/09):* o agente fala no nível do
    **objetivo/entregável**, não lista tarefa solta. Ex.: em vez de "você tem
    'pegar receita', 'separar ingredientes' pendentes", ele escreve "vi que o
    bolo é até sexta, já começou? em que estágio está?". A partir da resposta
    dela em linguagem normal, ele **atualiza a Dash** (status, datas) e
    **cria** tarefas/entregáveis. Mão dupla: "preciso mandar os documentos
    pra Armênia até quinta" vira linha na Dash.
  - *Decisões da Karina:* (a) fala primeiro **uma vez por dia**, e **só pra
    Karina** por enquanto (fora da janela de 24h cada toque custa ~R$ 0,04);
    (b) **sempre confirma antes** de criar ou alterar qualquer coisa,
    inclusive **onde** colocar a tarefa/entregável e se cria meta nova;
    (c) visibilidade: **Karina vê as tarefas de todos**, os demais veem só
    as próprias; (d) nunca apagar linha, nunca mexer em tarefa de outra
    pessoa.
  - *Como escrever:* o Claude passa a **decidir** (não só redigir), recebendo
    a pergunta, o histórico recente de `wpf_whatsapp_messages` e os fatos da
    Dash calculados em código. Números sempre do código; se a API falhar,
    cai nas regras atuais. Escrever na Dash = ler a seção `tasks2` de
    `wpf_dashboard_data`, alterar e gravar com `updated_at` novo (a Dash dos
    navegadores junta em até 15s pelo sync de 15/09).
  - *Onde:* Worker `wpf-whatsapp-bridge` (Cloudflare).
  - *Aberto em:* 2026-09-17

- [ ] **Agente: o que ficou faltando antes de conversar de verdade**
  - Escrever de volta na Dash (hoje o agente só lê).
  - Toque diário só pra Karina: precisa de **template aprovado** na Meta
    (mensagem iniciada pela empresa fora da janela de 24h) e de um
    agendamento (cron do Cloudflare ou Edge Function no Supabase).
  - Registrar quem pediu cada alteração (auditoria) e limite de mensagens
    por hora.
  - O agente ignora as próprias mensagens (`direction = out`) pra não
    conversar sozinho.
  - *Aberto em:* 2026-09-17

- [ ] **Sessão nova do Claude precisa de acesso ao Supabase pra ler a Dash**
  — em 17/09 o host `ufwmktomjfcvloswgnyt.supabase.co` estava fora da lista
  de domínios permitidos da sessão, então não deu pra ler `tasks2` direto.
  - *Saídas:* adicionar o host nas configurações de rede do projeto, ou
    colar no chat o resultado de um `select data from wpf_dashboard_data
    where section = 'tasks2'`.
  - *Aberto em:* 2026-09-17

- [ ] **O que só a Karina consegue fazer (nas próximas sessões)** — o Claude
  publica sozinho no GitHub, mas **não** tem acesso ao Cloudflare nem ao
  Supabase.
  - *Cloudflare:* colar o código do Worker em Edit code e clicar em Deploy;
    criar/editar segredos. (Se o editor abrir em modo leitura, trocar o
    seletor de versão pra "Active/Latest".)
  - *Supabase:* rodar os SQL no SQL Editor.
  - *Meta:* aprovar template, mexer em número/verificação.
  - *Aberto em:* 2026-09-17

- [ ] **Sem Settings: como gerenciar usuários e backup** — em 16/09 Settings
  saiu do menu de vez (decisão da Karina, sem atalho).
  - *Contexto:* criar/editar usuários e senhas, baixar/restaurar backup,
    lista de versões do dashboard e URL do Daily Digest só existiam lá. O
    código continua; as versões seguem sendo gravadas. Pra usar de novo:
    tirar `#nav-settings` da regra CSS de 16/09 (ou abrir via console:
    `document.getElementById("nav-settings").click()`).
  - *Onde:* `index.html`, CSS ao lado de `#nav-marketing`.
  - *Aberto em:* 2026-09-16

- [ ] **Metas automáticas da Tasks congelam sem a Goals** — "acessos no
  site", "seguidores Instagram", "CPC" e "gasto AdWords" leem a entrada mais
  recente dos KPIs de Marketing em `goalsData`, que só era atualizada pela
  aba Goals.
  - *Contexto:* não há código que traga esses números da planilha de
    Marketing pra `goalsData`. Caminho sugerido: `kpiDoMarketing` ler direto
    de `mktData` (a planilha que já carrega a cada 5 min).
  - *Onde:* `index.html`, Tasks 2, `METAS_AUTOMATICAS` / `kpiDoMarketing`.
  - *Aberto em:* 2026-09-16

- [ ] **Apagar de verdade o código de Geral, Goals, Tasks original e o card
  do Slack** — hoje só escondidos.
  - *Contexto:* decisão de 16/09 foi ocultar. Antes de apagar: resolver as
    metas automáticas (item acima), a semeadura da Tasks 2 a partir de
    `tasksData` (`seedFromRealTasks`) e o Slack, que usa `tasksData`.
  - *Onde:* `index.html`.
  - *Aberto em:* 2026-09-16

- [ ] **Confirmar de onde vem `operations.worldpokerfederation.workers.dev`**
  — Karina usa esse endereço (Cloudflare Workers), mas as publicações vão
  pro repo `karinabupp/wpf` / GitHub Pages.
  - *Contexto:* em 16/09, depois de publicar `06e64b8`, os únicos checks
    do commit no GitHub são os do Pages (`build`, `deploy`,
    `report-build-status`), sem nenhum check do Cloudflare, e o token não
    lê webhooks (403). O endereço também não é acessível de dentro da
    sessão. Se o Worker não puxa do repo, as correções de 15/09 (sync) e
    16/09 (filtro) não chegam lá. Teste simples: dar F5 ali e ver se a
    setinha fecha com filtro ativo.
  - *Onde:* hospedagem / Cloudflare.
  - *Aberto em:* 2026-09-16

- [ ] **Sync: mesmo campo da mesma linha editado ao mesmo tempo** — continua
  valendo o último a gravar naquele campo.
  - *Contexto:* limite aceito na proposta de 15/09. Resolver 100% exige
    Supabase Realtime ou uma linha por tarefa na tabela (hoje é uma linha
    por seção). Só vale se isso aparecer na prática.
  - *Onde:* `index.html`, `juntarNo`.
  - *Aberto em:* 2026-09-15

- [ ] **Ctrl+Z da Tasks 2 depois de uma atualização vinda de outro PC** — a
  pilha de desfazer guarda retratos da tabela; desfazer depois que chegou
  uma edição de outra pessoa pode trazer de volta o estado anterior dela.
  - *Contexto:* observado ao ler o código em 15/09, **não testado nem
    corrigido**. Caminho provável: limpar a pilha de desfazer quando
    `aplicarDaNuvem` trouxer `tasks2`.
  - *Onde:* `index.html`, Tasks 2 (snapshot de desfazer) + `aplicarDaNuvem`.
  - *Aberto em:* 2026-09-15

- [ ] **Históricos pesam em todo envio** — `historicoGeral` (10 retratos do
  dashboard inteiro) e `tasks2Historico` mudam a cada gravação e sobem
  junto sempre.
  - *Contexto:* já era assim antes; o sync novo só não os baixa na
    atualização ao vivo. Se a dash ficar lenta pra salvar, é o primeiro
    lugar a olhar (ex. mandar só a versão nova em vez da lista toda).
  - *Onde:* `registrarVersaoGeral`, `enviarAgora`.
  - *Aberto em:* 2026-09-15

- [ ] **Liberar escrita no repo para as sessões do Claude** — pra não depender
  de upload manual a cada mudança.
  - *Contexto:* em 11/09 o push **continuou bloqueado nesta sessão**, com a
    mesma mensagem do proxy: `karinabupp/wpf is not in this session's
    authorized repository set`. Mas **outras sessões publicaram direto** no
    mesmo dia (commits das 17:32 às 19:05 UTC, ex. `a943bd5`). Ou seja, o
    token funciona; o que decide é se o repo está nas **fontes da sessão**
    quando ela é aberta. Caminho provável: abrir a tarefa com o repo
    `karinabupp/wpf` adicionado como fonte (como as sessões que conseguiram
    publicar foram abertas) e testar com `git push --dry-run` logo no início.
  - *11/09 (3ª sessão):* testado de novo com o token das instruções —
    mesmo bloqueio. O token nem chega a ser usado: o proxy da sessão barra
    qualquer repo fora das fontes da tarefa, e a documentação do proxy manda
    **não contornar** esse bloqueio (é política). Então não há nada a fazer
    de dentro de uma sessão aberta sem o repo; a solução é **abrir a tarefa
    com `karinabupp/wpf` selecionado como repositório**.
  - *Plano B:* dirigir o navegador embutido do Claude no PC da Karina (já
    logado no GitHub) e fazer o upload pela interface web, com ela
    autorizando e acompanhando. Ainda não foi usado.
  - *15/09:* nesta sessão o `git push --dry-run` **passou** — o repo estava
    nas fontes da sessão. Confirma que o caminho é abrir com o repo
    selecionado.
  - *Onde:* configuração de ambiente, fora do dashboard.
  - *Aberto em:* 2026-08-31 · *revisado em:* 2026-09-15

- [ ] **Uma sessão por vez mexendo na Dash** — em 11/09 duas sessões
  implementaram o mesmo pedido (arrastar pra baixo) em paralelo, de jeitos
  diferentes, e uma teve que substituir a outra.
  - *Contexto:* as sessões não se enxergam. Sugestão: antes de começar,
    toda sessão roda `git fetch` e compara com o HEAD que leu no início; e
    Karina evita abrir duas tarefas pro mesmo pedido. (15/09: mais um commit
    sem Changelog, `7b718a8`.) Também vale: as
    sessões que publicaram entre 01/09 e 11/09 **não registraram nada neste
    Changelog** (o histórico delas está só nas mensagens de commit do repo).
  - *Onde:* processo de trabalho.
  - *Aberto em:* 2026-09-11

- [ ] **Bug: "Colar aqui" não abre a linha que recebeu as cópias** — a
  intenção do código é expandir o destino pra mostrar o que chegou.
  - *Contexto:* no handler do `#tasks2-bulk-colar` está
    `tasksExpanded[alvo.id] = true`, mas `tasksExpanded` é um `Set`; o
    certo é `tasksExpanded.add(alvo.id)`. A cópia funciona, só não abre a
    linha. Achado em 11/09, **não corrigido** (fora do pedido; precisa de OK).
  - *Onde:* `index.html`, bloco Tasks 2, listener de `tasks2-bulk-colar`.
  - *Aberto em:* 2026-09-11

- [ ] **Trocar o token do GitHub que está nas instruções do projeto** — está
  em texto puro, legível por qualquer sessão do projeto.
  - *Contexto:* levantado em 31/08, segue pendente. Preferir fine-grained com
    escopo só em `karinabupp/wpf` (Contents + Metadata) e expiração curta.
    Bom momento pra fazer isso é junto com a liberação de escrita acima.
  - *Onde:* instruções do projeto WPF Dash.
  - *Aberto em:* 2026-08-31

- [ ] **Decidir se o rascunho vira a versão oficial ou é descartado** — a aba
  Tasks 2 é código duplicado; quanto mais tempo ela viver, mais ela diverge
  da aba Tasks original.
  - *Contexto:* a duplicação total foi escolha consciente (isolamento máximo).
    Quando as mudanças do rascunho estiverem aprovadas, o caminho é portar as
    diferenças pra aba Tasks e **remover** o bloco Tasks 2 inteiro — os cinco
    pontos de inserção estão documentados no Changelog de 31/08. **Atenção:**
    a coluna Projeto inteira (chip, select, `projetosData`, gerenciador) só
    existe no rascunho; portar significa levar isso junto, incluindo a chave
    de localStorage e a decisão de sincronizar ou não com a nuvem.
  - *Onde:* `index.html`, blocos `tasks2-*` e o bloco JS "TASKS 2".
  - *Aberto em:* 2026-08-31

- [ ] **A coluna Projeto não sincroniza com a nuvem** — hoje `projetosData`
  vive só no `localStorage` deste navegador.
  - *Contexto:* é consequência correta do isolamento do rascunho (nada de
    `scheduleCloudSave`), mas na hora de virar oficial isso precisa de
    decisão: os projetos vão pro payload do Supabase junto com o resto? Se
    sim, precisam entrar no `loadFromCloud`/save e ganhar tratamento de
    conflito, senão dois navegadores criam listas divergentes.
  - *Nota de 11/09:* pelo histórico do repo, o Tasks 2 passou a sincronizar
    com a nuvem (commit `86cb0c1`, "Sync Tasks 2 and Members 2 to the
    cloud") e a coluna virou "Área". Conferir numa próxima sessão se este
    item ainda vale.
  - *Onde:* `index.html`, `PROJETOS_STORAGE_KEY` / `saveProjetosData()`.
  - *Aberto em:* 2026-09-01

## Observado, sem ação necessária agora

- **Dados do Agente de Gestão (WhatsApp), pra não caçar de novo.** App ID
  `1138081025211466`; número do robô `+55 11 97261-7434`; Phone Number ID
  `1414890888363584`; WABA ID `1758272028835115`; Worker
  `wpf-whatsapp-bridge` em `wpf-whatsapp-bridge.worldpokerfederation.workers.dev`;
  tabelas `wpf_whatsapp_messages` e `wpf_agente_pessoas`; página
  `karinabupp.github.io/wpf/privacy.html`. Segredos ficam **só** no Worker
  (inclusive a secret key do Supabase e a chave da Anthropic). Crédito da
  Anthropic: US$ 10 em 17/09. (17/09)

- **Avisos Gerais guarda status manuais que não aparecem mais.** Desde
  16/09 o quadro é calculado da Tasks; os status escolhidos à mão antes
  continuam em `statusPorQuadro["avisos-gerais"]`. Se um dia voltar a ser
  manual, eles reaparecem. Dá pra limpar, mas só com OK. (16/09)

- **Inicialização salva antes da nuvem carregar.** Ao abrir a página, o
  código de seeds/migrações chama `scheduleCloudSave` ~5 vezes, e a
  inicialização do mapa grava federações logo depois da carga. Desde 15/09
  o envio espera a primeira carga dar certo, então isso não sobe mais dado
  de exemplo; mas essas gravações de inicialização continuam existindo.

- **`versaoUtil` pode travar o histórico geral.** Se a versão mais recente
  guardada tiver uma seção crítica com itens e o estado atual tiver essa
  seção vazia (ex. metas de exemplo → nuvem sem metas), nenhuma versão nova
  é guardada até isso mudar. Visto nos testes de 15/09 e contornado na
  migração; a regra em si não foi mexida. (15/09)

- **"Hoje" do Deadline e do Late é em UTC.** `todayISO()` usa
  `toISOString()`, então depois das 21h em São Paulo o dashboard já
  considera o dia seguinte (uma tarefa pode virar Late/Deadline 3h antes).
  Já era assim com o Late; o Deadline só seguiu a mesma régua. Corrigir é
  trocar `todayISO` pra data local — mexe também na aba Tasks original,
  então precisa de OK. (11/09)

- **Seletores no Safari antigo.** A lista de Status/Área/País abre via
  `showPicker()`. Em navegador sem esse recurso o seletor abre como antes,
  mas aí não dá pra *começar* uma seleção arrastando em cima dele (dá pra
  começar em outra célula e passar por cima). (11/09)

- **Os tons de roxo dos projetos ficaram órfãos.** Em 01/09 o chip virou
  cinza único e `tomDoProjeto()` passou a ignorar a fila. `PROJETO_TONS` e o
  campo `p.tom` continuam no código de propósito — voltar às cores é
  literalmente desfazer um `return`. Efeito colateral que existia e sumiu
  junto: depois de excluir um projeto, o próximo criado podia repetir a cor
  de um existente (o tom vinha de `projetosData.length % 8`). Se um dia as
  cores voltarem, esse bug volta com elas — a correção é pegar o próximo tom
  livre em vez do próximo da fila.

- **O bloco Tasks 2 fica no fim do `<script>`.** Isso significa que qualquer
  erro síncrono anterior no script mata a aba Tasks 2 junto. Confirmado de
  novo em 01/09, e dessa vez sem stub: no ambiente de teste a CDN não é
  alcançável, o `d3 is not defined` estoura, e a aba Tasks 2 simplesmente não
  renderiza (a Tasks original renderiza, porque o init dela vem antes). Em
  produção o d3 carrega normal, então não é um problema real — mas se um dia
  a dash ficar sem CDN, é a primeira coisa a quebrar. **Para testar o Tasks 2
  em ambiente sem rede:** servir d3/topojson/chart.js do `node_modules` via
  `page.route` do Playwright, apontando pras URLs da jsdelivr. (Usado de
  novo em 11/09 com `playwright-core` + Chromium de `/opt/pw-browsers`.)

- **`renameAssigneeEverywhere` / `removeAssigneeEverywhere` não tocam o
  rascunho.** Renomear ou apagar um usuário em Settings atualiza as tasks
  reais e deixa o rascunho com o nome antigo. É consequência esperada do
  isolamento; o botão "Recarregar do original" resolve.

---

## Concluídos

- [x] **Publicar a correção do abrir/fechar com filtro (16/09)** — commit
  `06e64b8` publicado, sha256 `d8eba116…7698` confere, Pages `built`.

- [x] **Publicar a correção de sincronização (15/09)** — commit `1aacd4c`
  publicado direto desta sessão, sha256 `516c5d37…c6e9` confere, Pages
  `built`. Pendência fora do código: todo mundo dar refresh na Dash.

- [x] **Subir o `index.html` de 11/09 no GitHub** — feito por Karina:
  commit `4edaea3` ("Add files via upload"), sha256 do `index.html` no repo
  confere com o entregue (`b0b475d9…28e5`). Contém as 4 mudanças do dia.

- [x] **Subir o `index.html` da sessão de 01/09 no GitHub** — superado: o
  repo já está muitos commits à frente (HEAD `a943bd5` em 11/09).

- [x] **Subir o `index.html` com a aba Tasks 2 no GitHub** — feito; o HEAD
  `c175538` já contém a aba.

- [x] **Definir acesso ao repositório no GitHub** — resolvido parcialmente em
  2026-08-31: o token do projeto dá **leitura** (clone/ls-remote funcionam) no
  `karinabupp/wpf`. A parte de escrita virou item próprio acima.
