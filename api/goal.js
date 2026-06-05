// /api/goal.js — Vercel Serverless Function
// 目标工作台：把「出海目标」拆解为结构化落地路线图（通过 Claude 的目标分解能力完成）
// 输入：投资目标 + 行业 + 预算 + 区域偏好 + 阶段；输出：结构化 JSON 路线图

const rateLimitMap = new Map();
const RATE_LIMIT = 30;               // 目标分解较重，限制更严
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  if (!record || now - record.start > RATE_WINDOW) record = { count: 1, start: now };
  else record.count++;
  rateLimitMap.set(ip, record);
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) if (now - v.start > RATE_WINDOW) rateLimitMap.delete(k);
  }
  return {
    allowed: record.count <= RATE_LIMIT,
    resetIn: Math.ceil((record.start + RATE_WINDOW - now) / 1000),
  };
}

const ALLOWED_MODELS = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"];
const DEFAULT_MODEL = "claude-opus-4-8";

const ADVISOR_IDS = "market-entry | legal-policy | tax-finance | site-park | hr-labor | supply-chain";

const GOAL_SYSTEM = `你是「越南出海投资顾问平台」的首席顾问（Chief Advisor）。你的职责是：把企业模糊的越南出海目标，分解为一份可执行的结构化落地路线图。

你深谙越南外商投资落地全流程：投资注册证（IRC）与企业注册证（ERC）、外资准入与条件性行业、《投资法 2020》《企业法 2020》、企业所得税（标准 20%，优惠 10%/15%/17% 及免税期）、增值税、外国承包商税（FCT）、利润汇出、北中南三大区域工业园区（海防/北宁/北江/兴安、胡志明/平阳/同奈/隆安、岘港/广南）、VSIP / DEEP C 等园区、四档地区最低工资与社保（雇主约 21.5%）、外国人工作许可、CPTPP / EVFTA / RCEP / UKVFTA 等自贸协定与原产地规则、主要港口（吉莱/海防/盖梅）。

规则：
- 基于用户提供的目标与画像，给出具体、量化、贴合越南实际的建议，避免空话套话。
- 涉及税率/工资/园区地价等数字时，标明为「参考区间」，并提示需结合最新政策与专业机构核实。
- recommendedAdvisors 与 phases[].advisors 中的顾问 id 只能取自：${ADVISOR_IDS}
- 严格只返回 JSON，不要任何前后缀、不要 markdown 代码块。

返回如下 JSON 结构：
{
  "summary": "一句话战略判断（中文、锐利）",
  "feasibility": "可行性评估：高/中/低 — 一句话理由",
  "phases": [
    { "name": "阶段名", "timeframe": "时间窗口", "objective": "阶段目标", "keyActions": ["关键动作"], "advisors": ["相关顾问id"] }
  ],
  "keyRisks": [ { "risk": "风险点", "mitigation": "缓解措施" } ],
  "incentives": ["可争取的优惠/政策（如优惠税率、工业园区减免、自贸协定关税）"],
  "checklist": ["落地清单项（证照/合规/资金/团队）"],
  "recommendedAdvisors": [ { "id": "顾问id", "reason": "为什么优先咨询" } ],
  "estimatedTimeline": "从启动到投产的整体时间预估",
  "nextStep": "立即可执行的第一步"
}

phases 给 3-5 个；keyRisks 给 3-5 条；checklist 给 6-10 项；recommendedAdvisors 给 2-4 个。`;

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);

async function callClaude(apiKey, payload, maxAttempts = 4) {
  let lastErr = "", lastStatus = 502;
  for (let i = 1; i <= maxAttempts; i++) {
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
    if (!RETRYABLE.has(res.status) || i === maxAttempts) break;
    await new Promise((r) => setTimeout(r, Math.min(1500 * 2 ** (i - 1), 12000) + Math.random() * 600));
  }
  return { ok: false, status: lastStatus, error: lastErr };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-access-code");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const accessPassword = process.env.ACCESS_PASSWORD;
  if (accessPassword && (req.headers["x-access-code"] || "") !== accessPassword) {
    return res.status(401).json({ error: "访问密码错误", message: "请输入正确的访问密码" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || "unknown";
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return res.status(429).json({
      error: "请求过于频繁",
      message: `目标分解每小时上限 ${RATE_LIMIT} 次，请 ${rate.resetIn} 秒后重试`,
    });
  }

  const { goal, industry, budget, region, stage, model } = req.body || {};
  if (!goal || typeof goal !== "string" || goal.trim().length < 4) {
    return res.status(400).json({ error: "请填写出海目标（至少 4 个字）" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "服务端未配置 API Key",
      message: "请在 Vercel 环境变量中设置 ANTHROPIC_API_KEY",
    });
  }

  const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

  const userPrompt = [
    `出海目标：${goal.trim()}`,
    industry ? `行业：${industry}` : "",
    budget ? `预算：${budget}` : "",
    region ? `区域偏好：${region}` : "",
    stage ? `当前阶段：${stage}` : "",
    "",
    "请基于以上信息，输出结构化落地路线图 JSON。",
  ].filter(Boolean).join("\n");

  try {
    const result = await callClaude(apiKey, {
      model: selectedModel,
      max_tokens: 4096,
      system: GOAL_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (!result.ok) {
      let parsed = {};
      try { parsed = JSON.parse(result.error); } catch {}
      return res.status(result.status).json({
        error: parsed.error?.message || `Claude API 返回 ${result.status}`,
      });
    }

    const text = (result.data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
      const plan = JSON.parse(clean);
      return res.status(200).json({ plan, model: result.data.model, usage: result.data.usage });
    } catch {
      return res.status(502).json({
        error: "目标分解返回了非 JSON 内容，请重试",
        raw: text.slice(0, 400),
      });
    }
  } catch (err) {
    console.error("Goal error:", err);
    return res.status(500).json({ error: "服务端请求失败", message: err.message });
  }
}
