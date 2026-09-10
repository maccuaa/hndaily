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

let config = await loadConfig(CONFIG_PATH);
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
// (ticket 05/10). Config is re-read at the top of every tick so editing
// config.json takes effect without a restart. Bun.cron can't update an
// existing job's schedule in place, so if schedule.cron/timezone changed,
// the old job is stopped and a new one registered with the fresh schedule
// — that change is picked up starting the *next* fire, not instantly.
let job: Bun.CronJob;
let scheduledTimezone = config.schedule.timezone;

function logNextFire(): void {
	const nextFire = Bun.cron.parse(config.schedule.cron, Date.now(), {
		tz: config.schedule.timezone,
	});
	logger.info("Next Delivery run scheduled", { nextFire: nextFire?.toISOString() ?? "unknown" });
}

/**
 *  Re-reads config.json, falling back to the last known-good config (and just logging) on failure.
 * */
async function reloadConfig(): Promise<void> {
	try {
		config = await loadConfig(CONFIG_PATH);
	} catch (err) {
		logger.error("Failed to re-read config; using last known-good config", {
			error: (err as Error).message,
		});
	}
}

function rescheduleIfChanged(): void {
	if (config.schedule.cron === job.cron && config.schedule.timezone === scheduledTimezone) {
		// no changes to the schedule, so no rescheduling needed.
		return;
	}

	logger.info("Delivery schedule changed; rescheduling", {
		previousCron: job.cron,
		previousTimezone: scheduledTimezone,
		cron: config.schedule.cron,
		timezone: config.schedule.timezone,
	});

	job.stop();

	job = Bun.cron(config.schedule.cron, tick, { tz: config.schedule.timezone });

	scheduledTimezone = config.schedule.timezone;

	logNextFire();
}

async function tick(): Promise<void> {
	await reloadConfig();

	// Deliberately unhandled on failure: runDeliveryRun logs and re-throws,
	// which crashes the process. Docker's `restart: unless-stopped` (ticket
	// 10) is the recovery mechanism, alongside the heartbeat ping (ticket 11)
	// catching a schedule that silently stopped firing.
	await runDeliveryRun({ db, config, mailerConfig, heartbeatUrl, ntfyTopic });

	// Re-read once more in case config.json was edited again while the
	// delivery above (SMTP/network calls) was in flight.
	await reloadConfig();

	rescheduleIfChanged();
}

job = Bun.cron(config.schedule.cron, tick, { tz: config.schedule.timezone });
logNextFire();
