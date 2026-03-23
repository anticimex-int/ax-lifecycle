import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@sanity/client";

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_TOKEN,
  apiVersion: "2024-01-01",
  useCdn: false,
});

function key() {
  return crypto.randomUUID().slice(0, 8);
}

function sanitize(persona, prompt) {
  const slug =
    typeof persona.slug === "string"
      ? persona.slug
      : persona.slug?.current || persona.title || "persona";

  return {
    _type: "persona",
    title: String(persona.title || "Untitled"),
    slug: {
      _type: "slug",
      current: String(slug)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 96),
    },
    prompt: String(prompt),
    emoji: String(persona.emoji || ""),
    heroTitle: String(persona.heroTitle || ""),
    heroDesc: String(persona.heroDesc || ""),
    scenarioEmoji: String(persona.scenarioEmoji || ""),
    scenarioTitle: String(persona.scenarioTitle || ""),
    scenarioText: String(persona.scenarioText || ""),
    closeStatement: String(persona.closeStatement || ""),
    context: (persona.context || []).map((c) => ({
      _key: key(),
      title: String(c.title || ""),
      items: (c.items || []).map(String),
    })),
    stages: (persona.stages || []).map((s) => ({
      _key: key(),
      heading: String(s.heading || ""),
      subtitle: String(s.subtitle || ""),
      quote: String(s.quote || ""),
      outcome: String(s.outcome || ""),
      cards: (s.cards || []).map((c) => ({
        _key: key(),
          icon: String(c.icon || ""),
        title: String(c.title || ""),
        style: ["default", "highlight", "action", "full"].includes(c.style)
          ? c.style
          : "default",
        items: (c.items || []).map(String),
      })),
      feelings: (s.feelings || []).map(String),
      actions: (s.actions || []).map(String),
      interactions: (s.interactions || []).map(String),
      painpoints: (s.painpoints || []).map(String),
      improvements: (s.improvements || []).map(String),
    })),
    metrics: (persona.metrics || []).map((m) => ({
      _key: key(),
      value: String(m.value || ""),
      label: String(m.label || ""),
    })),
  };
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

export default async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  };

  const jsonHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders });
  }

  const { prompt, passphrase } = body;

  if (!passphrase || passphrase !== process.env.PASSPHRASE) {
    return new Response(JSON.stringify({ error: "Invalid passphrase" }), { status: 403, headers: jsonHeaders });
  }

  if (!prompt || prompt.trim().length < 3) {
    return new Response(JSON.stringify({ error: "Please provide a persona description" }), { status: 400, headers: jsonHeaders });
  }

  // Use SSE streaming to keep the connection alive
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => {
        controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("progress", { stage: "generating", message: "AI is generating the persona..." });

        // Stream from Claude to keep connection alive
        const anthropic = new Anthropic();
        let text = "";

        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          messages: [{ role: "user", content: `Generate a detailed Anticimex customer lifecycle persona journey for: ${prompt.trim()}` }],
          system: SYSTEM_PROMPT,
        });

        let chunkCount = 0;
        claudeStream.on("text", (chunk) => {
          text += chunk;
          chunkCount++;
          // Send progress every 20 chunks to keep connection alive
          if (chunkCount % 20 === 0) {
            send("progress", { stage: "generating", message: "AI is writing the persona journey..." });
          }
        });

        const finalMessage = await claudeStream.finalMessage();

        // If streaming didn't capture text, get it from final message
        if (!text && finalMessage.content[0]) {
          text = finalMessage.content[0].text;
        }

        send("progress", { stage: "saving", message: "Saving to database..." });

        // Parse JSON
        let persona;
        try {
          persona = JSON.parse(text);
        } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) persona = JSON.parse(m[0]);
          else throw new Error("Failed to parse AI response as JSON");
        }

        // Sanitize and write to Sanity
        const doc = sanitize(persona, prompt.trim());
        const created = await sanity.create(doc);

        send("done", { _id: created._id, title: created.title });
      } catch (err) {
        console.error("Generate error:", err);
        send("error", { error: err.message || "Generation failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { status: 200, headers: corsHeaders });
};

export const config = {
  path: "/.netlify/functions/generate",
};
