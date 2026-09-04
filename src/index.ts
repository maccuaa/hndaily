import { loadConfig } from "./config";
import { openDb } from "./db";
import { runDeliveryRun } from "./delivery-run";
import { loadHeartbeatUrlFromEnv } from "./heartbeat";
import { logger } from "./logger";
import { loadMailerConfigFromEnv } from "./mailer";
import { loadNtfyTopicFromEnv } from "./ntfy";

const CONFIG_PATH = process.env.HNDAILY_CONFIG_PATH ?? "config.json";
const DB_PATH = process.env.HNDAILY_DB_PATH ?? "data/hndaily.sqlite";

// --run-once: triggers one real Delivery run immediately, then exits.
// --dry-run: same, but a Dry run (see CONTEXT.md) — skips Send history.
// Both let you verify delivery (e.g. an SMTP fix) without waiting for cron.
const args = process.argv.slice(2);
const runOnce = args.includes("--run-once");
const dryRun = args.includes("--dry-run");
if (runOnce && dryRun) {
	throw new Error("--run-once and --dry-run are mutually exclusive");
}

const config = await loadConfig(CONFIG_PATH);
const mailerConfig = loadMailerConfigFromEnv();
const heartbeatUrl = loadHeartbeatUrlFromEnv();
const ntfyTopic = loadNtfyTopicFromEnv();
const db = openDb(DB_PATH);

logger.info("hndaily starting", {
	cron: config.schedule.cron,
	timezone: config.schedule.timezone,
	storyCount: config.storyCount,
	theme: config.theme,
	recipientEmail: config.recipientEmail,
	heartbeatEnabled: heartbeatUrl !== null,
	ntfyEnabled: ntfyTopic !== null,
	mode: runOnce ? "run-once" : dryRun ? "dry-run" : "scheduled",
});

if (runOnce || dryRun) {
	await runDeliveryRun({ db, config, mailerConfig, heartbeatUrl, ntfyTopic, dryRun });
	process.exit(0);
}

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
		await runDeliveryRun({ db, config, mailerConfig, heartbeatUrl, ntfyTopic });
	},
	{ tz: config.schedule.timezone },
);

const nextFire = Bun.cron.parse(config.schedule.cron, Date.now(), { tz: config.schedule.timezone });
logger.info("Next Delivery run scheduled", { nextFire: nextFire?.toISOString() ?? "unknown" });
