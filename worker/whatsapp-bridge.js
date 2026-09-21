// Ponte do WhatsApp da Dash — Agente de Gestão (modo conversacional econômico).
//
//  GET  /webhook   → verificação da Meta
//  POST /webhook   → mensagem recebida: grava, responde 200 na hora e
//                    trata a conversa em segundo plano (ctx.waitUntil)
//  POST /enviar    → envia mensagem avulsa, exige o token no header
//
// O que o agente olha: SÓ a aba Tasks (seções tasks2 / tasks2__xxx) e a
// Members 2 (members2 / members2__xxx), de todas as empresas.
//
// Como economiza (decidido pela Karina em 21/09):
//  - O Claude NÃO recebe a Dash inteira a cada mensagem. Recebe:
//      · as últimas modificações desde a mensagem anterior desta pessoa
//        (comparação com um retrato guardado em wpf_agente_snapshot);
//      · só as mudanças que pedem ação da pessoa (decidido em 22/09);
//        pra Karina, também coisas grandes dos outros que viraram Late ou
//        Deadline. Panorama/alertas só quando alguém pede (ferramenta
//        resumo_alertas);
//      · as últimas 6 mensagens da conversa.
//    O resto ele busca com ferramentas, só a parte que precisa.
//  - Haiku atende. Ele pode subir pro Sonnet (ferramenta chamar_sonnet)
//    em tarefa que precise; limite de SONNET_POR_DIA por pessoa.
//  - Leitura da Dash inteira (analise_geral) só no Sonnet, 1 por dia por
//    pessoa.
//  - Parte fixa (instruções + ferramentas) vai marcada pra cache.
//  - Respostas curtas a médias (max_tokens baixo).
//  - Cada resposta grava modelo e tokens gastos na tabela de mensagens.
//
// Mudanças: o Claude só PROPÕE; o código valida, mostra o resumo, espera o
// "sim" e grava. Nunca apaga. Pessoa comum só mexe no que é dela.

const TAB_MSG = "wpf_whatsapp_messages";
const TAB_PESSOAS = "wpf_agente_pessoas";
const TAB_PEND = "wpf_agente_pendencias";
const TAB_AUDIT = "wpf_agente_auditoria";
const TAB_SNAP = "wpf_agente_snapshot";
const TAB_DASH = "wpf_dashboard_data";

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-5";
const SONNET_POR_DIA = 10;
const ANALISE_POR_DIA = 1;
const HISTORICO_MSGS = 6;
const MAX_TOKENS = 500;
const MAX_RODADAS = 5;
const LIMITE_POR_HORA = 40;
const TENTATIVAS_GRAVAR = 3;
const MAX_LINHAS_MUDANCAS = 30;
const MAX_LINHAS_ALERTA = 25;
const MAX_RESULTADOS_BUSCA = 25;
const TIPOS_COM_CONTEXTO = { meta: true, projeto: true };
const TIPOS_GRANDES = { entregavel: true, projeto: true, meta: true };

const STATUS_MANUAIS = ["Not Started", "In Progress", "Done", "On Hold", "Cancelled"];
const TIPOS = ["objetivo", "meta", "projeto", "entregavel", "tarefa"];
const TIPO_LABEL = { objetivo: "Objetivo", meta: "Meta", projeto: "Projeto", entregavel: "Entregável", tarefa: "Tarefa" };
const TIPO_RANK = { objetivo: 0, meta: 1, projeto: 2, entregavel: 3, tarefa: 4 };
const TIPO_MEMBRO_OPCOES = ["Observador", "Afiliado"];
const RE_TASKS = /^tasks2(__[a-z0-9_]+)?$/i;
const RE_MEMBERS = /^members2(__[a-z0-9_]+)?$/i;

// ─── Utilidades ──────────────────────────────────────────────────────────
function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function diaSemanaSP() {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(new Date());
}
// Início do dia de hoje em São Paulo, em UTC (SP é UTC-3 o ano todo).
function inicioDoDiaSP() {
  return new Date(Date.parse(hojeSP() + "T03:00:00Z")).toISOString();
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
function nomeEmpresa(secao) {
  const suf = (String(secao).match(/__(.+)$/) || [])[1];
  return suf ? suf.toUpperCase() : "WPF";
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
  const r = await sb(env, TAB_MSG, { method: "POST", body: [linha], prefer: "resolution=ignore-duplicates,return=representation" });
  return r.ok && Array.isArray(r.dados) && r.dados.length > 0;
}

// consumo = { modelo, tokens_entrada, tokens_saida, tokens_cache, analise_geral }
async function enviarTexto(env, para, texto, consumo) {
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
      msg_type: "text", body: texto, sent_at: new Date().toISOString(), raw: corpo, ...(consumo || {})
    });
  }
  return { ok: res.ok, id, corpo };
}

// ─── Opções clicáveis ────────────────────────────────────────────────────
// Até 3 opções curtas (≤20 caracteres) viram botões; até 10 (≤24) viram
// lista ("Ver opções"). Se não couber (texto > 1024 ou opção longa), vai
// como texto com as opções numeradas, e a pessoa responde com o número.
// Tocar numa opção chega de volta como o texto dela.
const LIM_BOTAO = 20, LIM_LISTA = 24, LIM_CORPO_INTERATIVO = 1024;
function formatoOpcoes(texto, opcoes) {
  const ops = (opcoes || []).map(o => String(o).trim()).filter(Boolean).filter((o, i, a) => a.indexOf(o) === i).slice(0, 10);
  if (!ops.length) return { tipo: "texto", texto, opcoes: [] };
  if (texto.length <= LIM_CORPO_INTERATIVO && ops.length <= 3 && ops.every(o => o.length <= LIM_BOTAO)) return { tipo: "botoes", texto, opcoes: ops };
  if (texto.length <= LIM_CORPO_INTERATIVO && ops.every(o => o.length <= LIM_LISTA)) return { tipo: "lista", texto, opcoes: ops };
  return { tipo: "numerado", texto: texto + "\n\n" + ops.map((o, i) => `${i + 1}. ${o}`).join("\n") + "\n_(responda com o número)_", opcoes: ops };
}
function corpoInterativo(para, f) {
  const interactive = f.tipo === "botoes"
    ? { type: "button", body: { text: f.texto }, action: { buttons: f.opcoes.map((o, i) => ({ type: "reply", reply: { id: "op_" + (i + 1), title: o } })) } }
    : { type: "list", body: { text: f.texto }, action: { button: "Ver opções", sections: [{ title: "Opções", rows: f.opcoes.map((o, i) => ({ id: "op_" + (i + 1), title: o })) }] } };
  return { messaging_product: "whatsapp", to: para, type: "interactive", interactive };
}
async function enviarComOpcoes(env, para, texto, opcoes, consumo) {
  texto = corta(texto, 4000);
  const f = formatoOpcoes(texto, opcoes);
  if (f.tipo === "texto") return enviarTexto(env, para, texto, consumo);
  if (f.tipo === "numerado") return enviarTexto(env, para, f.texto, { ...(consumo || {}), opcoes: f.opcoes });
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpoInterativo(para, f))
  });
  const corpo = await res.json().catch(() => null);
  if (!res.ok) {
    // Se a Meta recusar o formato, não fica sem resposta: vai numerado.
    console.log("erro ao enviar interativo:", res.status, JSON.stringify(corpo));
    const numerado = texto + "\n\n" + f.opcoes.map((o, i) => `${i + 1}. ${o}`).join("\n") + "\n_(responda com o número)_";
    return enviarTexto(env, para, numerado, { ...(consumo || {}), opcoes: f.opcoes });
  }
  const id = corpo && corpo.messages && corpo.messages[0] && corpo.messages[0].id;
  await gravarMensagem(env, {
    wa_message_id: id || null, direction: "out", from_number: env.WHATSAPP_PHONE_ID, to_number: para,
    msg_type: "interactive", body: texto + `\n[opções: ${f.opcoes.join(" | ")}]`, sent_at: new Date().toISOString(), raw: corpo,
    ...(consumo || {}), opcoes: f.opcoes
  });
  return { ok: true, id, corpo };
}
// O Claude termina a resposta com [[opções: A | B | C]] quando faz pergunta.
function separarOpcoes(texto) {
  const m = String(texto || "").match(/\[\[\s*op[çc][õo]es\s*:\s*([^\]]*)\]\]\s*$/i);
  if (!m) return { texto: String(texto || "").trim(), opcoes: [] };
  return { texto: texto.slice(0, m.index).trim(), opcoes: m[1].split("|").map(o => o.trim()).filter(Boolean) };
}

