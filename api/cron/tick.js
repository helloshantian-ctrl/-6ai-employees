// Master cron scheduler. Vercel Cron hits this endpoint with stages:
//   /api/cron/tick?stage=ingest      — poll RSS + scrape due sources
//   /api/cron/tick?stage=summarize   — summarize a batch of fresh articles
//   /api/cron/tick?stage=digest      — generate + send digests for users due now

const { checkCron, checkAdmin } = require("../../lib/auth");
const { ok, fail, methodGuard, parseQuery } = require("../../lib/http");

// We call sibling handlers in-process via direct require rather than HTTP.
const rss = require("../ingest/rss");
const scrape = require("../ingest/scrape");
const summarizeRun = require("../summarize/run");
const digestGenerate = require("../digest/generate");
const digestSend = require("../digest/send");

module.exports = async function handler(req, res) {
  if (!(await methodGuard(req, res, ["GET", "POST"]))) return;
  if (!checkCron(req) && !checkAdmin(req)) return fail(res, 401, "unauthorized");
  const q = parseQuery(req);
  const stage = q.stage || "all";
  const log = [];

  const captured = captureRes(res);

  if (stage === "ingest" || stage === "all") {
    await callHandler(rss, { ...req, query: { trigger: "cron" } }, captured, log, "rss");
    await callHandler(scrape, { ...req, query: { trigger: "cron" } }, captured, log, "scrape");
  }
  if (stage === "summarize" || stage === "all") {
    await callHandler(summarizeRun, { ...req, query: { limit: q.limit || "10" } }, captured, log, "summarize");
  }
  if (stage === "digest" || stage === "all") {
    await callHandler(digestGenerate, { ...req, query: {} }, captured, log, "digest.generate");
    await callHandler(digestSend, { ...req, query: {} }, captured, log, "digest.send");
  }
  return ok(res, { stage, log });
};

function captureRes() {
  // Sub-handlers call res.status().json() — we want to capture, not send.
  return {
    _payload: null,
    _status: 200,
    setHeader() {},
    status(c) { this._status = c; return this; },
    json(d) { this._payload = d; return this; },
    end() { return this; },
  };
}

async function callHandler(handler, req, capturedTemplate, log, name) {
  const captured = { ...capturedTemplate, _payload: null, _status: 200,
    status(c){this._status=c;return this}, json(d){this._payload=d;return this},
    setHeader(){}, end(){return this} };
  try {
    await handler(req, captured);
    log.push({ stage: name, status: captured._status, result: captured._payload });
  } catch (e) {
    log.push({ stage: name, error: e.message });
  }
}
