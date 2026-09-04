import { DEFAULT_THEME_ID, getTheme } from "./themes";
import type { Story } from "./types";

// Re-exported so existing imports of `escapeHtml` from "./render" keep working.
export { escapeHtml } from "./html-utils";

export interface RenderedDigest {
  subject: string;
  html: string;
}

export interface RenderOptions {
  isCatchup: boolean;
  /** Which Theme (src/themes/*) renders the HTML — defaults to Night Wire when omitted. */
  theme?: string;
}

/**
 * Renders a Digest: title, link, points, comment count only (ticket 01) — no
 * summaries or comment excerpts for v1. The subject line stays plain text
 * and theme-agnostic; visual identity (header, story layout, footer) is
 * delegated to the selected Theme (see src/themes/).
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

  const theme = getTheme(options.theme ?? DEFAULT_THEME_ID);
  const html = theme.render({ stories, isCatchup: options.isCatchup, dateLabel });

  return { subject, html };
}
