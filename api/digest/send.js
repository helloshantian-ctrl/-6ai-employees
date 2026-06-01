// POST or GET /api/digest/send?digest_id=...    (specific digest)
// POST or GET /api/digest/send                  (all status='ready' digests)

const { db } = require("../../lib/supabase");
const { send } = require("../../lib/deliverers");
const { requireAdminOrCron } = require("../../lib/auth");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET", "POST"]))) return;
  if (!requireAdminOrCron(req, res)) return;
  const q = parseQuery(req);

  let digests;
  if (q.digest_id) {
    digests = await db.select("digests", { where: { id: `eq.${q.digest_id}` }, limit: 1 });
  } else {
    digests = await db.select("digests", { where: { status: "eq.ready" }, order: "created_at.asc", limit: 200 });
  }

  const results = [];
  for (const digest of digests) {
    const targets = await db.select("delivery_targets", {
      where: { user_id: `eq.${digest.user_id}`, is_active: "eq.true" }, limit: 20,
    });
    if (targets.length === 0) {
      await db.update("digests", { status: "sent" }, { where: { id: `eq.${digest.id}` } });
      results.push({ digest_id: digest.id, skipped: "no targets" });
      continue;
    }

    let anyFail = false;
    for (const target of targets) {
      const [delivery] = await db.insert("deliveries", [{
        digest_id: digest.id, target_id: target.id, channel: target.channel,
      }]);
      const r = await send({ target, digest });
      await db.update("deliveries", {
        status: r.ok ? "sent" : "failed",
        response: r.response || null,
        error: r.error || null,
        sent_at: new Date().toISOString(),
      }, { where: { id: `eq.${delivery.id}` } });
      if (!r.ok) anyFail = true;
      results.push({ digest_id: digest.id, target_id: target.id, channel: target.channel, ok: r.ok, error: r.error });
    }
    await db.update("digests", { status: anyFail ? "failed" : "sent" }, { where: { id: `eq.${digest.id}` } });
  }
  return ok(res, { processed: digests.length, results });
};
