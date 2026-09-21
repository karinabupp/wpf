// wpf-slack-bridge — Cloudflare Worker
// Publicado pelo GitHub Actions (.github/workflows/deploy-worker-slack.yml)
// a cada mudança nesta pasta. Os segredos (SLACK_BOT_TOKEN,
// SLACK_SIGNING_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY) ficam no
// Cloudflare e NÃO são tocados pelo deploy.
//
//  1. POST /events  — o Slack chama quando sai mensagem num canal do bot.
//     Confere a assinatura do Slack e grava em wpf_slack_messages.
//  2. POST /notify, POST /backfill, GET /channels, GET /users — chamados pela
//     Dash. Desde 21/09 exigem o login da Dash: o header Authorization traz o
//     token do Supabase de quem entrou, e o banco confirma (wpf_tem_acesso)
//     que a pessoa está na lista de acesso. Sem isso: 401.

// Endereço e chave PÚBLICA (anon) do Supabase — os mesmos do index.html.
// Só servem pra perguntar ao banco se o token de quem chamou vale.
const SB_URL = "https://ufwmktomjfcvloswgnyt.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmd21rdG9tamZjdmxvc3dnbnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjIyMDAsImV4cCI6MjEwMDM5ODIwMH0.NAhI21Vs1aYqJQ_P9QAVTsRQWr_8bYlaE1fPg2KS-mg";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/events" && request.method === "POST") {
      return handleSlackEvent(request, env);
    }

    const rotaDaDash =
      (url.pathname === "/notify" && request.method === "POST") ||
      (url.pathname === "/backfill" && request.method === "POST") ||
      (url.pathname === "/channels" && request.method === "GET") ||
      (url.pathname === "/users" && request.method === "GET");
    if (!rotaDaDash) {
      return new Response("Not found", { status: 404, headers: corsHeaders() });
    }
    if (!(await temAcesso(request))) {
      return new Response(JSON.stringify({ ok: false, error: "login necessário" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" }
      });
    }

    if (url.pathname === "/notify") return handleNotify(request, env);
    if (url.pathname === "/backfill") return handleBackfill(request, env);
    if (url.pathname === "/channels") return handleListChannels(request, env);
    return handleListUsers(request, env);
  }
};

// Pergunta ao banco, com o token de quem chamou, se essa pessoa tem acesso à
// Dash. Token falso, vencido ou de fora da lista → false.
async function temAcesso(request) {
  const auth = request.headers.get("Authorization") || "";
  if (!/^Bearer\s+\S+$/.test(auth)) return false;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/wpf_tem_acesso`, {
      method: "POST",
      headers: { "apikey": SB_ANON, "Authorization": auth, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch (e) {
    return false;
  }
}

// ── /events — incoming from Slack ───────────────────────────────────────

async function handleSlackEvent(request, env) {
  const rawBody = await request.text();

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.log("BAD JSON:", rawBody.slice(0, 200));
    return new Response("Bad request", { status: 400 });
  }
  if (payload.type === "url_verification") {
    console.log("Handling url_verification handshake");
    return new Response(payload.challenge, { headers: { "Content-Type": "text/plain" } });
  }

  console.log("Event payload type:", payload.type, "| event.type:", payload.event && payload.event.type, "| has bot_id:", !!(payload.event && payload.event.bot_id), "| subtype:", payload.event && payload.event.subtype);

  // Verify the request is genuinely from Slack (HMAC over timestamp+body
  // using the signing secret) before trusting anything in it.
  const isValid = await verifySlackSignature(request, rawBody, env.SLACK_SIGNING_SECRET);
  console.log("Signature valid:", isValid, "| has signing secret env var:", !!env.SLACK_SIGNING_SECRET);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = payload.event;
  if (event && event.type === "message" && !event.subtype) {
    console.log("Saving message to Supabase:", JSON.stringify({ channel: event.channel, user: event.user, bot_id: event.bot_id, ts: event.ts }));
    await saveMessageToSupabase(event, env);
  } else {
    console.log("Skipped — not a plain message event (edit/join/etc)");
  }

  return new Response("ok");
}

async function verifySlackSignature(request, rawBody, signingSecret) {
  const timestamp = request.headers.get("X-Slack-Request-Timestamp");
  const slackSig = request.headers.get("X-Slack-Signature");
  if (!timestamp || !slackSig || !signingSecret) return false;

  // Reject anything older than 5 minutes — basic replay-attack guard.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(baseString));
  const hex = [...new Uint8Array(sigBuffer)].map(b => b.toString(16).padStart(2, "0")).join("");
  const computedSig = `v0=${hex}`;

  if (computedSig.length !== slackSig.length) return false;
  let diff = 0;
  for (let i = 0; i < computedSig.length; i++) diff |= computedSig.charCodeAt(i) ^ slackSig.charCodeAt(i);
  return diff === 0;
}

const userNameCache = new Map();
const channelNameCache = new Map();

async function resolveUserName(userId, env) {
  if (!userId) return null;
  if (userNameCache.has(userId)) return userNameCache.get(userId);
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${encodeURIComponent(userId)}`, {
      headers: { "Authorization": `Bearer ${env.SLACK_BOT_TOKEN}` }
    });
    const data = await res.json();
    const name = data.ok ? (data.user.profile.display_name || data.user.real_name || data.user.name) : null;
    userNameCache.set(userId, name);
    return name;
  } catch (err) {
    console.log("users.info failed:", String(err));
    return null;
  }
}

