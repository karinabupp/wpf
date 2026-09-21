// Ponte do WhatsApp da Dash — Agente de Gestão (modo conversacional).
//
//  GET  /webhook   → verificação da Meta
//  POST /webhook   → mensagem recebida: grava, responde 200 na hora e
//                    trata a conversa em segundo plano (ctx.waitUntil)
//  POST /enviar    → envia mensagem avulsa, exige o token no header
//
// Como a conversa funciona:
//  1. Identifica a pessoa pelo telefone (wpf_agente_pessoas).
//  2. Lê as tarefas de TODAS as empresas (toda seção tasks2 / tasks2__xxx).
//  3. Se havia mudança esperando confirmação e a pessoa disse "sim" ou
//     "não", resolve isso em código, sem passar pelo Claude.
//  4. Senão, manda pro Claude o quadro resumido + a conversa recente. O
//     Claude só CONVERSA e PROPÕE (ferramentas propor_mudanca /
//     propor_criacao). Quem valida, monta o resumo da confirmação e, depois
//     do "sim", grava na Dash é este código.
//  5. Nunca apaga linha. Pessoa comum só mexe no que é dela; admin em tudo.
//  6. Se a API do Claude falhar, responde com um resumo simples do quadro.
//
// Segredos no Cloudflare: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
// WHATSAPP_VERIFY_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY.

const TAB_MSG = "wpf_whatsapp_messages";
const TAB_PESSOAS = "wpf_agente_pessoas";
const TAB_PEND = "wpf_agente_pendencias";
const TAB_AUDIT = "wpf_agente_auditoria";
const TAB_DASH = "wpf_dashboard_data";

const MODELO = "claude-sonnet-5";
const HISTORICO_MSGS = 12;        // mensagens anteriores mandadas ao Claude
const LIMITE_POR_HORA = 40;       // mensagens recebidas por número por hora
const TENTATIVAS_GRAVAR = 3;

const STATUS_MANUAIS = ["Not Started", "In Progress", "Done", "On Hold", "Cancelled"];
const TIPOS = ["objetivo", "meta", "projeto", "entregavel", "tarefa"];
const TIPO_LABEL = { objetivo: "Objetivo", meta: "Meta", projeto: "Projeto", entregavel: "Entregável", tarefa: "Tarefa" };
const TIPO_RANK = { objetivo: 0, meta: 1, projeto: 2, entregavel: 3, tarefa: 4 };

// ─── Utilidades ──────────────────────────────────────────────────────────
function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function diaSemanaSP() {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(new Date());
}
function somaDias(iso, n) {
  return new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
}
function br(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}${a !== hojeSP().slice(0, 4) ? "/" + a : ""}`;
}
function dataValida(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}
function normalizar(txt) {
  return String(txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function corta(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const SIM = new Set(["sim", "s", "ss", "sim sim", "confirmo", "confirma", "confirmado", "pode", "pode sim", "sim pode",
  "pode fazer", "pode ir", "ok", "okay", "isso", "isso mesmo", "certo", "correto", "manda", "bora", "yes", "y", "fechado", "beleza", "blz"]);
const NAO = new Set(["nao", "n", "nao pode", "cancela", "cancelar", "cancelado", "deixa", "deixa pra la", "esquece", "no", "negativo", "para"]);
function ehSim(txt) {
  const t = normalizar(txt);
  if (!t) return /^[\s👍✅👌🙏]+$/u.test(String(txt || "")) && String(txt).trim() !== "";
  return SIM.has(t);
}
function ehNao(txt) {
  const t = normalizar(txt);
  if (!t) return /^[\s👎❌]+$/u.test(String(txt || "")) && String(txt).trim() !== "";
  return NAO.has(t);
}

// ─── Supabase ────────────────────────────────────────────────────────────
async function sb(env, caminho, opcoes = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${caminho}`, {
    method: opcoes.method || "GET",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opcoes.prefer ? { "Prefer": opcoes.prefer } : {})
    },
    body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined
  });
  const texto = await res.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { dados = texto; }
  if (!res.ok) console.log("supabase erro", res.status, caminho.split("?")[0], String(texto).slice(0, 300));
  return { ok: res.ok, status: res.status, dados };
}

// Grava a mensagem. Devolve true só se for NOVA (a Meta às vezes reenvia).
async function gravarMensagem(env, linha) {
  const r = await sb(env, TAB_MSG, {
    method: "POST", body: [linha],
    prefer: "resolution=ignore-duplicates,return=representation"
  });
  return r.ok && Array.isArray(r.dados) && r.dados.length > 0;
}

