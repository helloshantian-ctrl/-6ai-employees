// Zero-config demo server.
// Run: `node demo/server.js` → open http://localhost:3000/dashboard.html
//
// Stores everything in memory (seeded with realistic mock data).
// If ANTHROPIC_API_KEY is set, /api/digest/generate calls Claude for real;
// otherwise it falls back to the pre-baked summaries in seed-data.js.
//
// No Supabase, no Vercel, no env vars required.

const http = require("http");
const fs = require("fs");
const path = require("path");

const seed = require("./seed-data");
const { parse: parseFeed } = require("../lib/feed-parser");
const { normalize, htmlToText } = require("../lib/article");
const { classify } = require("../lib/topic");

const PORT = process.env.PORT || 3000;

// ===== In-memory "DB" =====
const db = {
  sources: [...seed.sources],
  articles: [...seed.articles],
  summaries: [...seed.summaries],
  users: [...seed.users],
  preferences: [...seed.preferences],
  delivery_targets: [...seed.delivery_targets],
  digests: [...seed.digests],
  deliveries: [],
  ingest_jobs: [],
};

// ===== Routing =====
const routes = {
  "GET /api/articles/list": handleArticlesList,
  "GET /api/articles/get": handleArticleGet,
  "GET /api/sources/list": handleSourcesList,
  "POST /api/sources/upsert": handleSourceUpsert,
  "GET /api/users/list": handleUsersList,
  "POST /api/users/upsert": handleUserUpsert,
  "GET /api/digest/list": handleDigestList,
  "POST /api/digest/generate": handleDigestGenerate,
  "POST /api/digest/send": handleDigestSend,
  "POST /api/summarize/run": handleSummarizeRun,
  "POST /api/ingest/rss": handleIngestRss,
  "POST /api/ingest/api-import": handleApiImport,
  "POST /api/cron/tick": handleCronTick,
  "GET /api/_state": handleState,
  "POST /api/_reset": handleReset,
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token, authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  const [pathname, qs] = (req.url || "/").split("?");
  const query = parseQuery(qs || "");

  // API routing
  const key = `${req.method} ${pathname}`;
  if (routes[key]) {
    try {
      const body = await readBody(req);
      const result = await routes[key]({ query, body });
      res.writeHead(result.status || 200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result.data));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: e.message, stack: e.stack }));
    }
  }

  // Static files
  let filePath = pathname === "/" ? "/dashboard.html" : pathname;
  const fp = path.join(__dirname, "..", "public", filePath);
  if (!fp.startsWith(path.join(__dirname, "..", "public"))) {
    res.writeHead(403); return res.end("forbidden");
  }
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found: " + filePath);
    }
    const ext = path.extname(fp);
    const mime = { ".html":"text/html; charset=utf-8", ".css":"text/css", ".js":"application/javascript", ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon" }[ext] || "text/plain";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const haveKey = !!process.env.ANTHROPIC_API_KEY;
  console.log("");
  console.log("  📰 AI Briefing — DEMO server");
  console.log("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  🌐 Dashboard:  http://localhost:${PORT}/dashboard.html`);
  console.log(`  ⚙️  Admin:      http://localhost:${PORT}/admin.html  (no token needed in demo)`);
  console.log(`  💬 Chat:       http://localhost:${PORT}/index.html  (needs ANTHROPIC_API_KEY)`);
  console.log("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  📊 Seeded:     ${db.articles.length} articles · ${db.summaries.length} summaries · ${db.users.length} users · ${db.digests.length} digest`);
  console.log(`  🧠 AI:         ${haveKey ? "Claude API connected" : "mock summaries (set ANTHROPIC_API_KEY for real AI)"}`);
  console.log("");
  console.log("  Try in browser:");
  console.log(`    • /dashboard.html → 看文章流 + 我的简报`);
  console.log(`    • /admin.html → 点 \"🌀 跑完整流水线\" 触发演示`);
  console.log("");
});

// ===== Handlers =====
function handleArticlesList({ query }) {
  let arr = db.articles.slice();
  if (query.topic) arr = arr.filter(a => (a.topics || []).includes(query.topic));
  if (query.source_id) arr = arr.filter(a => a.source_id === query.source_id);
  if (query.q) arr = arr.filter(a => (a.title || "").toLowerCase().includes(query.q.toLowerCase()));
  arr.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
  const limit = Math.min(Number(query.limit) || 30, 200);
  arr = arr.slice(0, limit);
  const summaries = {};
  for (const a of arr) {
    const s = db.summaries.find(x => x.article_id === a.id && x.style === (query.style || "briefing"));
    if (s) summaries[a.id] = s;
  }
  return { data: { articles: arr, summaries } };
}

function handleArticleGet({ query }) {
  const article = db.articles.find(a => a.id === query.id);
  if (!article) return { status: 404, data: { error: "not found" } };
  const summaries = db.summaries.filter(s => s.article_id === query.id);
  return { data: { article, summaries } };
}

function handleSourcesList() { return { data: { sources: db.sources } }; }
function handleSourceUpsert({ body }) {
  if (!body.type || !body.name) return { status: 400, data: { error: "type + name required" } };
  if (body.id) {
    const idx = db.sources.findIndex(s => s.id === body.id);
    if (idx >= 0) { db.sources[idx] = { ...db.sources[idx], ...body }; return { data: { source: db.sources[idx] } }; }
  }
  const row = { id: "src-" + Math.random().toString(36).slice(2, 8), is_active: true, ...body };
  db.sources.push(row);
  return { data: { source: row } };
}

function handleUsersList() { return { data: { users: db.users } }; }
function handleUserUpsert({ body }) {
  if (!body.email) return { status: 400, data: { error: "email required" } };
  let user = db.users.find(u => u.email === body.email);
  if (!user) {
    user = { id: "u-" + Math.random().toString(36).slice(2, 8), is_active: true, ...body };
    db.users.push(user);
  } else {
    Object.assign(user, body);
  }
  if (body.preferences) {
    const idx = db.preferences.findIndex(p => p.user_id === user.id);
    const row = { ...body.preferences, user_id: user.id };
    if (idx >= 0) db.preferences[idx] = row; else db.preferences.push(row);
  }
  if (Array.isArray(body.delivery_targets)) {
    db.delivery_targets = db.delivery_targets.filter(t => t.user_id !== user.id);
    for (const t of body.delivery_targets) {
      db.delivery_targets.push({ id: "t-" + Math.random().toString(36).slice(2, 8), user_id: user.id, is_active: true, ...t });
    }
  }
  return { data: { user, preferences: db.preferences.find(p => p.user_id === user.id), delivery_targets: db.delivery_targets.filter(t => t.user_id === user.id) } };
}

function handleDigestList({ query }) {
  let arr = db.digests.slice();
  if (query.user_id) arr = arr.filter(d => d.user_id === query.user_id);
  arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { data: { digests: arr.slice(0, Number(query.limit) || 20) } };
}

async function handleDigestGenerate({ query }) {
  const userId = query.user_id || "u-demo";
  const user = db.users.find(u => u.id === userId);
  if (!user) return { status: 404, data: { error: "user not found" } };
  const prefs = db.preferences.find(p => p.user_id === userId) || { topics: [], summary_style: "briefing", summary_language: "zh-CN", max_items: 10 };

  let pool = db.articles.slice();
  if (prefs.topics?.length) {
    const want = prefs.topics.map(t => t.toLowerCase());
    pool = pool.filter(a => (a.topics || []).some(t => want.includes(t.toLowerCase())));
  }
  pool.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
  const top = pool.slice(0, prefs.max_items || 10);

  // Ensure each article has a summary; call Claude if key is set, else reuse seeded.
  const sums = [];
  for (const a of top) {
    let s = db.summaries.find(x => x.article_id === a.id && x.style === prefs.summary_style && x.language === prefs.summary_language);
    if (!s && process.env.ANTHROPIC_API_KEY) {
      try {
        s = await callClaudeForSummary(a, prefs);
        db.summaries.push(s);
      } catch (e) {
        s = { article_id: a.id, title_cn: a.title, one_liner: "(摘要失败: " + e.message + ")", bullets: [] };
      }
    } else if (!s) {
      s = { article_id: a.id, title_cn: a.title, one_liner: "(无摘要)", bullets: [] };
    }
    sums.push(s);
  }

  const body_md = composeDigest(user, sums, top);
  const digest = {
    id: "d-" + Math.random().toString(36).slice(2, 8),
    user_id: userId,
    period_start: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    period_end: new Date().toISOString(),
    created_at: new Date().toISOString(),
    title: `${user.name || user.email} 的 AI 简报 · ${new Date().toLocaleDateString("zh-CN")}`,
    article_ids: top.map(a => a.id),
    body_md,
    status: "ready",
  };
  db.digests.unshift(digest);
  return { data: { digest, count: top.length } };
}

function handleDigestSend({ query }) {
  let digests = db.digests.filter(d => d.status === "ready");
  if (query.digest_id) digests = digests.filter(d => d.id === query.digest_id);
  const results = [];
  for (const digest of digests) {
    const targets = db.delivery_targets.filter(t => t.user_id === digest.user_id && t.is_active);
    for (const t of targets) {
      const delivery = { id: "dlv-" + Math.random().toString(36).slice(2, 8), digest_id: digest.id, target_id: t.id, channel: t.channel, status: "sent", sent_at: new Date().toISOString() };
      db.deliveries.push(delivery);
      results.push({ digest_id: digest.id, channel: t.channel, ok: true, mode: "demo-no-op" });
    }
    digest.status = "sent";
  }
  return { data: { processed: digests.length, results, note: "demo mode — no actual webhook calls made" } };
}

async function handleSummarizeRun({ query }) {
  const limit = Math.min(Number(query.limit) || 5, 20);
  const haveKey = !!process.env.ANTHROPIC_API_KEY;
  const need = db.articles
    .filter(a => !db.summaries.find(s => s.article_id === a.id && s.style === "briefing"))
    .slice(0, limit);
  const out = [];
  for (const a of need) {
    if (haveKey) {
      try { const s = await callClaudeForSummary(a, { summary_style: "briefing", summary_language: "zh-CN" }); db.summaries.push(s); out.push({ article_id: a.id, ok: true }); }
      catch (e) { out.push({ article_id: a.id, ok: false, error: e.message }); }
    } else {
      const stub = { article_id: a.id, style: "briefing", language: "zh-CN", title_cn: a.title, one_liner: "(demo 模式，无 ANTHROPIC_API_KEY)", bullets: [], body_md: "" };
      db.summaries.push(stub);
      out.push({ article_id: a.id, ok: true, mode: "mock" });
    }
  }
  return { data: { processed: out.length, results: out, note: haveKey ? "called Claude" : "mock summaries — set ANTHROPIC_API_KEY for real AI" } };
}

async function handleIngestRss({ query }) {
  // Demo trick: pull a real free RSS feed (Hacker News front page) so users see
  // the ingest pipeline actually fetching from the internet.
  const url = query.url || "https://hnrss.org/frontpage";
  try {
    const r = await fetch(url, { headers: { "User-Agent": "AI Briefing Demo" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const xml = await r.text();
    const feed = parseFeed(xml);
    let inserted = 0;
    for (const it of feed.items.slice(0, 10)) {
      const text = htmlToText(it.content) || it.title;
      const row = normalize({
        source_id: "src-rss-demo",
        external_id: it.guid || it.link,
        url: it.link, title: it.title, author: it.author,
        published_at: it.pubDate, raw_html: it.content, content_text: text,
        topics: classify(`${it.title}\n${text}`),
      });
      if (!db.articles.find(a => a.content_hash === row.content_hash)) {
        db.articles.unshift({ id: "a-" + Math.random().toString(36).slice(2, 8), ingested_at: new Date().toISOString(), ...row });
        inserted++;
      }
    }
    if (!db.sources.find(s => s.id === "src-rss-demo")) {
      db.sources.push({ id: "src-rss-demo", type: "rss", vendor: "hackernews", name: "Hacker News Front Page (demo live)", url, topics: ["tech","startup"], is_active: true, last_status: "ok", last_polled_at: new Date().toISOString() });
    }
    return { data: { ok: true, source: url, found: feed.items.length, inserted } };
  } catch (e) { return { status: 500, data: { error: e.message } }; }
}

function handleApiImport({ body }) {
  if (!Array.isArray(body.items)) return { status: 400, data: { error: "items required" } };
  let inserted = 0;
  for (const it of body.items) {
    const row = normalize({
      source_id: body.source_id || "src-api",
      url: it.url, title: it.title, author: it.author,
      published_at: it.published_at, content_text: it.text || it.html || it.title,
      topics: it.topics?.length ? it.topics : classify(`${it.title}\n${it.text || ""}`),
    });
    if (!db.articles.find(a => a.content_hash === row.content_hash)) {
      db.articles.unshift({ id: "a-" + Math.random().toString(36).slice(2, 8), ingested_at: new Date().toISOString(), ...row });
      inserted++;
    }
  }
  return { data: { ok: true, total: body.items.length, inserted } };
}

async function handleCronTick({ query }) {
  const log = [];
  const stage = query.stage || "all";
  if (stage === "ingest" || stage === "all") log.push(["ingest.rss", await handleIngestRss({ query: {} })]);
  if (stage === "summarize" || stage === "all") log.push(["summarize", await handleSummarizeRun({ query: { limit: 5 } })]);
  if (stage === "digest" || stage === "all") {
    log.push(["digest.generate", await handleDigestGenerate({ query: {} })]);
    log.push(["digest.send", handleDigestSend({ query: {} })]);
  }
  return { data: { stage, log } };
}

function handleState() {
  return { data: {
    counts: {
      sources: db.sources.length, articles: db.articles.length, summaries: db.summaries.length,
      users: db.users.length, digests: db.digests.length, deliveries: db.deliveries.length,
    },
  } };
}

function handleReset() {
  db.sources = [...seed.sources];
  db.articles = [...seed.articles];
  db.summaries = [...seed.summaries];
  db.users = [...seed.users];
  db.preferences = [...seed.preferences];
  db.delivery_targets = [...seed.delivery_targets];
  db.digests = [...seed.digests];
  db.deliveries = [];
  return { data: { ok: true } };
}

// ===== Claude call (only used when ANTHROPIC_API_KEY is set) =====
async function callClaudeForSummary(article, prefs) {
  const sys = "你是高端财经/科技简报编辑。把英文原文精炼为中文要点简报。请以严格 JSON 输出: {\"title_cn\":\"...\",\"one_liner\":\"...\",\"bullets\":[\"...\"],\"body_md\":\"...\"} 无 markdown 包裹。";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: sys,
      messages: [{ role: "user", content: `标题: ${article.title}\n作者: ${article.author||"-"}\n正文:\n${(article.content_text||"").slice(0, 8000)}` }],
    }),
  });
  if (!res.ok) throw new Error("Anthropic " + res.status);
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error("no JSON in response");
  const parsed = JSON.parse(m[0]);
  return {
    article_id: article.id, style: prefs.summary_style || "briefing", language: prefs.summary_language || "zh-CN",
    title_cn: parsed.title_cn, one_liner: parsed.one_liner, bullets: parsed.bullets || [], body_md: parsed.body_md || "",
  };
}

