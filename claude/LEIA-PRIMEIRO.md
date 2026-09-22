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
- **Robô — quem cria linha pra outras pessoas:** admin, ou quem tem
  `cria_para_outros = true` em `wpf_agente_pessoas` (hoje: Isabela).

## O que o Claude NÃO consegue fazer sozinho

Publicar no GitHub, sim. Mas **Cloudflare, Supabase e Meta dependem da
Karina**: colar código no Worker e dar Deploy, criar/editar segredos, rodar
SQL, aprovar template.

## Ao final de cada sessão

Atualizar `Changelog.md` e `Prox-Passos.md` **aqui nesta pasta** e publicar
no repo, para a próxima sessão começar de onde esta parou.
