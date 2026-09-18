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
- Worker `wpf-whatsapp-bridge` (Cloudflare) — ponte do WhatsApp. **O código
  dele não está neste repo**; vive no painel do Cloudflare.
- Supabase, projeto "operation dashboard" — dados da Dash
  (`wpf_dashboard_data`), mensagens (`wpf_whatsapp_messages`) e pessoas do
  agente (`wpf_agente_pessoas`).

## O que o Claude NÃO consegue fazer sozinho

Publicar no GitHub, sim. Mas **Cloudflare, Supabase e Meta dependem da
Karina**: colar código no Worker e dar Deploy, criar/editar segredos, rodar
SQL, aprovar template.

## Ao final de cada sessão

Atualizar `Changelog.md` e `Prox-Passos.md` **aqui nesta pasta** e publicar
no repo, para a próxima sessão começar de onde esta parou.
