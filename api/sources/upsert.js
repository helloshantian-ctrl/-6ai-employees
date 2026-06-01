// POST /api/sources/upsert
// Body: { id?, type, name, vendor?, url?, config?, topics?, poll_interval_minutes?, is_active? }
// Returns the saved row.

const { db } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/auth");
const { readJsonBody, ok, fail, methodGuard } = require("../../lib/http");

const TYPES = new Set(["email", "rss", "api", "scrape"]);

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["POST"]))) return;
  if (!requireAdmin(req, res)) return;
  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.message); }

  if (!body.type || !TYPES.has(body.type)) return fail(res, 400, "type must be one of " + [...TYPES]);
  if (!body.name) return fail(res, 400, "name required");

  const row = {
    type: body.type,
    name: body.name,
    vendor: body.vendor || null,
    url: body.url || null,
    config: body.config || {},
    topics: body.topics || [],
    poll_interval_minutes: body.poll_interval_minutes || 60,
    is_active: body.is_active !== false,
  };

  try {
    if (body.id) {
      const updated = await db.update("sources", row, { where: { id: `eq.${body.id}` } });
      return ok(res, { source: updated[0] });
    }
    const inserted = await db.insert("sources", [row]);
    return ok(res, { source: inserted[0] });
  } catch (e) { return fail(res, 500, e.message); }
};
