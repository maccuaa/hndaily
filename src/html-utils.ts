/**
 * Small HTML helpers shared by render.ts and the theme implementations
 * (src/themes/*) — split out so themes don't need to import from render.ts
 * (which itself imports the theme registry).
 */

export function escapeHtml(input: string): string {
	return input
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function hnDiscussionUrl(hnId: number): string {
	return `https://news.ycombinator.com/item?id=${hnId}`;
}
