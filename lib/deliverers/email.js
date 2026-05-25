// Email via Resend (no SDK).
// target.config = { email: "user@example.com" }
// env: RESEND_API_KEY, RESEND_FROM (e.g. "AI Briefing <briefing@yourdomain.com>")

const { mdToHtml } = require("./_md");

async function send({ target, digest }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "AI Briefing <onboarding@resend.dev>";
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  const to = target.config?.email;
  if (!to) return { ok: false, error: "target.config.email required" };

  const html = mdToHtml(digest.body_md || "");
  const subject = digest.title || `AI 简报 · ${new Date().toLocaleDateString("zh-CN")}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [to], subject, html, text: digest.body_md }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.message || `Resend ${res.status}`, response: data };
  return { ok: true, response: data };
}

module.exports = { send };
