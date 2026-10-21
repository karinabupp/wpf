# Como retomar o trabalho da WPF Dash

Esta pasta é a memória do projeto. Toda sessão do Claude deve **ler estes
dois arquivos antes de propor qualquer coisa**:

1. `Changelog.md` — tudo o que já foi alterado, quando e por quê.
2. `Prox-Passos.md` — o que está em aberto, com contexto suficiente para
   retomar sem reconstruir o raciocínio.

## Regras de trabalho (as mesmas das instruções do projeto)

1. **Aprovação antes de tudo.** Nada é alterado, criado ou apagado sem
   autorização explícita da Karina — inclusive ajustes pequenos e correções
   de bug óbvias.
2. **Changelog obrigatório** ao final de toda sessão em que algo mudar.
3. **Prox Passos** recebe tudo o que ficar pendente ou for identificado como
   melhoria futura.
4. **Ler estes docs no início da sessão**, para não repetir trabalho nem
   desfazer decisão já tomada.

## Onde as coisas vivem

- `index.html` — a Dash inteira (um arquivo só), publicada pelo GitHub Pages.
- `privacy.html` — política de privacidade do app "Agente de Gestão" (WhatsApp).
- `worker/` — robô do WhatsApp (`wpf-whatsapp-bridge`). `worker-slack/` —
  ponte do Slack (`wpf-slack-bridge`). Push nessas pastas publica sozinho
  (GitHub Actions). Segredos ficam só no Cloudflare.
- `sql/` — scripts aplicados no Supabase, com data.
- Supabase, projeto "operation dashboard" — dados da Dash
  (`wpf_dashboard_data`), mensagens (`wpf_whatsapp_messages`) e pessoas do
  agente (`wpf_agente_pessoas`).

## Login da Dash (desde 21/09)

- Login pelo **Supabase Auth**. Quem pode entrar = usuário em
  Authentication → Users **e** linha na tabela `wpf_acesso` (papel adm/colab
  e `nome` igual ao da Tasks). A lista de usuários em Settings não controla
  mais o acesso. Os dados da Dash só abrem pra quem está nas duas.
- **Esqueci a senha:** a pessoa fala com a Karina, que abre uma sessão. O
  Claude reseta pelo conector do Supabase (a Karina passa uma provisória):
  `update auth.users set encrypted_password = extensions.crypt('<provisória>',
  extensions.gen_salt('bf')) where email = '<e-mail>';` e
  `update wpf_acesso set precisa_trocar_senha = true where email = '<e-mail>';`
  Na próxima entrada a Dash obriga a trocar.
- **Nunca** colocar senha, token ou chave secreta neste repo: ele é público.
- **REGRA DO ROBÔ (Karina, 22/09 — não pode quebrar; e-mail atualizado em
  12/10):** o que cada um recebe sem pedir. Leonardo e Roberto: só as tarefas
  deles. Isabela: as dela + Slack. Karina: as dela + Slack (e, como admin,
  reuniões/sistema). **E-mail/agenda: cada um SÓ os próprios**, quando
  conectar o Google (12/10); nunca de outra pessoa.
  Tarefas dos outros: NUNCA por conta própria; só na conversa, quando a
  pessoa pedir. Slack por pessoa = `recebe_slack` em `wpf_agente_pessoas`.
  Teste que guarda a regra: `teste_regra.mjs` (sessão de 22/09).
- **Carinha na Dash (23/09):** janelinha de chat só pra login `karina`
  (`CARINHA_LOGINS` no index.html + `LOGINS_CHAT_DASH` no Worker — mudar
  nos dois). Rota `/chat` do Worker; mesma conversa do WhatsApp, marcada
  `canal = 'dash'`.
- **Settings (25/09):** aba de pessoas e permissões, só pro login `karina`
  (`SETTINGS_LOGINS` no index.html + `LOGINS_SETTINGS` no Worker — mudar
  nos dois). Lê e grava pelo Worker (`/admin/pessoas`, `/admin/pessoa`,
  `/admin/reset-senha`). Empresas e permissões moram em `wpf_acesso`
  (`empresas`, `permissoes`). Permissões ainda NÃO bloqueiam ninguém
  (`PERMISSOES_LIBERADAS_PARA_TODOS = true`); Settings e Carinha são só da
  Karina, sempre.
- **REGRA — `CATALOGO_PERMISSOES` (25/09):** toda sessão que criar uma
  função nova na Dash acrescenta a permissão dela no `CATALOGO_PERMISSOES`
  (index.html) e registra no Changelog. Assim o pop-up de permissões da
  Settings acompanha cada atualização. Permissão nova nasce desligada pra
  colab e ligada pra adm; o pop-up marca "novo".
- **Robô — quem cria linha pra outras pessoas:** admin, ou quem tem
  `cria_para_outros = true` em `wpf_agente_pessoas` (hoje: Isabela).

- **Detalhador — fase 0 (08/10):** quando a Karina descrever uma demanda pra
  virar tarefas, seguir **`worker/instrucoes/detalhador.md`**: perguntar só o
  que falta, mostrar a árvore Demanda › Entrega › Item › Etapa e, com "sim",
  gravar na Tasks (piloto) (`tasksPiloto` no Supabase; nunca `tasks2`), com
  a Dash dela salva antes e recarregada depois. Registrar no Changelog o que
  foi criado. A mesma instrução vira a do Carinha na fase 3 do projeto BAIER.

- **REGRA — entrega nova na Projetos (Karina, 09/10):** toda entrega nova
  segue **`worker/instrucoes/organizacao-projetos.md`**: Entrega (meta com
  número) › Etapa (agrupamento, ex. continente) › Tarefa (a unidade, "@País",
  pelo menos N) › Subtarefas (o processo padrão, igual em todas). Exemplo:
  "50 Federações Membros". Propor antes, gravar só com "sim".

