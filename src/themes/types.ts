import type { Story } from "../types";

/**
 * The Digest footer's settings line — pre-formatted, timezone-aware strings
 * (see src/date-utils.ts) so Themes never do their own date math, matching
 * how `dateLabel` already works.
 */
export interface ThemeFooterContext {
	/** The Recipient's configured email address — shown as plain text, not a mailto: link. */
	recipientEmail: string;
	/** e.g. "5 September at 14:00" — when this Digest was generated. */
	generatedAtLabel: string;
	/** e.g. "4 September, 14:00" — start of the Curation window actually used. */
	windowStartLabel: string;
	/** e.g. "5 September, 14:00" — end of the Curation window (the generation moment). */
	windowEndLabel: string;
	/** e.g. "Sunday, 6 September at 7:00" — the next scheduled Delivery run. */
	nextDeliveryLabel: string;
}

/**
 * Data a Theme needs to render one Digest — deliberately limited to what
 * render.ts already has available (no live schedule/heartbeat data), so
 * adding or restyling a theme never requires plumbing new state through the
 * rest of the app.
 */
export interface ThemeRenderContext {
	stories: Story[];
	isCatchup: boolean;
	dateLabel: string;
	footer: ThemeFooterContext;
}

/**
 * A Theme owns a Digest's full visual identity: header/logo, story-row
 * layout, and footer — not just a color swap. To add a new theme, implement
 * this interface in a new file under src/themes/ and register it in
 * src/themes/index.ts; nothing else in the codebase needs to change.
 */
export interface Theme {
	/** Stable identifier used in config.json's "theme" setting — kebab-case. */
	id: string;
	/** Human-readable name, for logs/docs only. */
	name: string;
	/** Renders the complete `<!DOCTYPE html>...</html>` document for a Digest email. */
	render(context: ThemeRenderContext): string;
}
