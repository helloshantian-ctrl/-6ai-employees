// Channel dispatcher.
// Each deliverer exports `send({ target, digest })` → { ok, response, error }.

const email = require("./email");
const slack = require("./slack");
const discord = require("./discord");
const feishu = require("./feishu");
const wecom = require("./wecom");
const web = require("./web");

const REGISTRY = { email, slack, discord, feishu, wecom, web };

async function send({ target, digest }) {
  const handler = REGISTRY[target.channel];
  if (!handler) return { ok: false, error: `unknown channel: ${target.channel}` };
  try {
    const r = await handler.send({ target, digest });
    return { ok: r?.ok !== false, response: r?.response || r, error: r?.error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { send, REGISTRY };
