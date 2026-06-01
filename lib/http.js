// Small helpers shared by all /api handlers.

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 1_000_000) reject(new Error("body too large")); });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function parseQuery(req) {
  // Vercel exposes req.query; for the local test-server we need to parse it.
  if (req.query && typeof req.query === "object") return req.query;
  const i = (req.url || "").indexOf("?");
  if (i < 0) return {};
  const qs = req.url.slice(i + 1);
  const out = {};
  for (const part of qs.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

function corsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-access-code, x-admin-token, x-cron-secret, authorization");
}

function ok(res, data, status = 200) {
  corsHeaders(res);
  res.status(status).json(data);
}

function fail(res, status, message, extra = {}) {
  corsHeaders(res);
  res.status(status).json({ error: message, ...extra });
}

async function methodGuard(req, res, allowed) {
  corsHeaders(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return false; }
  if (!allowed.includes(req.method)) { fail(res, 405, "method not allowed"); return false; }
  return true;
}

module.exports = { readJsonBody, parseQuery, ok, fail, methodGuard, corsHeaders };
