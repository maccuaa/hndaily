import {
	formatDateLabel,
	formatGeneratedAt,
	formatNextDelivery,
	formatWindowBoundary,
} from "./date-utils";
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
	/** The Recipient's configured email address — shown in the footer's settings line. */
	recipientEmail: string;
	/** The Recipient's configured schedule — formats the footer's timestamps and locates the next Delivery run. */
	schedule: { cron: string; timezone: string };
	/** Unix seconds: start of the Curation window actually used for this Digest (see CurationResult.windowStart). */
	windowStart: number;
}

/**
 * Renders a Digest: title, link, points, comment count only (ticket 01) — no
 * summaries or comment excerpts for v1. The subject line stays plain text
 * and theme-agnostic; visual identity (header, story layout, footer) is
 * delegated to the selected Theme (see src/themes/).
 *
 * All dates/times — the header's date label, and the footer's settings line
 * (generated-at, Curation window, next Delivery run) — are formatted in the
 * Recipient's configured schedule timezone, not the server's local time.
 */
export function renderDigest(stories: Story[], options: RenderOptions): RenderedDigest {
	const { timezone } = options.schedule;
	const now = new Date();
	const dateLabel = formatDateLabel(now, timezone);
	const subject = options.isCatchup
		? `HN Daily catch-up — ${dateLabel}`
		: `HN Daily — ${dateLabel}`;

	const nextDeliveryAt = Bun.cron.parse(options.schedule.cron, now, { tz: timezone });
	if (!nextDeliveryAt) {
		throw new Error(
			`Could not compute the next Delivery run for cron "${options.schedule.cron}" in timezone "${timezone}"`,
		);
	}

	const theme = getTheme(options.theme ?? DEFAULT_THEME_ID);
	const html = theme.render({
		stories,
		isCatchup: options.isCatchup,
		dateLabel,
		footer: {
			recipientEmail: options.recipientEmail,
			generatedAtLabel: formatGeneratedAt(now, timezone),
			windowStartLabel: formatWindowBoundary(new Date(options.windowStart * 1000), timezone),
			windowEndLabel: formatWindowBoundary(now, timezone),
			nextDeliveryLabel: formatNextDelivery(nextDeliveryAt, timezone),
		},
	});

	return { subject, html };
}
