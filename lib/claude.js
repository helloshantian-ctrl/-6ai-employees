// Thin Anthropic Messages API wrapper (no SDK).
// Used by summarize + digest pipelines.

const API_URL = "https://api.anthropic.com/v1/messages";

const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  default: "claude-sonnet-4-6",
  best: "claude-opus-4-7",
};

async function complete({ system, messages, model = MODELS.default, maxTokens = 2048, temperature = 0.3 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic ${res.status}: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  return {
    text,
    model: data.model,
    usage: data.usage,
  };
}

// Convenience: ask the model to return JSON; parse the first {...} block defensively.
async function completeJson(opts) {
  const out = await complete(opts);
  const match = out.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON: " + out.text.slice(0, 200));
  try {
    return { ...out, json: JSON.parse(match[0]) };
  } catch (e) {
    throw new Error("JSON parse failed: " + e.message + " | raw: " + match[0].slice(0, 200));
  }
}

module.exports = { complete, completeJson, MODELS };
