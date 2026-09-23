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

- [ ] **Robô: reuniões (Read AI) na regra de 22/09** — a regra da Karina
  lista pra ela "as dela + Slack + e-mail"; os avisos de itens de reunião
  (e de sistema) continuam indo pra admin. Confirmar com ela se ficam.
  - *Aberto em:* 2026-09-22

- [ ] **Aviso de mudança de datas em massa** — Karina perguntou (22/09) se
  o robô avisa quando alguém muda muitas datas. Proposta: a Dash registra
  quem mudou cada data; o robô junta (ex.: 5+ prazos da mesma pessoa em 1h).
  Pendente: pela regra de 22/09, aviso sobre tarefas dos outros só quando
  ela pedir — precisa ela dizer se isso é exceção. Faltam também as 3
  escolhas (limite, só Fim ou Início também, de quem).
  - *Aberto em:* 2026-09-22

- [ ] **Slack: conferir o 1º aviso de verdade** — publicado em 22/09
  (Changelog, 7ª). Mandar uma mensagem num canal onde o bot está e ver se
  chega no WhatsApp em até ~5 min, com os botões Criar tarefa / Ver
  mensagens / Já vi. Se não chegar: conferir se a ponte ainda grava em
  `wpf_slack_messages` (a última era de 19/09) e o marcador
  `slack_visto_<tel>` em `wpf_agente_config`.
  - *Aberto em:* 2026-09-22

- [ ] **Robô: repetir a pergunta do print** — depois de 22/09 (Changelog,
  2ª de 22/09): Karina manda "Tem alguma tarefa minha em deadline hj? Ou
  late?" e confere que ele responde só as dela e cita a equipe com nome.
  - *Aberto em:* 2026-09-22

- [ ] **Presença: conferir com duas pessoas de verdade** — publicada em
  21/09 (Changelog, 14ª). Testada só com canal simulado. Se as bolinhas não
  aparecerem: console do navegador ("presença: CHANNEL_ERROR") e logs do
  Realtime no Supabase; conferir as 2 regras em `realtime.messages`.
  Opcional (endurecer): Supabase → Project Settings → Realtime → desligar
  "Allow public access" (a Dash não usa canal público).
  - *Aberto em:* 2026-09-21

- [ ] **Robô: conferir os avisos novos na prática** — publicados em 21/09
  (Changelog, 12ª). Olhar nos próximos dias: se está avisando pouco demais
  (as réguas: atraso "recente" = 2 dias úteis; Deadline só hoje/amanhã com
  3+ abertas); se os rascunhos do "Falar com X" soam bem; se o "Já vi,
  deixa comigo" está escondendo algo que devia voltar. Ajustes são nas
  constantes do bloco "Avisos (regras revistas em 21/09)".
  - *Não feito:* avisar a Karina quando a pessoa toca "Já vi" num recado.
  - *Aberto em:* 2026-09-21

- [ ] **Login: todos trocarem a senha provisória** — Karina já trocou e
  testou (21/09). Isabela, Leonardo e Roberto: F5 na Dash, e-mail do
  trabalho + senha provisória, senha nova. Conferir em `wpf_acesso`
  (`precisa_trocar_senha = false` pros 4).
  - *Aberto em:* 2026-09-21

- [ ] **Opcional: proteção contra senha vazada no Supabase** — aviso do
  próprio Supabase (Authentication → Sign In / Providers). Pode ser recurso
  só de plano pago. Também opcional: mínimo de 8 caracteres no Auth (a Dash
  já exige 8).
  - *Aberto em:* 2026-09-21

- [ ] **Planilha de Marketing é pública** — a Dash lê a planilha do Google
  como CSV público (link "qualquer pessoa"), e o ID está no `index.html`
  público. Risco baixo (são KPIs), mas qualquer um lê. Fechar exigiria a
  Dash ler por outro caminho (ex. o robô copiar pro Supabase).
  - *Onde:* `index.html`, leitura `gviz/tq?tqx=out:csv`.
  - *Aberto em:* 2026-09-21

- [ ] **Agente: todo mundo mandar o primeiro "oi" + template aprovado** —
  o check-in diário (21/09) só alcança quem já falou com o robô (janela
  aberta). Isabela, Leonardo e Roberto precisam mandar uma mensagem pro
  número do robô uma vez. Conferir a aprovação do template `aviso_dash`
  na Meta (sem ele, janela fechada + assunto = espera).
  - *Aberto em:* 2026-09-17 · *revisado em:* 2026-09-21

- [ ] **Agente: aba Tasks antiga e históricos ficaram de fora** — por
  decisão de custo (21/09) o agente lê só `tasks2*` e `members2*`. Se um dia
  quiser "o que mudou esta semana" com mais alcance, dá pra resumir os
  históricos em código antes de mandar. Nada a fazer agora.
  - *Aberto em:* 2026-09-21

