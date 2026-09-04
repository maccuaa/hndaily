import { logger } from "./logger";

/**
 * Heartbeat ping to healthchecks.io at the end of each successful Delivery
 * run (ticket 11) — catches both a crashed container (paired with Docker's
 * `restart: unless-stopped`) and a container that's alive but whose
 * internal `Bun.cron()` schedule silently stopped firing.
 *
 * Best-effort: a heartbeat failure must never fail the Delivery run itself,
 * since the Digest has already been sent successfully by the time this runs.
 */
export function loadHeartbeatUrlFromEnv(): string | null {
	return process.env.HNDAILY_HEARTBEAT_URL || null;
}

export async function sendHeartbeat(url: string): Promise<void> {
	try {
		const res = await fetch(url);
		if (!res.ok) {
			logger.error("Heartbeat ping failed", {
				url,
				status: res.status,
				statusText: res.statusText,
			});
		}
	} catch (err) {
		logger.error("Heartbeat ping failed", { url, error: (err as Error).message });
	}
}
