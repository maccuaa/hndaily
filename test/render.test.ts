import { describe, expect, test } from "bun:test";
import { escapeHtml, renderDigest } from "../src/render";
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

describe("escapeHtml", () => {
  test("escapes the five special characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's "Show"</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s &quot;Show&quot;&lt;/a&gt;",
    );
  });
});

describe("renderDigest", () => {
  test("labels the subject/heading as a catch-up digest when isCatchup is true", () => {
    const { subject, html } = renderDigest([story()], { isCatchup: true });
    expect(subject).toContain("catch-up");
    expect(html).toContain("Catch-up digest");
  });

  test("labels the subject/heading as a regular digest when isCatchup is false", () => {
    const { subject, html } = renderDigest([story()], { isCatchup: false });
    expect(subject).not.toContain("catch-up");
    expect(html).toContain("Daily digest");
  });

  test("links the title to the story's external URL, and shows points + comment count", () => {
    const { html } = renderDigest([story({ url: "https://example.com/a", points: 250, numComments: 42 })], {
      isCatchup: false,
    });
    expect(html).toContain('href="https://example.com/a"');
    expect(html).toContain("250 points");
    expect(html).toContain("42 comments");
  });

  test("links the title to the HN discussion when there's no external URL (self-post)", () => {
    const { html } = renderDigest([story({ hnId: 999, url: null })], { isCatchup: false });
    expect(html).toContain('href="https://news.ycombinator.com/item?id=999"');
  });

  test("always includes a comments link to the HN discussion, separate from the title link", () => {
    const { html } = renderDigest([story({ hnId: 555, url: "https://example.com/b" })], {
      isCatchup: false,
    });
    expect(html).toContain('href="https://example.com/b"');
    expect(html).toContain('href="https://news.ycombinator.com/item?id=555"');
  });

  test("escapes story titles", () => {
    const { html } = renderDigest([story({ title: `<script>alert("x")</script>` })], {
      isCatchup: false,
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  test("shows a friendly message when there are no stories", () => {
    const { html } = renderDigest([], { isCatchup: false });
    expect(html).toContain("No new stories");
  });
});