async function enviarTexto(env, para, texto) {
  texto = corta(texto, 4000);
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { preview_url: false, body: texto } })
  });
  const corpo = await res.json().catch(() => null);
  if (!res.ok) console.log("erro ao enviar:", res.status, JSON.stringify(corpo));
  const id = corpo && corpo.messages && corpo.messages[0] && corpo.messages[0].id;
  if (res.ok) {
    await gravarMensagem(env, {
      wa_message_id: id || null, direction: "out", from_number: env.WHATSAPP_PHONE_ID, to_number: para,
      msg_type: "text", body: texto, sent_at: new Date().toISOString(), raw: corpo
    });
  }
  return { ok: res.ok, id, corpo };
}

// ─── Dados da Dash ───────────────────────────────────────────────────────
function nomeEmpresa(secao) {
  const suf = (secao.match(/^tasks2__(.+)$/) || [])[1];
  if (!suf) return "WPF";
  return suf.toUpperCase();
}

// Lê a Dash inteira de uma vez. Ficam de fora só:
//  - os históricos de versões (historicoGeral, tasks2Historico*): são cópias
//    de segurança de dados que já vêm aqui, e passam de 6 MB;
//  - "tasks", a aba Tasks antiga (aguardando decisão da Karina, ver
//    Prox Passos).
const SECOES_FORA = new Set(["tasks"]);
async function carregarDash(env) {
  const r = await sb(env, `${TAB_DASH}?select=section,data,updated_at&section=not.ilike.*historico*`);
  if (!r.ok || !Array.isArray(r.dados)) throw new Error("não consegui ler a Dash");
  const linhas = r.dados.filter(l => !SECOES_FORA.has(l.section));
  const empresas = linhas
    .filter(l => /^tasks2(__[a-z0-9_]+)?$/i.test(l.section) && Array.isArray(l.data))
    .sort((a, b) => (a.section === "tasks2" ? -1 : b.section === "tasks2" ? 1 : a.section.localeCompare(b.section)))
    .map(l => ({ secao: l.section, nome: nomeEmpresa(l.section), dados: l.data, updated_at: l.updated_at }));
  const outras = linhas
    .filter(l => !/^tasks2(__[a-z0-9_]+)?$/i.test(l.section))
    .sort((a, b) => a.section.localeCompare(b.section));
  return { empresas, outras };
}

// Senha e login nunca vão pro Claude.
const CHAVES_SECRETAS = new Set(["password", "senha", "login", "mustchangepassword", "token"]);
function semSegredos(v) {
  if (Array.isArray(v)) return v.map(semSegredos);
  if (v && typeof v === "object") {
    const o = {};
    Object.keys(v).forEach(k => { if (!CHAVES_SECRETAS.has(k.toLowerCase())) o[k] = semSegredos(v[k]); });
    return o;
  }
  return v;
}
const LIMITE_POR_ABA = 25000;
function montarOutrasAbas(outras) {
  const vazio = v => v === null || v === undefined || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
  const blocos = outras.filter(l => !vazio(l.data)).map(l => {
    const j = JSON.stringify(semSegredos(l.data));
    return `### ${l.section} (atualizada ${String(l.updated_at).slice(0, 10)})\n${j.length > LIMITE_POR_ABA ? j.slice(0, LIMITE_POR_ABA) + " …(cortado)" : j}`;
  });
  return blocos.length ? "\n\nOutras abas da Dash (só leitura, dados crus em JSON; use pra responder perguntas, nunca pra propor mudanças):\n" + blocos.join("\n") : "";
}

// Dá um apelido curto a cada linha (WPF-12, CBTH-340) pra o Claude citar,
// e guarda caminho/pai de cada uma.
function indexar(empresas) {
  const porApelido = {}, porId = {};
  empresas.forEach(emp => {
    let n = 0;
    (function andar(lista, pai, caminho, prof) {
      lista.forEach(no => {
        n++;
        const apelido = `${emp.nome}-${n}`;
        const info = { apelido, empresa: emp, no, pai, caminho, prof };
        porApelido[apelido.toUpperCase()] = info;
        porId[emp.secao + "|" + no.id] = info;
        andar(no.subtasks || [], no, caminho.concat(no.name || "(sem nome)"), prof + 1);
      });
    })(emp.dados, null, [], 0);
  });
  return { porApelido, porId };
}

