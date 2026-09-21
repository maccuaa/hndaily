import { escapeHtml, extractHostname, hnDiscussionUrl } from "../html-utils";
import type { Story } from "../types";
import type { Theme } from "./types";

/**
 * Crimson Column — a clean digital-editorial newspaper: crisp white
 * background, bold serif headlines, generous whitespace, a single crimson
 * accent.
 */

const BG = "#FFFFFF";
const INK = "#111111";
const CRIMSON = "#B3261E";
const MUTED = "#666666";
const HAIRLINE = "#E5E5E5";
// Single-quoted (not double-quoted) font names: these constants get interpolated
// straight into double-quoted HTML style="..." attributes, and a literal `"`
// would prematurely close the attribute and silently drop every style after it.
const SERIF_FONT = `Georgia, 'Times New Roman', Times, serif`;
const SANS_FONT = `-apple-system, BlinkMacSystemFont, sans-serif`; // used only for the small, letter-spaced eyebrow labels

function renderMasthead(isCatchup: boolean): string {
	const eyebrow = isCatchup
		? "CATCH-UP BRIEFING — STORIES SINCE THE LAST DIGEST"
		: "TODAY'S BRIEFING";
	return `<div style="padding: 32px 24px 18px;">
    <span style="font-family: ${SERIF_FONT}; font-weight: 700; font-size: 28px; color: ${INK};">&#9650; HN Daily</span>
    <div style="border-top: 2px solid ${INK}; margin: 14px 0 8px;"></div>
    <span style="font-family: ${SANS_FONT}; font-size: 11px; letter-spacing: 0.14em; color: ${CRIMSON};">${eyebrow}</span>
  </div>`;
}

function renderStoryItem(story: Story): string {
	const link = story.url ?? hnDiscussionUrl(story.hnId);
	const commentsUrl = hnDiscussionUrl(story.hnId);
	const hostname = extractHostname(link);
	return `<li style="list-style: none; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid ${HAIRLINE};">
    <a href="${escapeHtml(link)}" style="font-family: ${SERIF_FONT}; font-weight: 700; font-size: 16px; text-decoration: none; color: ${INK};">${escapeHtml(story.title)}</a>
    <br />
    <span style="font-family: ${SERIF_FONT}; font-size: 12px; color: ${MUTED};">${escapeHtml(hostname)} &middot; ${story.points} points &middot; <a href="${escapeHtml(commentsUrl)}" style="color: ${MUTED};">${story.numComments} comments</a></span>
  </li>`;
}

function renderFooter(): string {
	return `<div style="padding: 16px 24px 30px; border-top: 1px solid ${HAIRLINE}; margin-top: 8px;">
    <span style="font-family: ${SANS_FONT}; font-size: 11px; color: ${MUTED};">hndaily — a personal Hacker News digest</span>
  </div>`;
}

export const crimsonColumnTheme: Theme = {
	id: "crimson-column",
	name: "Crimson Column",
	render({ stories, isCatchup, dateLabel }) {
		const body =
			stories.length === 0
				? `<p style="font-family: ${SERIF_FONT}; color: ${MUTED}; padding: 0 24px;">No new stories since the last digest.</p>`
				: `<ol style="padding-left: 0; margin: 4px 24px 0;">${stories.map(renderStoryItem).join("")}</ol>`;

		return `<!DOCTYPE html>
<html>
  <body style="margin: 0; font-family: ${SERIF_FONT}; color: ${INK}; background: ${BG};">
    <div style="max-width: 600px; margin: 0 auto;">
      ${renderMasthead(isCatchup)}
      <p style="font-family: ${SANS_FONT}; font-size: 11px; color: ${MUTED}; padding: 0 24px; margin: 0 0 10px;">${escapeHtml(dateLabel)}</p>
      ${body}
      ${renderFooter()}
    </div>
  </body>
</html>`;
	},
};
