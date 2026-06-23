import Anthropic from "@anthropic-ai/sdk";
import type { AlbumCondition } from "@/types";

// Lazy-init so the module doesn't crash if ANTHROPIC_API_KEY is unset at import time
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it to your environment variables to enable AI features."
    );
  }
  return new Anthropic();
}

export interface AIPricingInput {
  artist: string;
  title: string;
  genre?: string | null;
  condition: AlbumCondition;
  catalogNumber?: string | null;
  notes?: string | null;
  // Discogs market data
  discogsNumForSale?: number;
  discogsLowest?: number;
  discogsMedian?: number;
  discogsPriceForCondition?: number;
  discogsAllConditionPrices?: Record<string, number>;
  discogsReleaseYear?: string;
  // eBay market data
  ebayCount?: number;
  ebayMedian?: number;
  ebayLowest?: number;
  ebayHighest?: number;
  ebaySampleListings?: Array<{ price: number; title: string }>;
  // Current suggested price (from rule-based system)
  currentSuggestedPrice?: number;
}

export interface AIPricingResult {
  suggestedPrice: number;
  priceRange: { low: number; high: number };
  reasoning: string;
  strategy: "premium" | "competitive" | "clearance";
  confidence: "low" | "medium" | "high";
}

/* ─────────────────────────────────────────────────────────────────────────────
   AI Listing Description
───────────────────────────────────────────────────────────────────────────── */

export interface AIDescriptionInput {
  artist: string;
  title: string;
  genre?: string | null;
  condition: AlbumCondition;
  catalogNumber?: string | null;
  notes?: string | null;
  releaseYear?: string | null;
  suggestedPrice?: number | null;
  platform?: "ebay" | "discogs" | "both";
}

