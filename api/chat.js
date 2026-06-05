// /api/chat.js — Vercel Serverless Function
// 越南出海投资顾问智能体平台 · Claude API 安全代理层
// 职责：隐藏 API Key + 访问密码 + 速率限制 + 模型白名单 + 失败重试

// ===== 内存速率限制（Vercel Serverless 实例级别） =====
const rateLimitMap = new Map();
const RATE_LIMIT = 80;               // 每个 IP 每小时最大请求数
const RATE_WINDOW = 60 * 60 * 1000;  // 1 小时窗口

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
    resetIn: Math.ceil((record.start + RATE_WINDOW - now) / 1000),
  };
}

// ===== 允许的模型白名单 =====
// 默认 Opus 4.8（顾问对话锐度最佳）；Sonnet 4.6 / Haiku 4.5 可降本提速。
const ALLOWED_MODELS = [
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
];
const DEFAULT_MODEL = "claude-opus-4-8";

// ===== 调用 Claude（带指数退避重试） =====
const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 4;

async function callClaude(apiKey, payload) {
  let lastErr = "";
  let lastStatus = 502;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return { ok: true, data: await res.json() };

    lastStatus = res.status;
    lastErr = (await res.text()).slice(0, 600);
    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) break;

    const backoff = Math.min(1500 * 2 ** (attempt - 1), 12000);
    await new Promise((r) => setTimeout(r, backoff + Math.floor(Math.random() * 600)));
  }
  return { ok: false, status: lastStatus, error: lastErr };
}

export default async function handler(req, res) {
  // ----- CORS -----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-access-code");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ----- 访问密码验证 -----
  const accessPassword = process.env.ACCESS_PASSWORD;
  if (accessPassword) {
    const userCode = req.headers["x-access-code"] || "";
    if (userCode !== accessPassword) {
      return res.status(401).json({ error: "访问密码错误", message: "请输入正确的访问密码" });
    }
  }

  // ----- 速率限制 -----
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown";

  const rateCheck = checkRateLimit(clientIp);
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", rateCheck.remaining);

  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: "请求过于频繁",
      message: `已达到每小时 ${RATE_LIMIT} 次限制，请 ${rateCheck.resetIn} 秒后重试`,
      retryAfter: rateCheck.resetIn,
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
  if (messages.length > 40) {
    return res.status(400).json({ error: "对话消息不能超过 40 条" });
  }

  const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

  // ----- 检查 API Key -----
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "服务端未配置 API Key",
      message: "请在 Vercel 环境变量中设置 ANTHROPIC_API_KEY",
    });
  }

  // ----- 调用 Claude -----
  try {
    const result = await callClaude(apiKey, {
      model: selectedModel,
      max_tokens: 3072,
      system,
      messages: messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: typeof m.content === "string" ? m.content : "",
      })),
    });

    if (!result.ok) {
      let parsed = {};
      try { parsed = JSON.parse(result.error); } catch {}
      return res.status(result.status).json({
        error: parsed.error?.message || `Claude API 返回 ${result.status}`,
        type: parsed.error?.type || "api_error",
      });
    }

    const data = result.data;
    return res.status(200).json({
      content: data.content,
      model: data.model,
      usage: data.usage,
      rateLimit: { remaining: rateCheck.remaining - 1, limit: RATE_LIMIT },
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "服务端请求失败", message: err.message });
  }
}
