# ⚡ 6 AI 员工系统

基于 Claude API 的 6 个 AI 员工智能工作台。复刻追日Gucci OpenClaw 系统，零服务器即可部署。

## 🤖 6 个 AI 员工

| # | 员工 | 职能 |
|---|------|------|
| 🌅 | 晨报助手 LALA | 邮件摘要 · 日程提醒 · 市场快报 · AI新闻 |
| 🧠 | 第二大脑 | URL抓取 · 智能摘要 · 分类归档 · 关联分析 |
| ✅ | 任务管理中心 | 任务看板 · 优先排序 · 进度追踪 · 周报 |
| 📝 | 内容策划管家 | 趋势研究 · 创意生成 · 竞品分析 · 内容日历 |
| 📊 | 数据分析中心 | 持仓分析 · 市场扫描 · 可视化图表 |
| 🧬 | 记忆管理中心 | 三层记忆 · 记忆体检 · 知识蒸馏 |

## 🚀 一键部署到 Vercel

### 前置条件
- [Anthropic API Key](https://console.anthropic.com/settings/keys)
- [Vercel 账号](https://vercel.com)（免费）
- Git

### 部署步骤

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd 6ai-employee-system

# 2. 安装 Vercel CLI
npm i -g vercel

# 3. 登录 Vercel
vercel login

# 4. 部署（首次会创建项目）
vercel

# 5. 设置环境变量
vercel env add ANTHROPIC_API_KEY     # 粘贴你的 sk-ant-api03-... Key
vercel env add ACCESS_PASSWORD        # 设置一个访问密码（用户需要输入这个才能使用）

# 6. 正式部署
vercel --prod
```

### 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API Key，在 console.anthropic.com 获取 |
| `ACCESS_PASSWORD` | 可选 | 访问密码，设置后用户需要输入密码才能使用。不设置则所有人可直接使用 |

## 📁 项目结构

```
6ai-vercel/
├── api/
│   └── chat.js          # Vercel Serverless Function（API 代理）
├── public/
│   └── index.html       # 前端单页应用
├── package.json
├── vercel.json          # Vercel 路由配置
└── README.md
```

## 🔒 安全特性

- **API Key 隐藏**：Key 只存在服务端环境变量，前端完全不暴露
- **访问密码**：可设置密码防止未授权访问
- **速率限制**：每 IP 每小时 60 次请求上限
- **模型白名单**：只允许调用指定模型
- **消息条数限制**：单次最多 30 条对话上下文

## 💰 费用估算

使用 Claude Sonnet 模型：
- 每次对话约 $0.02-0.05
- 个人使用（每天10次）：约 $9/月
- 小团队（每天50次）：约 $45/月

节省成本：可在 `api/chat.js` 中将模型改为 `claude-haiku-4-5-20251001`（便宜约10倍）

## 📝 自定义

### 修改 AI 员工角色
编辑 `public/index.html` 中的 `AGENTS` 数组，修改每个员工的 `sys`（System Prompt）字段。

### 添加新员工
在 `AGENTS` 数组中添加新对象，格式参照已有员工。

### 修改速率限制
编辑 `api/chat.js` 中的 `RATE_LIMIT` 常量。

## License

MIT
