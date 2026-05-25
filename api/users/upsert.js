// POST /api/users/upsert
// Body: { id?, email, name?, role?, timezone?, language?, is_active?,
//         preferences?: { topics, source_ids, summary_style, summary_language,
//                         digest_frequency, send_hour_local, max_items },
//         delivery_targets?: [{ id?, channel, label?, config, is_active? }, ...] }

const { db } = require("../../lib/supabase");
const { requireAdmin } = require("../../lib/auth");
const { readJsonBody, ok, fail, methodGuard } = require("../../lib/http");

const CHANNELS = new Set(["email", "slack", "discord", "feishu", "wecom", "web"]);

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["POST"]))) return;
  if (!requireAdmin(req, res)) return;
  let body;
  try { body = await readJsonBody(req); } catch (e) { return fail(res, 400, e.message); }

  if (!body.email) return fail(res, 400, "email required");

  const userRow = {
    email: body.email,
    name: body.name || null,
    role: body.role || "reader",
    timezone: body.timezone || "Asia/Shanghai",
    language: body.language || "zh-CN",
    is_active: body.is_active !== false,
  };

  try {
    let user;
    if (body.id) {
      const updated = await db.update("users", userRow, { where: { id: `eq.${body.id}` } });
      user = updated[0];
    } else {
      const inserted = await db.insert("users", [userRow], { onConflict: "email" });
      user = inserted[0];
    }
    if (!user) return fail(res, 500, "failed to upsert user");

    if (body.preferences) {
      const prefs = { ...body.preferences, user_id: user.id, updated_at: new Date().toISOString() };
      await db.insert("user_preferences", [prefs], { onConflict: "user_id" });
    }

    if (Array.isArray(body.delivery_targets)) {
      for (const t of body.delivery_targets) {
        if (!CHANNELS.has(t.channel)) continue;
        const row = {
          user_id: user.id,
          channel: t.channel,
          label: t.label || null,
          config: t.config || {},
          is_active: t.is_active !== false,
        };
        if (t.id) {
          await db.update("delivery_targets", row, { where: { id: `eq.${t.id}` } });
        } else {
          await db.insert("delivery_targets", [row]);
        }
      }
    }

    const targets = await db.select("delivery_targets", { where: { user_id: `eq.${user.id}` } });
    const prefs = await db.select("user_preferences", { where: { user_id: `eq.${user.id}` }, limit: 1 });
    return ok(res, { user, preferences: prefs[0] || null, delivery_targets: targets });
  } catch (e) { return fail(res, 500, e.message); }
};
