import { loadConfig } from "./config";
import { openDb } from "./db";
import { runDeliveryRun } from "./delivery-run";
import { loadHeartbeatUrlFromEnv } from "./heartbeat";
import { loadMailerConfigFromEnv } from "./mailer";

const CONFIG_PATH = process.env.HNDAILY_CONFIG_PATH ?? "config.json";
const DB_PATH = process.env.HNDAILY_DB_PATH ?? "data/hndaily.sqlite";

const config = await loadConfig(CONFIG_PATH);
const mailerConfig = loadMailerConfigFromEnv();
const heartbeatUrl = loadHeartbeatUrlFromEnv();
const db = openDb(DB_PATH);

console.log(
	`hndaily starting — schedule "${config.schedule.cron}" (${config.schedule.timezone}), ` +
		`${config.storyCount} stories/run, "${config.theme}" theme, sending to ${config.recipientEmail}` +
		(heartbeatUrl ? ", heartbeat enabled" : ", heartbeat disabled (HNDAILY_HEARTBEAT_URL not set)"),
);

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
console.log(`Next Delivery run scheduled for ${nextFire?.toISOString() ?? "unknown"}`);
