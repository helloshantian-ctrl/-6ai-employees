// 飞书 (Lark) custom bot webhook. target.config = { webhook_url, secret? }
// Docs: https://open.feishu.cn/document/client-docs/bot-v1/add-custom-bot
// If `secret` is set, we sign the payload per Feishu's HMAC-SHA256 rule.

const crypto = require("crypto");

function sign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac("sha256", stringToSign).update("");
  return hmac.digest("base64");
}

async function send({ target, digest }) {
  const url = target.config?.webhook_url;
  if (!url) return { ok: false, error: "target.config.webhook_url required" };
  const body = {
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: digest.title || "AI 简报" },
        template: "blue",
      },
      elements: [
        { tag: "markdown", content: (digest.body_md || "").slice(0, 30000) },
      ],
    },
  };
  if (target.config?.secret) {
    const ts = Math.floor(Date.now() / 1000);
    body.timestamp = String(ts);
    body.sign = sign(target.config.secret, ts);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== 0) {
    return { ok: false, error: `Feishu: ${data.msg || res.status}`, response: data };
  }
  return { ok: true, response: data };
}

module.exports = { send };
