// GET /api/articles/list?limit=20&since=2026-05-20&topic=ai&source_id=...
// Returns articles + their default-style summary (if cached).

const { db } = require("../../lib/supabase");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET"]))) return;
  const q = parseQuery(req);
  const limit = Math.min(Number(q.limit) || 20, 200);

  const where = {};
  if (q.source_id) where.source_id = `eq.${q.source_id}`;
  if (q.since) where.published_at = `gte.${q.since}`;
  if (q.topic) where.topics = `cs.{${q.topic}}`;       // contains
  if (q.q) where.title = `ilike.%${q.q}%`;

  try {
    const articles = await db.select("articles", {
      where,
      order: "published_at.desc.nullslast,ingested_at.desc",
      limit,
    });
    if (articles.length === 0) return ok(res, { articles: [], summaries: {} });

    const ids = articles.map(a => a.id).join(",");
    const sums = await db.select("summaries", {
      where: { article_id: `in.(${ids})`, style: `eq.${q.style || "briefing"}`, language: `eq.${q.language || "zh-CN"}` },
      limit: 500,
    });
    const byId = {};
    for (const s of sums) byId[s.article_id] = s;
    return ok(res, { articles, summaries: byId });
  } catch (e) { return fail(res, 500, e.message); }
};
