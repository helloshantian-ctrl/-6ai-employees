# 部署指南

## 1. Supabase 项目

1. [supabase.com](https://supabase.com) → New project
2. 在 SQL editor 中粘贴 [`db/schema.sql`](../db/schema.sql) 并运行
3. Settings → API 复制：
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE` (**只放后端**)

## 2. Anthropic API Key

[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) → 生成 → `ANTHROPIC_API_KEY`

## 3. (可选) Resend

- 注册 [resend.com](https://resend.com)
- 绑定发送域名，拿到 `RESEND_API_KEY`，设置 `RESEND_FROM`（如 `"AI Briefing <briefing@yourdomain.com>"`）
- 启用 Inbound (用于接收 newsletter 转发) → 设置 webhook，生成 `RESEND_INBOUND_SECRET`

## 4. Vercel 部署

```bash
npm i -g vercel
vercel link
vercel env add ANTHROPIC_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE
vercel env add ADMIN_TOKEN          # openssl rand -hex 32
vercel env add CRON_SECRET          # openssl rand -hex 32
vercel env add AUTH_USERNAME        # 仪表盘 Basic Auth 用户
vercel env add AUTH_PASSWORD
vercel env add ACCESS_PASSWORD      # 老聊天界面的访问密码 (可选)
vercel env add RESEND_API_KEY       # 可选
vercel env add RESEND_FROM          # 可选
vercel env add RESEND_INBOUND_SECRET  # 可选
vercel --prod
```

部署后：
- `https://<domain>/` → 原来的 6 AI 员工聊天
- `https://<domain>/dashboard.html` → 用户简报 dashboard (Basic Auth)
- `https://<domain>/admin.html` → 管理后台 (Basic Auth + Admin Token)

## 5. 配置 Cron Secret

Vercel Cron 默认会发 `Authorization: Bearer <CRON_SECRET>` 当且仅当你在 Vercel Dashboard 的 Cron 设置里把 `CRON_SECRET` 标记为环境变量。如果没设置，cron 调用会被 `lib/auth.js` 拒绝。

> 一个简单替代：把 `x-cron-secret` 通过 Vercel "Headers" 配置注入。我们这里两种都支持。

## 6. 创建初始数据

进入 `/admin.html`，输入 ADMIN_TOKEN，按以下顺序：

1. **添加源**（RSS / Email / API / Scrape）
2. **创建用户** 并配置：
   - 订阅偏好（话题、风格、频次、每期条数）
   - 分发目标 JSON 数组
3. **手动触发** "🌀 跑完整流水线" 验证

## 7. 本地开发

```bash
cp .env.example .env.local
# 填入环境变量后：
node test-server.js
# → http://localhost:3000
```

> `test-server.js` 仅会路由 `/api/chat`。新增的 API 路由建议直接 `vercel dev`：
> ```bash
> npm i -g vercel
> vercel dev
> ```

## 8. 常见问题

- **PostgREST `42P01: relation "x" does not exist`** → 没跑 `db/schema.sql`
- **`SUPABASE_URL not set`** → Vercel 没 `vercel env add`
- **Cron 返回 401** → `CRON_SECRET` 配置不正确，或者 Vercel cron 没注入 header
- **总结失败 `Anthropic 429`** → 触发 rate limit，降低 cron 频率或改用 `claude-haiku-4-5-20251001`
- **dedupe 不工作** → 同一 URL 标题正文必须完全一致才会命中 `content_hash`；改正文措辞会被当成新文章
