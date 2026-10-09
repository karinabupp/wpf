# Organização das entregas na Projetos — instrução

> **Quem usa:** toda sessão do Claude (projeto WPF Gestão) e, a partir da
> fase 3, o Carinha — sempre que for criar uma **entrega nova** na guia
> Projetos (seção `projetos` no Supabase).
> Definido pela Karina em 09/10/2026 ("a organização perfeita das tarefas").
> Mudou aqui = registrar no Changelog.
> Exemplo pronto: entrega **"50 Federações Membros"** (id `pj-cl-f14`).

## O modelo (4 níveis, sempre nesta ordem)

| Nível na Projetos | O que é | Exemplo |
|---|---|---|
| **Entrega** | O resultado, com o **número da meta** no nome. | 50 Federações Membros |
| **Etapa** | O **agrupamento** que organiza as unidades. | Europa, Ásia, Américas, África, Oceania |
| **Tarefa** | A **unidade** da meta, citada com @ (nome exatamente como no cadastro). | @Argentina |
| **Subtarefa** | O **processo padrão** da unidade: os mesmos passos, na mesma ordem, em **todas** as unidades. Começam com verbo. | Buscar e contatar candidato › … › Postar página no site |

Os níveis 5 e 6 (também "Subtarefa") ficam livres pra quebrar um passo
quando precisar; o modelo não os usa.

## Regras

1. **Meta N ⇒ pelo menos N unidades.** Se a entrega é "50 federações", a
   lista tem no mínimo 50 países (pode ter mais: os candidatos contam).
2. **Agrupamento que ajuda a enxergar.** Pra países: por continente
   (Américas juntas). Pra outras metas, perguntar à Karina qual agrupamento
   usar se não for óbvio.
3. **Unidade = @ + nome do cadastro**, sozinha no nome (ex.: "@Argentina").
   Na Projetos isto substitui a regra 1 do `detalhador.md` ("país nunca é o
   nome sozinho"): aqui o país É a tarefa, e o trabalho está nas subtarefas.
4. **Processo padrão idêntico** em todas as unidades (mesmos nomes, mesma
   ordem). Se o processo mudar, muda em todas.
5. **Status inicial vem da fonte de verdade** (ex.: CRM), marcando como
   Finalizado só o que o status já garante; o resto fica Não iniciado.
   Nunca inventar data de "Finalizado em" (fica vazio).
6. **Sempre propor antes de gravar** (árvore resumida: entrega, etapas com
   contagem, processo padrão, regra de status) e só gravar com "sim".
7. Entrega nova vai **no fim** da lista. Não mexer em outras entregas.
8. Toda criação vai pro Changelog (o que foi criado, ids, contagens).

## Critério × andamento (Karina, 09/10)

- Cada tópico do Critério de conclusão precisa de **pelo menos uma linha
  que o confirme** (etapa, tarefa ou subtarefa), ligada no pop-up ↗ ao lado
  do nome ("Confirmado por"). Cada tópico tem ainda uma marca
  ✓ atingido / ◐ parcial / ✗ não (campo `criterioCheck` da linha).
- Tópico sem linha que confirme = **falta detalhar** (a ↗ fica laranja).
  Ao criar ou revisar uma entrega, o agente **aponta esses tópicos e pede
  que a entrega seja preenchida** (propor as tarefas que faltam), antes de
  dar a entrega por organizada.
- O Carinha ainda não lê a Projetos; quando ler, faz o mesmo aviso (ver
  Prox Passos).

## Exemplo — 50 Federações Membros (09/10)

- Frente: Federações · Objetivo: Governança.
- Critério: • 50 federações membros • Estatutos e registros coletados e
  verificados • Página de cada federação no ar.
- Etapas: Europa (35), Ásia (15), Américas (14), África (7), Oceania (2) =
  73 países do CRM (quadro *Membros - Federações*, todos com status).
- Processo de cada país:
  1. Buscar e contatar candidato
  2. Apresentar a WPF
  3. Abrir a federação
  4. Coletar documentos (estatuto e registro)
  5. Verificar documentos
  6. Coletar informações pro site (links, fotos, board)
  7. Criar página no site
  8. Postar página no site
- Status inicial pelo CRM: Membro → 1–3 finalizados · Abertura → 1–2
  finalizados, 3 em andamento · Negociação → 1 finalizado, 2 em andamento ·
  Lead → 1 em andamento.