export async function generateListingDescription(
  input: AIDescriptionInput
): Promise<string> {
  const client = getClient();

  const platform =
    input.platform === "ebay"
      ? "eBay"
      : input.platform === "discogs"
        ? "Discogs"
        : "eBay and Discogs";

  const albumDetails = [
    `Artist: ${input.artist}`,
    `Title: ${input.title}`,
    input.genre ? `Genre: ${input.genre}` : null,
    `Condition: ${input.condition}`,
    input.catalogNumber ? `Catalog #: ${input.catalogNumber}` : null,
    input.releaseYear ? `Year: ${input.releaseYear}` : null,
    input.notes?.trim() ? `Seller notes: ${input.notes.trim().slice(0, 300)}` : null,
    input.suggestedPrice ? `Listing price: $${input.suggestedPrice.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are an expert vinyl record seller with deep knowledge of music history, pressing values, and what drives buyers to purchase. Write a compelling, honest listing description for the vinyl record below. The description will be used on ${platform}.

Guidelines:
- Open with a strong hook about the artist or album's significance (1–2 sentences)
- State the condition clearly and what the buyer can expect
- Mention why this record is worth owning (cultural impact, collectability, sound quality, era)
- Reference any notable details from the seller notes if relevant
- Close with a short, confident statement about careful, secure packaging / buying with confidence
- Length: 150–220 words
- Tone: knowledgeable, enthusiastic but honest — like a trusted record shop owner
- Plain text only, no markdown headers or bullet points
- IMPORTANT: Do NOT promise or state any specific shipping, handling, or delivery timeframe (e.g. "ships within 2 days", "arrives in a week", "same-day shipping"). Shipping speed is set by the platform's policies, not the description. Only speak generally about careful packaging and prompt, reliable handling.

ALBUM:
${albumDetails}

Write ONLY the description text, nothing else:`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  if (!text) throw new Error("AI returned an empty description");
  return text;
}

/* ─────────────────────────────────────────────────────────────────────────────
   AI Pricing Suggestion
───────────────────────────────────────────────────────────────────────────── */

export async function getAIPricingSuggestion(
  input: AIPricingInput
): Promise<AIPricingResult> {
  getClient(); // validates key early

  // Build a concise but data-rich prompt
  const marketLines: string[] = [];

  if (
    input.discogsPriceForCondition != null ||
    input.discogsMedian != null ||
    input.discogsNumForSale != null
  ) {
    const parts: string[] = [];
    if (input.discogsNumForSale != null)
      parts.push(`${input.discogsNumForSale} copies for sale`);
    if (input.discogsPriceForCondition != null)
      parts.push(`suggested for this grade: $${input.discogsPriceForCondition.toFixed(2)}`);
    if (input.discogsMedian != null && input.discogsMedian !== input.discogsPriceForCondition)
      parts.push(`median across all grades: $${input.discogsMedian.toFixed(2)}`);
    if (input.discogsLowest != null)
      parts.push(`lowest active: $${input.discogsLowest.toFixed(2)}`);
    marketLines.push(`Discogs: ${parts.join(", ")}`);
  }

  if (input.discogsAllConditionPrices && Object.keys(input.discogsAllConditionPrices).length > 0) {
    const grades = Object.entries(input.discogsAllConditionPrices)
      .map(([g, p]) => `${g}: $${p.toFixed(2)}`)
      .join(", ");
    marketLines.push(`Discogs grade breakdown: ${grades}`);
  }

  if (input.ebayCount != null && input.ebayCount > 0) {
    const parts: string[] = [];
    parts.push(`${input.ebayCount} active listings`);
    if (input.ebayMedian != null) parts.push(`median asking: $${input.ebayMedian.toFixed(2)}`);
    if (input.ebayLowest != null && input.ebayHighest != null)
      parts.push(`range: $${input.ebayLowest.toFixed(2)}–$${input.ebayHighest.toFixed(2)}`);
    marketLines.push(`eBay: ${parts.join(", ")}`);
  }

  if (input.ebaySampleListings && input.ebaySampleListings.length > 0) {
    const samples = input.ebaySampleListings
      .slice(0, 3)
      .map((l) => `"${l.title.slice(0, 50)}" at $${l.price.toFixed(2)}`)
      .join("; ");
    marketLines.push(`eBay sample listings: ${samples}`);
  }

  const albumDetails = [
    `Artist: ${input.artist}`,
    `Title: ${input.title}`,
    input.genre ? `Genre: ${input.genre}` : null,
    `Condition: ${input.condition}`,
    input.catalogNumber ? `Catalog #: ${input.catalogNumber}` : null,
    input.discogsReleaseYear ? `Year: ${input.discogsReleaseYear}` : null,
    input.notes ? `Notes: ${input.notes.slice(0, 200)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const currentPrice =
    input.currentSuggestedPrice != null
      ? `\nRule-based suggested price (median × condition multiplier): $${input.currentSuggestedPrice.toFixed(2)}`
      : "";

  // Static system prompt is identical across every call — cache it with
  // ephemeral cache_control so the bulk button charges 10% of normal input
  // cost on the role/instructions portion after the first call.
  const systemPrompt = `You are an expert vinyl record market analyst with deep knowledge of collector demand, pressing rarity, and pricing dynamics on Discogs and eBay.

Analyse each album and its market data, then recommend the optimal selling price. Consider: artist collectability, pressing rarity, genre demand trends, condition premium/discount vs. market, and whether the market is oversupplied or tight.

Respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON:
{
  "suggestedPrice": <number, 2 decimal places>,
  "priceRange": { "low": <number>, "high": <number> },
  "reasoning": "<2–3 sentences: why this price, what market factors matter, any caveats>",
  "strategy": "<one of: premium | competitive | clearance>",
  "confidence": "<one of: low | medium | high>"
}`;

  const userPrompt = `ALBUM
${albumDetails}

MARKET DATA
${marketLines.length > 0 ? marketLines.join("\n") : "No market data available — use genre knowledge only."}
${currentPrice}`;

  const client = getClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  // Parse — strip any accidental markdown fences
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: AIPricingResult;
  try {
    parsed = JSON.parse(jsonText) as AIPricingResult;
  } catch {
    throw new Error(`AI returned non-JSON response: ${text.slice(0, 200)}`);
  }

  // Validate and normalise
  const price = Number(parsed.suggestedPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("AI returned an invalid price");
  }

  return {
    suggestedPrice: Math.round(price * 100) / 100,
    priceRange: {
      low: Math.round(Number(parsed.priceRange?.low ?? price * 0.85) * 100) / 100,
      high: Math.round(Number(parsed.priceRange?.high ?? price * 1.15) * 100) / 100,
    },
    reasoning: String(parsed.reasoning ?? ""),
    strategy: (["premium", "competitive", "clearance"].includes(parsed.strategy)
      ? parsed.strategy
      : "competitive") as AIPricingResult["strategy"],
    confidence: (["low", "medium", "high"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium") as AIPricingResult["confidence"],
  };
}
