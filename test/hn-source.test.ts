import { afterEach, describe, expect, test } from "bun:test";
import { fetchFromAlgolia, fetchFromFirebase, fetchTopStories } from "../src/hn-source";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), { status: ok ? status : 500 });
}

describe("fetchFromAlgolia", () => {
  test("maps hits to Stories, defaulting missing optional fields", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: string | URL) => {
      requestedUrl = input.toString();
      return jsonResponse({
        hits: [
          {
            objectID: "123",
            title: "A great story",
            url: "https://example.com/a",
            points: 200,
            num_comments: 50,
            created_at_i: 1_700_000_000,
          },
          {
            objectID: "456",
            title: null,
            url: null,
            points: null,
            num_comments: null,
            created_at_i: 1_700_000_100,
          },
        ],
      });
    }) as unknown as typeof fetch;

    const stories = await fetchFromAlgolia(1_699_000_000, 15);

    expect(requestedUrl).toContain("tags=story");
    expect(requestedUrl).toContain("numericFilters=created_at_i%3E1699000000");
    expect(requestedUrl).toContain("hitsPerPage=15");
    expect(stories).toEqual([
      { hnId: 123, title: "A great story", url: "https://example.com/a", points: 200, numComments: 50, createdAt: 1_700_000_000 },
      { hnId: 456, title: "(untitled)", url: null, points: 0, numComments: 0, createdAt: 1_700_000_100 },
    ]);
  });

  test("throws on a non-ok response", async () => {
    globalThis.fetch = (async () => new Response("boom", { status: 503 })) as unknown as typeof fetch;
    await expect(fetchFromAlgolia(0, 10)).rejects.toThrow(/Algolia HN search failed/);
  });
});

describe("fetchFromFirebase", () => {
  test("filters by type=story and time, sorts by score desc, respects limit", async () => {
    const items: Record<number, unknown> = {
      1: { id: 1, type: "story", title: "Old story", score: 500, descendants: 10, time: 100 }, // too old
      2: { id: 2, type: "story", title: "Low score", score: 50, descendants: 1, time: 999 },
      3: { id: 3, type: "comment", title: "Not a story", score: 900, descendants: 0, time: 999 }, // wrong type
      4: { id: 4, type: "story", title: "High score", score: 300, descendants: 20, time: 999, url: "https://example.com/4" },
      5: { id: 5, type: "story", title: "Mid score", score: 150, descendants: 5, time: 999 },
    };

    globalThis.fetch = (async (input: string | URL) => {
      const url = input.toString();
      if (url.endsWith("/topstories.json")) {
        return jsonResponse([1, 2, 3, 4, 5]);
      }
      const match = /\/item\/(\d+)\.json$/.exec(url);
      const id = match ? Number(match[1]) : -1;
      return jsonResponse(items[id] ?? null);
    }) as unknown as typeof fetch;

    const stories = await fetchFromFirebase(500, 2);

    expect(stories).toEqual([
      { hnId: 4, title: "High score", url: "https://example.com/4", points: 300, numComments: 20, createdAt: 999 },
      { hnId: 5, title: "Mid score", url: null, points: 150, numComments: 5, createdAt: 999 },
    ]);
  });
});

describe("fetchTopStories", () => {
  test("uses the Algolia result when it succeeds", async () => {
    let firebaseCalled = false;
    globalThis.fetch = (async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("algolia")) {
        return jsonResponse({ hits: [{ objectID: "1", title: "t", url: null, points: 1, num_comments: 1, created_at_i: 1 }] });
      }
      firebaseCalled = true;
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    const stories = await fetchTopStories(0, 5);

    expect(stories).toHaveLength(1);
    expect(firebaseCalled).toBe(false);
  });

  test("falls back to Firebase when Algolia fails", async () => {
    globalThis.fetch = (async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("algolia")) {
        return new Response("nope", { status: 500 });
      }
      if (url.endsWith("/topstories.json")) {
        return jsonResponse([9]);
      }
      return jsonResponse({ id: 9, type: "story", title: "Fallback story", score: 42, descendants: 3, time: 1000 });
    }) as unknown as typeof fetch;

    const stories = await fetchTopStories(500, 5);

    expect(stories).toEqual([
      { hnId: 9, title: "Fallback story", url: null, points: 42, numComments: 3, createdAt: 1000 },
    ]);
  });
});
