// Seed data for the demo server — 10 articles styled after WSJ / The Information /
// Bloomberg / Stratechery, each with a pre-generated zh-CN briefing summary so the
// dashboard shows realistic output even without an Anthropic key.

const now = Date.now();
const hoursAgo = h => new Date(now - h * 3600 * 1000).toISOString();

const sources = [
  { id: "src-wsj",   type: "email",  vendor: "wsj",            name: "WSJ Pro · Markets Briefing",       url: "mailto:newsletters@wsj.com",            topics: ["markets","macro"],    is_active: true,  last_status: "ok", last_polled_at: hoursAgo(0.2) },
  { id: "src-ti",    type: "rss",    vendor: "theinformation", name: "The Information · Daily",          url: "https://www.theinformation.com/feed",   topics: ["ai","startup","tech"], is_active: true, last_status: "ok", last_polled_at: hoursAgo(0.5) },
  { id: "src-bbg",   type: "api",    vendor: "bloomberg",      name: "Bloomberg Terminal Export",        url: "https://api.bloomberg.com/news",         topics: ["markets","macro"],    is_active: true,  last_status: "ok", last_polled_at: hoursAgo(0.3) },
  { id: "src-strat", type: "rss",    vendor: "stratechery",    name: "Stratechery (Ben Thompson)",        url: "https://stratechery.com/feed",          topics: ["tech","startup"],     is_active: true,  last_status: "ok", last_polled_at: hoursAgo(1.0) },
  { id: "src-ft",    type: "email",  vendor: "ft",             name: "Financial Times · Lex",            url: "mailto:lex@ft.com",                     topics: ["markets","macro"],    is_active: true,  last_status: "ok", last_polled_at: hoursAgo(0.4) },
];

