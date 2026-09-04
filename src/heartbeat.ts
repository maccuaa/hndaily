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
			console.error(`Heartbeat ping to ${url} returned ${res.status} ${res.statusText}`);
		}
	} catch (err) {
		console.error(`Heartbeat ping to ${url} failed: ${(err as Error).message}`);
	}
}
