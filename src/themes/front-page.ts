import { escapeHtml, hnDiscussionUrl } from "../html-utils";
import type { Story } from "../types";
import type { Theme } from "./types";

/**
 * Front Page — leans into Hacker News's own visual heritage (the point
 * triangle, a bold masthead) instead of avoiding it. The rank numerals are a
 * real signature, not decoration: curate.ts always orders Stories by score,
 * so a Story's position in the list already carries that meaning.
 */

const INK = "#1A1A1A";
const RUST = "#E85D2C";
const GRAPHITE = "#6B6B6B";
const HAIRLINE = "#E4E2DC";
// Single-quoted (not double-quoted) font name: this constant gets interpolated
// straight into double-quoted HTML style="..." attributes, and a literal `"`
// would prematurely close the attribute and silently drop every style after it.
const SANS_FONT = `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;

function renderMasthead(isCatchup: boolean): string {
	const eyebrow = isCatchup
		? "CATCH-UP — STORIES SINCE THE LAST DIGEST"
		: "TOP STORIES, RANKED DAILY";
	return `<div style="padding: 20px 24px 14px;">
    <span style="display: inline-block; width: 40px; height: 40px; background: ${INK}; text-align: center; line-height: 40px; font-size: 22px; color: ${RUST}; vertical-align: middle;">&#9650;</span>
    <span style="display: inline-block; vertical-align: middle; padding-left: 12px; font-family: ${SANS_FONT}; font-weight: 800; font-size: 20px; letter-spacing: 0.03em; color: ${INK};">HN DAILY</span>
    <div style="border-top: 1px solid ${HAIRLINE}; margin: 12px 0 6px;"></div>
    <span style="font-family: ${SANS_FONT}; font-size: 10px; letter-spacing: 0.15em; color: ${GRAPHITE};">${eyebrow}</span>
  </div>`;
}

function renderStoryItem(story: Story, rank: number): string {
	const link = story.url ?? hnDiscussionUrl(story.hnId);
	const commentsUrl = hnDiscussionUrl(story.hnId);
	const rankLabel = String(rank).padStart(2, "0");
	return `<li style="margin-bottom: 16px;">
    <span style="font-family: ${SANS_FONT}; font-weight: 800; color: ${RUST}; font-size: 13px;">${rankLabel}</span>
    <a href="${escapeHtml(link)}" style="font-size: 15px; text-decoration: none; color: ${INK}; font-weight: 600;">${escapeHtml(story.title)}</a>
    <br />
    <span style="font-size: 13px; color: ${GRAPHITE};"><span style="color: ${RUST};">&#9650;</span> ${story.points} &middot; <a href="${escapeHtml(commentsUrl)}" style="color: ${GRAPHITE};">${story.numComments} comments</a></span>
  </li>`;
}

function renderFooter(): string {
	return `<div style="padding: 14px 24px 20px; border-top: 1px solid ${HAIRLINE}; margin-top: 8px;">
    <span style="font-family: ${SANS_FONT}; font-size: 11px; color: ${GRAPHITE};">hndaily — a personal Hacker News digest</span>
  </div>`;
}

export const frontPageTheme: Theme = {
	id: "front-page",
	name: "Front Page",
	render({ stories, isCatchup, dateLabel }) {
		const body =
			stories.length === 0
				? `<p style="font-family: ${SANS_FONT}; color: ${GRAPHITE}; padding: 0 24px;">No new stories since the last digest.</p>`
				: `<ol style="list-style: none; padding-left: 20px; margin: 8px 24px 0;">${stories.map((story, i) => renderStoryItem(story, i + 1)).join("")}</ol>`;

		return `<!DOCTYPE html>
<html>
  <body style="margin: 0; font-family: ${SANS_FONT}; color: ${INK}; background: #FAFAF9;">
    <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF;">
      ${renderMasthead(isCatchup)}
      <p style="font-size: 11px; color: ${GRAPHITE}; padding: 0 24px; margin: 0 0 8px;">${escapeHtml(dateLabel)}</p>
      ${body}
      ${renderFooter()}
    </div>
  </body>
</html>`;
	},
};
