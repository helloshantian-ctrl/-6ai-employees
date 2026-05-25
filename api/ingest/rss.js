// POST or GET /api/ingest/rss?source_id=...    (specific source)
// POST or GET /api/ingest/rss                  (all due active RSS sources)
//
// For paid feeds, store the cookie / Basic auth in source.config:
//   { cookie: "ti_sess=...", auth: { user, pass }, headers: { ... } }

const { db } = require("../../lib/supabase");
const { parse } = require("../../lib/feed-parser");
const { normalize, htmlToText } = require("../../lib/article");
const { classify } = require("../../lib/topic");
const { requireAdminOrCron } = require("../../lib/auth");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET", "POST"]))) return;
  if (!requireAdminOrCron(req, res)) return;
  const q = parseQuery(req);

  let sources;
  if (q.source_id) {
    sources = await db.select("sources", { where: { id: `eq.${q.source_id}`, type: "eq.rss" }, limit: 1 });
  } else {
    sources = await db.select("sources", { where: { type: "eq.rss", is_active: "eq.true" }, limit: 100 });
  }

  const results = [];
  for (const source of sources) {
    const job = await db.insert("ingest_jobs", [{ source_id: source.id, trigger: q.trigger || "cron" }]);
    const jobId = job[0].id;
    try {
      const r = await pollOne(source);
      await db.update("ingest_jobs", {
        finished_at: new Date().toISOString(),
        items_found: r.found,
        items_new: r.inserted,
        status: "ok",
      }, { where: { id: `eq.${jobId}` } });
      await db.update("sources", {
        last_polled_at: new Date().toISOString(),
        last_status: "ok",
        last_error: null,
      }, { where: { id: `eq.${source.id}` } });
      results.push({ source_id: source.id, ...r });
    } catch (e) {
      await db.update("ingest_jobs", {
        finished_at: new Date().toISOString(),
        status: "failed",
        error: e.message,
      }, { where: { id: `eq.${jobId}` } });
      await db.update("sources", {
        last_polled_at: new Date().toISOString(),
        last_status: "failed",
        last_error: e.message,
      }, { where: { id: `eq.${source.id}` } });
      results.push({ source_id: source.id, error: e.message });
    }
  }
  return ok(res, { polled: results.length, results });
};

async function pollOne(source) {
  const headers = { "User-Agent": "Mozilla/5.0 (AI Briefing Aggregator)" };
  if (source.config?.cookie) headers.Cookie = source.config.cookie;
  if (source.config?.headers) Object.assign(headers, source.config.headers);
  if (source.config?.auth?.user && source.config?.auth?.pass) {
    const b64 = Buffer.from(`${source.config.auth.user}:${source.config.auth.pass}`).toString("base64");
    headers.Authorization = `Basic ${b64}`;
  }

  const res = await fetch(source.url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source.url}`);
  const xml = await res.text();
  const feed = parse(xml);

  const max = Math.min(feed.items.length, source.config?.max_items_per_poll || 25);
  let inserted = 0;
  for (const it of feed.items.slice(0, max)) {
    const text = htmlToText(it.content) || it.title;
    const row = normalize({
      source_id: source.id,
      external_id: it.guid || it.link,
      url: it.link,
      title: it.title,
      author: it.author,
      published_at: it.pubDate,
      raw_html: it.content,
      content_text: text,
      topics: [...(source.topics || []), ...classify(`${it.title}\n${text}`)],
      metadata: { feed_title: feed.title },
    });
    try {
      await db.insert("articles", [row], { onConflict: "content_hash", returning: false });
      inserted++;
    } catch (e) {
      // ignore unique conflicts
      if (!String(e.message).includes("duplicate")) throw e;
    }
  }
  return { found: feed.items.length, inserted };
}
