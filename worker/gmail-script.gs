/**
 * Agente de Gestão WPF — ponte do Gmail pro robô do WhatsApp.
 *
 * De hora em hora, olha a caixa PRINCIPAL e manda pro robô:
 *   - e-mails NOVOS (a partir de quando o script foi ligado);
 *   - conversas paradas SEM RESPOSTA há 3 dias úteis (a última mensagem
 *     não é sua), uma vez cada.
 * Newsletter, notificação automática, "no-reply" e o Read AI ficam de fora.
 * Vai só remetente, destinatários, assunto, data e um trecho do texto.
 *
 * Instalar: cole tudo, salve, escolha a função "configurar" no topo e
 * clique em Executar (autorize com a conta do trabalho). Pronto.
 */
const ROBO_URL = "https://wpf-whatsapp-bridge.worldpokerfederation.workers.dev/gmail";
const ROBO_TOKEN = "COLE_O_TOKEN_AQUI";
const DIAS_SEM_RESPOSTA = 3;

function configurar() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty("DESDE", String(Math.floor(Date.now() / 1000)));
  p.setProperty("SEM_RESPOSTA", "[]");
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("verificarEmails").timeBased().everyHours(1).create();
  Logger.log("Ligado! A partir de agora, e-mails novos vão pro robô de hora em hora.");
}

function automatico(m) {
  const de = (m.getFrom() || "").toLowerCase();
  if (/no-?reply|donotreply|notifica|notification|mailer-daemon|newsletter|read\.ai|calendar|bounce/.test(de)) return true;
  if (m.getHeader("List-Unsubscribe") || m.getHeader("List-Id")) return true;
  const auto = (m.getHeader("Auto-Submitted") || "").toLowerCase();
  if (auto && auto !== "no") return true;
  const prec = (m.getHeader("Precedence") || "").toLowerCase();
  return prec === "bulk" || prec === "list" || prec === "junk";
}

function diasUteis(de, ate) {
  let n = 0;
  const d = new Date(de.getTime());
  d.setHours(0, 0, 0, 0);
  const fim = new Date(ate.getTime());
  fim.setHours(0, 0, 0, 0);
  while (d < fim) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) n++;
  }
  return n;
}

function montar(m, th, tipo, dias) {
  return {
    id: m.getId(), thread: th.getId(), tipo: tipo, dias_sem_resposta: dias || null,
    de: m.getFrom(), para: m.getTo(), cc: m.getCc(),
    assunto: m.getSubject(), data: m.getDate().toISOString(),
    trecho: (m.getPlainBody() || "").replace(/\s+/g, " ").slice(0, 1500),
    link: "https://mail.google.com/mail/u/0/#inbox/" + th.getId()
  };
}

function verificarEmails() {
  const p = PropertiesService.getScriptProperties();
  const desde = Number(p.getProperty("DESDE") || 0);
  if (!desde) { configurar(); return; }
  const agora = Math.floor(Date.now() / 1000);
  const eu = (Session.getActiveUser().getEmail() || "").toLowerCase();
  const emails = [];

  // 1) Novos desde a última olhada
  GmailApp.search("in:inbox category:primary -from:me after:" + (desde - 60), 0, 50).forEach(th => {
    th.getMessages().forEach(m => {
      if (Math.floor(m.getDate().getTime() / 1000) <= desde) return;
      if (eu && (m.getFrom() || "").toLowerCase().indexOf(eu) !== -1) return;
      if (automatico(m)) return;
      emails.push(montar(m, th, "novo"));
    });
  });

  // 2) Parados sem resposta (só conversas que chegaram depois de ligar)
  const vistos = JSON.parse(p.getProperty("SEM_RESPOSTA") || "[]");
  GmailApp.search("in:inbox category:primary -from:me older_than:3d newer_than:30d", 0, 40).forEach(th => {
    if (vistos.indexOf(th.getId()) !== -1) return;
    const msgs = th.getMessages();
    const ult = msgs[msgs.length - 1];
    if (Math.floor(ult.getDate().getTime() / 1000) <= desde) return;
    if (eu && (ult.getFrom() || "").toLowerCase().indexOf(eu) !== -1) return; // a última é sua: respondeu
    if (automatico(ult)) return;
    const dias = diasUteis(ult.getDate(), new Date());
    if (dias < DIAS_SEM_RESPOSTA) return;
    emails.push(montar(ult, th, "sem_resposta", dias));
    vistos.push(th.getId());
  });

  if (emails.length) {
    const r = UrlFetchApp.fetch(ROBO_URL, {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { "x-gmail-token": ROBO_TOKEN },
      payload: JSON.stringify({ emails: emails })
    });
    if (r.getResponseCode() !== 200) {
      Logger.log("Robô respondeu " + r.getResponseCode() + ": " + r.getContentText());
      return; // não avança: tenta de novo na próxima hora
    }
  }
  p.setProperty("DESDE", String(agora));
  p.setProperty("SEM_RESPOSTA", JSON.stringify(vistos.slice(-300)));
}
