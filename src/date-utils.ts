/**
 * Date/time formatting for the Digest footer's settings line (recipient,
 * generated-at, Curation window, next Delivery run) and the header's date
 * label — all rendered in the Recipient's configured schedule timezone, not
 * the server's local time.
 *
 * Day-month order with no year (e.g. "5 September") deliberately mirrors the
 * short, unambiguous style used across the footer; the `en-GB` locale gives
 * us that ordering without hand-rolling month names. Hours use `hourCycle:
 * "h23"` rather than `hour12: false` — some engines render midnight as
 * "24:00" with `hour12: false`, which `h23` avoids (verified: 0:00, not
 * 24:00).
 */

function formatDayMonth(date: Date, timeZone: string): string {
	return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone });
}

function formatTime(date: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-GB", {
		hour: "numeric",
		minute: "2-digit",
		hourCycle: "h23",
		timeZone,
	}).formatToParts(date);
	const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
	const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
	return `${hour}:${minute}`;
}

function formatWeekday(date: Date, timeZone: string): string {
	return date.toLocaleDateString("en-GB", { weekday: "long", timeZone });
}

/** e.g. "5 September" — used for the header's date label. */
export function formatDateLabel(date: Date, timeZone: string): string {
	return formatDayMonth(date, timeZone);
}

/** e.g. "5 September at 14:00" — when this Digest was generated. */
export function formatGeneratedAt(date: Date, timeZone: string): string {
	return `${formatDayMonth(date, timeZone)} at ${formatTime(date, timeZone)}`;
}

/** e.g. "4 September, 14:00" — one boundary of the Curation window. */
export function formatWindowBoundary(date: Date, timeZone: string): string {
	return `${formatDayMonth(date, timeZone)}, ${formatTime(date, timeZone)}`;
}

/** e.g. "Sunday, 6 September at 7:00" — the next scheduled Delivery run. */
export function formatNextDelivery(date: Date, timeZone: string): string {
	return `${formatWeekday(date, timeZone)}, ${formatDayMonth(date, timeZone)} at ${formatTime(date, timeZone)}`;
}
