import { describe, expect, test } from "bun:test";
import { frontPageTheme } from "../src/themes/front-page";
import type { Story } from "../src/types";

function story(overrides: Partial<Story> = {}): Story {
  return {
    hnId: 1,
    title: "A story",
    url: "https://example.com/a",
    points: 100,
    numComments: 10,
    createdAt: 1_700_000_000,
    ...overrides,
  };
}

const dateLabel = "January 5, 2026";

describe("frontPageTheme", () => {
  test("has the expected id/name", () => {
    expect(frontPageTheme.id).toBe("front-page");
    expect(frontPageTheme.name).toBe("Front Page");
  });

  test("includes the masthead wordmark", () => {
    const html = frontPageTheme.render({ stories: [story()], isCatchup: false, dateLabel });
    expect(html).toContain("HN DAILY");
  });

  test("shows the catch-up eyebrow when isCatchup is true", () => {
    const html = frontPageTheme.render({ stories: [story()], isCatchup: true, dateLabel });
    expect(html).toContain("CATCH-UP");
  });

  test("shows the ranked-daily eyebrow when isCatchup is false", () => {
    const html = frontPageTheme.render({ stories: [story()], isCatchup: false, dateLabel });
    expect(html).not.toContain("CATCH-UP");
    expect(html).toContain("TOP STORIES, RANKED DAILY");
  });

  test("numbers stories by rank (position in the array), zero-padded to two digits", () => {
    const html = frontPageTheme.render({
      stories: [story({ hnId: 1 }), story({ hnId: 2 }), story({ hnId: 3 })],
      isCatchup: false,
      dateLabel,
    });
    expect(html).toContain(">01<");
    expect(html).toContain(">02<");
    expect(html).toContain(">03<");
  });

  test("links the title to the story's external URL, and shows points + comment count", () => {
    const html = frontPageTheme.render({
      stories: [story({ url: "https://example.com/a", points: 250, numComments: 42 })],
      isCatchup: false,
      dateLabel,
    });
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain("250");
    expect(html).toContain("42 comments");
  });

  test("links the title to the HN discussion when there's no external URL (self-post)", () => {
    const html = frontPageTheme.render({
      stories: [story({ hnId: 999, url: null })],
      isCatchup: false,
      dateLabel,
    });
    expect(html).toContain('href="https://news.ycombinator.com/item?id=999"');
  });

  test("always includes a comments link to the HN discussion, separate from the title link", () => {
    const html = frontPageTheme.render({
      stories: [story({ hnId: 555, url: "https://example.com/b" })],
      isCatchup: false,
      dateLabel,
    });
    expect(html).toContain('href="https://example.com/b"');
    expect(html).toContain('href="https://news.ycombinator.com/item?id=555"');
  });

  test("escapes story titles", () => {
    const html = frontPageTheme.render({
      stories: [story({ title: `<script>alert("x")</script>` })],
      isCatchup: false,
      dateLabel,
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  test("shows a friendly message when there are no stories", () => {
    const html = frontPageTheme.render({ stories: [], isCatchup: false, dateLabel });
    expect(html).toContain("No new stories");
  });
});
