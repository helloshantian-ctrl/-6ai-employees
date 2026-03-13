// test-server.js — 本地测试服务器，模拟 Vercel 路由行为
// 用法：ANTHROPIC_API_KEY=sk-xxx ACCESS_PASSWORD=test123 node test-server.js

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

// 动态加载 API handler
let chatHandler;
function loadHandler() {
  // 清除缓存以支持热更新
  delete require.cache[require.resolve("./api/chat.js")];
  const mod = require("./api/chat.js");
  chatHandler = mod.default || mod;
}
loadHandler();

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-access-code");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // API route
  if (req.url === "/api/chat" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        req.body = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid JSON" }));
      }

      // Mock Vercel's req/res interface
      const mockRes = {
        _status: 200,
        _headers: {},
        statusCode: 200,
        setHeader(k, v) { this._headers[k] = v; },
        status(code) { this._status = code; return this; },
        json(data) {
          res.writeHead(this._status, {
            "Content-Type": "application/json",
            ...this._headers
          });
          res.end(JSON.stringify(data));
        },
        end() { res.end(); }
      };

      // Forward x-forwarded-for for rate limiting
      req.headers["x-forwarded-for"] = req.headers["x-forwarded-for"] || "127.0.0.1";

      try {
        await chatHandler(req, mockRes);
      } catch (err) {
        console.error("Handler error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static files
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(__dirname, "public", filePath);

  const ext = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon"
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("  ⚡ 6 AI 员工系统 — 本地测试服务器");
  console.log("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  🌐 地址:  http://localhost:${PORT}`);
  console.log(`  🔑 API:   ${process.env.ANTHROPIC_API_KEY ? "✅ 已配置" : "❌ 未配置 (设置 ANTHROPIC_API_KEY)"}`);
  console.log(`  🔐 密码:  ${process.env.ACCESS_PASSWORD ? "✅ 已设置 (" + process.env.ACCESS_PASSWORD + ")" : "⚠️  未设置 (任何人可访问)"}`);
  console.log("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");
});
