import Anthropic from "@anthropic-ai/sdk";
import { resolveImageMediaType } from "@/lib/ai-cover-identify";

const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL ?? "claude-opus-4-5";
const MAX_REMOTE_IMAGE_BYTES = 4_000_000;

export type CompareConfidence = "high" | "medium" | "low" | "none";

export interface CompareCandidate {
  coverImage?: string;
}

export interface CompareResult {
  /** Index into the candidates array of the visual match, or -1 if none. */
  index: number;
  confidence: CompareConfidence;
}

async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_REMOTE_IMAGE_BYTES) return null;
    return { data: buffer.toString("base64"), mediaType: resolveImageMediaType(contentType) };
  } catch {
    return null;
  }
}

/**
 * Visually compare an uploaded album cover photo against a set of candidate
 * Discogs release covers, returning which candidate is the same album. This
 * complements OCR-based identification: it works even when stylized fonts make
 * the cover text unreadable, because it matches the artwork itself.
 *
 * Returns { index: -1 } when no candidate clearly matches, AI is unavailable,
 * or none of the candidate images could be fetched.
 */
export async function pickMatchingRelease(
  uploaded: Buffer,
  uploadedMime: string,
  candidates: CompareCandidate[]
): Promise<CompareResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { index: -1, confidence: "none" };

  const withImages: Array<{
    originalIndex: number;
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i].coverImage;
    if (!url) continue;
    const img = await fetchImageAsBase64(url);
    if (img) withImages.push({ originalIndex: i, data: img.data, mediaType: img.mediaType });
  }

  if (withImages.length === 0) return { index: -1, confidence: "none" };

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: "UPLOADED COVER — this is the album cover photo we need to identify:",
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: resolveImageMediaType(uploadedMime),
        data: uploaded.toString("base64"),
      },
    },
    {
      type: "text",
      text: "CANDIDATE COVERS from Discogs, each numbered. Compare the artwork (layout, imagery, colors, typography), ignoring photo glare, angle, cropping, and sleeve wear:",
    },
  ];

  withImages.forEach((c, n) => {
    content.push({ type: "text", text: `Candidate ${n}:` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: c.mediaType, data: c.data },
    });
  });

  content.push({
    type: "text",
    text: `Which candidate is the SAME album cover as the uploaded photo? If none clearly match, use -1. Respond with ONLY JSON, no markdown:
{"candidate": <number or -1>, "confidence": "high" | "medium" | "low" | "none"}`,
  });

  let text = "";
  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 100,
      messages: [{ role: "user", content }],
    });
    text = message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
  } catch {
    return { index: -1, confidence: "none" };
  }

  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(jsonText) as {
      candidate?: number;
      confidence?: CompareConfidence;
    };
    const localIndex = parsed.candidate;
    if (
      localIndex == null ||
      localIndex < 0 ||
      localIndex >= withImages.length
    ) {
      return { index: -1, confidence: "none" };
    }
    return {
      index: withImages[localIndex].originalIndex,
      confidence: parsed.confidence ?? "none",
    };
  } catch {
    return { index: -1, confidence: "none" };
  }
}
