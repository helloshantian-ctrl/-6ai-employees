const { db } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/auth");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET"]))) return;
  if (!requireAdmin(req, res)) return;
  const q = parseQuery(req);
  const where = {};
  if (q.type) where.type = `eq.${q.type}`;
  if (q.active !== undefined) where.is_active = `eq.${q.active === "true"}`;
  try {
    const rows = await db.select("sources", { where, order: "created_at.desc", limit: Number(q.limit) || 200 });
    return ok(res, { sources: rows });
  } catch (e) { return fail(res, 500, e.message); }
};
