# 架构概览

本系统在原"6 AI 员工"聊天平台基础上叠加了一条 **采集 → 归一化 → AI 总结 → 个性化简报 → 多渠道分发** 的完整管道。

## 数据流

```
              ┌────────────────────────────────────────────┐
              │            内容采集 (ingest)                │
              ├────────────────────────────────────────────┤
              │ • Email Newsletter (POST /api/ingest/email)│
              │   ← Resend / Postmark Inbound webhook      │
              │ • RSS (cron /api/ingest/rss)               │
              │   ← 带 cookie/Basic-Auth 拉取付费源        │
              │ • 第三方 API (POST /api/ingest/api-import) │
              │ • 登录态抓取 (cron /api/ingest/scrape)     │
              │   ← 调用 Playwright/Browserless worker     │
              └─────────────┬──────────────────────────────┘
                            ▼
                  ┌──────────────────┐
                  │  articles 表     │ ← 归一化 + content_hash 去重
                  └────────┬─────────┘
                           ▼
              ┌──────────────────────────┐
              │ AI 总结 (Claude)         │  /api/summarize/run
              │  • briefing / deepdive   │
              │  • bullets               │
              │  缓存到 summaries 表     │
              └──────────┬───────────────┘
                         ▼
           ┌──────────────────────────────┐
           │ 个性化简报 digest 生成        │ /api/digest/generate
           │  按用户偏好 (话题/源/频次/风格) │
           │  组装 body_md，存 digests 表  │
           └───────────┬──────────────────┘
                       ▼
           ┌──────────────────────────────┐
           │  多渠道分发 deliverers       │ /api/digest/send
           ├──────────────────────────────┤
           │ Email (Resend) · Slack       │
           │ Discord · 飞书 · 企业微信     │
           │ Web Dashboard (/dashboard.html)│
           └──────────────────────────────┘
```

## 调度

Vercel Cron 在 `vercel.json` 中配置：

| schedule         | path                                  | 作用             |
| ---------------- | ------------------------------------- | ---------------- |
| `*/15 * * * *`   | `/api/cron/tick?stage=ingest`         | 拉取所有源        |
| `5,20,35,50 * * * *` | `/api/cron/tick?stage=summarize`  | 增量 AI 总结      |
| `0 * * * *`      | `/api/cron/tick?stage=digest`         | 生成 + 发送简报   |

`tick.js` 是聚合调度器，按 `stage` 内部调用对应的 handler。频次决定于：
- 每个用户的 `user_preferences.digest_frequency`（hourly/daily/weekly）
- `digests.created_at` 时间戳 — 若仍在窗口期内则跳过该用户

## 数据模型 (Postgres / Supabase)

详见 [`db/schema.sql`](../db/schema.sql)。核心表：

- **users** — 终端用户（多个）。
- **user_preferences** — 1:1，话题/源筛选 + 频次 + 风格。
- **delivery_targets** — 1:N，用户的分发目标（email / slack / 飞书 / 企微 / discord / web）。
- **sources** — 内容源配置（含 cookie / Basic Auth 等）。
- **articles** — 归一化文章；`content_hash` 唯一索引做去重。
- **summaries** — 按 `(article_id, style, language)` 唯一缓存的 AI 摘要。
- **digests** — 单次为某用户编排好的简报 (markdown body)。
- **deliveries** — 单次发送记录 (channel + status)。
- **ingest_jobs** — 采集 job 日志。

## 鉴权

| 角色             | 凭证                                      | 用途                                    |
| ---------------- | ----------------------------------------- | --------------------------------------- |
| Cron             | `Authorization: Bearer $CRON_SECRET`      | Vercel Cron 调用 `/api/cron/*`          |
| Admin            | `x-admin-token: $ADMIN_TOKEN`             | `/api/sources/*`, `/api/users/*`, 手动触发 |
| Resend Inbound   | `?token=$RESEND_INBOUND_SECRET`           | `/api/ingest/email` webhook            |
| Dashboard 浏览者 | HTTP Basic Auth (`$AUTH_USERNAME/PASSWORD`) | `middleware.js` 拦截除 `/api/*` 外的所有 |

## 安全 / 合规要点

- WSJ / The Information 等付费源**只能通过订阅者本人合法授权的方式**接入：
  - 推荐：用户自己的邮箱订阅 newsletter，转发给本系统的专属收件地址
  - 推荐：自己浏览器登录后导出的 cookie / RSS token，存进 `sources.config.cookie`
  - 不推荐：暴力登录抓取，违反 ToS
- 所有秘钥（API key、cookie、webhook URL）只存在 `sources.config` (server-side JSON) 与 Vercel 环境变量；前端不读取。
- `service_role` Supabase key 只在 serverless 函数里使用；前端用 anon key（本项目暂未开放浏览器直连 DB）。
- HTML 渲染时使用 `escape()`，邮件 HTML 用最小 markdown→HTML（无外链脚本）。

## 扩展点

- **向量检索**：开启 Supabase `pgvector`，给 `articles` 加 `embedding` 列，做语义去重 / 相关推荐。
- **真人审核**：在 `digests` 增加 `status='pending_review'`，admin 在 dashboard 批准后再 `send`。
- **更多渠道**：在 `lib/deliverers/` 添加新文件，并注册到 `lib/deliverers/index.js` 的 `REGISTRY`。
- **Scrape Worker**：参考 `docs/sources.md` 中的接口约定自建 Playwright 服务。
