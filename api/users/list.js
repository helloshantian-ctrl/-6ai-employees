const { db } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/auth");
const { ok, fail, methodGuard } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET"]))) return;
  if (!requireAdmin(req, res)) return;
  try {
    const users = await db.select("users", { order: "created_at.desc", limit: 200 });
    return ok(res, { users });
  } catch (e) { return fail(res, 500, e.message); }
};
