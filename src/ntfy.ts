import { logger } from "./logger";

/**
 * Content-bearing Notification via ntfy (the public ntfy.sh instance)
 * reporting a Delivery run's outcome — success or failure — as it happens.
 * Distinct from the healthchecks.io Heartbeat (src/heartbeat.ts), which is
 * a silent liveness ping with no content, alerting only when pings *stop*
 * arriving. A short-term addition until the Heartbeat alone proves
 * reliable.
 *
 * Best-effort: a failed ntfy post must never fail the Delivery run itself.
 */
export function loadNtfyTopicFromEnv(): string | null {
	return process.env.HNDAILY_NTFY_TOPIC || null;
}

export interface NtfyNotification {
	title: string;
	message: string;
	priority?: "min" | "low" | "default" | "high" | "urgent";
	tags?: string[];
}

export async function sendNtfyNotification(
	topic: string,
	notification: NtfyNotification,
): Promise<void> {
	try {
		const res = await fetch(`https://ntfy.sh/${topic}`, {
			method: "POST",
			body: notification.message,
			headers: {
				"X-Title": notification.title,
				...(notification.priority ? { "X-Priority": notification.priority } : {}),
				...(notification.tags?.length ? { "X-Tags": notification.tags.join(",") } : {}),
			},
		});
		if (!res.ok) {
			logger.error("ntfy notification failed", {
				status: res.status,
				statusText: res.statusText,
			});
		}
	} catch (err) {
		logger.error("ntfy notification failed", { error: (err as Error).message });
	}
}
