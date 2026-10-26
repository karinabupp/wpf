# Lembretes do Carinha — quando e o quê lembrar

> **Quem usa:** o Carinha (Worker `wpf-whatsapp-bridge`, bloco "PROJETOS +
> AGENDA") e toda sessão do Claude que mexer na rotina de mensagens.
> **Regras da Karina de 14/10/2026** (gatilhos, botões, agenda) **+ jeito
> de mandar de 20/10/2026** (conversa, trava de 2 em 4h, resumão, janela sem
> template). Mudou aqui = registrar no Changelog.
> **No ar pra todos** (`projetos_liberados` = `{"todos": true}`), sem piloto.

## De onde vem

- Fonte: guia **Projetos** das **duas empresas** (seções `projetos` e
  `projetos__cbth`, desde 21/10). Não lê as outras abas. Tarefa da CBTH vem
  com "É da CBTH." (no resumão, "(CBTH)" no projeto; na agenda, "· CBTH"); o
  que muda pelo WhatsApp/agenda grava na seção da empresa da linha.
- Só tarefas **abertas** (nem Finalizado, nem Cancelado) **em nome da
  pessoa**. Linha dentro de entrega cancelada não entra.
- **Só a ponta** (linha sem nada dentro), sempre (Karina, 21/10): a mãe
  herda o responsável das filhas e não gera aviso.
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
- **Fim de semana (20/10):** só tarefa que vence (ou começa) naquele dia.
  E-mail, Slack e reunião ficam pra segunda.
- **Prazo em sábado/domingo** (fora do Ladies Weekend): pergunta uma vez
  "é proposital?" com [Sim, proposital] [Mudar prazo]. Se o Fim mudar e cair
  de novo em fim de semana, pergunta de novo.

## Como ele manda (Karina, 20/10)

- **Só chama quando tem coisa.** Sem assunto, silêncio (acabou o "Nada desse
  lado" e o lembrete do meio-dia).
- **Uma coisa por mensagem:** uma tarefa, um e-mail. As reuniões do dia vão
  juntas numa mensagem só. **Slack (23/10):** tudo o que estiver pendente vai
  junto numa mensagem só, separado por canal e do mais antigo pro mais novo.
- **TRAVA:** no máximo **2 mensagens por conta própria seguidas sem
  resposta numa janela de 4h**. Respondeu = zera. Passaram 4h sem resposta =
  pode mais 2. **Furam a trava:** reunião nova na agenda (ou reunião a menos
  de 1h que ainda não foi avisada), tarefa nova que vence hoje (ou já
  atrasada) que entrou durante o dia e **Slack (23/10)**, que sai na rodada
  seguinte a ter chegado (até 30 min, de 8h a 21h, em dia útil).
- **Ordem:** o que vence hoje (de cara; 2 ou mais = uma mensagem com todas e
  [Ver a 1ª] [Ver a 2ª]; desde 23/10 agrupadas por onde estão: "📌 entrega ›
  linha de cima" e as tarefas numeradas embaixo) › reuniões do dia ("precisa de algo pra elas?",
  sempre antes do horário) › e-mail muito importante › tarefas › e-mail.
  O Slack não entra na fila: fura (veja TRAVA).
- **Tarefas, uma por vez**, por **prioridade** (alta › média › baixa › sem)
  e, entre iguais, **a mais difícil primeiro**. Texto de conversa: "X vence
  hoje. Dá pra fechar hoje?", com [Finalizar/Começar] [Mudar prazo]
  [Depois]. Fechou o assunto (Finalizar, prazo novo, Depois, proposital):
  "Próxima: …" vem sozinha.
- **Resumão (5+ tarefas no dia, fora as que vencem hoje):** "Hoje você tem
  N tarefas pedindo atenção: • Projeto A: x não iniciadas e y em andamento…
  Quer começar por qual?" com um botão por projeto. Admin recebe também o
  link do dia na Dash.
- **Não atropela:** com conversa rolando (menos de 30 min da última
  mensagem), a rodada espera; e-mail comum não entra entre uma tarefa e a
  próxima (o Slack entra).
- **Rodadas:** 9h25 (monta o dia), e de 8h a 21h aos :05 e aos :35.

## Janela de 24h

- **Janela fechada → template `carinha_bom_dia` só quando há assunto
  (Karina, 26/10):** vai numa rodada dos :05/:35 em que haja algo pra
  entregar (Slack, tarefa do dia na fila ou e-mail relevante), dia útil,
  8h–19h, **no máximo um bom dia por dia**. Sem assunto, não sai nada. Às
  9h25 não sai template (a rotina só monta o dia). Fim de semana, nada.
  Texto: "Oi, {nome}! Precisando de algo por aí? Nossa janela de 24h já
  fechou. Me responde aqui pra gente poder continuar conversando e eu seguir
  te mandando suas tarefas e avisos. 🙂" com um botão só, [Tô aqui!]: reabre
  a janela e já manda o que estava esperando.
- **Sem fallback:** enquanto a Meta não aprovar o `carinha_bom_dia`, não sai
  template nenhum (o `aviso_dash` não é mais usado).
- Fora o bom dia, janela fechada = nada sai; tudo espera a pessoa escrever.
  Quando ela escreve ("oi", "Ver o que tem"…), o que estava esperando vem.
- **Manutenção (dias úteis, 8h–21h):** se a janela vai fechar e não houve
  assunto, "Oi, Fulana! Tudo certo por aí? Precisa de algo?" [Tudo certo]
  [Preciso], uma vez, pra ela responder e renovar as 24h. A equipe foi
  orientada a responder sempre.

## Revisores (obrigatórios)

- **De texto (IA):** lê cada tarefa como quem está no celular sem contexto
  nenhum e reescreve o que estiver confuso, com jargão da planilha ("2ª
  vez", "Post 1") ou longo. Não inventa: se a linha não diz o essencial,
  avisa que vale detalhar na Dash.
- **De código:** de manhã, recalcula a lista a partir da Projetos e confere:
  a fila bate com os gatilhos; nada finalizado ou cancelado; tudo é da
  pessoa. Antes de cada tarefa sair, confere a mensagem: o "o que fazer", o
  prazo dito (vence hoje / data / dias de atraso) e os botões. Qualquer
  diferença: **não sai** e a Karina recebe "⚠️ O revisor barrou…".

## Atalho e conversa

- "ver agora", "agora", "tarefas", "minhas tarefas", "tarefas de hoje"
  (com erro de digitação também) trazem a tarefa da vez (ou o resumão, se
  ainda forem 5+) a qualquer hora. Duas mensagens seguidas abrem uma vez só.
- Perguntas livres ("o que tenho atrasado?") usam a mesma Projetos e o
  mesmo jeito de escrever: o que fazer, de qual projeto e o prazo — nunca
  nome solto de linha. Só as da pessoa; as dos outros só quando ela pedir.

## Durante o dia

- Tarefa **nova** em nome da pessoa vencendo hoje ou já atrasada: vai na
  hora, furando a trava ("Entrou uma tarefa nova sua: …"). Vencendo amanhã:
  entra na fila.
- Reunião nova na agenda: avisa na hora, antes do horário, furando a trava.
- E-mail importante e não lido: entra na fila, um por mensagem, respeitando
  a trava (não vai mais na hora).

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