const temFilhos = no => Array.isArray(no.subtasks) && no.subtasks.length > 0;
const doResponsavel = (no, nome) => Array.isArray(no.assignees) && no.assignees.includes(nome);
// Em Objetivo/Projeto/Entregável com linhas dentro, o Responsável é
// calculado pela Dash (todo mundo que está abaixo). Aí estar na lista não
// faz a linha ser "dela": só Meta (escolhida à mão) e linhas sem nada
// dentro contam como posse.
const ehDono = (no, nome) => doResponsavel(no, nome) && (no.rowType === "meta" || !temFilhos(no));
function algumAbaixo(no, teste) {
  return (no.subtasks || []).some(f => teste(f) || algumAbaixo(f, teste));
}

// Quadro em texto pro Claude. Esconde o que está Done/Cancelled.
// Pessoa comum vê só as linhas dela, com o caminho acima como contexto.
function montarQuadro(empresas, indice, pessoa) {
  const linhas = [];
  empresas.forEach(emp => {
    let ocultas = 0;
    const saida = [];
    (function andar(lista, prof, dentroDaPessoa) {
      lista.forEach(no => {
        const fechado = no.status === "Done" || no.status === "Cancelled";
        const minha = ehDono(no, pessoa.nome_tasks);
        const visivel = pessoa.admin || dentroDaPessoa || minha || algumAbaixo(no, f => doResponsavel(f, pessoa.nome_tasks));
        if (!visivel) return;
        if (fechado) { ocultas++; return; }
        const info = indice.porId[emp.secao + "|" + no.id];
        const datas = no.startDate && no.endDate ? `${br(no.startDate)}→${br(no.endDate)}` : no.endDate ? `até ${br(no.endDate)}` : "sem data";
        const resp = (no.assignees || []).length ? no.assignees.join(", ") : "sem responsável";
        saida.push(`${"  ".repeat(prof)}${info.apelido} ${TIPO_LABEL[no.rowType] || no.rowType}: ${corta(no.name, 90)} | ${no.status} | ${datas} | ${resp}${temFilhos(no) ? " [agrupa]" : ""}`);
        andar(no.subtasks || [], prof + 1, dentroDaPessoa || minha);
      });
    })(emp.dados, 0, false);
    linhas.push(`### ${emp.nome}${saida.length ? "" : " (nada em aberto)"}`);
    linhas.push(...saida);
    if (ocultas) linhas.push(`(${ocultas} linhas concluídas ou canceladas ocultas)`);
  });
  return linhas.join("\n");
}

function caminhoTexto(info) {
  return [info.empresa.nome].concat(info.caminho.map(c => corta(c, 40)), [corta(info.no.name, 60)]).join(" › ");
}

// Grava UMA seção só se ninguém gravou depois da leitura (updated_at igual).
async function gravarSecao(env, secao, dados, updatedAtLido) {
  const r = await sb(env, `${TAB_DASH}?section=eq.${encodeURIComponent(secao)}&updated_at=eq.${encodeURIComponent(updatedAtLido)}`, {
    method: "PATCH", body: { data: dados, updated_at: new Date().toISOString() }, prefer: "return=representation"
  });
  return r.ok && Array.isArray(r.dados) && r.dados.length === 1;
}

