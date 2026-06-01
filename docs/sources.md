# 内容源接入指南

涵盖 WSJ、The Information、Bloomberg、Substack 等。

## 1. Email Newsletter (推荐 · 最合规)

适用于所有支持邮件订阅的源（WSJ Pro, The Information Briefings, Bloomberg Surveillance, Stratechery 等）。

### 步骤

1. 在 [Resend](https://resend.com) 开启 **Inbound** 并绑定一个域名（如 `mail.briefing.yourdomain.com`）。
2. 在 Resend Inbound 控制台设置 Webhook：
   ```
   POST https://<your-vercel-domain>/api/ingest/email?token=<RESEND_INBOUND_SECRET>
   ```
3. 用一个新邮箱（如 `wsj@mail.briefing.yourdomain.com`）订阅 WSJ / The Information 的 newsletter。
4. 邮件到达后会自动调 webhook → 系统创建 `sources` 行（按发件人地址区分）+ `articles` 行。

> 不需要在 admin 后台手动创建 email 源 — 系统会按发件人自动建。

## 2. RSS Feed (适合 The Information、Substack 付费 RSS)

The Information 提供 `https://www.theinformation.com/feed?token=...`；多数 Substack 付费栏目也有个性化 RSS。

### 步骤

1. 登录发布方网站，找到 "Your private RSS" / "Feed URL"。
2. 在 admin (`/admin.html`) → 内容源 新增：
   - 类型: `rss`
   - URL: 完整 feed URL
   - Config (JSON):
     ```json
     {
       "cookie": "ti_session=...; another=...",
       "headers": { "User-Agent": "Mozilla/5.0" },
       "max_items_per_poll": 25
     }
     ```
3. 系统每 15 分钟（或按 `poll_interval_minutes`）轮询。
4. 也可手动触发：admin 的 "📡 拉取 RSS 源"。

### Basic Auth 形式

如果源用 Basic Auth：
```json
{ "auth": { "user": "...", "pass": "..." } }
```

## 3. 第三方 API / 数据合作

WSJ Pro、Bloomberg Terminal、Refinitiv 等通常有 partner API。

1. 在 admin 新建一个 `api` 类型的源（仅占位，记录 vendor）。
2. 自己写一个 cron job / lambda 把文章 POST 到：
   ```
   POST https://<your-vercel-domain>/api/ingest/api-import
   Header: x-admin-token: $ADMIN_TOKEN
   Body: {
     "source_id": "uuid-of-the-source",
     "items": [
       {
         "external_id": "wsj-12345",
         "url": "https://...",
         "title": "...",
         "author": "...",
         "published_at": "2026-05-25T01:00:00Z",
         "text": "...",
         "topics": ["markets","china"]
       }
     ]
   }
   ```

## 4. 登录态网页抓取 (Last resort)

仅当上面三种都不可行时考虑。**会违反多数发布方 ToS**，请在购买合约里确认允许。

### 自建 Scrape Worker (Playwright)

部署一个独立服务（推荐 [browserless.io](https://browserless.io) 或自托管 Playwright on Fly.io）：

```
POST /scrape
Authorization: Bearer $SCRAPE_WORKER_TOKEN
Body: { "source": <full sources row> }

Response: {
  "items": [
    {
      "url": "...",
      "title": "...",
      "author": "...",
      "published_at": "ISO8601",
      "html": "<article>...</article>",
      "text": "plaintext"
    }
  ]
}
```

把 Worker URL + token 写进 `SCRAPE_WORKER_URL` / `SCRAPE_WORKER_TOKEN`，然后在 admin 新建 `scrape` 类型源（把登录凭据放进 `config`）。

Worker 端要负责：
- 用 `source.config.cookies` 注入登录态
- 翻当日列表页 → 进每篇详情 → 提取正文
- 处理风控 / 节流 (人间间隔、residential proxy)

## 5. 话题标签

自动标签由 `lib/topic.js` 关键词规则生成；用户在 `user_preferences.topics` 里勾选感兴趣的话题（`ai`, `markets`, `china`, `us`, `startup`, `macro`, `crypto`, `tech`, `energy`, `geopolitics`）。

要新增话题：编辑 `lib/topic.js` 的 `RULES` 数组。

## 6. 验证采集是否成功

- `/admin.html → 内容源` 查看 `last_polled_at` 和 `last_status`
- 进 Supabase Studio 查 `ingest_jobs` 表的 job log
- 进 `/dashboard.html` 看文章流是否出现
