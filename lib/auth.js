// Simple token-based auth for API endpoints.
// Three roles:
//   - cron: caller is Vercel Cron (header `x-cron-secret`)
//   - admin: caller knows ADMIN_TOKEN
//   - public: no auth (only chat endpoint)
//
// User-facing dashboards re-use the existing ACCESS_PASSWORD model.

function checkCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel cron sends `Authorization: Bearer <CRON_SECRET>` when configured.
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const header = req.headers["x-cron-secret"];
  return bearer === secret || header === secret;
}

function checkAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const header = req.headers["x-admin-token"];
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return header === token || bearer === token;
}

function requireAdminOrCron(req, res) {
  if (checkAdmin(req) || checkCron(req)) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

function requireAdmin(req, res) {
  if (checkAdmin(req)) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

module.exports = { checkCron, checkAdmin, requireAdmin, requireAdminOrCron };
