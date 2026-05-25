// Minimal markdown → HTML (headings, bold, italic, code, links, lists).
// Zero deps. Good enough for email rendering.

function escape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, t) => `<code>${escape(t)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function mdToHtml(md) {
  const lines = (md || "").split(/\r?\n/);
  const html = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^---+$/.test(line)) { flushList(); html.push("<hr/>"); continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushList();
      const n = m[1].length;
      html.push(`<h${n}>${inline(escape(m[2]))}</h${n}>`);
      continue;
    }
    if ((m = line.match(/^>\s+(.*)$/))) {
      flushList();
      html.push(`<blockquote>${inline(escape(m[1]))}</blockquote>`);
      continue;
    }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${inline(escape(m[1]))}</li>`);
      continue;
    }
    if (line === "") { flushList(); html.push(""); continue; }
    flushList();
    html.push(`<p>${inline(escape(line))}</p>`);
  }
  flushList();
  return wrap(html.join("\n"));

  function flushList() { if (inList) { html.push("</ul>"); inList = false; } }
}

function wrap(body) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#1a2234;max-width:680px;margin:32px auto;padding:0 20px;line-height:1.65}
h1{font-size:24px;margin:24px 0 8px}h2{font-size:18px;margin:28px 0 8px;border-bottom:1px solid #eef;padding-bottom:6px}h3{font-size:15px;margin:18px 0 6px}
blockquote{border-left:3px solid #6c9fff;color:#475569;margin:8px 0;padding:4px 12px;background:#f5f8ff;border-radius:4px}
ul{padding-left:22px}li{margin:3px 0}a{color:#3b82f6;text-decoration:none}a:hover{text-decoration:underline}hr{border:none;border-top:1px solid #e2e8f0;margin:18px 0}
code{background:#f1f5f9;padding:1px 5px;border-radius:3px;font-family:ui-monospace,monospace;font-size:.92em}
em{color:#64748b}
</style></head><body>${body}</body></html>`;
}

module.exports = { mdToHtml };