function composeDigest(user, summaries, articles) {
  const lines = [`# ${user.name || user.email.split("@")[0]} 的 AI 简报`, "", `*${new Date().toLocaleDateString("zh-CN")} · ${summaries.length} 条精选*`, ""];
  const byId = Object.fromEntries(articles.map(a => [a.id, a]));
  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i]; const a = byId[s.article_id] || {};
    lines.push(`## ${i + 1}. ${s.title_cn || a.title}`);
    if (s.one_liner) lines.push(`> ${s.one_liner}`, "");
    if (Array.isArray(s.bullets)) for (const b of s.bullets) lines.push(`- ${b}`);
    lines.push("");
    const meta = [a.author, a.published_at && new Date(a.published_at).toLocaleDateString("zh-CN"), a.url && `[原文](${a.url})`].filter(Boolean);
    if (meta.length) lines.push(`*${meta.join(" · ")}*`, "");
    lines.push("---", "");
  }
  return lines.join("\n");
}

// ===== utils =====
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === "GET") return resolve({});
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 1_000_000) reject(new Error("too large")); });
    req.on("end", () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on("error", reject);
  });
}
function parseQuery(qs) {
  const out = {}; if (!qs) return out;
  for (const part of qs.split("&")) { const [k, v=""] = part.split("="); out[decodeURIComponent(k)] = decodeURIComponent(v); }
  return out;
}
