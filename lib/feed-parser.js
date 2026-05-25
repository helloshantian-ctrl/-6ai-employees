// Minimal RSS 2.0 / Atom 1.0 parser — zero deps.
// Robust enough for WSJ, The Information, Bloomberg, Substack feeds.

function decode(s) {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function matchAll(re, str) {
  const out = [];
  let m;
  while ((m = re.exec(str)) !== null) out.push(m);
  return out;
}

function tag(name) {
  return new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
}

function attr(xml, attrName) {
  const m = xml.match(new RegExp(`${attrName}\\s*=\\s*"([^"]+)"`, "i"));
  return m ? m[1] : null;
}

function parse(xml) {
  if (!xml || typeof xml !== "string") return { items: [], type: "unknown" };

  // Detect feed type
  const isAtom = /<feed[\s>]/i.test(xml);
  if (isAtom) return parseAtom(xml);
  return parseRss(xml);
}

function parseRss(xml) {
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const items = matchAll(itemRe, xml).map(m => {
    const it = m[1];
    return {
      title: decode((it.match(tag("title")) || [])[1] || "").trim(),
      link:  decode((it.match(tag("link")) || [])[1] || "").trim(),
      guid:  decode((it.match(tag("guid")) || [])[1] || "").trim() || null,
      author: decode(
        (it.match(tag("author")) || [])[1] ||
        (it.match(tag("dc:creator")) || [])[1] || ""
      ).trim() || null,
      pubDate: decode((it.match(tag("pubDate")) || [])[1] || "").trim() || null,
      content: decode(
        (it.match(tag("content:encoded")) || [])[1] ||
        (it.match(tag("description")) || [])[1] || ""
      ),
      raw: it,
    };
  });
  const channelTitle = decode((xml.match(tag("title")) || [])[1] || "").trim();
  return { type: "rss", title: channelTitle, items };
}

function parseAtom(xml) {
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  const items = matchAll(entryRe, xml).map(m => {
    const it = m[1];
    const linkTag = it.match(/<link[^>]*\/>/i) || it.match(/<link[^>]*>[\s\S]*?<\/link>/i);
    const href = linkTag ? attr(linkTag[0], "href") : null;
    return {
      title: decode((it.match(tag("title")) || [])[1] || "").trim(),
      link:  href || decode((it.match(tag("id")) || [])[1] || "").trim(),
      guid:  decode((it.match(tag("id")) || [])[1] || "").trim() || null,
      author: decode((it.match(tag("name")) || [])[1] || "").trim() || null,
      pubDate: decode(
        (it.match(tag("updated")) || [])[1] ||
        (it.match(tag("published")) || [])[1] || ""
      ).trim() || null,
      content: decode(
        (it.match(tag("content")) || [])[1] ||
        (it.match(tag("summary")) || [])[1] || ""
      ),
      raw: it,
    };
  });
  const feedTitle = decode((xml.match(tag("title")) || [])[1] || "").trim();
  return { type: "atom", title: feedTitle, items };
}

module.exports = { parse };