// ─── Propostas: validação e resumo (tudo em código) ──────────────────────
function validarMudanca(entrada, indice, pessoa, hoje) {
  const info = indice.porApelido[String(entrada.linha || "").toUpperCase()];
  if (!info) return { erro: `Linha ${entrada.linha} não existe no quadro.` };
  const no = info.no;
  if (!pessoa.admin && !ehDono(no, pessoa.nome_tasks)) return { erro: `${pessoa.nome_tasks} não é responsável por essa linha; só pode mudar as próprias.` };
  const mud = {}, itens = [];
  if (entrada.nome !== undefined) {
    const nome = String(entrada.nome).trim();
    if (!nome) return { erro: "O nome novo está vazio." };
    if (nome !== no.name) { mud.name = nome; itens.push(`Nome: ${corta(no.name, 50)} → ${nome}`); }
  }
  const mexeDatasOuStatus = entrada.status !== undefined || entrada.inicio !== undefined || entrada.fim !== undefined;
  if (mexeDatasOuStatus && temFilhos(no)) return { erro: "Essa linha agrupa outras: status e datas dela são calculados pela Dash a partir das linhas de baixo. Mude as de baixo." };
  if (entrada.status !== undefined) {
    if (!STATUS_MANUAIS.includes(entrada.status)) return { erro: `Status "${entrada.status}" não pode ser escolhido (Late e Deadline são automáticos pelas datas).` };
    if (entrada.status !== no.status) { mud.status = entrada.status; itens.push(`Status: ${no.status} → ${entrada.status}`); }
  }
  for (const [campo, chave, rotulo] of [["inicio", "startDate", "Início"], ["fim", "endDate", "Fim"]]) {
    if (entrada[campo] === undefined) continue;
    const v = entrada[campo] === null ? "" : String(entrada[campo]);
    if (v && !dataValida(v)) return { erro: `${rotulo} "${v}" não é uma data válida (use AAAA-MM-DD).` };
    if (v !== (no[chave] || "")) { mud[chave] = v; itens.push(`${rotulo}: ${br(no[chave])} → ${v ? br(v) : "sem data"}`); }
  }
  const ini = mud.startDate !== undefined ? mud.startDate : no.startDate;
  const fim = mud.endDate !== undefined ? mud.endDate : no.endDate;
  if (ini && fim && ini > fim) return { erro: `O início (${br(ini)}) ficaria depois do fim (${br(fim)}).` };
  // Linha atrasada com o fim empurrado pra frente: a Dash não tira o Late
  // sozinha, então volta pra In Progress (aparece no resumo pra pessoa ver).
  if (mud.status === undefined && no.status === "Late" && mud.endDate && mud.endDate >= hoje) {
    mud.status = "In Progress"; itens.push(`Status: Late → In Progress`);
  }
  if (!itens.length) return { erro: "Nada mudaria: os valores pedidos já são os atuais." };
  return {
    acao: { tipo: "mudanca", secao: info.empresa.secao, id: no.id, mudancas: mud },
    resumo: `*${caminhoTexto(info)}*\n` + itens.map(i => "• " + i).join("\n")
  };
}

function validarCriacao(entrada, indice, pessoa, nomesConhecidos) {
  const info = indice.porApelido[String(entrada.pai || "").toUpperCase()];
  if (!info) return { erro: `Linha ${entrada.pai} (onde colocar) não existe no quadro.` };
  const pai = info.no;
  const tipo = entrada.tipo;
  if (!TIPOS.includes(tipo) || tipo === "objetivo") return { erro: `Tipo "${tipo}" não pode ser criado por aqui.` };
  const rp = TIPO_RANK[pai.rowType], rf = TIPO_RANK[tipo];
  if (rp === undefined || rf < rp || (rf === rp && !["projeto", "entregavel", "tarefa"].includes(tipo)))
    return { erro: `Não dá pra colocar ${TIPO_LABEL[tipo]} dentro de ${TIPO_LABEL[pai.rowType] || pai.rowType}.` };
  if (!pessoa.admin && !doResponsavel(pai, pessoa.nome_tasks)) return { erro: `${pessoa.nome_tasks} só pode criar dentro de linhas em que é responsável.` };
  const nome = String(entrada.nome || "").trim();
  if (!nome) return { erro: "Falta o nome da linha nova." };
  const ini = entrada.inicio ? String(entrada.inicio) : "", fim = entrada.fim ? String(entrada.fim) : "";
  if (ini && !dataValida(ini)) return { erro: `Início "${ini}" inválido (use AAAA-MM-DD).` };
  if (fim && !dataValida(fim)) return { erro: `Fim "${fim}" inválido (use AAAA-MM-DD).` };
  if (ini && fim && ini > fim) return { erro: "O início ficaria depois do fim." };
  const resp = Array.isArray(entrada.responsaveis) && entrada.responsaveis.length ? entrada.responsaveis.map(String) : [pessoa.nome_tasks];
  const desconhecido = resp.find(n => !nomesConhecidos.has(n));
  if (desconhecido) return { erro: `Não conheço "${desconhecido}". Nomes válidos: ${[...nomesConhecidos].join(", ")}.` };
  if (!pessoa.admin && resp.some(n => n !== pessoa.nome_tasks)) return { erro: "Só a Karina pode criar linha com outra pessoa como responsável." };
  return {
    acao: { tipo: "criacao", secao: info.empresa.secao, paiId: pai.id, linha: { nome, tipo, startDate: ini, endDate: fim, assignees: resp } },
    resumo: `Criar ${TIPO_LABEL[tipo]} *${nome}* em:\n*${caminhoTexto(info)}*\n` +
      [ini || fim ? `• Datas: ${ini ? br(ini) : "—"} → ${fim ? br(fim) : "—"}` : "• Sem data", `• Responsável: ${resp.join(", ")}`].join("\n")
  };
}

