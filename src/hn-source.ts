import type { Story } from "./types";

/**
 * Fetches candidate Stories created since `sinceUnixSeconds`, ranked by
 * score, capped at `limit`. Algolia HN Search API is the primary source
 * (server-side score/time filtering in one request); the official Firebase
 * API is a fallback if Algolia is unreachable (ticket 03).
 */
export async function fetchTopStories(sinceUnixSeconds: number, limit: number): Promise<Story[]> {
  try {
    return await fetchFromAlgolia(sinceUnixSeconds, limit);
  } catch (err) {
    console.error(
      `Algolia HN source failed, falling back to Firebase: ${(err as Error).message}`,
    );
    return await fetchFromFirebase(sinceUnixSeconds, limit);
  }
}

interface AlgoliaHit {
  objectID: string;
  title: string | null;
  url: string | null;
  points: number | null;
  num_comments: number | null;
  created_at_i: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

export async function fetchFromAlgolia(sinceUnixSeconds: number, limit: number): Promise<Story[]> {
  const url = new URL("https://hn.algolia.com/api/v1/search");
  url.searchParams.set("tags", "story");
  url.searchParams.set("numericFilters", `created_at_i>${sinceUnixSeconds}`);
  url.searchParams.set("hitsPerPage", String(limit));

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Algolia HN search failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as AlgoliaResponse;

  return data.hits.map((hit) => ({
    hnId: Number(hit.objectID),
    title: hit.title ?? "(untitled)",
    url: hit.url ?? null,
    points: hit.points ?? 0,
    numComments: hit.num_comments ?? 0,
    createdAt: hit.created_at_i,
  }));
}

const FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0";

interface FirebaseItem {
  id: number;
  type: string;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  time: number;
}

export async function fetchFromFirebase(sinceUnixSeconds: number, limit: number): Promise<Story[]> {
  const idsRes = await fetch(`${FIREBASE_BASE}/topstories.json`);
  if (!idsRes.ok) {
    throw new Error(`Firebase HN topstories fetch failed: ${idsRes.status} ${idsRes.statusText}`);
  }
  const ids = (await idsRes.json()) as number[];

  // No server-side score/time filter, so fetch every candidate item and
  // filter/sort client-side (ticket 03) — acceptable since this fallback
  // path is rarely exercised (only when Algolia itself is unreachable).
  const items = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`${FIREBASE_BASE}/item/${id}.json`);
      if (!res.ok) return null;
      return (await res.json()) as FirebaseItem | null;
    }),
  );

  const stories: Story[] = items
    .filter(
      (item): item is FirebaseItem =>
        item != null && item.type === "story" && item.time >= sinceUnixSeconds,
    )
    .map((item) => ({
      hnId: item.id,
      title: item.title ?? "(untitled)",
      url: item.url ?? null,
      points: item.score ?? 0,
      numComments: item.descendants ?? 0,
      createdAt: item.time,
    }));

  stories.sort((a, b) => b.points - a.points);
  return stories.slice(0, limit);
}