const articles = [
  {
    id: "a01", source_id: "src-wsj", url: "https://www.wsj.com/articles/fed-rate-cut-2026", external_id: "wsj-fed-2026-05",
    title: "Fed Signals Two More Rate Cuts as Inflation Eases Toward 2% Target",
    author: "Nick Timiraos", published_at: hoursAgo(3), ingested_at: hoursAgo(2.8),
    language: "en", topics: ["markets","macro","us"],
    content_text: "Federal Reserve officials signaled they could cut interest rates two more times before the end of 2026, citing further progress on inflation and a softening labor market. Chair Jerome Powell said the policy stance remains 'meaningfully restrictive' and that the FOMC has room to recalibrate. The dot plot showed a median expectation of 3.625% by year-end. Treasury yields fell across the curve, with the 2-year dropping 12bp. Equities rallied on the dovish tone, with the S&P 500 closing at a record high.",
  },
  {
    id: "a02", source_id: "src-ti", url: "https://www.theinformation.com/articles/anthropic-fundraise",
    title: "Anthropic in Talks to Raise at $250B Valuation, Triple Its Last Round",
    author: "Stephanie Palazzolo", published_at: hoursAgo(5), ingested_at: hoursAgo(4.5),
    language: "en", topics: ["ai","startup","tech"],
    content_text: "Anthropic is in early discussions with investors for a new funding round at a valuation around $250 billion, according to people familiar with the matter. That would be more than triple its $61.5B mark from earlier this year. The company's annual revenue run-rate has reportedly crossed $9B, driven by enterprise adoption of Claude. Lightspeed Venture Partners and existing backer Google are said to be considering participating. The round could close as soon as next quarter.",
  },
  {
    id: "a03", source_id: "src-bbg", url: "https://www.bloomberg.com/news/nvidia-china-export",
    title: "Nvidia's China Sales Slip 30% as Beijing Pushes Domestic Chips",
    author: "Debby Wu", published_at: hoursAgo(7), ingested_at: hoursAgo(6.7),
    language: "en", topics: ["china","tech","markets"],
    content_text: "Nvidia's revenue from mainland China fell about 30% year-over-year last quarter as Chinese cloud providers shifted to domestic alternatives from Huawei and Cambricon. The decline came despite the company launching a US-export-compliant H20 chip aimed specifically at the Chinese market. CFO Colette Kress told analysts that competitive dynamics in China have 'fundamentally changed.' Nvidia's overall data center revenue still grew 47%, beating expectations.",
  },
  {
    id: "a04", source_id: "src-ti", url: "https://www.theinformation.com/articles/openai-hardware",
    title: "OpenAI's First Consumer Device, Designed With Jony Ive, Targets 2027 Launch",
    author: "Erin Woo", published_at: hoursAgo(10), ingested_at: hoursAgo(9.5),
    language: "en", topics: ["ai","startup","tech"],
    content_text: "OpenAI's secretive hardware project with former Apple designer Jony Ive is targeting a late 2027 launch for its first consumer device, described internally as a 'screenless companion' that lives in the user's pocket. The device runs a custom Anthropic-rival assistant tuned on OpenAI's latest reasoning models. Sources say Sam Altman has pitched it as 'the iPhone of AI.' Manufacturing partners in Vietnam have been selected to avoid China tariff exposure.",
  },
  {
    id: "a05", source_id: "src-wsj", url: "https://www.wsj.com/articles/byd-europe-factory",
    title: "BYD Breaks Ground on Third European EV Factory, Doubling Down Despite Tariffs",
    author: "Selina Cheng", published_at: hoursAgo(14), ingested_at: hoursAgo(13.6),
    language: "en", topics: ["china","markets","energy"],
    content_text: "Chinese EV giant BYD broke ground on a 1.5M-unit factory in Spain this week, its third European production base after Hungary and Turkey. The move comes despite the EU's 27% tariff on Chinese-made EVs. By manufacturing locally, BYD sidesteps the tariff entirely and is now on track to surpass Tesla as Europe's #2 EV brand by 2027. Local production also unlocks EU green-subsidy eligibility worth up to €5,000 per vehicle.",
  },
  {
    id: "a06", source_id: "src-strat", url: "https://stratechery.com/2026/apple-ai-strategy",
    title: "Apple's AI Bet: Why On-Device Models Are the Real Moat",
    author: "Ben Thompson", published_at: hoursAgo(18), ingested_at: hoursAgo(17.5),
    language: "en", topics: ["ai","tech"],
    content_text: "Apple's WWDC 2026 reveals a deliberate strategy: rather than chase frontier model performance, Apple is investing in tiny, on-device models that run inside the Neural Engine of every iPhone. The pitch is privacy by architecture — no user data leaves the device. The bet only works if smaller models become 'good enough' for daily tasks, which our benchmarks suggest is roughly true today. Combined with Apple's distribution moat (2.2 billion active devices), this could leapfrog cloud AI players in consumer market share even with inferior raw capability.",
  },
  {
    id: "a07", source_id: "src-bbg", url: "https://www.bloomberg.com/news/oil-opec-cut",
    title: "OPEC+ Surprises Markets With 2 Million Barrel Production Cut",
    author: "Grant Smith", published_at: hoursAgo(22), ingested_at: hoursAgo(21.5),
    language: "en", topics: ["energy","macro","markets"],
    content_text: "OPEC+ ministers agreed on Sunday to cut combined production by 2 million barrels per day starting July, the largest reduction since 2020. The decision blindsided traders who had expected a rollover of existing quotas. Brent crude spiked 8% on the open Monday to $94. The cut is widely seen as a response to slowing Chinese demand and a tactical move to defend $90 as a price floor. White House officials called the decision 'shortsighted' and hinted at SPR releases.",
  },
  {
    id: "a08", source_id: "src-ti", url: "https://www.theinformation.com/articles/perplexity-acquisition",
    title: "Perplexity in Advanced Acquisition Talks With Meta, Sources Say",
    author: "Cory Weinberg", published_at: hoursAgo(26), ingested_at: hoursAgo(25.5),
    language: "en", topics: ["ai","startup","tech"],
    content_text: "AI search startup Perplexity is in advanced talks to be acquired by Meta for roughly $15 billion, three people familiar with the discussions said. The deal would fold Perplexity's 24M monthly users and its CEO Aravind Srinivas into Meta's Superintelligence Labs unit headed by Alexandr Wang. Talks were initially focused on a strategic investment but escalated after Perplexity's most recent fundraising attempt at a $20B valuation stalled. A deal could be announced within weeks.",
  },
  {
    id: "a09", source_id: "src-ft", url: "https://www.ft.com/content/uk-bank-stress",
    title: "UK Banks Pass Stress Test But Regulator Flags Commercial Real Estate Risk",
    author: "Stephen Morris", published_at: hoursAgo(30), ingested_at: hoursAgo(29.5),
    language: "en", topics: ["markets","macro"],
    content_text: "The Bank of England's annual stress test found all seven major UK lenders would remain solvent in a severe downturn scenario including a 5% GDP contraction and 12% unemployment. However, the PRA flagged commercial real estate exposure as a 'growing concern,' particularly to office assets in London's secondary markets. NatWest and Lloyds were singled out for elevated CRE concentration. Bank shares were mixed on the results.",
  },
  {
    id: "a10", source_id: "src-wsj", url: "https://www.wsj.com/articles/sec-crypto-rules",
    title: "SEC Unveils Crypto Rulebook, Greenlights Bitcoin ETFs in 401(k)s",
    author: "Vicky Ge Huang", published_at: hoursAgo(34), ingested_at: hoursAgo(33.5),
    language: "en", topics: ["crypto","markets","us"],
    content_text: "The Securities and Exchange Commission on Friday published its long-awaited crypto rulebook, clarifying that spot Bitcoin and Ethereum ETFs are eligible for inclusion in employer-sponsored 401(k) retirement plans. The 240-page rule also creates a registration safe harbor for token issuers and defines decentralization criteria that exempt projects from securities law. Industry groups cheered the framework while consumer advocates warned of retirement-fund losses. Bitcoin briefly touched $112,000 on the news.",
  },
];

