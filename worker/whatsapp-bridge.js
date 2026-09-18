// Ponte do WhatsApp da Dash.
//  GET  /webhook   → verificação da Meta
//  POST /webhook   → mensagem recebida: guarda no Supabase e responde
//  POST /enviar    → envia mensagem (usado pelo agente), exige o token no header
const TABELA = "wpf_whatsapp_messages";

async function gravar(env, linha) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${TABELA}`, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      // Mensagem repetida pela Meta nao entra duas vezes.
      "Prefer": "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify([linha])
  });
  if (!res.ok) console.log("erro ao gravar:", res.status, await res.text());
  return res.ok;
}

async function enviarTexto(env, para, texto) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { preview_url: false, body: texto }
    })
  });
  const corpo = await res.json().catch(() => null);
  if (!res.ok) console.log("erro ao enviar:", res.status, JSON.stringify(corpo));
  const id = corpo && corpo.messages && corpo.messages[0] && corpo.messages[0].id;
  if (res.ok) {
    await gravar(env, {
      wa_message_id: id || null,
      direction: "out",
      from_number: env.WHATSAPP_PHONE_ID,
      to_number: para,
      msg_type: "text",
      body: texto,
      sent_at: new Date().toISOString(),
      raw: corpo
    });
  }
  return { ok: res.ok, id, corpo };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/webhook" && request.method === "GET") {
      const modo = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const desafio = url.searchParams.get("hub.challenge");
      if (modo === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(desafio, { status: 200 });
      }
      return new Response("forbidden", { status: 403 });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      let corpo = null;
      try { corpo = await request.json(); } catch (e) { corpo = null; }
      // Responde 200 sempre: se a Meta nao receber 200, ela reenvia tudo.
      try {
        const mudanca = corpo?.entry?.[0]?.changes?.[0]?.value;
        const msg = mudanca?.messages?.[0];
        if (msg) {
          const contato = mudanca?.contacts?.[0];
          const texto = msg.text?.body
            || msg.button?.text
            || msg.interactive?.list_reply?.title
            || msg.interactive?.button_reply?.title
            || "";
          await gravar(env, {
            wa_message_id: msg.id,
            direction: "in",
            from_number: msg.from,
            to_number: mudanca?.metadata?.display_phone_number || null,
            contact_name: contato?.profile?.name || null,
            msg_type: msg.type,
            body: texto,
            sent_at: new Date(Number(msg.timestamp) * 1000).toISOString(),
            raw: corpo
          });
          // Resposta provisoria, so pra ver a ida e volta funcionando.
          // Sai quando o agente entrar no lugar.
          await enviarTexto(env, msg.from, "Recebi: " + (texto || "(sem texto)"));
        }
      } catch (e) {
        console.log("erro no webhook:", e && e.message);
      }
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/enviar" && request.method === "POST") {
      if (request.headers.get("x-agente-token") !== env.WHATSAPP_VERIFY_TOKEN) {
        return new Response("forbidden", { status: 403 });
      }
      let dados = null;
      try { dados = await request.json(); } catch (e) { dados = null; }
      if (!dados || !dados.para || !dados.texto) {
        return new Response(JSON.stringify({ ok: false, erro: "informe para e texto" }), {
          status: 400, headers: { "Content-Type": "application/json" }
        });
      }
      const r = await enviarTexto(env, String(dados.para), String(dados.texto));
      return new Response(JSON.stringify({ ok: r.ok, id: r.id }), {
        status: r.ok ? 200 : 502, headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("wpf-whatsapp-bridge ok", { status: 200 });
  }
};
