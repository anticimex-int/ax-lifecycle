import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

const SANITY_API = `https://${process.env.SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${process.env.SANITY_DATASET}?returnIds=true`;

function key() { return crypto.randomUUID().slice(0, 8); }

function sanitize(persona, prompt) {
  const slug = typeof persona.slug === "string" ? persona.slug : persona.slug?.current || persona.title || "persona";
  return {
    _type: "persona",
    title: String(persona.title || "Untitled"),
    slug: { _type: "slug", current: String(slug).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) },
    prompt: String(prompt),
    emoji: String(persona.emoji || ""),
    heroTitle: String(persona.heroTitle || ""),
    heroDesc: String(persona.heroDesc || ""),
    scenarioEmoji: String(persona.scenarioEmoji || ""),
    scenarioTitle: String(persona.scenarioTitle || ""),
    scenarioText: String(persona.scenarioText || ""),
    closeStatement: String(persona.closeStatement || ""),
    context: (persona.context || []).map(c => ({ _key: key(), title: String(c.title || ""), items: (c.items || []).map(String) })),
    stages: (persona.stages || []).map(s => ({
      _key: key(), heading: String(s.heading || ""), subtitle: String(s.subtitle || ""),
      quote: String(s.quote || ""), outcome: String(s.outcome || ""),
      cards: (s.cards || []).map(c => ({
        _key: key(), icon: String(c.icon || ""), title: String(c.title || ""),
        style: ["default","highlight","action","full"].includes(c.style) ? c.style : "default",
        items: (c.items || []).map(String),
      })),
      feelings: (s.feelings || []).map(String), actions: (s.actions || []).map(String),
      interactions: (s.interactions || []).map(String), painpoints: (s.painpoints || []).map(String),
      improvements: (s.improvements || []).map(String),
    })),
    metrics: (persona.metrics || []).map(m => ({ _key: key(), value: String(m.value || ""), label: String(m.label || "") })),
  };
}

const SYSTEM_PROMPT = `Generate a JSON object for an Anticimex pest control customer lifecycle. Structure:
{"title":"","slug":"kebab-case","emoji":"","heroTitle":"text with <em>one</em> word","heroDesc":"","scenarioEmoji":"","scenarioTitle":"","scenarioText":"","context":[{"title":"Emotional state","items":["5 items"]},{"title":"What they need","items":["5 items"]},{"title":"Decision drivers","items":["5 items"]}],"stages":[{"heading":"","subtitle":"quote","cards":[{"icon":"emoji","title":"","items":["3 items"],"style":"default|highlight|action"}],"quote":"2-3 sentences","feelings":["4"],"actions":["4"],"interactions":["4"],"painpoints":["4"],"improvements":["4"],"outcome":""}],"closeStatement":"","metrics":[{"value":"","label":""},{"value":"","label":""},{"value":"","label":""},{"value":"","label":""}]}
Rules: 5 stages (Awareness,Consideration,Decision,Service,Loyalty). 2 cards per stage. Be concise. Reference SMART monitoring, IPM, Prevention Score. Return ONLY JSON.`;

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }
  const jsonRes = (obj, s = 200) => new Response(JSON.stringify(obj), { status: s, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } });

  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return jsonRes({ error: "Invalid JSON" }, 400); }
  const { prompt } = body;
  if (!prompt || prompt.trim().length < 3) return jsonRes({ error: "Please provide a persona description" }, 400);

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [{ role: "user", content: `Anticimex customer lifecycle persona for: ${prompt.trim()}` }],
      system: SYSTEM_PROMPT,
    });

    const text = message.content[0].text;
    let persona;
    try { persona = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) persona = JSON.parse(m[0]); else throw new Error("Failed to parse AI response");
    }

    const doc = sanitize(persona, prompt.trim());
    const res = await fetch(SANITY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SANITY_TOKEN}` },
      body: JSON.stringify({ mutations: [{ create: doc }] }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error?.description || "Sanity save failed");

    return jsonRes({ _id: result.results?.[0]?.id, title: doc.title });
  } catch (err) {
    console.error("Generate error:", err);
    return jsonRes({ error: err.message || "Generation failed" }, 500);
  }
};
