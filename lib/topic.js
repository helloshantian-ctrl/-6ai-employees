// Lightweight topic classifier (keyword-based fallback).
// Used to tag articles when the source doesn't provide a taxonomy.
// Real classification can later be swapped to Claude or embeddings.

const RULES = [
  ["ai",        /(\bAI\b|artificial intelligence|machine learning|GPT|Claude|LLM|大模型|人工智能|机器学习)/i],
  ["markets",   /(market|stocks|bonds|treasury|earnings|股市|股票|债券|国债|财报|期货|汇率)/i],
  ["china",     /(China|Beijing|Shanghai|Shenzhen|Tencent|Alibaba|中国|北京|上海|深圳|腾讯|阿里巴巴|字节)/i],
  ["us",        /(United States|Washington|White House|Federal Reserve|Fed\b|美国|美联储|白宫)/i],
  ["startup",   /(startup|founder|seed round|series [a-d]|创业|融资|天使轮|VC)/i],
  ["macro",     /(inflation|GDP|recession|jobs report|通胀|衰退|GDP|就业)/i],
  ["crypto",    /(bitcoin|ethereum|crypto|blockchain|stablecoin|加密|区块链|比特币)/i],
  ["tech",      /(Apple|Google|Microsoft|Meta|Nvidia|chip|semiconductor|芯片|半导体|苹果|谷歌|微软|英伟达)/i],
  ["energy",    /(oil|OPEC|renewable|solar|EV\b|电动车|石油|能源|光伏)/i],
  ["geopolitics",/(Russia|Ukraine|Middle East|Israel|Taiwan|sanctions|俄罗斯|乌克兰|中东|以色列|台湾|制裁)/i],
];

function classify(text) {
  if (!text) return [];
  const hit = new Set();
  for (const [topic, re] of RULES) if (re.test(text)) hit.add(topic);
  return [...hit];
}

module.exports = { classify, RULES };
