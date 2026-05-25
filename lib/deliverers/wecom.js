// 企业微信 群机器人 webhook. target.config = { webhook_url }
// Docs: https://developer.work.weixin.qq.com/document/path/91770

async function send({ target, digest }) {
  const url = target.config?.webhook_url;
  if (!url) return { ok: false, error: "target.config.webhook_url required" };
  // markdown msg max 4096 bytes
  const content = truncateBytes(digest.body_md || "", 3800);
  const body = { msgtype: "markdown", markdown: { content } };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errcode !== 0) {
    return { ok: false, error: `WeCom: ${data.errmsg || res.status}`, response: data };
  }
  return { ok: true, response: data };
}

function truncateBytes(s, n) {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= n) return s;
  return buf.slice(0, n).toString("utf8") + "\n…(已截断)";
}

module.exports = { send };
