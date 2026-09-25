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
- **REGRA DO ROBÔ (Karina, 22/09 — não pode quebrar):** o que cada um recebe
  sem pedir. Leonardo e Roberto: só as tarefas deles. Isabela: as dela +
  Slack. Karina: as dela + Slack + e-mail (e, como admin, reuniões/sistema).
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

## O que o Claude NÃO consegue fazer sozinho

Publicar no GitHub, sim. Mas **Cloudflare, Supabase e Meta dependem da
Karina**: colar código no Worker e dar Deploy, criar/editar segredos, rodar
SQL, aprovar template.

## Ao final de cada sessão

Atualizar `Changelog.md` e `Prox-Passos.md` **aqui nesta pasta** e publicar
no repo, para a próxima sessão começar de onde esta parou.
