# ⚡ AI 信息聚合平台 + 6 AI 员工系统

一个由 Claude 驱动的 **AI 自动化信息平台**，把你订阅的高端付费源 (WSJ, The Information, Bloomberg, Substack...) 自动采集 → AI 总结 → 按用户偏好推送到 **邮件 / Web / Slack / Discord / 飞书 / 企业微信**。

原"6 AI 员工"聊天工作台 (`/`) 保留不动。

## ✨ 能力

| 模块 | 功能 |
|------|------|
| 📥 采集 | Email Newsletter inbound · RSS (带 cookie/Basic Auth) · 第三方 API · 登录态抓取 |
| 🧠 处理 | Claude 总结（briefing / deepdive / bullets 三种风格） · 自动话题标签 · 内容哈希去重 |
| 👥 用户 | 多用户 · 各自的话题/源/频次/风格 · 每用户多个分发目标 |
| 📤 分发 | Email (Resend) · Slack · Discord · 飞书 · 企业微信 · Web Dashboard |
| ⚙️ 运维 | Vercel Cron 自动跑 · Admin 后台手动触发 · ingest_jobs 审计日志 |
| 🔒 安全 | HTTP Basic auth 仪表盘 · Admin Token API · Cron Secret · 安全 HTTP headers |

## 🏗 架构

```
ingest (Email/RSS/API/Scrape)
   → articles (Postgres，content_hash 去重)
   → summaries (Claude 缓存)
   → digests (按用户偏好编排)
   → deliveries (多渠道分发)
```

详细见 [`docs/architecture.md`](docs/architecture.md)。

## 📁 项目结构

```
.
├── api/
│   ├── chat.js                 # 原 6AI 聊天代理 (保持不变)
│   ├── articles/{list,get}.js
│   ├── sources/{list,upsert}.js
│   ├── users/{list,upsert}.js
│   ├── ingest/
│   │   ├── email.js            # 入站邮件 webhook (Resend / Postmark)
│   │   ├── rss.js              # 拉付费 RSS feed
│   │   ├── api-import.js       # 第三方 API 推数据进来
│   │   └── scrape.js           # 调外部 Playwright worker
│   ├── summarize/run.js        # AI 增量总结
│   ├── digest/{generate,send,list}.js
│   └── cron/tick.js            # 调度入口
├── lib/
│   ├── supabase.js  claude.js  auth.js  http.js
│   ├── article.js   topic.js   summarize.js   feed-parser.js
│   └── deliverers/             # 6 个渠道 + dispatcher
├── db/schema.sql               # Postgres schema
├── public/
│   ├── index.html              # 6 AI 员工聊天 (原有)
│   ├── dashboard.html          # 简报 dashboard (新)
│   └── admin.html              # 管理后台 (新)
├── middleware.js               # Basic auth 仪表盘
├── vercel.json                 # 含 Cron 配置
└── docs/{architecture,sources,deployment}.md
```

## 🚀 快速开始

详见 [`docs/deployment.md`](docs/deployment.md)，简化版：

```bash
# 1. Supabase 建项目, 在 SQL editor 跑 db/schema.sql
# 2. 拷贝环境变量
cp .env.example .env.local
# 3. Vercel 部署
vercel env add ANTHROPIC_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE
vercel env add ADMIN_TOKEN       # openssl rand -hex 32
vercel env add CRON_SECRET       # openssl rand -hex 32
vercel env add AUTH_USERNAME
vercel env add AUTH_PASSWORD
vercel --prod
```

然后：

1. 打开 `https://<你的域名>/admin.html`
2. 输入 ADMIN_TOKEN
3. 在 "内容源" tab 添加 RSS / 配置 Inbound Email（见 [`docs/sources.md`](docs/sources.md)）
4. 在 "用户与订阅" 创建用户 + 配置分发目标
5. "手动触发" 跑一次 "🌀 完整流水线" 验证
6. 用户访问 `https://<你的域名>/dashboard.html` 查看简报流

## ⏰ Cron 默认调度

`vercel.json` 中：

| 频率                    | 任务                                   |
|------------------------|----------------------------------------|
| 每 15 分钟              | 采集 (RSS + Scrape)                    |
| 每 15 分钟 (偏移 5)     | AI 增量总结                            |
| 每小时                  | 生成 + 发送 digest                     |

可按需调整。

## 🤖 模型与成本

- 默认 `claude-sonnet-4-6`（总结 / digest 编排）
- 想省钱可改 `lib/claude.js` 的 `MODELS.default = MODELS.fast` 使用 Haiku 4.5
- 单篇 briefing 约 1-2K input + 300-500 output token，每千文章约 $1-3

## 🔐 合规提示

WSJ / The Information / Bloomberg 都是付费授权内容。本系统**不**做无授权爬取：
- 推荐通过 **你自己邮箱订阅** newsletter，转发到 Resend Inbound
- 推荐使用 **你自己账号的 RSS token / cookie**，存进 source.config
- 抓取式接入仅作为最后手段，请确认你的订阅条款允许

## 📚 文档

- [docs/architecture.md](docs/architecture.md) — 整体架构 + 数据流
- [docs/sources.md](docs/sources.md) — 4 种采集方式详细接入步骤
- [docs/deployment.md](docs/deployment.md) — Vercel + Supabase 部署

## License

MIT
