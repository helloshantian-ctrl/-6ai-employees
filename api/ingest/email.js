// POST /api/ingest/email
//
// Receives an inbound newsletter email and turns it into an article.
//
// Supported payload shapes:
//   - Resend Inbound webhook  (https://resend.com/docs/inbound)
//   - Postmark Inbound        (https://postmarkapp.com/developer/user-guide/inbound)
//   - Generic JSON: { from, subject, html, text, received_at }
//
// Auth: header `x-admin-token` OR `RESEND_INBOUND_SECRET` query token.

const { db } = require("../../lib/supabase");
const { normalize, htmlToText } = require("../../lib/article");
const { classify } = require("../../lib/topic");
const { checkAdmin, checkCron } = require("../../lib/auth");
const { readJsonBody, ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["POST"]))) return;
  const q = parseQuery(req);
  const inboundSecret = process.env.RESEND_INBOUND_SECRET;
  const tokenOk =
    checkAdmin(req) ||
    checkCron(req) ||
    (inboundSecret && q.token === inboundSecret);
  if (!tokenOk) return fail(res, 401, "unauthorized");

  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.message); }

  const parsed = adaptPayload(body);
  if (!parsed.html && !parsed.text) return fail(res, 400, "no email content");

  // Find/auto-create the matching source by sender address.
  const source = await ensureEmailSource(parsed.from);

  const article = normalize({
    source_id: source.id,
    external_id: parsed.messageId || null,
    url: extractCanonicalLink(parsed.html),
    title: parsed.subject || "(no subject)",
    author: parsed.fromName || parsed.from,
    published_at: parsed.receivedAt || new Date().toISOString(),
    raw_html: parsed.html || null,
    content_text: parsed.text || htmlToText(parsed.html),
    topics: classify(`${parsed.subject}\n${parsed.text || htmlToText(parsed.html)}`),
    metadata: { from: parsed.from, subject: parsed.subject },
  });

  try {
    const inserted = await db.insert("articles", [article], { onConflict: "content_hash" });
    return ok(res, { ok: true, article: inserted[0], source });
  } catch (e) {
    // dedupe → unique violation is fine
    if (String(e.message).includes("duplicate")) return ok(res, { ok: true, deduped: true });
    return fail(res, 500, e.message);
  }
};

function adaptPayload(b) {
  // Resend Inbound: { from: {address,name}, to, subject, html, text, headers, received_at, ... }
  if (b?.from && typeof b.from === "object" && (b.html || b.text)) {
    return {
      from: b.from.address || b.from.email,
      fromName: b.from.name,
      subject: b.subject,
      html: b.html,
      text: b.text,
      messageId: b.message_id || b.id,
      receivedAt: b.received_at || b.created_at,
    };
  }
  // Postmark: { From, Subject, HtmlBody, TextBody, MessageID, Date }
  if (b?.HtmlBody || b?.TextBody) {
    return {
      from: b.From,
      fromName: b.FromName,
      subject: b.Subject,
      html: b.HtmlBody,
      text: b.TextBody,
      messageId: b.MessageID,
      receivedAt: b.Date,
    };
  }
  // Generic
  return {
    from: b.from,
    fromName: b.fromName,
    subject: b.subject,
    html: b.html,
    text: b.text,
    messageId: b.message_id || b.id,
    receivedAt: b.received_at || b.date,
  };
}

function extractCanonicalLink(html) {
  if (!html) return null;
  // Newsletters often include a "View in browser" link first.
  const m = html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*(?:View|Read|Open)[^<]*<\/a>/i);
  if (m) return m[1];
  const any = html.match(/<a[^>]+href="(https?:\/\/[^"]+)"/i);
  return any ? any[1] : null;
}

async function ensureEmailSource(fromAddress) {
  if (!fromAddress) fromAddress = "unknown@unknown";
  const existing = await db.select("sources", {
    where: { type: "eq.email", url: `eq.mailto:${fromAddress}` }, limit: 1,
  });
  if (existing[0]) return existing[0];
  const vendor = guessVendor(fromAddress);
  const inserted = await db.insert("sources", [{
    type: "email",
    name: `Email: ${fromAddress}`,
    vendor,
    url: `mailto:${fromAddress}`,
    config: { from: fromAddress },
    topics: [],
    is_active: true,
  }]);
  return inserted[0];
}

function guessVendor(addr) {
  const a = (addr || "").toLowerCase();
  if (a.includes("wsj.com")) return "wsj";
  if (a.includes("theinformation.com")) return "theinformation";
  if (a.includes("bloomberg")) return "bloomberg";
  if (a.includes("nytimes")) return "nytimes";
  if (a.includes("ft.com")) return "ft";
  return "custom";
}
