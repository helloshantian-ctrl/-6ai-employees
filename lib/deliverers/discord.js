// Discord webhook. target.config = { webhook_url }

async function send({ target, digest }) {
  const url = target.config?.webhook_url;
  if (!url) return { ok: false, error: "target.config.webhook_url required" };
  // Discord caps content at 2000 chars; embed description at 4096.
  const desc = (digest.body_md || "").slice(0, 4000);
  const body = {
    embeds: [{
      title: (digest.title || "AI Briefing").slice(0, 256),
      description: desc,
      timestamp: new Date().toISOString(),
    }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `Discord ${res.status}: ${await res.text()}` };
  return { ok: true };
}

module.exports = { send };