- **REGRA — nome limpo na Projetos (Karina, 13/10):** nada entre parênteses
  e nada de "Nome: detalhe" em linha nenhuma: vira sublinha (ou Responsável/
  data). Detalhes em **`worker/instrucoes/organizacao-projetos.md`**.

- **Dash enxuta (21/10):** a Dash é **Projetos · CRM · Settings (só Karina)
  · Meu Google**, em cada empresa. Tasks, Tasks (piloto) e Gestão saíram do
  menu e do código; os dados delas (`tasks2*`, `tasksPiloto*`) seguem no
  banco, intocados. A Projetos é de todo mundo e a tela inicial
  (`projetosLiberado()` = logado). O cadastro das tags continua em
  `tasksPilotoCadastro*` (bloco "TAGS" no index.html). **CRM ↔ Projetos:**
  Avisos Gerais conta as tarefas da Projetos por país/estado (tags próprias
  e herdadas — Karina, 21/10), aba Tarefas na janela do país, "Abrir no CRM"
  no cartão do @País, aviso ao mudar o status (Salvar) — pela ponte
  `projetosBridge` (tarefas/editar/criar/abrirLinha). Barrinha da linha na cor da frente da entrega (Federações azul,
  Eventos roxo, Comitê rosa, Marketing laranja queimado). A frente
  "Institucional" aparece como "Eventos" (id `institucional`).

- **REGRA — mãe herda das filhas na Projetos (Karina, 20/10):** linha com
  algo dentro tem status, datas e "Finalizado em" calculados (não editáveis):
  todas canceladas → Cancelado; todas finalizadas → Finalizado; tudo o que
  está aberto bloqueado → Bloqueado; nada começado → Não iniciado; resto →
  Em andamento. Atraso de filha deixa a mãe vermelha. **Responsável também
  (21/10):** quem tem tarefa de ponta aberta dentro (tudo finalizado: todas
  as pontas), mais tarefas primeiro; ninguém nas pontas → fica o da mãe.
  Ao gravar dados por
  SQL, deixar as mães coerentes (a Dash recalcula e grava ao abrir).
  `calcularMaes()` no bloco PROJETOS do index.html.

- **Carinha lê a Projetos (Karina, 14/10):** manhã das 9h25 (todo dia) com
  as tarefas que caem nos 5 gatilhos + reuniões do dia, uma mensagem por
  tarefa com botões, **revisor em código** antes de mandar, e-mail não lido à
  parte, tarefa nova urgente na hora, agenda pelo Google Tasks (🟡/🔴,
  concluir = Finalizado). Regras em **`worker/instrucoes/lembretes.md`**
  (substituem as de 09/10). Só pra quem está em `projetos_liberados`
  (`wpf_agente_config`): **liberado pra todos em 14/10** (`{"todos": true}`).
  Continua valendo a REGRA DO ROBÔ: cada um só o seu; Slack só Karina e Isabela. Link direto pra linha da Dash: `?pj=<id>&org=wpf`; lista do dia:
  `?dia=<ids>&org=wpf`. **Carinha é um só (Karina, 14/10):** pra quem está
  liberado, a conversa também lê/muda só a Projetos (`instrucoesPj`, ferramentas
  `*_projetos`); a Tasks antiga não aparece mais pra essa pessoa.

- **REGRA — como o Carinha manda (Karina, 20/10; no ar 21/10, pra todos):**
  só chama quando tem coisa; uma coisa por mensagem; **no máximo 2
  seguidas sem resposta em 4h** (furam: reunião nova e tarefa nova que vence
  hoje); vence hoje primeiro, depois prioridade › dificuldade; 5+ tarefas =
  resumão por projeto; texto de conversa e "Próxima" sozinha. Janela
  fechada: template `carinha_bom_dia` às 9h25 do dia seguinte (todo dia útil
  até responder; fds só com tarefa do dia; **sem fallback** enquanto a Meta
  não aprovar); fora isso, nada, com a manutenção "tudo certo por aí?" em
  dia útil. Fim de semana: só tarefa do
  dia. Detalhes em **`worker/instrucoes/lembretes.md`**.

- **MODO SÓ E-MAIL (Karina, 13/10 — até segunda ordem):** o Carinha está
  ligado pra todos, mas por conta própria **só avisa de e-mail relevante da
  própria pessoa** (spam/propaganda não; nada do e-mail dos outros).
  **Ninguém recebe nada de Tasks**, nem check-in, Slack ou reunião. Chave
  `avisos_somente_email` em `wpf_agente_config`; só desligar com ordem dela.
  Exceção (14/10): quem está em `projetos_liberados` (hoje só a Karina) segue
  a rotina nova da Projetos (item acima).
- **Google de cada pessoa (12/10):** conexão em `google.html` ou no ícone
  "Meu Google" da Dash; chave em `wpf_agente_google` (só o robô lê). App
  "Carinha" no Google Cloud da organização WPF (interno + confiável).
  Piloto: só admin; liberar = config `google_liberados`. Mexer em e-mail,
  agenda ou Drive: sempre com o "sim" e só na conta de quem pediu.

## O que o Claude NÃO consegue fazer sozinho

Publicar no GitHub, sim. Mas **Cloudflare, Supabase e Meta dependem da
Karina**: colar código no Worker e dar Deploy, criar/editar segredos, rodar
SQL, aprovar template.

## Ao final de cada sessão

Atualizar `Changelog.md` e `Prox-Passos.md` **aqui nesta pasta** e publicar
no repo, para a próxima sessão começar de onde esta parou.
