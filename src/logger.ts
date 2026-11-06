/**
 * Minimal logger: one human-readable line per event, identical in every
 * environment (logs are read directly with `docker compose logs`, not
 * shipped anywhere):
 *
 *   2026-11-06 12:00:09 INFO  Delivery run succeeded storiesSentCount=25 isCatchup=false
 *
 * Ported from raven's src/middleware/logger.ts. No external dependency —
 * matches the project's zero-runtime-dependency posture (see src/smtp.ts).
 */

type LogContext = Record<string, unknown>;

export type LogLevel = "INFO" | "WARN" | "ERROR";

const RESET = "\u001b[0m";
const DIM = "\u001b[2m";
const LEVEL_COLORS: Record<LogLevel, string> = {
	INFO: "",
	WARN: "\u001b[33m",
	ERROR: "\u001b[31m",
};

// Strings print bare unless whitespace, a quote or a control character would make the line ambiguous.
const BARE_VALUE = /^[^\s"\p{Cc}]+$/u;

const pad2 = (n: number): string => String(n).padStart(2, "0");

// Local time, which is UTC inside the container unless TZ is set.
const formatTimestamp = (date: Date): string =>
	`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
	`${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

function formatValue(value: unknown): string {
	if (typeof value === "string") return BARE_VALUE.test(value) ? value : JSON.stringify(value);
	if (value instanceof Error) return JSON.stringify(`${value.name}: ${value.message}`);
	if (typeof value === "object" && value !== null) {
		try {
			return JSON.stringify(value);
		} catch {
			// Logging must never throw into a Delivery run (e.g. circular references)
			return "[unserializable]";
		}
	}
	return String(value);
}

/**
 * Render one line per event: `YYYY-MM-DD HH:mm:ss LEVEL message key=value ...`
 * Undefined values are skipped.
 */
export function formatLog(
	level: LogLevel,
	msg: string,
	ctx: LogContext = {},
	color: boolean = Bun.enableANSIColors,
): string {
	const paint = (text: string, code: string): string =>
		color && code ? `${code}${text}${RESET}` : text;

	const fields = Object.entries(ctx)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${formatValue(value)}`);

	return [
		paint(formatTimestamp(new Date()), DIM),
		paint(level.padEnd(5), LEVEL_COLORS[level]),
		msg,
		...fields,
	].join(" ");
}

// Written to the process streams rather than console.*: with colors on, Bun's console.error wraps
// its output in red, which would tint our own timestamp and level coloring.
function emit(stream: "stdout" | "stderr", level: LogLevel, msg: string, ctx?: LogContext): void {
	process[stream].write(`${formatLog(level, msg, ctx)}\n`);
}

export const logger = {
	info: (msg: string, ctx?: LogContext): void => emit("stdout", "INFO", msg, ctx),
	warn: (msg: string, ctx?: LogContext): void => emit("stderr", "WARN", msg, ctx),
	error: (msg: string, ctx?: LogContext): void => emit("stderr", "ERROR", msg, ctx),
};
