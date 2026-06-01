// Slack incoming webhook. target.config = { webhook_url }

async function send({ target, digest }) {
  const url = target.config?.webhook_url;
  if (!url) return { ok: false, error: "target.config.webhook_url required" };
  const body = {
    text: digest.title || "AI Briefing",
    blocks: [
      { type: "header", text: { type: "plain_text", text: digest.title || "AI Briefing" } },
      { type: "section", text: { type: "mrkdwn", text: truncate(digest.body_md || "", 2900) } },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `Slack ${res.status}: ${await res.text()}` };
  return { ok: true };
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 3) + "..." : s; }

module.exports = { send };
