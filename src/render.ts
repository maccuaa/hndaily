import type { Story } from "./types";

export interface RenderedDigest {
  subject: string;
  html: string;
}

export interface RenderOptions {
  isCatchup: boolean;
}

/**
 * Renders a Digest as plain-ish HTML: title, link, points, comment count
 * only (ticket 01) — no summaries or comment excerpts for v1.
 */
export function renderDigest(stories: Story[], options: RenderOptions): RenderedDigest {
  const dateLabel = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const subject = options.isCatchup
    ? `HN Daily catch-up — ${dateLabel}`
    : `HN Daily — ${dateLabel}`;

  const body =
    stories.length === 0
      ? "<p>No new stories since the last digest.</p>"
      : `<ol style="padding-left: 20px; margin: 0;">${stories.map(renderStoryItem).join("")}</ol>`;

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
    <h1 style="font-size: 18px;">${options.isCatchup ? "Catch-up digest" : "Daily digest"}</h1>
    ${body}
  </body>
</html>`;

  return { subject, html };
}

function renderStoryItem(story: Story): string {
  const link = story.url ?? hnDiscussionUrl(story.hnId);
  const commentsUrl = hnDiscussionUrl(story.hnId);
  return `<li style="margin-bottom: 12px;">
    <a href="${escapeHtml(link)}" style="font-size: 15px; text-decoration: none; color: #000;">${escapeHtml(story.title)}</a>
    <br />
    <span style="font-size: 13px; color: #666;">${story.points} points &middot; <a href="${escapeHtml(commentsUrl)}" style="color: #666;">${story.numComments} comments</a></span>
  </li>`;
}

function hnDiscussionUrl(hnId: number): string {
  return `https://news.ycombinator.com/item?id=${hnId}`;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
