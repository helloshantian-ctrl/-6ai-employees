// Thin Supabase REST client (no SDK, no deps).
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE from env. The service role key is
// required because all ingest/digest endpoints run server-side under cron auth.

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;

function ensureConfigured() {
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set");
  }
}

async function request(path, { method = "GET", query = {}, body, headers = {} } = {}) {
  ensureConfigured();
  const qs = new URLSearchParams(query).toString();
  const fullUrl = `${url}/rest/v1/${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(fullUrl, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: headers.Prefer || "return=representation",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new Error(`Supabase ${method} ${path} → ${res.status}: ${parsed?.message || text}`);
    err.status = res.status;
    err.details = parsed;
    throw err;
  }
  return parsed;
}

function safeJson(t) { try { return JSON.parse(t); } catch { return t; } }

// PostgREST-style filters helper.
// where({ id: 'eq.123', status: 'in.(a,b)' }) => { id: 'eq.123', status: 'in.(a,b)' }
const db = {
  select(table, { where = {}, order, limit, select = "*" } = {}) {
    const query = { select, ...where };
    if (order) query.order = order;
    if (limit) query.limit = String(limit);
    return request(table, { query });
  },
  insert(table, rows, { onConflict, returning = true } = {}) {
    const query = {};
    if (onConflict) query.on_conflict = onConflict;
    return request(table, {
      method: "POST",
      query,
      body: rows,
      headers: {
        Prefer: [
          returning ? "return=representation" : "return=minimal",
          onConflict ? "resolution=merge-duplicates" : null,
        ].filter(Boolean).join(","),
      },
    });
  },
  update(table, patch, { where = {} } = {}) {
    return request(table, { method: "PATCH", query: where, body: patch });
  },
  delete(table, { where = {} } = {}) {
    return request(table, { method: "DELETE", query: where });
  },
  raw: request,
};

module.exports = { db, request };
