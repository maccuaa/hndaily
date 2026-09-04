import { loadConfig } from "./config";
import { openDb } from "./db";
import { runDeliveryRun } from "./delivery-run";
import { loadHeartbeatUrlFromEnv } from "./heartbeat";
import { logger } from "./logger";
import { loadMailerConfigFromEnv } from "./mailer";

const CONFIG_PATH = process.env.HNDAILY_CONFIG_PATH ?? "config.json";
const DB_PATH = process.env.HNDAILY_DB_PATH ?? "data/hndaily.sqlite";

const config = await loadConfig(CONFIG_PATH);
const mailerConfig = loadMailerConfigFromEnv();
const heartbeatUrl = loadHeartbeatUrlFromEnv();
const db = openDb(DB_PATH);

logger.info("hndaily starting", {
	cron: config.schedule.cron,
	timezone: config.schedule.timezone,
	storyCount: config.storyCount,
	theme: config.theme,
	recipientEmail: config.recipientEmail,
	heartbeatEnabled: heartbeatUrl !== null,
});

// Long-running Docker container using Bun.cron()'s in-process scheduling
// (ticket 05/10) — config is read once at startup; changing it requires a
// container restart to take effect.
Bun.cron(
	config.schedule.cron,
	async () => {
		// Deliberately unhandled on failure: runDeliveryRun logs and re-throws,
		// which crashes the process. Docker's `restart: unless-stopped` (ticket
		// 10) is the recovery mechanism, alongside the heartbeat ping (ticket 11)
		// catching a schedule that silently stopped firing.
		await runDeliveryRun({ db, config, mailerConfig, heartbeatUrl });
	},
	{ tz: config.schedule.timezone },
);

const nextFire = Bun.cron.parse(config.schedule.cron, Date.now(), { tz: config.schedule.timezone });
logger.info("Next Delivery run scheduled", { nextFire: nextFire?.toISOString() ?? "unknown" });
