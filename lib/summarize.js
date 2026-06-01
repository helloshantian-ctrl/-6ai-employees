// AI summarization: per-article + per-digest.
// Uses claude.js for model calls and supabase.js to cache results.

const { complete, completeJson, MODELS } = require("./claude");
const { db } = require("./supabase");

const STYLE_PROMPTS = {
  briefing:
    "你是一位高端财经/科技简报编辑。把英文原文精炼为中文要点简报：标题(<=30字)、一句话核心(<=60字)、3-5条要点(每条<=80字)，附1-2句潜在影响。不写废话。",
  deepdive:
    "你是一位资深行业分析师。请用中文输出深度解读：背景、关键事实、分析、对中国市场/读者的含义。500-800字。",
  bullets:
    "你是简报机器人。仅输出5条中文 bullet（每条<=40字）。不要前言、不要标题。",
};

const JSON_SCHEMA_NOTE = `请以严格 JSON 输出：
{
  "title_cn": "...",
  "one_liner": "...",
  "bullets": ["...", "..."],
  "body_md": "..."
}
只输出 JSON，无 markdown 包裹。`;

async function summarizeArticle({ article, style = "briefing", language = "zh-CN", model }) {
  const existing = await db.select("summaries", {
    where: {
      article_id: `eq.${article.id}`,
      style: `eq.${style}`,
      language: `eq.${language}`,
    },
    limit: 1,
  });
  if (existing && existing[0]) return existing[0];

  const sys = (STYLE_PROMPTS[style] || STYLE_PROMPTS.briefing) + "\n\n" + JSON_SCHEMA_NOTE;
  const text = (article.content_text || "").slice(0, 12000); // cap input
  const userMsg =
    `# 原文标题\n${article.title}\n\n` +
    (article.author ? `# 作者\n${article.author}\n\n` : "") +
    (article.url ? `# 链接\n${article.url}\n\n` : "") +
    `# 正文\n${text}`;

  const out = await completeJson({
    system: sys,
    messages: [{ role: "user", content: userMsg }],
    model: model || MODELS.default,
    maxTokens: 1500,
    temperature: 0.2,
  });

  const row = {
    article_id: article.id,
    style,
    language,
    title_cn: out.json.title_cn || article.title,
    one_liner: out.json.one_liner || "",
    bullets: out.json.bullets || [],
    body_md: out.json.body_md || "",
    model: out.model,
    input_tokens: out.usage?.input_tokens || null,
    output_tokens: out.usage?.output_tokens || null,
  };
  const [saved] = await db.insert("summaries", [row], {
    onConflict: "article_id,style,language",
  });
  return saved || row;
}

// Compose a multi-article digest into markdown body for delivery.
async function composeDigest({ user, prefs, summaries, articles }) {
  const articlesById = Object.fromEntries(articles.map(a => [a.id, a]));
  const lines = [];
  lines.push(`# ${greeting(user)}的 AI 简报`);
  lines.push("");
  lines.push(`*${new Date().toLocaleDateString("zh-CN")} · ${summaries.length} 条精选*`);
  lines.push("");
  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    const a = articlesById[s.article_id] || {};
    lines.push(`## ${i + 1}. ${s.title_cn || a.title}`);
    if (s.one_liner) lines.push(`> ${s.one_liner}`);
    lines.push("");
    if (Array.isArray(s.bullets) && s.bullets.length) {
      for (const b of s.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
    const meta = [];
    if (a.author) meta.push(a.author);
    if (a.published_at) meta.push(new Date(a.published_at).toLocaleDateString("zh-CN"));
    if (a.url) meta.push(`[原文](${a.url})`);
    if (meta.length) lines.push(`*${meta.join(" · ")}*`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

function greeting(user) {
  return user.name || user.email?.split("@")[0] || "你";
}

module.exports = { summarizeArticle, composeDigest, STYLE_PROMPTS };
