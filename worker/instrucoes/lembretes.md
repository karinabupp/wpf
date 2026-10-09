# Lembretes do Carinha — quando e o quê lembrar

> **Quem usa:** o Carinha (Worker `wpf-whatsapp-bridge`) e toda sessão do
> Claude que mexer na rotina de mensagens. Aprovado pela Karina em
> 09/10/2026 ("manda bala"). Mudou aqui = registrar no Changelog.
> **Ainda não está ligado:** o resumo diário só começa quando a Karina
> liberar (ver Prox Passos "Resumo diário + fechamento do dia").

## De onde vem

- Fonte: guia **Projetos** (seção `projetos`). A Tasks vai deixar de existir.
- Só **ações**: linhas sem nada dentro, não finalizadas/canceladas (mesma
  regra da coluna Próxima ação). Unidade sem passos ("🇦🇷 @Argentina") não é
  ação.
- Cada um recebe **só o que é seu** (REGRA DO ROBÔ). Ação **sem responsável,
  sem data ou faltando informação vai pra Karina**, perguntando de quem é /
  o que falta; com a resposta, o Claude/Carinha preenche (com confirmação).

## Quando lembrar (por Dificuldade e período)

Período longo = mais de 7 dias entre Início e Fim.

| Tipo | Quando lembra |
|---|---|
| **Dificuldade Alta** ou **período longo** | 2 dias antes do Início e no dia do Início; durante, a cada 3 dias úteis pergunta como está; de novo 3 dias antes do Fim |
| **Dificuldade Média** | no Início e 3 dias antes do Fim |
| **Dificuldade Baixa** | uma vez só; depois, só se atrasar |
| **Atrasada** (passou do Fim) | sempre entra |

Sem Dificuldade preenchida: tratar como Média. Sem Início/Fim: não dispara
por data — vai pra Karina como "faltando informação".

## Rotatividade (nada de repetir as mesmas tarefas todo dia)

- Por pessoa e por dia: **no máximo 5 itens**.
- Escolha por nota: **prioridade** (alta > média > baixa) + **proximidade do
  prazo** + **tempo desde a última vez que o item apareceu**. O que apareceu
  ontem perde peso. Atrasada sempre entra (conta dentro dos 5).
- Guardar quando cada item foi mostrado a cada pessoa (pra calcular o peso).

## Ritual (dias úteis)

- **Manhã (check-in, 9h–9h25):** resumo do que precisa ser feito, já
  filtrado pelas regras acima. Sem nada: não manda resumo (o check-in que
  mantém a janela do WhatsApp aberta continua, decidido em 09/10).
- **Fim do dia (19h):** pergunta o que foi feito e o que não foi, dos itens
  mostrados de manhã. A resposta vira proposta de mudança de status, sempre
  com confirmação.
