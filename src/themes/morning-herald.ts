import { escapeHtml, extractHostname, hnDiscussionUrl } from "../html-utils";
import type { Story } from "../types";
import type { Theme } from "./types";

/**
 * Morning Herald — a sepia-toned broadsheet: serif headlines and em-dash
 * byline-style metadata.
 */

const PAPER = "#F4EFE4";
const INK = "#2B2420";
const OXBLOOD = "#8C1F28";
const MUTED = "#6B5E4C";
const HAIRLINE = "#D8CBB0";
// Single-quoted (not double-quoted) font names: this constant gets interpolated
// straight into double-quoted HTML style="..." attributes, and a literal `"`
// would prematurely close the attribute and silently drop every style after it.
const SERIF_FONT = `Georgia, 'Times New Roman', Times, serif`;

function renderMasthead(isCatchup: boolean): string {
	const eyebrow = isCatchup
		? "CATCH-UP BRIEFING — STORIES SINCE THE LAST DIGEST"
		: "TODAY'S BRIEFING";
	return `<div style="padding: 28px 24px 16px; text-align: center;">
    <span style="font-family: ${SERIF_FONT}; font-weight: 700; font-size: 30px; letter-spacing: 0.02em; color: ${INK};">&#9650; The HN Daily</span>
    <div style="border-top: 3px double ${INK}; margin: 12px 0 8px;"></div>
    <span style="font-family: ${SERIF_FONT}; font-style: italic; font-size: 11px; letter-spacing: 0.1em; color: ${OXBLOOD};">${eyebrow}</span>
  </div>`;
}

function renderStoryItem(story: Story): string {
	const link = story.url ?? hnDiscussionUrl(story.hnId);
	const commentsUrl = hnDiscussionUrl(story.hnId);
	const hostname = extractHostname(link);
	return `<li style="list-style: none; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid ${HAIRLINE};">
    <a href="${escapeHtml(link)}" style="font-family: ${SERIF_FONT}; font-weight: 700; font-size: 17px; text-decoration: none; color: ${INK};">${escapeHtml(story.title)}</a>
    <br />
    <span style="font-family: ${SERIF_FONT}; font-style: italic; font-size: 12px; color: ${MUTED};">${escapeHtml(hostname)} &mdash; ${story.points} points &mdash; <a href="${escapeHtml(commentsUrl)}" style="color: ${MUTED};">${story.numComments} comments</a></span>
  </li>`;
}

function renderFooter(): string {
	return `<div style="padding: 14px 24px 26px; text-align: center;">
    <span style="font-family: ${SERIF_FONT}; font-style: italic; font-size: 11px; color: ${MUTED};">hndaily — a personal Hacker News digest</span>
  </div>`;
}

export const morningHeraldTheme: Theme = {
	id: "morning-herald",
	name: "Morning Herald",
	render({ stories, isCatchup, dateLabel }) {
		const body =
			stories.length === 0
				? `<p style="font-family: ${SERIF_FONT}; color: ${MUTED}; padding: 0 24px; text-align: center;">No new stories since the last digest.</p>`
				: `<ol style="padding-left: 0; margin: 12px 24px 0;">${stories.map(renderStoryItem).join("")}</ol>`;

		return `<!DOCTYPE html>
<html>
  <body style="margin: 0; font-family: ${SERIF_FONT}; color: ${INK}; background: ${PAPER};">
    <div style="max-width: 600px; margin: 0 auto; padding: 12px 0 24px;">
      ${renderMasthead(isCatchup)}
      <p style="font-family: ${SERIF_FONT}; font-size: 12px; color: ${MUTED}; padding: 0 24px; margin: 0 0 8px; text-align: center;">${escapeHtml(dateLabel)}</p>
      ${body}
      ${renderFooter()}
    </div>
  </body>
</html>`;
	},
};
