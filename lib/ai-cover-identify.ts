import Anthropic from "@anthropic-ai/sdk";
import type { IdentifiedCover } from "@/lib/album-matching";

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it to enable cover photo matching."
    );
  }
  return new Anthropic();
}

const VISION_MODEL = "claude-sonnet-4-20250514";

const ACCEPTED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function resolveImageMediaType(
  mimeType: string | null | undefined
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (mimeType && ACCEPTED_MEDIA_TYPES.has(mimeType)) {
    return mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  }
  return "image/jpeg";
}

export async function identifyAlbumFromCover(
  imageBytes: Buffer,
  mimeType: string
): Promise<IdentifiedCover> {
  const client = getClient();
  const mediaType = resolveImageMediaType(mimeType);
  const base64 = imageBytes.toString("base64");

  const message = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: `You are reading text from a vinyl record album cover photo (front cover).

Extract ONLY what is clearly visible on the cover:
- artist: performing artist or band name (include "The" if printed)
- title: album title (not song titles unless this is a single; if the title repeats visually like "BUZZ BUZZ BUZZ", return the full title once as "Buzz Buzz Buzz")
- catalogNumber: catalog/label number if visible (e.g. SP 2166), else null
- label: record label name if visible, else null

Respond with ONLY valid JSON, no markdown:
{"artist":"...","title":"...","catalogNumber":null,"label":null}`,
          },
        ],
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let parsed: IdentifiedCover;
  try {
    parsed = JSON.parse(jsonText) as IdentifiedCover;
  } catch {
    throw new Error(`AI could not read the cover: ${text.slice(0, 120)}`);
  }

  const artist = String(parsed.artist ?? "").trim();
  const title = String(parsed.title ?? "").trim();
  if (!artist || !title) {
    throw new Error(
      "Could not identify artist and title from this cover. Try a clearer, front-on photo."
    );
  }

  return {
    artist,
    title,
    catalogNumber: parsed.catalogNumber ? String(parsed.catalogNumber).trim() : null,
    label: parsed.label ? String(parsed.label).trim() : null,
  };
}