// Aplica a ação num retrato fresco da seção. Devolve {antes, depois} ou erro.
function aplicarAcao(dados, acao, pessoa) {
  const achar = (lista, id) => { for (const t of lista) { if (t.id === id) return t; const f = achar(t.subtasks || [], id); if (f) return f; } return null; };
  if (acao.tipo === "mudanca") {
    const no = achar(dados, acao.id);
    if (!no) return { erro: "a linha não existe mais na Dash" };
    if (!pessoa.admin && !ehDono(no, pessoa.nome_tasks)) return { erro: "você não é mais responsável por essa linha" };
    const m = acao.mudancas;
    if ((m.status !== undefined || m.startDate !== undefined || m.endDate !== undefined) && temFilhos(no)) return { erro: "a linha passou a agrupar outras" };
    const antes = {}; Object.keys(m).forEach(k => { antes[k] = no[k] === undefined ? null : no[k]; });
    Object.assign(no, m);
    if (m.status !== undefined) delete no.statusAntesDeadline;
    return { linhaId: no.id, antes, depois: m };
  }
  if (acao.tipo === "criacao") {
    const pai = achar(dados, acao.paiId);
    if (!pai) return { erro: "a linha onde ia entrar não existe mais" };
    const l = acao.linha;
    const nova = {
      id: "task-" + Date.now(), name: l.nome, status: "Not Started", startDate: l.startDate || "", endDate: l.endDate || "",
      assignees: l.assignees, kpiLink: "", areaLink: "", objetivoLink: "", paisLink: "", mentions: [], pontuacoes: [],
      rowType: l.tipo, subtasks: []
    };
    if (!Array.isArray(pai.subtasks)) pai.subtasks = [];
    pai.subtasks.push(nova);
    return { linhaId: nova.id, antes: null, depois: nova };
  }
  return { erro: "ação desconhecida" };
}

async function executarPendencia(env, pend, pessoa, tel) {
  for (let i = 0; i < TENTATIVAS_GRAVAR; i++) {
    const r = await sb(env, `${TAB_DASH}?select=data,updated_at&section=eq.${encodeURIComponent(pend.acao.secao)}`);
    const linha = r.ok && r.dados && r.dados[0];
    if (!linha) return { erro: "não consegui ler a Dash" };
    const dados = linha.data;
    const res = aplicarAcao(dados, pend.acao, pessoa);
    if (res.erro) return res;
    if (await gravarSecao(env, pend.acao.secao, dados, linha.updated_at)) {
      await sb(env, TAB_AUDIT, { method: "POST", prefer: "return=minimal", body: [{
        telefone: tel, pessoa: pessoa.nome_tasks, secao: pend.acao.secao, linha_id: res.linhaId,
        acao: pend.acao.tipo, antes: res.antes, depois: res.depois, pendencia_id: pend.id
      }] });
      return { ok: true };
    }
    // Alguém gravou a mesma seção no meio do caminho: lê de novo e repete.
  }
  return { erro: "a Dash estava sendo editada ao mesmo tempo; tente de novo em instantes" };
}

async function marcarPendencia(env, id, status) {
  await sb(env, `${TAB_PEND}?id=eq.${id}`, { method: "PATCH", prefer: "return=minimal", body: { status, resolvido_em: new Date().toISOString() } });
}

// ─── Claude ──────────────────────────────────────────────────────────────
const FERRAMENTAS = [
  {
    name: "propor_mudanca",
    description: "Propõe mudar UMA linha existente do quadro. Não grava nada: o sistema mostra o resumo e pede confirmação à pessoa. Informe só os campos que mudam.",
    input_schema: {
      type: "object",
      properties: {
        linha: { type: "string", description: "Apelido da linha, ex. WPF-12 ou CBTH-340" },
        status: { type: "string", enum: STATUS_MANUAIS },
        inicio: { type: "string", description: "AAAA-MM-DD, ou \"\" pra tirar a data" },
        fim: { type: "string", description: "AAAA-MM-DD, ou \"\" pra tirar a data" },
        nome: { type: "string" }
      },
      required: ["linha"]
    }
  },
  {
    name: "propor_criacao",
    description: "Propõe criar UMA linha nova dentro de uma linha existente. Não grava nada: o sistema pede confirmação.",
    input_schema: {
      type: "object",
      properties: {
        pai: { type: "string", description: "Apelido da linha onde a nova entra" },
        tipo: { type: "string", enum: ["meta", "projeto", "entregavel", "tarefa"] },
        nome: { type: "string" },
        inicio: { type: "string", description: "AAAA-MM-DD (opcional)" },
        fim: { type: "string", description: "AAAA-MM-DD (opcional)" },
        responsaveis: { type: "array", items: { type: "string" }, description: "Nomes exatamente como na Dash. Se omitir, fica quem está falando." }
      },
      required: ["pai", "tipo", "nome"]
    }
  }
];

