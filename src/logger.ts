/**
 * Minimal structured logger: JSON lines in production (grep/jq-friendly in
 * `docker logs`), human-readable in development. Copied from raven's
 * src/middleware/logger.ts pattern — swapping its `config.development`
 * check for `NODE_ENV` since hndaily has no equivalent app config flag
 * (the Dockerfile already sets `NODE_ENV=production`).
 *
 * No external dependency — matches the project's zero-runtime-dependency
 * posture (see src/smtp.ts).
 */

type LogContext = Record<string, unknown>;

function formatLog(level: string, msg: string, ctx?: LogContext): string {
	const data = { level, msg, ...ctx, ts: new Date().toISOString() };

	if (process.env.NODE_ENV !== "production") {
		const time = new Date().toLocaleTimeString();
		const contextStr = ctx && Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx, null, 2)}` : "";
		return `[${level.toUpperCase()}] ${time} ${msg}${contextStr}`;
	}

	return JSON.stringify(data);
}

export const logger = {
	info: (msg: string, ctx?: LogContext): void => console.log(formatLog("info", msg, ctx)),
	warn: (msg: string, ctx?: LogContext): void => console.warn(formatLog("warn", msg, ctx)),
	error: (msg: string, ctx?: LogContext): void => console.error(formatLog("error", msg, ctx)),
};
