const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");

const SANITY_API = `https://${process.env.SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/mutate/${process.env.SANITY_DATASET}`;
const SANITY_TOKEN = process.env.SANITY_TOKEN;

function key() {
  return crypto.randomUUID().slice(0, 8);
}

function sanitize(persona) {
  const doc = {
    _type: "persona",
    title: String(persona.title || "Untitled"),
    prompt: "",
    emoji: String(persona.emoji || ""),
    heroTitle: String(persona.heroTitle || ""),
    heroDesc: String(persona.heroDesc || ""),
    scenarioEmoji: String(persona.scenarioEmoji || ""),
    scenarioTitle: String(persona.scenarioTitle || ""),
    scenarioText: String(persona.scenarioText || ""),
    closeStatement: String(persona.closeStatement || ""),
  };

  // Slug
  const rawSlug =
    typeof persona.slug === "string"
      ? persona.slug
      : persona.slug?.current || persona.title || "persona";
  doc.slug = {
    _type: "slug",
    current: String(rawSlug)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96),
  };

  // Context cards
  doc.context = (persona.context || []).map((c) => ({
    _key: key(),
    _type: "object",
    title: String(c.title || ""),
    items: (c.items || []).map(String),
  }));

  // Stages
  doc.stages = (persona.stages || []).map((s) => ({
    _key: key(),
    _type: "object",
    heading: String(s.heading || ""),
    subtitle: String(s.subtitle || ""),
    quote: String(s.quote || ""),
    outcome: String(s.outcome || ""),
    cards: (s.cards || []).map((c) => ({
      _key: key(),
      _type: "object",
      icon: String(c.icon || ""),
      title: String(c.title || ""),
      style: ["default", "highlight", "action", "full"].includes(c.style) ? c.style : "default",
      items: (c.items || []).map(String),
    })),
    feelings: (s.feelings || []).map(String),
    actions: (s.actions || []).map(String),
    interactions: (s.interactions || []).map(String),
    painpoints: (s.painpoints || []).map(String),
    improvements: (s.improvements || []).map(String),
  }));

  // Metrics
  doc.metrics = (persona.metrics || []).map((m) => ({
    _key: key(),
    _type: "object",
    value: String(m.value || ""),
    label: String(m.label || ""),
  }));

  return doc;
}

const SYSTEM_PROMPT = `You are a customer lifecycle expert for Anticimex, a global pest control and prevention company operating in 22 countries with 234+ branches.

You generate detailed customer persona journey data for Anticimex's 5-stage customer lifecycle:
1. Awareness
2. Consideration
3. Decision
4. Service
5. Loyalty

Given a persona description, generate a complete JSON object that maps this persona's journey through all 5 lifecycle stages, tailored to Anticimex's pest control and prevention services.

The JSON must follow this exact structure:

{
  "title": "Short persona title, e.g. Hotel Chain — 50 Locations",
  "slug": "kebab-case-slug",
  "emoji": "single emoji representing this persona",
  "heroTitle": "A compelling title with one <em>emphasized</em> word — about their journey from problem to partnership",
  "heroDesc": "A paragraph describing how the Anticimex lifecycle transforms this customer — mentioning their specific context and challenges.",
  "scenarioEmoji": "single emoji for the scenario",
  "scenarioTitle": "The scenario",
  "scenarioText": "A specific, vivid paragraph describing this persona's situation, challenges, and what they need from pest control.",
  "context": [
    {
      "title": "Emotional state",
      "items": ["5 specific emotional states relevant to this persona"]
    },
    {
      "title": "What they need",
      "items": ["5 specific needs"]
    },
    {
      "title": "Decision drivers",
      "items": ["5 decision factors"]
    }
  ],
  "stages": [
    {
      "heading": "Stage heading from the customer's perspective",
      "subtitle": "A direct quote from this persona in this stage",
      "cards": [
        {
          "icon": "single emoji",
          "title": "Card title",
          "items": ["3-5 specific bullet points"],
          "style": "default"
        },
        {
          "icon": "single emoji",
          "title": "Card title",
          "items": ["3-5 specific bullet points"],
          "style": "highlight"
        }
      ],
      "quote": "A longer, vivid first-person narrative quote (3-4 sentences) from this persona at this stage. Make it feel real and specific to their situation.",
      "feelings": ["4 specific feelings"],
      "actions": ["4 specific actions they take"],
      "interactions": ["4 specific touchpoints"],
      "painpoints": ["4 specific pain points"],
      "improvements": ["4 specific improvements Anticimex could make"],
      "outcome": "One sentence describing the positive outcome of this stage."
    }
  ],
  "closeStatement": "A compelling 2-sentence summary of this persona's complete journey — from their initial problem to long-term partnership with Anticimex.",
  "metrics": [
    { "value": "number or short text", "label": "Metric description" },
    { "value": "number or short text", "label": "Metric description" },
    { "value": "number or short text", "label": "Metric description" },
    { "value": "number or short text", "label": "Metric description" }
  ]
}

IMPORTANT RULES:
- Generate exactly 5 stages (Awareness, Consideration, Decision, Service, Loyalty)
- Each stage must have 2-3 cards with varying styles: "default", "highlight", "action", or "full"
- At least one card per stage should use "highlight" or "action" style
- All content must be specific to this persona and Anticimex pest control services
- Quotes should feel authentic and use natural, conversational language
- Include Anticimex-specific elements: SMART monitoring, IPM approach, branch model, Prevention Score, technician expertise
- The slug should be lowercase, hyphenated, max 60 chars
- heroTitle must contain exactly one <em>word</em> tag
- Return ONLY the JSON object, no markdown code fences or other text`;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { prompt, passphrase } = body;

  if (!passphrase || passphrase !== process.env.PASSPHRASE) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: "Invalid passphrase" }),
    };
  }

  if (!prompt || prompt.trim().length < 3) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Please provide a persona description" }),
    };
  }

  try {
    const anthropic = new Anthropic();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Generate a detailed Anticimex customer lifecycle persona journey for: ${prompt.trim()}`,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const text = message.content[0].text;
    let persona;
    try {
      persona = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        persona = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse Claude response as JSON");
      }
    }

    const doc = sanitize(persona);
    doc.prompt = prompt.trim();

    // Use raw Sanity mutation API to bypass client validation
    const res = await fetch(SANITY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SANITY_TOKEN}`,
      },
      body: JSON.stringify({
        mutations: [{ create: doc }],
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Sanity error:", JSON.stringify(result));
      throw new Error(result.error?.description || result.message || "Sanity create failed");
    }

    const createdId = result.results?.[0]?.id;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        _id: createdId,
        title: doc.title,
        slug: doc.slug,
      }),
    };
  } catch (err) {
    console.error("Generation error:", err.message || err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message || "Failed to generate persona. Please try again.",
      }),
    };
  }
};