// ─── Dados da Dash (só Tasks e Members 2) ────────────────────────────────
async function carregarDash(env) {
  const r = await sb(env, `${TAB_DASH}?select=section,data,updated_at&or=(section.like.tasks2*,section.like.members2*)`);
  if (!r.ok || !Array.isArray(r.dados)) throw new Error("não consegui ler a Dash");
  const ordem = (a, b) => (nomeEmpresa(a.secao) === "WPF" ? -1 : nomeEmpresa(b.secao) === "WPF" ? 1 : a.secao.localeCompare(b.secao));
  const empresas = r.dados.filter(l => RE_TASKS.test(l.section) && Array.isArray(l.data))
    .map(l => ({ secao: l.section, nome: nomeEmpresa(l.section), dados: l.data, updated_at: l.updated_at })).sort(ordem);
  const members = r.dados.filter(l => RE_MEMBERS.test(l.section) && l.data && typeof l.data === "object")
    .map(l => ({ secao: l.section, nome: nomeEmpresa(l.section), dados: l.data, updated_at: l.updated_at })).sort(ordem);
  return { empresas, members };
}

// Apelido estável por linha (sai do id, não da posição), ex. WPF-897435.
function indexar(empresas) {
  const porApelido = {}, porId = {};
  empresas.forEach(emp => {
    (function andar(lista, pai, caminho) {
      lista.forEach(no => {
        const base = `${emp.nome}-${String(no.id || "").replace(/^task-/, "").slice(-6) || "x"}`;
        let apelido = base, k = 2;
        while (porApelido[apelido.toUpperCase()]) apelido = base + "-" + (k++);
        const info = { apelido, empresa: emp, no, pai, caminho };
        porApelido[apelido.toUpperCase()] = info;
        porId[emp.secao + "|" + no.id] = info;
        andar(no.subtasks || [], no, caminho.concat(no.name || "(sem nome)"));
      });
    })(emp.dados, null, []);
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
// Pessoa comum enxerga as linhas dela, o que está dentro delas e o caminho acima.
function visivelPara(info, pessoa, indice) {
  if (pessoa.admin) return true;
  const nome = pessoa.nome_tasks;
  if (ehDono(info.no, nome) || algumAbaixo(info.no, f => ehDono(f, nome))) return true;
  let p = info.pai;
  while (p) {
    if (ehDono(p, nome)) return true;
    const ip = indice.porId[info.empresa.secao + "|" + p.id];
    p = ip && ip.pai;
  }
  return false;
}
// Contexto (texto livre de Meta e Projeto, escrito na Dash).
function contextoDe(no, limite) {
  if (!TIPOS_COM_CONTEXTO[no.rowType]) return "";
  const c = String(no.contexto || "").replace(/\s+/g, " ").trim();
  return c ? corta(c, limite) : "";
}
function linhaTexto(info, comCaminho, limiteContexto) {
  const no = info.no;
  const datas = no.startDate && no.endDate ? `${br(no.startDate)}→${br(no.endDate)}` : no.endDate ? `até ${br(no.endDate)}` : "sem data";
  const resp = (no.assignees || []).length ? no.assignees.join(", ") : "sem responsável";
  const caminho = comCaminho && info.caminho.length ? ` (em ${info.caminho.map(c => corta(c, 30)).join(" › ")})` : "";
  const ctx = limiteContexto ? contextoDe(no, limiteContexto) : "";
  return `${info.apelido} ${TIPO_LABEL[no.rowType] || no.rowType}: ${corta(no.name, 80)} | ${no.status} | ${datas} | ${resp}${temFilhos(no) ? " [agrupa]" : ""}${caminho}${ctx ? ` | contexto: ${ctx}` : ""}`;
}
function caminhoTexto(info) {
  return [info.empresa.nome].concat(info.caminho.map(c => corta(c, 40)), [corta(info.no.name, 60)]).join(" › ");
}

// ─── Retrato compacto (base das "últimas modificações") ──────────────────
function retratar(empresas, members) {
  const out = { tasks: {}, members: {} };
  empresas.forEach(emp => {
    const m = out.tasks[emp.secao] = {};
    (function andar(lista, paiId) {
      lista.forEach(no => {
        m[no.id] = { n: no.name || "", s: no.status || "", i: no.startDate || "", f: no.endDate || "", a: (no.assignees || []).join(", "), t: no.rowType || "", p: paiId };
        andar(no.subtasks || [], no.id);
      });
    })(emp.dados, null);
  });
  members.forEach(mb => {
    const m = out.members[mb.secao] = {};
    const spq = mb.dados.statusPorQuadro || {};
    Object.keys(spq).forEach(q => Object.keys(spq[q] || {}).forEach(pais => {
      const r = spq[q][pais] || {};
      m[q + "|" + pais] = [r.status || "", r.tipoMembro || "", r.partner || ""].join("¦");
    }));
    const pa = mb.dados.paises || {};
    Object.keys(pa).forEach(pais => Object.keys(pa[pais] || {}).forEach(col => {
      m["col|" + pais + "|" + col] = String(pa[pais][col] ?? "");
    }));
  });
  return out;
}

// Só o que pede ação direta de quem está falando: linha que é (ou passou
// a ser) dela e mudou, foi criada, virou Late/Deadline. Pra admin, além
// disso: Entregável/Projeto/Meta de qualquer pessoa que acabou de virar
// Late ou Deadline. Cada coisa aparece uma vez (a base anda a cada
// resposta). O resto (Members 2, mudanças alheias) é descartado aqui,
// antes de chegar ao Claude.
function mudancasDesde(antes, agora, pessoa, indice) {
  const linhas = [], nome = pessoa.nome_tasks;
  Object.keys(agora.tasks).forEach(secao => {
    const a = (antes.tasks || {})[secao];
    if (!a) return; // empresa nova: começa a contar a partir de agora
    const b = agora.tasks[secao];
    const emp = nomeEmpresa(secao);
    Object.keys(b).forEach(id => {
      const info = indice.porId[secao + "|" + id];
      if (!info) return;
      const x = a[id], y = b[id], no = info.no;
      const minha = ehDono(no, nome);
      const eraMinha = x && x.a.split(", ").includes(nome) && (y.t === "meta" || !temFilhos(no));
      const virouAlerta = x && x.s !== y.s && (y.s === "Late" || y.s === "Deadline");
      if (minha) {
        if (!x) { linhas.push(`+ ${emp} nova ${TIPO_LABEL[y.t] || y.t} pra você: ${linhaTexto(info, true)}`); return; }
        const dif = [];
        if (!eraMinha) dif.push("passou a ser sua");
        if (x.s !== y.s) dif.push(`status ${x.s}→${y.s}`);
        if (x.i !== y.i) dif.push(`início ${br(x.i)}→${br(y.i)}`);
        if (x.f !== y.f) dif.push(`fim ${br(x.f)}→${br(y.f)}`);
        if (x.n !== y.n) dif.push(`nome "${corta(x.n, 40)}"→"${corta(y.n, 40)}"`);
        if (dif.length) linhas.push(`~ ${emp} ${info.apelido} ${corta(y.n, 60)}: ${dif.join("; ")}`);
        return;
      }
      if (pessoa.admin && virouAlerta && TIPOS_GRANDES[y.t])
        linhas.push(`! ${emp} ${TIPO_LABEL[y.t]} de ${y.a || "ninguém"} virou ${y.s}: ${linhaTexto(info, true)}`);
    });
  });
  if (linhas.length > MAX_LINHAS_MUDANCAS) {
    const resto = linhas.length - MAX_LINHAS_MUDANCAS;
    return linhas.slice(0, MAX_LINHAS_MUDANCAS).join("\n") + `\n…e mais ${resto} (use buscar pra ver).`;
  }
  return linhas.join("\n");
}

// ─── Resumo de alertas (1ª mensagem do dia) ──────────────────────────────
function resumoAlertas(empresas, indice, pessoa, hoje) {
  const lim = somaDias(hoje, 7), itens = [];
  Object.values(indice.porId).forEach(info => {
    const no = info.no;
    if (temFilhos(no) || ["Done", "Cancelled"].includes(no.status) || !no.endDate) return;
    if (!(pessoa.admin || ehDono(no, pessoa.nome_tasks))) return;
    if (no.status === "Late" || no.status === "Deadline" || no.endDate <= lim) itens.push(info);
  });
  itens.sort((a, b) => (a.no.endDate < b.no.endDate ? -1 : 1));
  const late = itens.filter(i => i.no.status === "Late").length;
  const topo = `${late} atrasadas, ${itens.length - late} vencendo até ${br(lim)}.`;
  return topo + (itens.length ? "\n" + itens.slice(0, MAX_LINHAS_ALERTA).map(i => linhaTexto(i, true)).join("\n") : "")
    + (itens.length > MAX_LINHAS_ALERTA ? `\n…e mais ${itens.length - MAX_LINHAS_ALERTA} (use buscar).` : "");
}

// ─── Leitura completa (só Sonnet, 1 por dia) ─────────────────────────────
function quadroCompleto(empresas, members, indice, pessoa) {
  const linhas = [];
  empresas.forEach(emp => {
    let ocultas = 0;
    linhas.push(`### Tasks ${emp.nome}`);
    Object.values(indice.porId).filter(i => i.empresa === emp).forEach(info => {
      if (!visivelPara(info, pessoa, indice)) return;
      if (["Done", "Cancelled"].includes(info.no.status)) { ocultas++; return; }
      linhas.push("  ".repeat(info.caminho.length) + linhaTexto(info, false, 400));
    });
    if (ocultas) linhas.push(`(${ocultas} concluídas/canceladas ocultas)`);
  });
  if (pessoa.admin) members.forEach(mb => linhas.push(`### Members 2 ${mb.nome}`, resumoMembers(mb, null)));
  return linhas.join("\n");
}
function resumoMembers(mb, quadroId) {
  const out = [];
  (mb.dados.boards || []).forEach(b => {
    if (quadroId && b.id !== quadroId) return;
    const d = (mb.dados.statusPorQuadro || {})[b.id] || {};
    const porStatus = {};
    Object.keys(d).forEach(p => { const s = d[p].status || "sem status"; (porStatus[s] = porStatus[s] || []).push(p + (d[p].tipoMembro ? ` (${d[p].tipoMembro})` : "") + (d[p].partner ? ` [partner ${d[p].partner}]` : "")); });
    out.push(`Quadro ${b.id} "${b.nome}" (status: ${(b.status || []).join(", ")}${b.temTipoMembro ? "; Membro tem tipo Observador/Afiliado" : ""}):`);
    Object.keys(porStatus).forEach(s => out.push(`  ${s} (${porStatus[s].length}): ${porStatus[s].join(", ")}`));
  });
  const cols = (mb.dados.colunas || []).map(c => `${c.id} "${c.nome}" (${c.tipo}${c.opcoes ? ": " + c.opcoes.join("/") : ""})`);
  if (cols.length) out.push(`Colunas da planilha: ${cols.join("; ")}`);
  const pa = mb.dados.paises || {};
  const comDados = Object.keys(pa).filter(p => Object.values(pa[p] || {}).some(v => v !== "" && v != null));
  if (comDados.length) out.push(`Países com dados nas colunas: ${comDados.join(", ")} (use buscar_members com o país pra ver)`);
  return out.join("\n");
}

// ─── Busca (ferramentas) ─────────────────────────────────────────────────
function buscarTasks(entrada, indice, pessoa, hoje) {
  const alvo = entrada.apelido ? indice.porApelido[String(entrada.apelido).toUpperCase()] : null;
  if (entrada.apelido) {
    if (!alvo || !visivelPara(alvo, pessoa, indice)) return "Não achei essa linha.";
    const filhos = [];
    (function andar(no, prof) { (no.subtasks || []).forEach(f => { const i = indice.porId[alvo.empresa.secao + "|" + f.id]; if (filhos.length < 40) filhos.push("  ".repeat(prof) + linhaTexto(i, false)); andar(f, prof + 1); }); })(alvo.no, 1);
    // Contexto da própria linha e das Metas/Projetos acima dela.
    const ctxs = [];
    let p = alvo.pai, ip = alvo;
    while (p) {
      const c = contextoDe(p, 600);
      if (c) ctxs.push(`Contexto de ${TIPO_LABEL[p.rowType]} "${corta(p.name, 50)}": ${c}`);
      ip = indice.porId[alvo.empresa.secao + "|" + p.id]; p = ip && ip.pai;
    }
    const proprio = contextoDe(alvo.no, 1500);
    return [linhaTexto(alvo, true)].concat(proprio ? [`Contexto desta linha: ${proprio}`] : [], ctxs.reverse(), filhos).join("\n") + (filhos.length >= 40 ? "\n…(cortado)" : "");
  }
  const termo = normalizar(entrada.texto || "");
  const palavras = termo ? termo.split(" ") : [];
  const res = Object.values(indice.porId).filter(info => {
    const no = info.no;
    if (!visivelPara(info, pessoa, indice)) return false;
    if (entrada.empresa && info.empresa.nome !== String(entrada.empresa).toUpperCase()) return false;
    if (entrada.status && no.status !== entrada.status) return false;
    if (!entrada.status && !entrada.incluir_concluidas && ["Done", "Cancelled"].includes(no.status)) return false;
    if (entrada.responsavel && !normalizar((no.assignees || []).join(" ")).includes(normalizar(entrada.responsavel))) return false;
    if (entrada.vence_ate && !(no.endDate && no.endDate <= entrada.vence_ate)) return false;
    if (palavras.length) {
      const alvoTxt = normalizar(no.name + " " + info.caminho.join(" "));
      if (!palavras.every(p => alvoTxt.includes(p))) return false;
    }
    return true;
  });
  if (!res.length) return "Nada encontrado com esses filtros.";
  return res.slice(0, MAX_RESULTADOS_BUSCA).map(i => linhaTexto(i, true, 200)).join("\n") + (res.length > MAX_RESULTADOS_BUSCA ? `\n…e mais ${res.length - MAX_RESULTADOS_BUSCA}; refine a busca.` : "");
}
function buscarMembers(entrada, members, pessoa) {
  if (!pessoa.admin) return "Members 2 é só pra admin.";
  const lista = members.filter(mb => !entrada.empresa || mb.nome === String(entrada.empresa).toUpperCase());
  if (!lista.length) return "Não achei Members 2 dessa empresa.";
  if (entrada.pais) {
    const alvo = normalizar(entrada.pais), out = [];
    lista.forEach(mb => {
      Object.keys(mb.dados.statusPorQuadro || {}).forEach(q => Object.keys(mb.dados.statusPorQuadro[q] || {}).forEach(p => {
        if (normalizar(p).includes(alvo)) { const r = mb.dados.statusPorQuadro[q][p]; out.push(`${mb.nome} quadro ${q}: ${p} = ${r.status || "sem status"}${r.tipoMembro ? " (" + r.tipoMembro + ")" : ""}${r.partner ? " partner " + r.partner : ""}`); }
      }));
      Object.keys(mb.dados.paises || {}).forEach(p => { if (normalizar(p).includes(alvo)) out.push(`${mb.nome} colunas de ${p}: ${JSON.stringify(mb.dados.paises[p])}`); });
    });
    return out.length ? out.slice(0, 40).join("\n") : "Esse país não aparece em nenhum quadro (confira o nome em inglês, como está no mapa).";
  }
  return lista.map(mb => `### ${mb.nome}\n` + resumoMembers(mb, entrada.quadro || null)).join("\n");
}

// ─── Propostas: validação e resumo (tudo em código) ──────────────────────
function validarMudanca(entrada, indice, pessoa, hoje) {
  const info = indice.porApelido[String(entrada.linha || "").toUpperCase()];
  if (!info) return { erro: `Linha ${entrada.linha} não existe. Use buscar pra achar o apelido certo.` };
  const no = info.no;
  if (!pessoa.admin && !ehDono(no, pessoa.nome_tasks)) return { erro: `${pessoa.nome_tasks} não é responsável por essa linha; só pode mudar as próprias.` };
  const mud = {}, itens = [];
  if (entrada.nome !== undefined) {
    const nome = String(entrada.nome).trim();
    if (!nome) return { erro: "O nome novo está vazio." };
    if (nome !== no.name) { mud.name = nome; itens.push(`Nome: ${corta(no.name, 50)} → ${nome}`); }
  }
  const mexe = entrada.status !== undefined || entrada.inicio !== undefined || entrada.fim !== undefined;
  if (mexe && temFilhos(no)) return { erro: "Essa linha agrupa outras: status e datas dela são calculados pela Dash. Mude as de baixo." };
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
  // Atrasada com o fim empurrado pra frente: a Dash não tira o Late sozinha.
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
  if (!info) return { erro: `Linha ${entrada.pai} (onde colocar) não existe. Use buscar.` };
  const pai = info.no, tipo = entrada.tipo;
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

// Contexto de Meta/Projeto: acrescentar (padrão) ou substituir o texto.
function validarContexto(entrada, indice, pessoa) {
  const info = indice.porApelido[String(entrada.linha || "").toUpperCase()];
  if (!info) return { erro: `Linha ${entrada.linha} não existe. Use buscar.` };
  const no = info.no;
  if (!TIPOS_COM_CONTEXTO[no.rowType]) return { erro: "Só Meta e Projeto têm contexto." };
  if (!pessoa.admin && !doResponsavel(no, pessoa.nome_tasks)) return { erro: `${pessoa.nome_tasks} só pode escrever no contexto de Metas/Projetos em que está.` };
  const texto = String(entrada.texto || "").trim();
  if (!texto) return { erro: "Falta o texto do contexto." };
  const modo = entrada.modo === "substituir" ? "substituir" : "acrescentar";
  const atual = String(no.contexto || "");
  const novo = modo === "substituir" || !atual.trim() ? texto : atual.replace(/\s+$/, "") + "\n" + texto;
  if (novo === atual) return { erro: "Nada mudaria." };
  return {
    acao: { tipo: "contexto", secao: info.empresa.secao, id: no.id, texto: novo },
    resumo: `*${caminhoTexto(info)}*\n• Contexto (${modo === "substituir" && atual.trim() ? "substituir o texto atual" : "acrescentar"}): ${corta(texto, 500)}`
  };
}

// Members 2: status de um país num quadro, tipo de membro, partner, ou o
// valor de uma coluna da planilha. Só admin.
function paisesConhecidos(mb) {
  const s = new Set();
  Object.values(mb.dados.statusPorQuadro || {}).forEach(d => Object.keys(d || {}).forEach(p => s.add(p)));
  Object.keys(mb.dados.paises || {}).forEach(p => s.add(p));
  return s;
}
function validarMembers(entrada, members, pessoa, todosPaises) {
  if (!pessoa.admin) return { erro: "Só a Karina pode mudar o Members 2." };
  const mb = members.find(m => m.nome === String(entrada.empresa || "WPF").toUpperCase());
  if (!mb) return { erro: `Não achei o Members 2 da empresa ${entrada.empresa}.` };
  const pais = String(entrada.pais || "").trim();
  if (!pais) return { erro: "Falta o país." };
  if (!todosPaises.has(pais)) return { erro: `Não conheço o país "${pais}". Use o nome em inglês como está no mapa (busque com buscar_members).` };
  const itens = [], acao = { tipo: "members", secao: mb.secao, pais };
  if (entrada.coluna !== undefined) {
    const col = (mb.dados.colunas || []).find(c => c.id === entrada.coluna || normalizar(c.nome) === normalizar(entrada.coluna));
    if (!col) return { erro: `Coluna "${entrada.coluna}" não existe. Colunas: ${(mb.dados.colunas || []).map(c => c.nome).join(", ")}.` };
    const v = String(entrada.valor ?? "");
    if (col.tipo === "select" && v && !(col.opcoes || []).includes(v)) return { erro: `Na coluna ${col.nome} as opções são: ${(col.opcoes || []).join(", ")}.` };
    const atual = String(((mb.dados.paises || {})[pais] || {})[col.id] ?? "");
    if (v === atual) return { erro: "Nada mudaria: o valor já é esse." };
    acao.coluna = col.id; acao.valor = v;
    itens.push(`${col.nome}: ${atual || "vazio"} → ${v || "vazio"}`);
  }
  if (entrada.quadro !== undefined || entrada.status !== undefined || entrada.tipo_membro !== undefined || entrada.partner !== undefined) {
    const q = (mb.dados.boards || []).find(b => b.id === entrada.quadro || normalizar(b.nome) === normalizar(entrada.quadro));
    if (!q) return { erro: `Quadro "${entrada.quadro}" não existe. Quadros: ${(mb.dados.boards || []).map(b => `${b.id} (${b.nome})`).join(", ")}.` };
    if (q.id === "avisos-gerais" && entrada.status !== undefined) return { erro: "O status do quadro Avisos Gerais é calculado pela Dash; não dá pra mudar à mão." };
    const atual = ((mb.dados.statusPorQuadro || {})[q.id] || {})[pais] || { status: "", partner: "", tipoMembro: "" };
    const novo = { status: atual.status || "", partner: atual.partner || "", tipoMembro: atual.tipoMembro || "" };
    if (entrada.status !== undefined) {
      if (!(q.status || []).includes(entrada.status)) return { erro: `No quadro ${q.nome} os status são: ${(q.status || []).join(", ")}.` };
      novo.status = entrada.status;
    }
    if (entrada.partner !== undefined) novo.partner = String(entrada.partner);
    const ultimo = (q.status || [])[(q.status || []).length - 1];
    if (entrada.tipo_membro !== undefined) {
      if (!q.temTipoMembro) return { erro: `O quadro ${q.nome} não tem tipo de membro.` };
      if (entrada.tipo_membro && !TIPO_MEMBRO_OPCOES.includes(entrada.tipo_membro)) return { erro: "Tipo de membro é Observador ou Afiliado." };
      if (entrada.tipo_membro && novo.status !== ultimo) return { erro: `Tipo de membro só vale com status ${ultimo}.` };
      novo.tipoMembro = entrada.tipo_membro || "";
    }
    if (novo.status !== ultimo) novo.tipoMembro = ""; // mesma regra da Dash
    if (novo.status !== atual.status) itens.push(`${q.nome} › status: ${atual.status || "sem status"} → ${novo.status}`);
    if (novo.tipoMembro !== (atual.tipoMembro || "")) itens.push(`${q.nome} › tipo: ${atual.tipoMembro || "—"} → ${novo.tipoMembro || "—"}`);
    if (novo.partner !== (atual.partner || "")) itens.push(`${q.nome} › partner: ${atual.partner || "—"} → ${novo.partner || "—"}`);
    acao.quadro = q.id; acao.registro = novo;
  }
  if (!itens.length) return { erro: "Nada mudaria com isso." };
  return { acao, resumo: `*Members 2 ${mb.nome} › ${pais}*\n` + itens.map(i => "• " + i).join("\n") };
}

// Aplica a ação num retrato fresco da seção. Devolve {linhaId, antes, depois} ou erro.
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
  if (acao.tipo === "contexto") {
    const no = achar(dados, acao.id);
    if (!no) return { erro: "a linha não existe mais na Dash" };
    if (!TIPOS_COM_CONTEXTO[no.rowType]) return { erro: "a linha deixou de ser Meta/Projeto" };
    const antes = { contexto: no.contexto === undefined ? null : no.contexto };
    no.contexto = acao.texto;
    return { linhaId: no.id, antes, depois: { contexto: acao.texto } };
  }
  if (acao.tipo === "members") {
    if (!pessoa.admin) return { erro: "só a Karina pode mudar o Members 2" };
    const antes = {}, depois = {};
    if (acao.coluna) {
      if (!dados.paises || typeof dados.paises !== "object") dados.paises = {};
      if (!dados.paises[acao.pais]) dados.paises[acao.pais] = {};
      antes.coluna = { [acao.coluna]: dados.paises[acao.pais][acao.coluna] ?? null };
      dados.paises[acao.pais][acao.coluna] = acao.valor;
      depois.coluna = { [acao.coluna]: acao.valor };
    }
    if (acao.quadro) {
      if (!(dados.boards || []).some(b => b.id === acao.quadro)) return { erro: "o quadro não existe mais" };
      if (!dados.statusPorQuadro) dados.statusPorQuadro = {};
      if (!dados.statusPorQuadro[acao.quadro]) dados.statusPorQuadro[acao.quadro] = {};
      antes.registro = dados.statusPorQuadro[acao.quadro][acao.pais] || null;
      dados.statusPorQuadro[acao.quadro][acao.pais] = { ...(antes.registro || {}), ...acao.registro };
      depois.registro = dados.statusPorQuadro[acao.quadro][acao.pais];
    }
    return { linhaId: acao.pais + (acao.quadro ? " @ " + acao.quadro : ""), antes, depois };
  }
  return { erro: "ação desconhecida" };
}

async function gravarSecao(env, secao, dados, updatedAtLido) {
  const r = await sb(env, `${TAB_DASH}?section=eq.${encodeURIComponent(secao)}&updated_at=eq.${encodeURIComponent(updatedAtLido)}`, {
    method: "PATCH", body: { data: dados, updated_at: new Date().toISOString() }, prefer: "return=representation"
  });
  return r.ok && Array.isArray(r.dados) && r.dados.length === 1;
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
const F_BUSCAR = {
  name: "buscar", description: "Busca linhas da aba Tasks. Use pra qualquer coisa que não esteja nas mudanças/alertas que você já recebeu. Passe apelido pra ver uma linha e o que está dentro dela.",
  input_schema: { type: "object", properties: {
    texto: { type: "string", description: "palavras do nome da linha ou do caminho acima dela" },
    apelido: { type: "string", description: "ex. WPF-897435: mostra a linha e as de dentro" },
    empresa: { type: "string" }, responsavel: { type: "string" },
    status: { type: "string", enum: ["Not Started", "In Progress", "Deadline", "Late", "Done", "On Hold", "Cancelled"] },
    vence_ate: { type: "string", description: "AAAA-MM-DD" },
    incluir_concluidas: { type: "boolean" } } }
};
const F_BUSCAR_MEMBERS = {
  name: "buscar_members", description: "Consulta a aba Members 2 (quadros de países por status). Sem país: resumo dos quadros. Com país: tudo daquele país.",
  input_schema: { type: "object", properties: { empresa: { type: "string" }, quadro: { type: "string" }, pais: { type: "string" } } }
};
const F_MUDANCA = {
  name: "propor_mudanca", description: "Propõe mudar UMA linha da aba Tasks. Não grava: o sistema mostra o resumo e pede confirmação. Informe só o que muda.",
  input_schema: { type: "object", properties: {
    linha: { type: "string", description: "apelido, ex. WPF-897435" },
    status: { type: "string", enum: STATUS_MANUAIS },
    inicio: { type: "string", description: "AAAA-MM-DD, ou \"\" pra tirar" },
    fim: { type: "string", description: "AAAA-MM-DD, ou \"\" pra tirar" },
    nome: { type: "string" } }, required: ["linha"] }
};
const F_CRIACAO = {
  name: "propor_criacao", description: "Propõe criar UMA linha nova na aba Tasks dentro de uma linha existente. Não grava: o sistema pede confirmação.",
  input_schema: { type: "object", properties: {
    pai: { type: "string", description: "apelido da linha onde a nova entra" },
    tipo: { type: "string", enum: ["meta", "projeto", "entregavel", "tarefa"] },
    nome: { type: "string" }, inicio: { type: "string" }, fim: { type: "string" },
    responsaveis: { type: "array", items: { type: "string" }, description: "nomes exatos; se omitir, quem está falando" } },
    required: ["pai", "tipo", "nome"] }
};
const F_MEMBERS = {
  name: "propor_members", description: "Propõe mudar a aba Members 2 de um país: status num quadro (e tipo de membro / partner), ou o valor de uma coluna da planilha. Não grava: o sistema pede confirmação.",
  input_schema: { type: "object", properties: {
    empresa: { type: "string", description: "WPF, CBTH… (padrão WPF)" },
    pais: { type: "string", description: "nome em inglês como no mapa" },
    quadro: { type: "string", description: "id ou nome do quadro" }, status: { type: "string" },
    tipo_membro: { type: "string", enum: ["Observador", "Afiliado", ""] }, partner: { type: "string" },
    coluna: { type: "string", description: "id ou nome da coluna da planilha" }, valor: { type: "string" } },
    required: ["pais"] }
};
const F_CONTEXTO = {
  name: "propor_contexto", description: "Propõe escrever no contexto de uma Meta ou Projeto (texto que explica o porquê, quem está envolvido, decisões, parceiros). Use quando a pessoa pedir, e também OFEREÇA por conta própria quando ela contar algo importante sobre a Meta/Projeto que ainda não está no contexto. Não grava: o sistema pede confirmação.",
  input_schema: { type: "object", properties: {
    linha: { type: "string", description: "apelido da Meta ou Projeto" },
    texto: { type: "string", description: "o que escrever, frase curta e objetiva" },
    modo: { type: "string", enum: ["acrescentar", "substituir"], description: "padrão: acrescentar" } }, required: ["linha", "texto"] }
};
const F_ALERTAS = {
  name: "resumo_alertas", description: "Panorama rápido: o que está Late, em Deadline ou vence em 7 dias (pra admin, de todo mundo; pros outros, só o deles). Use SÓ quando a pessoa pedir um resumo / como estão as coisas.",
  input_schema: { type: "object", properties: {} }
};
const F_SONNET = {
  name: "chamar_sonnet", description: "Passa esta conversa pro modelo mais forte. Use SÓ quando precisar: análise/panorama geral, planejar ou reorganizar várias linhas, pedido ambíguo com várias partes, decidir onde encaixar algo novo. Pergunta simples, atualização de status e busca você resolve sozinho.",
  input_schema: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] }
};
const F_ANALISE = {
  name: "analise_geral", description: "Lê a aba Tasks inteira (e o Members 2) de uma vez. Caro: só quando a pessoa pedir análise ou panorama geral. Limite de 1 por dia por pessoa.",
  input_schema: { type: "object", properties: {} }
};

function instrucoes(modelo) {
  return `Você é o Agente de Gestão da Dash da Karina, no WhatsApp. Você cuida de duas abas da Dash, de todas as empresas (WPF, CBTH e outras que aparecerem): *Tasks* (hierarquia Objetivo › Meta › Projeto › Entregável › Tarefa) e *Members 2* (quadros de países por status).

Como conversar:
- Português do Brasil, jeito de WhatsApp. Respostas curtas a médias: em geral até 6 linhas, no máximo umas 12 quando a pergunta pedir. Negrito só com *asteriscos*; sem títulos nem tabelas.
- Fale no nível do entregável/projeto/objetivo; não despeje listas de tarefas. Ex.: "O Ladies Weekend tem 2 entregas vencendo sexta. O material de divulgação já começou?"
- Panorama/resumo geral só quando a pessoa pedir ("como estão as coisas?"): aí use resumo_alertas e destaque o que está Late ou Deadline.
- Novidades: quando o sistema mandar "Novidades que pedem ação", comente em 1–3 linhas no começo da resposta, só o que importa, e siga com o que a pessoa perguntou. Se não houver novidades, não mencione.
- Linhas com "contexto:" trazem o porquê daquela Meta/Projeto; use isso pra entender e conversar melhor.
- Quando terminar com uma pergunta que tenha respostas previsíveis, sugira as respostas na ÚLTIMA linha, assim: [[opções: Já comecei | Ainda não | Adiar]]. De 2 a 3 opções curtas (até 20 caracteres cada); se precisar escolher entre mais coisas (projetos, países…), até 10 opções de até 24 caracteres. Não repita as opções no texto. Sem pergunta, sem opções. Nunca ponha opções junto de uma proposta (o sistema já põe Sim/Não).
- Use só o que está nos dados que você recebeu ou buscou. Nunca invente linha, data, status, país ou pessoa. Se precisar de algo que não está aqui, use buscar / buscar_members antes de responder.
- Não cite apelidos (WPF-123456) na conversa; eles são só pras ferramentas.
- Diga a empresa quando houver mais de uma envolvida.

Mudanças:
- Pra mudar ou criar, chame propor_mudanca, propor_criacao, propor_members ou propor_contexto. Uma proposta por vez.
- Você NUNCA grava e NUNCA diz que já mudou ("pronto", "feito", "atualizei" são proibidos antes do sim). O sistema mostra o resumo e pergunta "Confirma?" sozinho; junto da ferramenta escreva no máximo uma frase curta tipo "Posso deixar assim:", sem pedir confirmação.
- Contexto: só Meta e Projeto têm. Quando a pessoa contar algo relevante sobre uma Meta/Projeto (decisão, parceiro, motivo, prazo combinado) que não está no contexto, ofereça registrar com propor_contexto.
- Tasks: status que dá pra escolher são Not Started, In Progress, Done, On Hold, Cancelled (Late e Deadline são automáticos pelas datas). Linhas [agrupa] têm status e datas calculados: mude as de baixo. Não existe apagar (só pela Dash). Pra criar, escolha o lugar certo na hierarquia; se não houver lugar óbvio, pergunte antes. Meta nova só se a pessoa pedir ou concordar.
- Members 2: status de cada quadro (os do próprio quadro), tipo de membro Observador/Afiliado só com o último status (Membro), partner, e colunas da planilha. O quadro Avisos Gerais tem status calculado. Países com o nome em inglês, como no mapa.
- Datas relativas ("sexta", "semana que vem") contam a partir de hoje; nas ferramentas use AAAA-MM-DD.
${modelo === HAIKU ? "\n- Se o pedido exigir análise geral, planejamento de várias linhas ou raciocínio mais pesado, chame chamar_sonnet em vez de tentar sozinho. No resto, resolva você." : "\n- Você é o modelo mais forte, chamado pra um pedido que precisa de mais cuidado. Se a pessoa pediu análise ou panorama geral, use analise_geral (1 por dia)."}`;
}

async function chamarClaude(env, modelo, system, ferramentas, mensagens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modelo, max_tokens: MAX_TOKENS, system, tools: ferramentas, messages: mensagens })
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
    const texto = corta(l.body || "(sem texto)", 600);
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += "\n" + texto;
    else msgs.push({ role, content: texto });
  });
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

