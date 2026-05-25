# 🎬 Demo 模式

零配置本地预览。不需要 Supabase / Vercel / 任何环境变量，开箱即跑。

## 启动

```bash
node demo/server.js
```

浏览器打开：

- **http://localhost:3000/dashboard.html** — 用户简报 dashboard（10 篇仿真文章 + 已生成的简报）
- **http://localhost:3000/admin.html** — 管理后台（demo 模式下无需 token）
- **http://localhost:3000/index.html** — 6 AI 员工聊天界面（这个需要 `ANTHROPIC_API_KEY`）

## 预置数据

| 内容 | 数量 |
|------|------|
| 内容源 (WSJ / The Information / Bloomberg / Stratechery / FT) | 5 |
| 仿真文章 (财经 + AI + 科技 + 能源 + 加密) | 10 |
| 中文 AI 摘要 (title_cn + one_liner + bullets) | 10 |
| 用户 + 订阅偏好 | 2 |
| 已生成的简报 | 1 |

## 可玩的事

1. 浏览 **dashboard**: 看话题流、点话题筛选、切到"我的简报" tab
2. 进 **admin**: 点 "📡 拉取 RSS 源" — 真的会去拉 Hacker News RSS 进来作为新文章
3. 点 "📨 生成简报" — 立刻为 demo 用户重新编排一份简报，刷新 dashboard 就能看到
4. 点 "🌀 完整流水线" — 一键跑 ingest + summarize + digest

## 接入真 Claude

如果想看真实 AI 总结效果（而不是预置的 mock 摘要），设置一个 key：

```bash
ANTHROPIC_API_KEY=sk-ant-xxx node demo/server.js
```

之后 "📡 拉取 RSS" 拉进来的新文章会自动调 Claude 出真摘要。

## 数据存储

完全在内存里。重启 server 会回到 seed 数据。`POST /api/_reset` 手动重置。

## 和生产模式的关系

Demo server 实现的是 **同样的 HTTP API**（`/api/articles/list`, `/api/digest/generate` ...），所以前端 dashboard/admin 页面共用一套，零修改。生产模式只是把内存存储换成 Supabase，把发送 webhook 换成真的 HTTP 调用。

部署生产版的步骤见 [docs/deployment.md](docs/deployment.md)。
