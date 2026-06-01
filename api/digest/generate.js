// POST or GET /api/digest/generate?user_id=...   (or all due users)
//
// For each user:
//   1. read preferences
//   2. pick top-N recent articles matching topics & source filters
//   3. ensure each has a summary in user's chosen style/language
//   4. compose body_md + create digest row (status='ready')

const { db } = require("../../lib/supabase");
const { summarizeArticle, composeDigest } = require("../../lib/summarize");
const { requireAdminOrCron } = require("../../lib/auth");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

const FREQ_HOURS = { realtime: 1, hourly: 1, daily: 24, weekly: 24 * 7 };

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET", "POST"]))) return;
  if (!requireAdminOrCron(req, res)) return;
  const q = parseQuery(req);

  let users;
  if (q.user_id) {
    users = await db.select("users", { where: { id: `eq.${q.user_id}`, is_active: "eq.true" }, limit: 1 });
  } else {
    users = await db.select("users", { where: { is_active: "eq.true" }, limit: 500 });
  }

  const results = [];
  for (const user of users) {
    try {
      const digest = await generateForUser(user, { force: q.force === "true" });
      if (digest) results.push({ user_id: user.id, digest_id: digest.id, count: digest.article_ids.length });
      else results.push({ user_id: user.id, skipped: true });
    } catch (e) {
      results.push({ user_id: user.id, error: e.message });
    }
  }
  return ok(res, { generated: results.filter(r => r.digest_id).length, results });
};

async function generateForUser(user, { force = false }) {
  const [prefs] = await db.select("user_preferences", { where: { user_id: `eq.${user.id}` }, limit: 1 });
  const p = prefs || defaults();

  // Has a digest been generated within the frequency window?
  if (!force) {
    const windowHours = FREQ_HOURS[p.digest_frequency] || 24;
    const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
    const recent = await db.select("digests", {
      where: { user_id: `eq.${user.id}`, created_at: `gte.${since}` }, limit: 1,
    });
    if (recent[0]) return null;
  }

  // Pull recent articles, then filter in JS by topics + source whitelist.
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const where = { ingested_at: `gte.${since}` };
  if (p.source_ids?.length) where.source_id = `in.(${p.source_ids.join(",")})`;
  const pool = await db.select("articles", {
    where,
    order: "published_at.desc.nullslast,ingested_at.desc",
    limit: 200,
  });

  const excluded = new Set(p.exclude_source_ids || []);
  const topics = (p.topics || []).map(t => t.toLowerCase());
  const filtered = pool.filter(a => {
    if (excluded.has(a.source_id)) return false;
    if (topics.length === 0) return true;
    const at = (a.topics || []).map(t => t.toLowerCase());
    return at.some(t => topics.includes(t));
  });

  const top = filtered.slice(0, p.max_items || 12);
  if (top.length === 0) return null;

  const summaries = [];
  for (const a of top) {
    try {
      const s = await summarizeArticle({
        article: a,
        style: p.summary_style || "briefing",
        language: p.summary_language || "zh-CN",
      });
      summaries.push(s);
    } catch (e) {
      // Don't fail the whole digest if one article fails.
      summaries.push({ article_id: a.id, title_cn: a.title, bullets: [], one_liner: `(摘要生成失败: ${e.message})` });
    }
  }

  const body_md = await composeDigest({ user, prefs: p, summaries, articles: top });
  const now = new Date();
  const period_start = new Date(now.getTime() - (FREQ_HOURS[p.digest_frequency] || 24) * 3600 * 1000).toISOString();
  const [digest] = await db.insert("digests", [{
    user_id: user.id,
    period_start,
    period_end: now.toISOString(),
    title: `${(user.name || user.email.split("@")[0])} 的 AI 简报 · ${now.toLocaleDateString("zh-CN")}`,
    body_md,
    article_ids: top.map(a => a.id),
    status: "ready",
  }]);
  return digest;
}

function defaults() {
  return {
    topics: [], source_ids: [], exclude_source_ids: [],
    summary_style: "briefing", summary_language: "zh-CN",
    digest_frequency: "daily", send_hour_local: 8, max_items: 12,
  };
}
