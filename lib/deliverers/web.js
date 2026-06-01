// Web "delivery" is a no-op — the digest is already in the DB and
// the dashboard reads from /api/articles + /api/digests. Marking sent
// here just tells the cron pipeline that the user has been served.

async function send() {
  return { ok: true, response: { mode: "web" } };
}

module.exports = { send };
