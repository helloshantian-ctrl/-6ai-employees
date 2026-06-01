// GET /api/digest/list?user_id=...&limit=10

const { db } = require("../../lib/supabase");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET"]))) return;
  const q = parseQuery(req);
  const where = {};
  if (q.user_id) where.user_id = `eq.${q.user_id}`;
  const limit = Math.min(Number(q.limit) || 20, 100);
  try {
    const digests = await db.select("digests", { where, order: "created_at.desc", limit });
    return ok(res, { digests });
  } catch (e) { return fail(res, 500, e.message); }
};