function promptSistema(pessoa, hoje, pendAnterior, nomesConhecidos) {
  return `Você é o Agente de Gestão da Dash (o quadro de tarefas da WPF e das outras empresas da Karina), falando pelo WhatsApp com ${pessoa.nome_tasks}${pessoa.admin ? " (admin: vê e pode mudar tudo)" : " (vê e muda só o que é dela/dele)"}.
Hoje é ${diaSemanaSP()}, ${hoje}.

Como conversar:
- Português do Brasil, jeito de WhatsApp: curto, direto, simpático. Normalmente até 6 linhas. Negrito só com *asteriscos*; nada de títulos ou tabelas.
- Fale no nível do entregável/projeto/objetivo, não despeje listas de tarefas. Ex.: "O Ladies Weekend tem 2 entregas vencendo sexta. O material de divulgação já começou?"
- Quando perguntarem como estão as coisas, destaque o que está Late ou Deadline (vence em até 3 dias) e o que vence nos próximos dias, e pergunte do andamento.
- Use só o que está no quadro abaixo. Nunca invente linha, data, status ou pessoa. Se não achar, diga que não achou.
- Diga a empresa quando houver mais de uma envolvida.

Mudanças na Dash:
- Pra mudar ou criar algo, chame propor_mudanca ou propor_criacao. Uma proposta por vez.
- Você NUNCA grava nada e NUNCA diz que já mudou. O sistema mostra o resumo e pergunta "Confirma?" sozinho, então junto da ferramenta escreva no máximo uma frase curta (ou nada), sem pedir confirmação.
- Status que dá pra escolher: Not Started, In Progress, Done, On Hold, Cancelled. Late e Deadline são automáticos pelas datas.
- Linhas marcadas [agrupa] têm status e datas calculados a partir das de baixo: não proponha mudar status/datas nelas.
- Não existe apagar. Se pedirem, diga que isso é só pela Dash.
- Pra criar, escolha o lugar certo na hierarquia (Objetivo › Meta › Projeto › Entregável › Tarefa). Se não houver lugar óbvio, pergunte onde colocar antes de propor. Meta nova só se a pessoa pedir ou concordar.
- Datas relativas ("sexta", "semana que vem") são a partir de hoje; na ferramenta use AAAA-MM-DD.
- Nomes de responsáveis válidos: ${[...nomesConhecidos].join(", ")}.
${pendAnterior ? `\nAtenção: havia esta mudança esperando confirmação, e a pessoa respondeu outra coisa, então ela foi descartada:\n${pendAnterior}\nSe a mensagem nova ajusta essa mudança, proponha de novo já ajustada.` : ""}

Quadro (linhas em aberto; cite pelo apelido só nas ferramentas, não na conversa):`;
}

async function chamarClaude(env, system, mensagens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, max_tokens: 1024, system, tools: FERRAMENTAS, messages: mensagens })
  });
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error("Claude " + res.status + " " + JSON.stringify(corpo).slice(0, 300));
  return corpo;
}