- [ ] **O que só a Karina consegue fazer (nas próximas sessões)** — desde
  18/09 o Claude publica o **Worker** sozinho (push em `worker/` dispara o
  GitHub Actions) e roda SQL pelo **conector do Supabase** (conta certa
  conectada em 18/09). Continua só com a Karina:
  - *Cloudflare:* criar/editar os segredos do Worker.
  - *Meta:* aprovar template, mexer em número/verificação.
  - *Aberto em:* 2026-09-17 · *revisado em:* 2026-09-18

- [ ] **Sem Settings: como gerenciar usuários e backup** — em 16/09 Settings
  saiu do menu de vez (decisão da Karina, sem atalho).
  - *Contexto:* criar/editar usuários e senhas, baixar/restaurar backup,
    lista de versões do dashboard e URL do Daily Digest só existiam lá. O
    código continua; as versões seguem sendo gravadas. Pra usar de novo:
    tirar `#nav-settings` da regra CSS de 16/09 (ou abrir via console:
    `document.getElementById("nav-settings").click()`).
  - *Onde:* `index.html`, CSS ao lado de `#nav-marketing`.
  - *21/09:* **usuários e senhas não são mais da Dash.** Com o login do
    Supabase, a lista de usuários em Settings não controla mais quem entra:
    dar/tirar acesso = usuário em Authentication → Users **e** linha em
    `wpf_acesso` (ver LEIA-PRIMEIRO). Backup e versões continuam valendo.
  - *Aberto em:* 2026-09-16 · *revisado em:* 2026-09-21

- [ ] **Metas automáticas da Tasks congelam sem a Goals** — "acessos no
  site", "seguidores Instagram", "CPC" e "gasto AdWords" leem a entrada mais
  recente dos KPIs de Marketing em `goalsData`, que só era atualizada pela
  aba Goals.
  - *Contexto:* não há código que traga esses números da planilha de
    Marketing pra `goalsData`. Caminho sugerido: `kpiDoMarketing` ler direto
    de `mktData` (a planilha que já carrega a cada 5 min).
  - *Onde:* `index.html`, Tasks 2, `METAS_AUTOMATICAS` / `kpiDoMarketing`.
  - *Aberto em:* 2026-09-16

- [ ] **Apagar de verdade o código de Geral, Goals, Tasks original, Members,
  Committee, Social, a aba Slack, o card do Slack e a aba Forms** (o editor
  e as respostas do Forms continuam usados pelo popup das tarefas Forms) — hoje só escondidos (Members e
  Committee desde 21/09; os dados de Members já estão no CRM).
  - *Contexto:* decisão de 16/09 foi ocultar. Antes de apagar: resolver as
    metas automáticas (item acima), a semeadura da Tasks 2 a partir de
    `tasksData` (`seedFromRealTasks`) e o Slack, que usa `tasksData`.
  - *Onde:* `index.html`.
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

- **Workers na conta Cloudflare (21/09):** `wpf-whatsapp-bridge` (robô,
  repo `worker/`), `wpf-slack-bridge` (Slack, repo `worker-slack/`, rotas da
  Dash exigem login), `operations` (espelho do GitHub Pages). Apagados em
  21/09: `wpf-whatsapp-webhook` (robô antigo, com `/send` aberto) e
  `yellow-smoke-f7d6` (IA da Social, aberto pra qualquer um — a IA da
  Social ficou desligada na Dash; religar = recriar o Worker trancado).

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

- [x] **Daily Digest desligado** — Karina cancelou no Google em 21/09.

- [x] **Login de verdade na Dash (Supabase Auth)** — feito em 21/09 (ver
  Changelog, 11ª). Dash, Slack e respostas de formulário só pra equipe
  logada; senhas antigas apagadas do banco e dos navegadores.
- [x] **Agente: primeiro teste de verdade no WhatsApp** — Karina testou em
  21/09: tudo certo.
- [x] **Agente: Read AI (renovação do token) e script do Gmail** —
  confirmados pela Karina em 21/09.
- [x] **Trocar o token do GitHub das instruções** — feito em 21/09
  (fine-grained, só `karinabupp/wpf`, Contents + Workflows); o antigo foi
  revogado. As sessões publicam direto com ele.
- [x] **De onde vem `operations.worldpokerfederation.workers.dev`** — é um
  Worker que só espelha o GitHub Pages (`karinabupp.github.io/wpf/`). Tudo
  que é publicado no repo chega lá. (21/09)
- [x] **Liberar escrita no repo** — resolvido: o token novo publica direto
  (21/09).

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