async function contarHoje(env, tel, filtro) {
  const r = await sb(env, `${TAB_MSG}?select=id&direction=eq.out&to_number=eq.${tel}&created_at=gte.${encodeURIComponent(inicioDoDiaSP())}&${filtro}`);
  return r.ok && Array.isArray(r.dados) ? r.dados.length : 0;
}

// ─── Resposta de emergência (API do Claude fora) ─────────────────────────
function resumoSimples(indice, pessoa, hoje) {
  const lim = somaDias(hoje, 7), itens = [];
  Object.values(indice.porId).forEach(info => {
    const no = info.no;
    if (!temFilhos(no) && (pessoa.admin || ehDono(no, pessoa.nome_tasks)) && !["Done", "Cancelled"].includes(no.status) && no.endDate && no.endDate <= lim)
      itens.push(`• ${no.endDate < hoje ? "⚠️ " : ""}${corta(no.name, 60)} (${info.empresa.nome}, ${br(no.endDate)})`);
  });
  const topo = "Estou com um problema pra conversar agora 😕 Tente de novo daqui a pouco.";
  if (!itens.length) return topo + "\nPelo quadro, nada seu vence nos próximos 7 dias.";
  return topo + "\nEnquanto isso, o que vence até " + br(lim) + ":\n" + itens.slice(0, 10).join("\n") + (itens.length > 10 ? `\n…e mais ${itens.length - 10}.` : "");
}

