import type { Database } from "bun:sqlite";

import type { Config } from "./config";
import { curate } from "./curate";
import { recordDeliveryRun, recordSentStories } from "./db";
import { sendHeartbeat } from "./heartbeat";
import { logger } from "./logger";
import type { MailerConfig } from "./mailer";
import { sendDigestEmail } from "./mailer";
import { renderDigest } from "./render";

export interface DeliveryRunDeps {
	db: Database;
	config: Config;
	mailerConfig: MailerConfig;
	heartbeatUrl: string | null;
}

/** Injectable overrides for testing — default to the real implementations. */
export interface DeliveryRunOverrides {
	curateFn?: typeof curate;
	renderFn?: typeof renderDigest;
	sendMailFn?: typeof sendDigestEmail;
	sendHeartbeatFn?: typeof sendHeartbeat;
}

/**
 * Orchestrates one Delivery run (ticket 09): curate → render → send →
 * record → heartbeat. On failure, records a failed run (best-effort) and
 * re-throws so the process exits — Docker's `restart: unless-stopped`
 * (ticket 10) is the recovery mechanism, alongside the heartbeat ping
 * (ticket 11) catching a schedule that silently stopped firing.
 */
export async function runDeliveryRun(
	deps: DeliveryRunDeps,
	overrides: DeliveryRunOverrides = {},
): Promise<void> {
	const curateFn = overrides.curateFn ?? curate;
	const renderFn = overrides.renderFn ?? renderDigest;
	const sendMailFn = overrides.sendMailFn ?? sendDigestEmail;
	const sendHeartbeatFn = overrides.sendHeartbeatFn ?? sendHeartbeat;

	const startedAt = Math.floor(Date.now() / 1000);

	try {
		const curationResult = await curateFn(deps.db, deps.config);
		const digest = renderFn(curationResult.stories, { isCatchup: curationResult.isCatchup });
		await sendMailFn(deps.mailerConfig, deps.config.recipientEmail, digest);

		const runId = recordDeliveryRun(deps.db, {
			startedAt,
			status: "success",
			isCatchup: curationResult.isCatchup,
			storiesSentCount: curationResult.stories.length,
		});
		recordSentStories(deps.db, runId, curationResult.stories);

		if (deps.heartbeatUrl) {
			await sendHeartbeatFn(deps.heartbeatUrl);
		}

		logger.info("Delivery run succeeded", {
			storiesSentCount: curationResult.stories.length,
			isCatchup: curationResult.isCatchup,
		});
	} catch (err) {
		logger.error("Delivery run failed", { error: (err as Error).message });
		try {
			recordDeliveryRun(deps.db, {
				startedAt,
				status: "failure",
				isCatchup: false,
				storiesSentCount: 0,
			});
		} catch (recordErr) {
			logger.error("Additionally failed to record the failed run", {
				error: (recordErr as Error).message,
			});
		}
		throw err;
	}
}
