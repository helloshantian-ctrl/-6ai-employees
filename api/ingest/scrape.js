// POST /api/ingest/scrape?source_id=...
//
// Hands off to an external Playwright/Browserless worker. The worker should
// log into the publisher with stored credentials, return JSON:
//   { items: [{ url, title, author, published_at, html, text }] }
//
// If SCRAPE_WORKER_URL is not configured, the endpoint is a stub that returns
// 501 so the rest of the pipeline can still run.

const { db } = require("../../lib/supabase");
const { normalize } = require("../../lib/article");
const { classify } = require("../../lib/topic");
const { requireAdminOrCron } = require("../../lib/auth");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET", "POST"]))) return;
  if (!requireAdminOrCron(req, res)) return;
  const q = parseQuery(req);

  const workerUrl = process.env.SCRAPE_WORKER_URL;
  const workerToken = process.env.SCRAPE_WORKER_TOKEN;
  if (!workerUrl) return fail(res, 501, "SCRAPE_WORKER_URL not configured");

  let sources;
  if (q.source_id) {
    sources = await db.select("sources", { where: { id: `eq.${q.source_id}`, type: "eq.scrape" }, limit: 1 });
  } else {
    sources = await db.select("sources", { where: { type: "eq.scrape", is_active: "eq.true" }, limit: 50 });
  }

  const results = [];
  for (const source of sources) {
    try {
      const r = await fetch(`${workerUrl}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${workerToken}` },
        body: JSON.stringify({ source }),
      });
      if (!r.ok) throw new Error(`worker ${r.status}: ${await r.text()}`);
      const { items = [] } = await r.json();
      let inserted = 0;
      for (const it of items) {
        const row = normalize({
          source_id: source.id,
          external_id: it.id || it.url,
          url: it.url,
          title: it.title,
          author: it.author,
          published_at: it.published_at,
          raw_html: it.html,
          content_text: it.text || it.html,
          topics: [...(source.topics || []), ...classify(`${it.title}\n${it.text || ""}`)],
          metadata: it.metadata || {},
        });
        try {
          await db.insert("articles", [row], { onConflict: "content_hash", returning: false });
          inserted++;
        } catch (e) { if (!String(e.message).includes("duplicate")) throw e; }
      }
      await db.update("sources", { last_polled_at: new Date().toISOString(), last_status: "ok", last_error: null }, { where: { id: `eq.${source.id}` } });
      results.push({ source_id: source.id, found: items.length, inserted });
    } catch (e) {
      await db.update("sources", { last_polled_at: new Date().toISOString(), last_status: "failed", last_error: e.message }, { where: { id: `eq.${source.id}` } });
      results.push({ source_id: source.id, error: e.message });
    }
  }
  return ok(res, { polled: results.length, results });
};