// ─── Tratamento de uma mensagem ──────────────────────────────────────────
async function tratarMensagem(env, msg, textoRecebido) {
  let texto = textoRecebido;
  const tel = msg.from;
  const rp = await sb(env, `${TAB_PESSOAS}?select=*&telefone=eq.${tel}`);
  const pessoa = rp.ok && rp.dados && rp.dados[0];
  if (!pessoa) { await enviarTexto(env, tel, "Oi! Este número ainda não está cadastrado no Agente de Gestão. Fale com a Karina pra liberar."); return; }

  const umaHora = new Date(Date.now() - 3600000).toISOString();
  const rc = await sb(env, `${TAB_MSG}?select=id&direction=eq.in&from_number=eq.${tel}&created_at=gte.${encodeURIComponent(umaHora)}`);
  const qtd = rc.ok && Array.isArray(rc.dados) ? rc.dados.length : 0;
  if (qtd > LIMITE_POR_HORA) {
    if (qtd === LIMITE_POR_HORA + 1) await enviarTexto(env, tel, "Recebi muitas mensagens na última hora. Dou uma pausa e volto a responder daqui a pouco.");
    return;
  }
  if (!texto) { await enviarTexto(env, tel, "Por enquanto eu só entendo mensagens de texto 🙂"); return; }

  // Respondeu "2" a uma mensagem com opções numeradas? Vira o texto da opção.
  if (/^\s*\d{1,2}\s*$/.test(texto)) {
    const ru = await sb(env, `${TAB_MSG}?select=opcoes&direction=eq.out&to_number=eq.${tel}&order=created_at.desc&limit=1`);
    const ops = ru.ok && ru.dados && ru.dados[0] && ru.dados[0].opcoes;
    const n = parseInt(texto, 10);
    if (Array.isArray(ops) && n >= 1 && n <= ops.length) texto = ops[n - 1];
  }

  const cmd = normalizar(texto);
  if (cmd === "sair" || cmd === "voltar") {
    await sb(env, `${TAB_PESSOAS}?telefone=eq.${tel}`, { method: "PATCH", prefer: "return=minimal", body: { recebe_avisos: cmd === "voltar" } });
    await enviarTexto(env, tel, cmd === "sair"
      ? "Pronto, parei de mandar avisos. Você ainda pode me escrever quando quiser. Pra voltar, mande VOLTAR."
      : "Pronto, voltei a mandar avisos. Pra parar, mande SAIR.");
    return;
  }

  // Mudança esperando o "sim"? Resolve em código, sem gastar Claude.
  const rpd = await sb(env, `${TAB_PEND}?select=*&telefone=eq.${tel}&status=eq.aguardando&order=criado_em.desc&limit=1`);
  let pend = rpd.ok && rpd.dados && rpd.dados[0];
  if (pend && Date.parse(pend.expira_em) < Date.now()) { await marcarPendencia(env, pend.id, "expirada"); pend = null; }
  if (pend && ehSim(texto)) {
    const r = await executarPendencia(env, pend, pessoa, tel);
    await marcarPendencia(env, pend.id, r.ok ? "confirmada" : "falhou");
    await enviarTexto(env, tel, r.ok ? "Feito ✅ Já está na Dash (quem estiver com ela aberta vê em até 15s)." : `Não consegui gravar: ${r.erro}. Nada foi mudado.`);
    return;
  }
  if (pend && ehNao(texto)) { await marcarPendencia(env, pend.id, "cancelada"); await enviarTexto(env, tel, "Ok, não mudei nada."); return; }
  let pendAnterior = null;
  if (pend) { await marcarPendencia(env, pend.id, "cancelada"); pendAnterior = pend.resumo; }

  const hoje = hojeSP();
  let empresas, members;
  try { ({ empresas, members } = await carregarDash(env)); }
  catch (e) { await enviarTexto(env, tel, "Não consegui ler a Dash agora. Tente de novo em instantes."); return; }
  const indice = indexar(empresas);
  const rn = await sb(env, `${TAB_PESSOAS}?select=nome_tasks`);
  const nomesConhecidos = new Set((rn.ok && rn.dados ? rn.dados : []).map(p => p.nome_tasks).filter(Boolean));
  Object.values(indice.porId).forEach(i => (i.no.assignees || []).forEach(n => nomesConhecidos.add(n)));
  const todosPaises = new Set(); members.forEach(mb => paisesConhecidos(mb).forEach(p => todosPaises.add(p)));

  // Últimas modificações desde a mensagem anterior desta pessoa.
  const agoraRetrato = retratar(empresas, members);
  const rs = await sb(env, `${TAB_SNAP}?select=dados,tirado_em&telefone=eq.${tel}`);
  const base = rs.ok && rs.dados && rs.dados[0];
  const mudancas = base ? mudancasDesde(base.dados, agoraRetrato, pessoa, indice) : null;

  const contexto = [
    `Falando com: ${pessoa.nome_tasks}${pessoa.admin ? " (admin: vê e muda tudo, inclusive Members 2)" : " (vê e muda só o que é dela/dele na aba Tasks; não vê Members 2)"}.`,
    `Hoje: ${diaSemanaSP()}, ${hoje}.`,
    `Responsáveis válidos: ${[...nomesConhecidos].join(", ")}.`,
    `Empresas: ${empresas.map(e => e.nome).join(", ")}.`,
    mudancas ? `Novidades que pedem ação (desde a última conversa):\n${mudancas}` : "",
    pendAnterior ? `Havia esta mudança esperando confirmação, e a pessoa respondeu outra coisa, então ela foi descartada:\n${pendAnterior}\nSe a mensagem nova ajusta essa mudança, proponha de novo já ajustada.` : ""
  ].filter(Boolean).join("\n\n");

  const mensagens = await historico(env, tel, msg.id);
  const atual = `[Contexto do sistema]\n${contexto}\n\n[Mensagem]\n${texto}`;
  if (mensagens.length && mensagens[mensagens.length - 1].role === "user") mensagens[mensagens.length - 1].content += "\n\n" + atual;
  else mensagens.push({ role: "user", content: atual });

  let modelo = HAIKU, analiseFeita = false;
  const uso = { tokens_entrada: 0, tokens_saida: 0, tokens_cache: 0 };
  const somarUso = u => { if (!u) return; uso.tokens_entrada += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0); uso.tokens_saida += u.output_tokens || 0; uso.tokens_cache += u.cache_read_input_tokens || 0; };
  const consumo = () => ({ modelo, ...uso, analise_geral: analiseFeita });
  const responder = async (txt, opcoes) => { await enviarComOpcoes(env, tel, txt, opcoes, consumo()); await sb(env, TAB_SNAP, { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: [{ telefone: tel, dados: agoraRetrato, tirado_em: new Date().toISOString() }] }); };

  try {
    for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
      const ferramentas = modelo === HAIKU
        ? [F_BUSCAR, F_ALERTAS, ...(pessoa.admin ? [F_BUSCAR_MEMBERS, F_MEMBERS] : []), F_MUDANCA, F_CRIACAO, F_CONTEXTO, F_SONNET]
        : [F_BUSCAR, F_ALERTAS, ...(pessoa.admin ? [F_BUSCAR_MEMBERS, F_MEMBERS] : []), F_MUDANCA, F_CRIACAO, F_CONTEXTO, F_ANALISE];
      ferramentas[ferramentas.length - 1] = { ...ferramentas[ferramentas.length - 1], cache_control: { type: "ephemeral" } };
      const system = [{ type: "text", text: instrucoes(modelo), cache_control: { type: "ephemeral" } }];
      const resp = await chamarClaude(env, modelo, system, ferramentas, mensagens);
      somarUso(resp.usage);
      const textoClaude = (resp.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      const usos = (resp.content || []).filter(b => b.type === "tool_use");
      if (!usos.length) {
        const sep = separarOpcoes(textoClaude);
        await responder(sep.texto || "Não entendi. Pode repetir de outro jeito?", sep.opcoes);
        return;
      }

      // Subir pro Sonnet: refaz a conversa com o modelo forte.
      const sobe = usos.find(u => u.name === "chamar_sonnet");
      if (sobe && modelo === HAIKU) {
        if ((await contarHoje(env, tel, `modelo=eq.${SONNET}`)) >= SONNET_POR_DIA) {
          mensagens.push({ role: "assistant", content: resp.content });
          mensagens.push({ role: "user", content: usos.map(u => ({ type: "tool_result", tool_use_id: u.id, is_error: true, content: u === sobe ? "Limite diário do modelo forte atingido; resolva você mesmo, do jeito mais simples." : "Uma coisa por vez." })) });
          continue;
        }
        modelo = SONNET;
        continue;
      }

      // Uma ferramenta por vez: responde a primeira e marca as outras.
      const u = usos[0];
      let resultado = null, proposta = null;
      if (u.name === "buscar") resultado = buscarTasks(u.input || {}, indice, pessoa, hoje);
      else if (u.name === "buscar_members") resultado = buscarMembers(u.input || {}, members, pessoa);
      else if (u.name === "analise_geral") {
        if (modelo !== SONNET) resultado = "Indisponível.";
        else if ((await contarHoje(env, tel, "analise_geral=eq.true")) >= ANALISE_POR_DIA) resultado = "Limite de 1 análise geral por dia já usado hoje. Responda com o que dá pra buscar.";
        else { resultado = quadroCompleto(empresas, members, indice, pessoa); analiseFeita = true; }
      }
      else if (u.name === "propor_mudanca") proposta = validarMudanca(u.input || {}, indice, pessoa, hoje);
      else if (u.name === "propor_criacao") proposta = validarCriacao(u.input || {}, indice, pessoa, nomesConhecidos);
      else if (u.name === "propor_members") proposta = validarMembers(u.input || {}, members, pessoa, todosPaises);
      else if (u.name === "propor_contexto") proposta = validarContexto(u.input || {}, indice, pessoa);
      else if (u.name === "resumo_alertas") resultado = resumoAlertas(empresas, indice, pessoa, hoje);
      else resultado = "Ferramenta desconhecida.";

      if (proposta && !proposta.erro) {
        await sb(env, TAB_PEND, { method: "POST", prefer: "return=minimal", body: [{ telefone: tel, acao: proposta.acao, resumo: proposta.resumo }] });
        const intro = separarOpcoes(textoClaude).texto.replace(/^(pronto|feito|fiz|atualizei|mudei|anotei|registrei)\b[!.,]*\s*/i, "").trim();
        await responder((intro ? intro + "\n\n" : "") + proposta.resumo + "\n\nConfirma?", ["Sim", "Não"]);
        return;
      }
      mensagens.push({ role: "assistant", content: resp.content });
      mensagens.push({ role: "user", content: usos.map(x => ({
        type: "tool_result", tool_use_id: x.id,
        ...(x === u ? (proposta ? { is_error: true, content: proposta.erro } : { content: resultado }) : { is_error: true, content: "Uma ferramenta por vez." })
      })) });
    }
    await responder("Não consegui resolver isso agora. Pode me dizer de outro jeito?");
  } catch (e) {
    console.log("erro Claude:", e && e.message);
    await enviarTexto(env, tel, resumoSimples(indice, pessoa, hoje), consumo());
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
export const _teste = { formatoOpcoes, corpoInterativo, separarOpcoes, ehSim, ehNao, normalizar, indexar, retratar, mudancasDesde, resumoAlertas, quadroCompleto, buscarTasks, buscarMembers,
  validarMudanca, validarCriacao, validarMembers, validarContexto, contextoDe, aplicarAcao, nomeEmpresa, hojeSP, instrucoes, HAIKU, SONNET };