async function resolveChannelName(channelId, env) {
  if (!channelId) return null;
  if (channelNameCache.has(channelId)) return channelNameCache.get(channelId);
  try {
    const res = await fetch(`https://slack.com/api/conversations.info?channel=${encodeURIComponent(channelId)}`, {
      headers: { "Authorization": `Bearer ${env.SLACK_BOT_TOKEN}` }
    });
    const data = await res.json();
    const name = data.ok ? data.channel.name : null;
    channelNameCache.set(channelId, name);
    return name;
  } catch (err) {
    console.log("conversations.info failed:", String(err));
    return null;
  }
}

async function resolveMentionsInText(text, env) {
  if (!text) return text;
  let result = text;
  const userIds = Array.from(new Set([...text.matchAll(/<@([A-Z0-9]+)(?:\|[^>]*)?>/g)].map(m => m[1])));
  for (const uid of userIds) {
    const name = await resolveUserName(uid, env);
    result = result.replace(new RegExp(`<@${uid}(?:\\|[^>]*)?>`, "g"), `@{${name || uid}|${uid}}`);
  }
  result = result
    .replace(/<!everyone>/g, "@{everyone}")
    .replace(/<!here>/g, "@{here}")
    .replace(/<!channel>/g, "@{channel}")
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, "#{$1}")
    .replace(/<#([A-Z0-9]+)>/g, "#{$1}");
  return result;
}

async function saveMessageToSupabase(event, env) {
  const [userName, channelName, resolvedText] = await Promise.all([
    resolveUserName(event.user, env),
    resolveChannelName(event.channel, env),
    resolveMentionsInText(event.text, env)
  ]);
  const finalUserName = userName || event.username || (event.bot_profile && event.bot_profile.name) || (event.bot_id ? "WPF Dashboard Bot" : null);
  const row = {
    channel: event.channel,
    channel_name: channelName,
    user_id: event.user || event.bot_id || null,
    user_name: finalUserName,
    text: resolvedText || "",
    ts: event.ts,
    thread_ts: event.thread_ts || null,
    workspace: env.WORKSPACE_ID || "default",
    inserted_at: new Date().toISOString()
  };
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/wpf_slack_messages?on_conflict=channel,ts`, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([row])
  });
  const bodyText = await res.text().catch(() => "");
  console.log("Supabase response:", res.status, bodyText.slice(0, 300));
}

// ── /notify — outgoing, called by the dashboard ─────────────────────────

async function handleNotify(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "corpo inválido" }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
  const { channel, text } = body;
  if (!channel || !text) {
    return new Response(JSON.stringify({ ok: false, error: "faltou 'channel' ou 'text'" }), {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({ channel, text })
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: data.ok ? 200 : 400,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 502,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
}

// ── /backfill — importa o histórico dos canais do bot ───────────────────

async function slackApi(method, params, env) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://slack.com/api/${method}?${qs}`, {
    headers: { "Authorization": `Bearer ${env.SLACK_BOT_TOKEN}` }
  });
  return res.json();
}

async function listBotChannels(env) {
  let channels = [];
  let cursor = "";
  do {
    const data = await slackApi("conversations.list", {
      types: "public_channel,private_channel",
      limit: "200",
      cursor
    }, env);
    if (!data.ok) throw new Error("conversations.list: " + data.error);
    channels = channels.concat((data.channels || []).filter(c => c.is_member));
    cursor = (data.response_metadata && data.response_metadata.next_cursor) || "";
  } while (cursor);
  return channels;
}

