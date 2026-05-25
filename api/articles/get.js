// GET /api/articles/get?id=...

const { db } = require("../../lib/supabase");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET"]))) return;
  const q = parseQuery(req);
  if (!q.id) return fail(res, 400, "id required");
  try {
    const rows = await db.select("articles", { where: { id: `eq.${q.id}` }, limit: 1 });
    const article = rows[0];
    if (!article) return fail(res, 404, "not found");
    const sums = await db.select("summaries", { where: { article_id: `eq.${q.id}` } });
    return ok(res, { article, summaries: sums });
  } catch (e) { return fail(res, 500, e.message); }
};
