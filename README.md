# 🇻🇳 越南出海投资顾问 · 智能体平台

> Vietnam Overseas Investment Advisory Platform · Powered by Claude

基于 Claude 的越南出海投资顾问智能体平台。一个**目标工作台**把出海目标拆解为可执行落地路线图，外加 **6 位专业顾问智能体**随时对话。零服务器、一键部署到 Vercel，API Key 仅存于服务端。

---

## 🎯 平台能力

### 目标工作台（Goal-Driven）
输入出海目标 + 行业 / 预算 / 区域 / 阶段，**首席顾问（Claude）**自动拆解为结构化落地路线图：

- **落地阶段**：分 3–5 个阶段，含时间窗口、目标、关键动作、对应顾问
- **关键风险与对策**
- **可争取的优惠政策**（优惠税率、园区减免、自贸协定关税…）
- **落地清单**（证照 / 合规 / 资金 / 团队）
- **建议优先咨询的顾问**（一键跳转对话）
- **整体时间预估 + 立即可做的第一步**

### 6 位专业顾问智能体

| 顾问 | 职能 |
|---|---|
| 🏛️ 市场准入与公司注册 | IRC/ERC、外资准入、条件性行业、负面清单 |
| ⚖️ 法律与外资政策 | 投资法/企业法、土地、合规与争议解决 |
| 💰 税务与财务 | CIT 20% 与优惠税率、增值税、FCT、利润汇出 |
| 🏭 选址与工业园区 | 北中南三区、VSIP/DEEP C、地价基建港口 |
| 👥 人力资源与用工 | 四档最低工资、社保 ~21.5%、工作许可 |
| 🚚 供应链与物流贸易 | CPTPP/EVFTA/RCEP、原产地规则、港口关务 |

---

## 🚀 一键部署到 Vercel

### 前置条件
- [Anthropic API Key](https://console.anthropic.com/settings/keys)
- [Vercel 账号](https://vercel.com)（免费）

### 部署步骤

```bash
# 1. 安装并登录 Vercel CLI
npm i -g vercel
vercel login

# 2. 在项目根目录部署（首次会创建项目）
vercel

# 3. 设置环境变量
vercel env add ANTHROPIC_API_KEY     # 粘贴 sk-ant-api03-... Key
vercel env add ACCESS_PASSWORD        # （可选）应用访问密码
vercel env add AUTH_USERNAME          # （可选）边缘 Basic Auth 用户名
vercel env add AUTH_PASSWORD          # （可选）边缘 Basic Auth 密码

# 4. 正式部署
vercel --prod
```

### 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API Key，在 console.anthropic.com 获取 |
| `ACCESS_PASSWORD` | 可选 | 应用内访问密码；设置后调用接口需在侧边栏填入。不设则任何人可用 |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | 可选 | 边缘 Basic Auth（保护整个站点）。默认 `huawei` / `aigcs@2026` |

部署完成后访问 `https://your-project.vercel.app`。

---

## 📁 项目结构

```
.
├── api/
│   ├── chat.js          # Claude 安全代理（顾问对话）
│   └── goal.js          # 目标工作台：目标 → 结构化路线图
├── public/
│   ├── index.html       # 单页应用（目标工作台 + 顾问对话）
│   └── robots.txt
├── build-secure.sh      # Vercel 构建：静态 + Serverless 函数 + Basic Auth 中间件
├── vercel.json
└── package.json
```

---

## 🔒 安全特性

- **API Key 隐藏**：Key 只存服务端环境变量，前端完全不暴露
- **双层访问控制**：边缘 Basic Auth（站点级）+ 应用访问密码（接口级）
- **速率限制**：对话 80 次/小时·IP，目标分解 30 次/小时·IP
- **模型白名单**：仅允许 Opus 4.8 / Sonnet 4.6 / Haiku 4.5
- **失败重试**：对 429/5xx/529 指数退避重试
- **安全响应头**：X-Frame-Options、X-Content-Type-Options、Referrer-Policy 等

---

## 🧠 模型

默认 **Claude Opus 4.8**（顾问对话与目标拆解的锐度最佳）。可在侧边栏切换：

| 模型 | 说明 | 成本 |
|------|------|------|
| `claude-opus-4-8` | 推荐，深度推演最强 | $$$ |
| `claude-sonnet-4-6` | 均衡、更快 | $$ |
| `claude-haiku-4-5` | 最省成本 | $ |

---

## 📝 自定义

- **修改顾问角色**：编辑 `public/index.html` 中的 `ADVISORS` 数组（`sys` 字段为 System Prompt）
- **修改首席顾问拆解逻辑**：编辑 `api/goal.js` 的 `GOAL_SYSTEM`
- **调整速率限制**：编辑各 `api/*.js` 顶部的 `RATE_LIMIT`

---

## ⚠️ 免责声明

本平台内容由 Claude 生成，仅供越南出海决策**参考**，不构成法律、税务或投资意见。涉及税率、工资、地价、政策等数字均为参考区间，落地前请与持牌专业机构核实最新法规。

## License

MIT
