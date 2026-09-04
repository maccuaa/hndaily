import { escapeHtml, hnDiscussionUrl } from "../html-utils";
import type { Story } from "../types";
import type { Theme } from "./types";

/**
 * Night Wire — the default theme. A quiet background job, not a product:
 * dark, monospace-flavored header band, calm white body. This is the
 * original "plain-ish HTML" look (ticket 01) with a small identity added
 * around it, so its wording stays byte-for-byte compatible with the
 * pre-theme output (see test/theme-night-wire.test.ts).
 *
 * The logo mark is a styled Unicode triangle (▲) rather than an inline SVG
 * or image: inline SVG/image support is inconsistent across email clients,
 * while a plain character with inline styles renders reliably everywhere.
 */

const HEADER_BG = "#14120F";
const MARK_BG = "#1E1B17";
const EMBER = "#D97A45";
const EMBER_LINK = "#B8501E"; // darkened from the ember-500 brand token for contrast on a white body
const MINT = "#8FBFA0";
const PAPER = "#EDE7DD";
const MUTED = "#8A8378";
// Single-quoted (not double-quoted) font names: these constants get interpolated
// straight into double-quoted HTML style="..." attributes, and a literal `"`
// would prematurely close the attribute and silently drop every style after it.
const MONO_FONT = `ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`;
const SANS_FONT = `-apple-system, BlinkMacSystemFont, sans-serif`;

function renderHeader(): string {
  return `<div style="background: ${HEADER_BG}; padding: 20px 24px;">
    <span style="display: inline-block; width: 40px; height: 40px; background: ${MARK_BG}; border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px; color: ${EMBER}; vertical-align: middle;">&#9650;</span>
    <span style="display: inline-block; vertical-align: middle; padding-left: 12px; font-family: ${MONO_FONT}; font-size: 19px; color: ${PAPER};">hndaily</span>
    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${MINT}; vertical-align: middle; margin-left: 2px;"></span>
  </div>`;
}

function renderStoryItem(story: Story): string {
  const link = story.url ?? hnDiscussionUrl(story.hnId);
  const commentsUrl = hnDiscussionUrl(story.hnId);
  return `<li style="margin-bottom: 14px;">
    <a href="${escapeHtml(link)}" style="font-size: 15px; text-decoration: none; color: ${EMBER_LINK}; font-weight: 600;">${escapeHtml(story.title)}</a>
    <br />
    <span style="font-size: 13px; color: ${MUTED};">${story.points} points &middot; <a href="${escapeHtml(commentsUrl)}" style="color: ${MUTED};">${story.numComments} comments</a></span>
  </li>`;
}

function renderFooter(): string {
  return `<div style="padding: 14px 24px 20px; border-top: 1px solid #EEEEEE; margin-top: 4px;">
    <span style="font-family: ${MONO_FONT}; font-size: 11px; color: ${MUTED};">hndaily — a quiet daily signal</span>
  </div>`;
}

export const nightWireTheme: Theme = {
  id: "night-wire",
  name: "Night Wire",
  render({ stories, isCatchup, dateLabel }) {
    const heading = isCatchup ? "Catch-up digest" : "Daily digest";
    const body =
      stories.length === 0
        ? `<p style="font-family: ${SANS_FONT}; color: ${MUTED}; padding: 0 24px;">No new stories since the last digest.</p>`
        : `<ol style="padding-left: 20px; margin: 16px 24px 0;">${stories.map(renderStoryItem).join("")}</ol>`;

    return `<!DOCTYPE html>
<html>
  <body style="margin: 0; font-family: ${SANS_FONT}; color: #111111; background: #FFFFFF;">
    <div style="max-width: 600px; margin: 0 auto;">
      ${renderHeader()}
      <h1 style="font-size: 16px; padding: 20px 24px 0; margin: 0;">${heading}</h1>
      <p style="font-size: 12px; color: ${MUTED}; padding: 4px 24px 0; margin: 0;">${escapeHtml(dateLabel)}</p>
      ${body}
      ${renderFooter()}
    </div>
  </body>
</html>`;
  },
};
