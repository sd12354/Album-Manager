import type { Album } from "@/types";

export interface IdentifiedCover {
  artist: string;
  title: string;
  catalogNumber?: string | null;
  label?: string | null;
}

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface AlbumMatchCandidate {
  albumId: string;
  artist: string;
  title: string;
  score: number;
  confidence: MatchConfidence;
}

export interface AlbumMatchResult {
  match: AlbumMatchCandidate | null;
  alternatives: AlbumMatchCandidate[];
}

/** Strip noise so "The Hollywood Flames" ≈ "Hollywood Flames". */
export function normalizeAlbumText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeAlbumText(value)
      .split(" ")
      .filter((t) => t.length > 1)
  );
}

/** Token overlap (Jaccard) with substring boost for partial titles. */
export function textSimilarity(a: string, b: string): number {
  const na = normalizeAlbumText(a);
  const nb = normalizeAlbumText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;

  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  ta.forEach((token) => {
    if (tb.has(token)) intersection++;
  });
  const union = new Set([...Array.from(ta), ...Array.from(tb)]).size;
  return union > 0 ? intersection / union : 0;
}

function scoreConfidence(score: number): MatchConfidence {
  if (score >= 0.82) return "high";
  if (score >= 0.58) return "medium";
  if (score >= 0.4) return "low";
  return "none";
}

export function scoreAlbumMatch(
  identified: IdentifiedCover,
  album: Pick<Album, "id" | "artist" | "title" | "catalog_number">
): number {
  const artistScore = textSimilarity(identified.artist, album.artist);
  const titleScore = textSimilarity(identified.title, album.title);

  let score = artistScore * 0.42 + titleScore * 0.58;

  if (identified.catalogNumber && album.catalog_number) {
    const catA = normalizeAlbumText(identified.catalogNumber);
    const catB = normalizeAlbumText(album.catalog_number);
    if (catA && catB && (catA === catB || catA.includes(catB) || catB.includes(catA))) {
      score = Math.min(1, score + 0.25);
    }
  }

  return Math.round(score * 1000) / 1000;
}

export function findBestAlbumMatch(
  identified: IdentifiedCover,
  albums: Pick<Album, "id" | "artist" | "title" | "catalog_number">[]
): AlbumMatchResult {
  const ranked = albums
    .map((album) => {
      const score = scoreAlbumMatch(identified, album);
      return {
        albumId: album.id,
        artist: album.artist,
        title: album.title,
        score,
        confidence: scoreConfidence(score),
      };
    })
    .filter((c) => c.score >= 0.35)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] ?? null;
  const match =
    best && best.confidence !== "none" && best.score >= 0.58 ? best : null;

  return {
    match,
    alternatives: ranked.slice(0, 5),
  };
}
