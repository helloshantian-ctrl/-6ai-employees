// POST /api/summarize/run?limit=10&style=briefing
//
// Picks recent un-summarized articles and runs Claude on each. Cron-friendly.

const { db } = require("../../lib/supabase");
const { summarizeArticle } = require("../../lib/summarize");
const { requireAdminOrCron } = require("../../lib/auth");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET", "POST"]))) return;
  if (!requireAdminOrCron(req, res)) return;

  const q = parseQuery(req);
  const limit = Math.min(Number(q.limit) || 8, 30);
  const style = q.style || "briefing";
  const language = q.language || "zh-CN";

  // Naive query: take recent articles that don't yet have a summary in this style.
  // (For larger volume, swap to an indexed `to_summarize` flag.)
  const articles = await db.select("articles", {
    order: "ingested_at.desc",
    limit: limit * 4, // overscan
  });

  const out = [];
  for (const a of articles) {
    if (out.length >= limit) break;
    const existing = await db.select("summaries", {
      where: { article_id: `eq.${a.id}`, style: `eq.${style}`, language: `eq.${language}` }, limit: 1,
    });
    if (existing[0]) continue;
    try {
      const s = await summarizeArticle({ article: a, style, language });
      out.push({ article_id: a.id, summary_id: s.id });
    } catch (e) {
      out.push({ article_id: a.id, error: e.message });
    }
  }
  return ok(res, { processed: out.length, results: out });
};