async function handleListChannels(request, env) {
  try {
    const channels = await listBotChannels(env);
    return new Response(JSON.stringify({
      ok: true,
      channels: channels.map(c => ({ id: c.id, name: c.name, is_private: c.is_private }))
    }), { headers: { ...corsHeaders(), "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 502,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
}

async function handleListUsers(request, env) {
  try {
    let users = [];
    let cursor = "";
    do {
      const data = await slackApi("users.list", { limit: "200", cursor }, env);
      if (!data.ok) throw new Error("users.list: " + data.error);
      users = users.concat((data.members || []).filter(u => !u.is_bot && !u.deleted && u.id !== "USLACKBOT"));
      cursor = (data.response_metadata && data.response_metadata.next_cursor) || "";
    } while (cursor);
    return new Response(JSON.stringify({
      ok: true,
      users: users.map(u => ({ id: u.id, name: u.profile.display_name || u.real_name || u.name }))
    }), { headers: { ...corsHeaders(), "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 502,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  }
}

async function handleBackfill(request, env) {
  const summary = { channels: 0, messagesSaved: 0, errors: [] };
  try {
    const channels = await listBotChannels(env);

    for (const channel of channels) {
      summary.channels++;
      let histCursor = "";
      let fetchedForThisChannel = 0;
      do {
        const hist = await slackApi("conversations.history", {
          channel: channel.id,
          limit: "200",
          cursor: histCursor
        }, env);
        if (!hist.ok) { summary.errors.push(`history ${channel.name}: ${hist.error}`); break; }

        const rows = [];
        for (const msg of hist.messages || []) {
          if (msg.subtype || msg.type !== "message") continue;
          const [userName, resolvedText] = await Promise.all([
            resolveUserName(msg.user, env),
            resolveMentionsInText(msg.text, env)
          ]);
          const finalUserName = userName || msg.username || (msg.bot_profile && msg.bot_profile.name) || (msg.bot_id ? "WPF Dashboard Bot" : null);
          rows.push({
            channel: channel.id,
            channel_name: channel.name,
            user_id: msg.user || msg.bot_id || null,
            user_name: finalUserName,
            text: resolvedText || "",
            ts: msg.ts,
            thread_ts: msg.thread_ts || null,
            workspace: env.WORKSPACE_ID || "default",
            inserted_at: new Date().toISOString()
          });

          if (msg.reply_count > 0) {
            try {
              const replies = await slackApi("conversations.replies", { channel: channel.id, ts: msg.ts, limit: "200" }, env);
              if (replies.ok) {
                for (const reply of replies.messages || []) {
                  if (reply.ts === msg.ts || reply.subtype || reply.type !== "message") continue;
                  const [replyUserName, replyText] = await Promise.all([
                    resolveUserName(reply.user, env),
                    resolveMentionsInText(reply.text, env)
                  ]);
                  const replyFinalName = replyUserName || reply.username || (reply.bot_profile && reply.bot_profile.name) || (reply.bot_id ? "WPF Dashboard Bot" : null);
                  rows.push({
                    channel: channel.id,
                    channel_name: channel.name,
                    user_id: reply.user || reply.bot_id || null,
                    user_name: replyFinalName,
                    text: replyText || "",
                    ts: reply.ts,
                    thread_ts: reply.thread_ts || msg.ts,
                    workspace: env.WORKSPACE_ID || "default",
                    inserted_at: new Date().toISOString()
                  });
                }
              }
            } catch (err) {
              console.log("conversations.replies failed for", msg.ts, String(err));
            }
          }
        }
        if (rows.length) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/wpf_slack_messages?on_conflict=channel,ts`, {
            method: "POST",
            headers: {
              "apikey": env.SUPABASE_SERVICE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/json",
              "Prefer": "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify(rows)
          });
          summary.messagesSaved += rows.length;
        }
        fetchedForThisChannel += (hist.messages || []).length;
        histCursor = (hist.has_more && hist.response_metadata) ? hist.response_metadata.next_cursor : "";
      } while (histCursor && fetchedForThisChannel < 1000);
    }
  } catch (err) {
    summary.errors.push(String(err));
  }
  return new Response(JSON.stringify({ ok: summary.errors.length === 0, ...summary }), {
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

// Exportado só pros testes.
export const _teste = { temAcesso, verifySlackSignature };