async function historico(env, tel, idAtual) {
  const r = await sb(env, `${TAB_MSG}?select=direction,body,wa_message_id&or=(from_number.eq.${tel},to_number.eq.${tel})&order=created_at.desc&limit=${HISTORICO_MSGS + 1}`);
  const linhas = (r.ok && Array.isArray(r.dados) ? r.dados : []).filter(l => l.wa_message_id !== idAtual).slice(0, HISTORICO_MSGS).reverse();
  const msgs = [];
  linhas.forEach(l => {
    const role = l.direction === "in" ? "user" : "assistant";
    const texto = l.body || "(sem texto)";
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += "\n" + texto;
    else msgs.push({ role, content: texto });
  });
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

// ─── Resposta de emergência (API do Claude fora) ─────────────────────────
function resumoSimples(empresas, pessoa, hoje) {
  const lim = somaDias(hoje, 7), itens = [];
  empresas.forEach(emp => (function andar(lista) {
    lista.forEach(no => {
      const folha = !temFilhos(no);
      const minha = pessoa.admin || doResponsavel(no, pessoa.nome_tasks);
      if (folha && minha && !["Done", "Cancelled"].includes(no.status) && no.endDate && no.endDate <= lim)
        itens.push(`• ${no.endDate < hoje ? "⚠️ " : ""}${corta(no.name, 60)} (${emp.nome}, ${br(no.endDate)})`);
      andar(no.subtasks || []);
    });
  })(emp.dados));
  const topo = "Estou com um problema pra conversar agora 😕 Tente de novo daqui a pouco.";
  if (!itens.length) return topo + "\nPelo quadro, nada seu vence nos próximos 7 dias.";
  return topo + "\nEnquanto isso, o que vence até " + br(lim) + ":\n" + itens.slice(0, 10).join("\n") + (itens.length > 10 ? `\n…e mais ${itens.length - 10}.` : "");
}

// ─── Tratamento de uma mensagem ──────────────────────────────────────────
async function tratarMensagem(env, msg, texto) {
  const tel = msg.from;
  const rp = await sb(env, `${TAB_PESSOAS}?select=*&telefone=eq.${tel}`);
  const pessoa = rp.ok && rp.dados && rp.dados[0];
  if (!pessoa) {
    await enviarTexto(env, tel, "Oi! Este número ainda não está cadastrado no Agente de Gestão. Fale com a Karina pra liberar.");
    return;
  }

  // Limite por hora (protege a conta da API).
  const umaHora = new Date(Date.now() - 3600000).toISOString();
  const rc = await sb(env, `${TAB_MSG}?select=id&direction=eq.in&from_number=eq.${tel}&created_at=gte.${encodeURIComponent(umaHora)}`);
  const qtd = rc.ok && Array.isArray(rc.dados) ? rc.dados.length : 0;
  if (qtd > LIMITE_POR_HORA) {
    if (qtd === LIMITE_POR_HORA + 1) await enviarTexto(env, tel, "Recebi muitas mensagens na última hora. Dou uma pausa e volto a responder daqui a pouco.");
    return;
  }

  if (!texto) { await enviarTexto(env, tel, "Por enquanto eu só entendo mensagens de texto 🙂"); return; }

  const cmd = normalizar(texto);
  if (cmd === "sair" || cmd === "voltar") {
    await sb(env, `${TAB_PESSOAS}?telefone=eq.${tel}`, { method: "PATCH", prefer: "return=minimal", body: { recebe_avisos: cmd === "voltar" } });
    await enviarTexto(env, tel, cmd === "sair"
      ? "Pronto, parei de mandar avisos. Você ainda pode me escrever quando quiser. Pra voltar, mande VOLTAR."
      : "Pronto, voltei a mandar avisos. Pra parar, mande SAIR.");
    return;
  }

  // Mudança esperando o "sim"?
  const agora = new Date().toISOString();
  const rpd = await sb(env, `${TAB_PEND}?select=*&telefone=eq.${tel}&status=eq.aguardando&order=criado_em.desc&limit=1`);
  let pend = rpd.ok && rpd.dados && rpd.dados[0];
  if (pend && Date.parse(pend.expira_em) < Date.parse(agora)) { await marcarPendencia(env, pend.id, "expirada"); pend = null; }
  if (pend && ehSim(texto)) {
    const r = await executarPendencia(env, pend, pessoa, tel);
    await marcarPendencia(env, pend.id, r.ok ? "confirmada" : "falhou");
    await enviarTexto(env, tel, r.ok ? "Feito ✅ Já está na Dash (quem estiver com ela aberta vê em até 15s)." : `Não consegui gravar: ${r.erro}. Nada foi mudado.`);
    return;
  }
  if (pend && ehNao(texto)) {
    await marcarPendencia(env, pend.id, "cancelada");
    await enviarTexto(env, tel, "Ok, não mudei nada.");
    return;
  }
  let pendAnterior = null;
  if (pend) { await marcarPendencia(env, pend.id, "cancelada"); pendAnterior = pend.resumo; }

  const hoje = hojeSP();
  let empresas, outras;
  try { ({ empresas, outras } = await carregarDash(env)); }
  catch (e) { await enviarTexto(env, tel, "Não consegui ler a Dash agora. Tente de novo em instantes."); return; }
  const indice = indexar(empresas);
  const rn = await sb(env, `${TAB_PESSOAS}?select=nome_tasks`);
  const nomesConhecidos = new Set((rn.ok && rn.dados ? rn.dados : []).map(p => p.nome_tasks).filter(Boolean));
  Object.values(indice.porApelido).forEach(i => (i.no.assignees || []).forEach(n => nomesConhecidos.add(n)));

  const system = [
    { type: "text", text: promptSistema(pessoa, hoje, pendAnterior, nomesConhecidos) },
    { type: "text", text: montarQuadro(empresas, indice, pessoa) + (pessoa.admin ? montarOutrasAbas(outras) : ""), cache_control: { type: "ephemeral" } }
  ];
  const mensagens = await historico(env, tel, msg.id);
  if (mensagens.length && mensagens[mensagens.length - 1].role === "user") mensagens[mensagens.length - 1].content += "\n" + texto;
  else mensagens.push({ role: "user", content: texto });

  try {
    for (let rodada = 0; rodada < 2; rodada++) {
      const resp = await chamarClaude(env, system, mensagens);
      const textoClaude = (resp.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      const uso = (resp.content || []).find(b => b.type === "tool_use");
      if (!uso) { await enviarTexto(env, tel, textoClaude || "Não entendi. Pode repetir de outro jeito?"); return; }
      const v = uso.name === "propor_mudanca" ? validarMudanca(uso.input || {}, indice, pessoa, hoje)
              : uso.name === "propor_criacao" ? validarCriacao(uso.input || {}, indice, pessoa, nomesConhecidos)
              : { erro: "ferramenta desconhecida" };
      if (v.erro) {
        // Devolve o erro pro Claude explicar ou corrigir (uma vez só).
        mensagens.push({ role: "assistant", content: resp.content });
        mensagens.push({ role: "user", content: (resp.content || []).filter(b => b.type === "tool_use").map(b => ({
          type: "tool_result", tool_use_id: b.id, is_error: true, content: b.id === uso.id ? v.erro : "Uma proposta por vez."
        })) });
        continue;
      }
      await sb(env, TAB_PEND, { method: "POST", prefer: "return=minimal", body: [{ telefone: tel, acao: v.acao, resumo: v.resumo }] });
      await enviarTexto(env, tel, (textoClaude ? textoClaude + "\n\n" : "") + v.resumo + "\n\nConfirma? Responda *sim* ou *não*.");
      return;
    }
    await enviarTexto(env, tel, "Não consegui montar essa mudança. Pode me dizer de outro jeito?");
  } catch (e) {
    console.log("erro Claude:", e && e.message);
    await enviarTexto(env, tel, resumoSimples(empresas, pessoa, hoje));
  }
}

// ─── Entrada ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/webhook" && request.method === "GET") {
      const modo = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const desafio = url.searchParams.get("hub.challenge");
      if (modo === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) return new Response(desafio, { status: 200 });
      return new Response("forbidden", { status: 403 });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      let corpo = null;
      try { corpo = await request.json(); } catch (e) { corpo = null; }
      // Responde 200 sempre e rápido: se a Meta não receber 200, ela reenvia.
      try {
        const mudanca = corpo?.entry?.[0]?.changes?.[0]?.value;
        const msg = mudanca?.messages?.[0];
        if (msg) {
          const contato = mudanca?.contacts?.[0];
          const texto = msg.text?.body || msg.button?.text || msg.interactive?.list_reply?.title || msg.interactive?.button_reply?.title || "";
          const nova = await gravarMensagem(env, {
            wa_message_id: msg.id, direction: "in", from_number: msg.from,
            to_number: mudanca?.metadata?.display_phone_number || null, contact_name: contato?.profile?.name || null,
            msg_type: msg.type, body: texto, sent_at: new Date(Number(msg.timestamp) * 1000).toISOString(), raw: corpo
          });
          if (nova) {
            const trabalho = tratarMensagem(env, msg, texto).catch(e => console.log("erro ao tratar:", e && e.message));
            if (ctx && ctx.waitUntil) ctx.waitUntil(trabalho); else await trabalho;
          }
        }
      } catch (e) {
        console.log("erro no webhook:", e && e.message);
      }
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/enviar" && request.method === "POST") {
      if (request.headers.get("x-agente-token") !== env.WHATSAPP_VERIFY_TOKEN) return new Response("forbidden", { status: 403 });
      let dados = null;
      try { dados = await request.json(); } catch (e) { dados = null; }
      if (!dados || !dados.para || !dados.texto) {
        return new Response(JSON.stringify({ ok: false, erro: "informe para e texto" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const r = await enviarTexto(env, String(dados.para), String(dados.texto));
      return new Response(JSON.stringify({ ok: r.ok, id: r.id }), { status: r.ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
    }

    return new Response("wpf-whatsapp-bridge ok", { status: 200 });
  }
};

// Exportado só pros testes.
export const _teste = { semSegredos, montarOutrasAbas, ehSim, ehNao, normalizar, indexar, montarQuadro, validarMudanca, validarCriacao, aplicarAcao, nomeEmpresa, hojeSP };
