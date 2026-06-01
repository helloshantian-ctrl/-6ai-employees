// Article normalization & dedupe helpers.

const crypto = require("crypto");

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Strip HTML tags, collapse whitespace, keep paragraph breaks.
function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Build a canonical content hash that ignores trivial differences.
function contentHash({ title, url, content_text }) {
  const norm = (content_text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000); // first 8k is enough for dedupe
  return sha256(`${(url || "").trim()}|${(title || "").trim()}|${norm}`);
}

// Try to guess language from char composition (fast, no deps).
function detectLanguage(text) {
  if (!text) return null;
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  return cjk > 20 ? "zh-CN" : "en";
}

function normalize({
  source_id,
  external_id,
  url,
  title,
  author,
  published_at,
  raw_html,
  content_text,
  topics = [],
  metadata = {},
}) {
  const text = content_text || htmlToText(raw_html) || title || "";
  return {
    source_id,
    external_id: external_id || null,
    url: url || null,
    title: (title || "(untitled)").slice(0, 500),
    author: author || null,
    published_at: published_at ? new Date(published_at).toISOString() : null,
    language: detectLanguage(text),
    topics,
    raw_html: raw_html || null,
    content_text: text,
    content_hash: contentHash({ title, url, content_text: text }),
    metadata,
  };
}

module.exports = { sha256, htmlToText, contentHash, detectLanguage, normalize };
