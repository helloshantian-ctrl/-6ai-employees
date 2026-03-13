// /api/chat.js — Vercel Serverless Function
// Claude API 安全代理层：速率限制 + 访问密码 + Key 隐藏

// ===== 内存速率限制（Vercel Serverless 实例级别） =====
const rateLimitMap = new Map();
const RATE_LIMIT = 60;           // 每个 IP 每小时最大请求数
const RATE_WINDOW = 60 * 60 * 1000; // 1 小时窗口

function checkRateLimit(ip) {
  const now = Date.now();
  let record = rateLimitMap.get(ip);

  if (!record || now - record.start > RATE_WINDOW) {
    record = { count: 1, start: now };
  } else {
    record.count++;
  }

  rateLimitMap.set(ip, record);

  // 清理过期记录（防止内存泄漏）
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.start > RATE_WINDOW) rateLimitMap.delete(key);
    }
  }

  return {
    allowed: record.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - record.count),
    resetIn: Math.ceil((record.start + RATE_WINDOW - now) / 1000)
  };
}

// ===== 允许的模型白名单 =====
const ALLOWED_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-haiku-4-5-20251001"
];

export default async function handler(req, res) {
  // ----- CORS -----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-access-code");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ----- 访问密码验证 -----
  const accessPassword = process.env.ACCESS_PASSWORD;
  if (accessPassword) {
    const userCode = req.headers["x-access-code"] || "";
    if (userCode !== accessPassword) {
      return res.status(401).json({
        error: "访问密码错误",
        message: "请输入正确的访问密码"
      });
    }
  }

  // ----- 速率限制 -----
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || "unknown";

  const rateCheck = checkRateLimit(clientIp);
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", rateCheck.remaining);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: "请求过于频繁",
      message: `已达到每小时 ${RATE_LIMIT} 次限制，请 ${rateCheck.resetIn} 秒后重试`,
      retryAfter: rateCheck.resetIn
    });
  }

  // ----- 校验请求体 -----
  const { messages, system, model } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages 字段必须为非空数组" });
  }

  if (!system || typeof system !== "string") {
    return res.status(400).json({ error: "system 字段必须为字符串" });
  }

  // 限制消息条数防止 token 爆炸
  if (messages.length > 30) {
    return res.status(400).json({ error: "对话消息不能超过 30 条" });
  }

  // 校验模型
  const selectedModel = ALLOWED_MODELS.includes(model) ? model : ALLOWED_MODELS[0];

  // ----- 检查 API Key -----
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "服务端未配置 API Key",
      message: "请在 Vercel 环境变量中设置 ANTHROPIC_API_KEY"
    });
  }

  // ----- 调用 Claude API -----
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 4096,
        system: system,
        messages: messages.map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: typeof m.content === "string" ? m.content : ""
        }))
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error("Claude API Error:", response.status, errBody);
      return res.status(response.status).json({
        error: errBody.error?.message || `Claude API 返回 ${response.status}`,
        type: errBody.error?.type || "api_error"
      });
    }

    const data = await response.json();

    // 返回精简数据
    return res.status(200).json({
      content: data.content,
      model: data.model,
      usage: data.usage,
      rateLimit: {
        remaining: rateCheck.remaining - 1,
        limit: RATE_LIMIT
      }
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({
      error: "服务端请求失败",
      message: err.message
    });
  }
}
