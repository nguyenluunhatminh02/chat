const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface LinkPreview {
  url: string;
  siteName?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  mediaType?: string; // "article" | "video" | "image" | ...
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Fetch link previews for multiple URLs
 */
export async function fetchLinkPreviews(
  urls: string[],
): Promise<LinkPreview[]> {
  const res = await fetch(`${BASE}/previews/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Get link previews for a specific message
 */
export async function getLinkPreviewsForMessage(
  messageId: string,
): Promise<LinkPreview[]> {
  const res = await fetch(`${BASE}/previews/by-message/${messageId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Extract URLs from text (client-side helper)
 */
export function extractUrls(text: string): string[] {
  const re = /\bhttps?:\/\/[^\s<>)\]]+/gi;
  const set = new Set<string>();
  for (const m of text.matchAll(re)) {
    try {
      set.add(new URL(m[0]).toString());
    } catch {
      // Invalid URL, skip
    }
  }
  return [...set].slice(0, 5); // Max 5 links per message
}