// Pre-generated zh-CN briefings (so the demo shows realistic output without an API key)
const summaries = [
  { article_id: "a01", style: "briefing", language: "zh-CN", title_cn: "美联储暗示年内再降息两次，鲍威尔称政策仍偏紧",
    one_liner: "通胀回落+就业走弱给美联储更多腾挪空间，市场闻风而动。",
    bullets: ["FOMC 点阵图显示年底中位数利率 3.625%", "鲍威尔表态'政策仍有实质性约束'，留出宽松窗口", "2 年期美债收益率下行 12bp，标普 500 创历史新高", "市场已 price in 7 月或 9 月开启首次降息"],
    body_md: "美联储 6 月议息会上释放出年内将再降息两次的信号..." },
  { article_id: "a02", style: "briefing", language: "zh-CN", title_cn: "Anthropic 寻求 2500 亿美元估值新一轮融资",
    one_liner: "估值三个月内翻三倍，企业级 Claude 营收年化已破 90 亿美元。",
    bullets: ["拟融资估值 ~$250B，是 5 月 $61.5B 的 4 倍", "Claude 年化收入运行率达 $9B，主要来自企业客户", "Lightspeed 与现有股东 Google 据称将参投", "新一轮或最快下季度完成"] },
  { article_id: "a03", style: "briefing", language: "zh-CN", title_cn: "英伟达中国营收下滑 30%，国产替代加速",
    one_liner: "华为/寒武纪抢单成功，北京算力自主战略见效。",
    bullets: ["上季度中国大陆数据中心收入同比 -30%", "尽管推出合规版 H20 仍难挽颓势", "CFO 承认中国市场'竞争格局已根本改变'", "整体数据中心业务仍同比增长 47%"] },
  { article_id: "a04", style: "briefing", language: "zh-CN", title_cn: "OpenAI x Jony Ive 首款消费硬件 2027 年发布",
    one_liner: "无屏'口袋伴侣'，Altman 称为'AI 时代的 iPhone'。",
    bullets: ["定位无屏幕个人 AI 助手设备", "代工选址越南以规避中国关税", "搭载 OpenAI 最新推理模型", "对标 Anthropic 即将推出的硬件产品"] },
  { article_id: "a05", style: "briefing", language: "zh-CN", title_cn: "比亚迪西班牙建第三座欧洲工厂，绕开关税",
    one_liner: "本地化生产规避 27% 关税，剑指欧洲市场亚军。",
    bullets: ["年产能 150 万辆，是匈/土两厂之后的第三座", "本地化生产同时享受欧盟最高 €5000/辆补贴", "2027 年有望超越特斯拉成欧洲第二大 EV 品牌", "彻底改变中国 EV 出海路径——从'出口'到'本地造'"] },
  { article_id: "a06", style: "briefing", language: "zh-CN", title_cn: "苹果 AI 策略：端侧小模型才是真护城河",
    one_liner: "用 22 亿活跃设备做分发，赌'够用'比'最强'更重要。",
    bullets: ["WWDC 2026 押注端侧 Neural Engine 部署小模型", "卖点是架构级隐私——数据不离开设备", "假设小模型能力已'够用'，benchmark 大致支持", "可借渠道优势在消费 AI 市场反超云端玩家"] },
  { article_id: "a07", style: "briefing", language: "zh-CN", title_cn: "OPEC+ 突袭式减产 200 万桶/日，2020 年来最大",
    one_liner: "中国需求疲软+护盘 $90，白宫怒斥并暗示动用 SPR。",
    bullets: ["7 月起每日减产 200 万桶，远超市场预期", "布伦特原油应声跳涨 8% 至 $94", "战术目标：捍卫 $90 油价心理关口", "美方称'目光短浅'，或释放战略石油储备反制"] },
  { article_id: "a08", style: "briefing", language: "zh-CN", title_cn: "Meta 拟 150 亿美元收购 Perplexity",
    one_liner: "AI 搜索创业公司 2400 万月活+创始人或并入 Meta 超智实验室。",
    bullets: ["收购价约 $15B，并入 Alexandr Wang 主导的超智实验室", "Perplexity 月活 24M，前次融资 $20B 估值未达成", "原本谈战略投资，升级为全资收购", "数周内或公布"] },
  { article_id: "a09", style: "briefing", language: "zh-CN", title_cn: "英国银行压力测试全过，但商业地产风险被点名",
    one_liner: "7 家主要银行抗压 GDP -5%、失业 12% 情景，CRE 是隐患。",
    bullets: ["所有受测银行在极端情景下仍保持偿付能力", "PRA 重点警示伦敦二级写字楼 CRE 敞口", "NatWest 与 Lloyds 因 CRE 集中度被单独点名", "银行股盘后涨跌互现"] },
  { article_id: "a10", style: "briefing", language: "zh-CN", title_cn: "SEC 加密新规：BTC/ETH ETF 可纳入 401(k)",
    one_liner: "240 页规则一锤定音，比特币应声触及 $112,000。",
    bullets: ["现货 BTC/ETH ETF 正式可入 401(k) 退休账户", "Token 发行设立注册避风港，并明确'去中心化'判定", "行业欢呼，消费者保护方警告退休金损失风险", "BTC 短时冲高至 $112K"] },
];

