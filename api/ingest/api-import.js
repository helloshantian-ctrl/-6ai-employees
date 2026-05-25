// POST /api/ingest/api-import
//
// Manual / third-party API push endpoint. Use this when you have official
// partner data (e.g. WSJ Pro API, Bloomberg Terminal export) and want to
// drop articles directly into the platform.
//
// Body: { source_id: uuid, items: [{ external_id?, url, title, author?, published_at?, html?, text, topics? }, ...] }

const { db } = require("../../lib/supabase");
const { normalize } = require("../../lib/article");
const { classify } = require("../../lib/topic");
const { requireAdminOrCron } = require("../../lib/auth");
const { readJsonBody, ok, fail, methodGuard } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["POST"]))) return;
  if (!requireAdminOrCron(req, res)) return;
  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.message); }
  if (!body.source_id) return fail(res, 400, "source_id required");
  if (!Array.isArray(body.items) || body.items.length === 0) return fail(res, 400, "items required");

  const [source] = await db.select("sources", { where: { id: `eq.${body.source_id}` }, limit: 1 });
  if (!source) return fail(res, 404, "source not found");

  let inserted = 0;
  for (const it of body.items) {
    const row = normalize({
      source_id: source.id,
      external_id: it.external_id || it.id || null,
      url: it.url,
      title: it.title,
      author: it.author,
      published_at: it.published_at,
      raw_html: it.html,
      content_text: it.text || it.html || it.title,
      topics: it.topics?.length ? it.topics : classify(`${it.title}\n${it.text || ""}`),
      metadata: it.metadata || {},
    });
    try {
      await db.insert("articles", [row], { onConflict: "content_hash", returning: false });
      inserted++;
    } catch (e) { if (!String(e.message).includes("duplicate")) throw e; }
  }
  return ok(res, { ok: true, total: body.items.length, inserted });
};
