# Lembretes do Carinha — quando e o quê lembrar

> **Quem usa:** o Carinha (Worker `wpf-whatsapp-bridge`, bloco "PROJETOS +
> AGENDA") e toda sessão do Claude que mexer na rotina de mensagens.
> **Regras da Karina de 14/10/2026** (substituem as de 09/10: Dificuldade,
> máximo de 5 por dia e rotatividade saíram). Mudou aqui = registrar no
> Changelog.
> **No ar só pra quem está em `projetos_liberados`** (`wpf_agente_config`).
> Piloto: só a Karina. Quem não está liberado segue no modo só e-mail.

## De onde vem

- Fonte: guia **Projetos** (seção `projetos`). Não lê as outras abas.
- Só tarefas **abertas** (nem Finalizado, nem Cancelado) **em nome da
  pessoa**. Linha dentro de entrega cancelada não entra.
- **Só a ponta** (linha sem nada dentro). A linha mãe só entra quando está em
  deadline ou atrasada, ou seja, pelos gatilhos de prazo, nunca pelo Início.
- Cada um recebe **só o que é seu** (REGRA DO ROBÔ).

## Os 5 gatilhos (dias corridos)

| Gatilho | Quando | Na mensagem |
|---|---|---|
| Início | dia do Início (só a ponta) | ▶️ Começa hoje |
| Entrou em deadline | Fim − 3 (o dia em que fica amarelo na Dash) | 🟡 Entrou no prazo |
| Vence | dia do Fim | 🟡 Vence hoje |
| Atraso | 4 dias depois do Fim | 🔴 4 dias de atraso |
| Atraso de novo | a cada 3 dias depois disso (7, 10, 13…) | 🔴 N dias de atraso |

- **Estreia** (a 1ª manhã de cada pessoa): entra também o que já estava no
  amarelo ou atrasado, uma vez só.
- **Fim de semana:** o Carinha roda todo dia. Sábado e domingo ele só manda
  se houver tarefa (sem "nada desse lado").
- **Prazo em sábado/domingo** (fora do Ladies Weekend): pergunta uma vez
  "é proposital?" com [Sim, proposital] [Mudar prazo]. Se o Fim mudar e cair
  de novo em fim de semana, pergunta de novo.

## A manhã (9h25)

1. **Resumo (Karina, 15/10):** "Bom dia, Fulana! Hoje você tem N
   compromissos na agenda e M tarefas na Dash. Por onde quer começar?"
   [Ver agenda] [Ver tarefas]. Só agenda: resumo + lista juntos. Só
   tarefas: direto pro passo 3.
2. **Ver agenda:** a lista dos compromissos do dia (agenda do Google da
   pessoa; recusados e "local de trabalho" fora).
3. **Ver tarefas:** "M tarefas de hoje na Dash… Onde você quer ver?"
   [Ver aqui] [Ver na Dash] (equipe, sem a aba Projetos: já vai a 1ª).
   - **Ver na Dash:** pop-up do dia (`?dia=<ids>`), Principais/Outras, troca
     de status.
   - **Ver aqui:** uma tarefa por vez ("1/N · …"): o que fazer, gatilho,
     projeto, com quem divide, e [ação] [Mudar prazo] [Ver próxima].
4. **Garantir que veja tudo:** o que falta (agenda ou tarefas) é sempre
   oferecido; a partir do meio-dia, se ainda faltar, vai sozinho uma vez.
5. E-mails importantes não lidos (e Slack pra Karina e Isabela), à parte.
6. Sem nada (dia útil): "Bom dia! Nada desse lado, você precisa de algo?"

Janela de 24h fechada: template `aviso_dash` (só se houver conteúdo); o
resto chega no "Ver agora".

## Revisores (obrigatórios)

- **De texto (IA):** lê cada tarefa como quem está no celular sem contexto
  nenhum e reescreve o que estiver confuso, com jargão da planilha ("2ª
  vez", "Post 1") ou longo. Não inventa: se a linha não diz o essencial,
  avisa que vale detalhar na Dash.
- **De código:** recalcula a lista a partir da Projetos e confere: o número
  da abertura bate com a fila; cada tarefa cumpre um gatilho; nada
  finalizado ou cancelado; tudo é da pessoa; cada mensagem tem o "o que
  fazer", o prazo e os botões. Qualquer diferença: **as tarefas não saem** e
  a Karina recebe "⚠️ O revisor barrou…".

## Atalho e conversa

- "ver agora", "agora", "tarefas", "minhas tarefas", "tarefas de hoje"
  (com erro de digitação também) abrem a lista de hoje a qualquer hora.
  Duas mensagens seguidas abrem uma vez só.
- Perguntas livres ("o que tenho atrasado?") usam a mesma Projetos e o
  mesmo jeito de escrever: o que fazer, de qual projeto e o prazo — nunca
  nome solto de linha. Só as da pessoa; as dos outros só quando ela pedir.

## Durante o dia

- Tarefa **nova** em nome da pessoa vencendo hoje ou amanhã, ou já
  atrasada: vai na hora ("🆕 Tarefa nova em seu nome").
- E-mail importante e não lido: conforme chega (sem teto por dia). O muito
  urgente continua indo na hora.

## Botões (tudo pede "sim" antes de gravar)

- **Finalizar / Começar:** muda o status; Finalizado preenche a data.
- **Mudar prazo:** oferece Amanhã / Em 3 dias / Próx. segunda ou aceita a
  data escrita (20/10, 20/10/2026, amanhã, em 3 dias, próx. sexta). Se cair em
  fim de semana, avisa.
- **Criar tarefa nova:** a pessoa escreve o nome (e o prazo, se tiver, ex.:
  "Enviar o contrato até 20/10"); cria logo depois da tarefa, em nome dela.
- Toda gravação vai pro Histórico da linha ("— pelo Carinha (WhatsApp,
  Karina)") e pra `wpf_agente_auditoria`.

## Agenda (Google Tasks)

- Entra SÓ a ação (linha sem nada dentro) aberta da pessoa que está em
  deadline ou atrasada (Fim − 3 em diante), com 🟡. As linhas de cima vão
  só na descrição ("Está dentro de: …, na entrega …"), com o link. Concluir
  finaliza no máximo UMA linha da Dash (Karina, 14/10).
- No último dia, vai pro dia do Fim. Passou e não foi concluída: vira 🔴 e
  vem pra data de hoje, todo dia.
- **Concluir na agenda = Finalizado na Projetos** (em até 1 hora).
  Finalizada na Dash = concluída na agenda. Cancelada, passada pra outra
  pessoa ou com prazo afastado: sai da agenda.
- Apagada na agenda pela pessoa: não volta, a não ser que o Fim mude.
- Exige a permissão "Tarefas" na conexão do Google (reconectar em
  google.html) e a Google Tasks API ligada no projeto Carinha.