const users = [
  { id: "u-demo", email: "demo@example.com", name: "Demo 用户", role: "admin", timezone: "Asia/Shanghai", language: "zh-CN", is_active: true, created_at: hoursAgo(48) },
  { id: "u-finance", email: "finance@example.com", name: "财经组", role: "reader", timezone: "Asia/Shanghai", language: "zh-CN", is_active: true, created_at: hoursAgo(24) },
];

const preferences = [
  { user_id: "u-demo",    topics: [], source_ids: [], exclude_source_ids: [], summary_style: "briefing", summary_language: "zh-CN", digest_frequency: "daily", send_hour_local: 8, max_items: 10 },
  { user_id: "u-finance", topics: ["markets","macro","energy"], source_ids: [], exclude_source_ids: [], summary_style: "briefing", summary_language: "zh-CN", digest_frequency: "daily", send_hour_local: 9, max_items: 8 },
];

const delivery_targets = [
  { id: "t-demo-email", user_id: "u-demo", channel: "email", label: "主邮箱", config: { email: "demo@example.com" }, is_active: true },
  { id: "t-demo-web",   user_id: "u-demo", channel: "web",   label: "Dashboard", config: {}, is_active: true },
];

// One pre-generated digest so /dashboard.html "我的简报" tab shows content immediately.
const digests = [
  {
    id: "d-sample", user_id: "u-demo",
    period_start: hoursAgo(24), period_end: hoursAgo(0), created_at: hoursAgo(0.1),
    title: "Demo 用户 的 AI 简报 · " + new Date().toLocaleDateString("zh-CN"),
    article_ids: articles.map(a => a.id),
    status: "sent",
    body_md: buildSampleDigest(),
  },
];

function buildSampleDigest() {
  const lines = [`# Demo 用户的 AI 简报`, "", `*${new Date().toLocaleDateString("zh-CN")} · ${articles.length} 条精选*`, ""];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const s = summaries.find(x => x.article_id === a.id) || {};
    lines.push(`## ${i + 1}. ${s.title_cn || a.title}`);
    if (s.one_liner) lines.push(`> ${s.one_liner}`, "");
    if (Array.isArray(s.bullets)) for (const b of s.bullets) lines.push(`- ${b}`);
    lines.push("");
    const meta = [a.author, new Date(a.published_at).toLocaleDateString("zh-CN"), a.url ? `[原文](${a.url})` : ""].filter(Boolean);
    lines.push(`*${meta.join(" · ")}*`, "", "---", "");
  }
  return lines.join("\n");
}

module.exports = { sources, articles, summaries, users, preferences, delivery_targets, digests };
