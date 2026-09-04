import { DEFAULT_THEME_ID, THEME_IDS } from "./themes";

/**
 * Loads and validates the Recipient's config file (ticket 01): story count,
 * schedule (a standard cron expression covers frequency + time-of-day
 * together), IANA timezone, and which Theme (src/themes/) renders the
 * Digest's HTML. Read once at container startup (ticket 10); changing a
 * value requires restarting the container to take effect.
 */
export interface Config {
	recipientEmail: string;
	storyCount: number;
	schedule: {
		cron: string;
		timezone: string;
	};
	/** One of THEME_IDS (src/themes/) — defaults to DEFAULT_THEME_ID ("night-wire") when omitted. */
	theme: string;
}

export async function loadConfig(path: string): Promise<Config> {
	let raw: unknown;
	try {
		raw = await Bun.file(path).json();
	} catch (err) {
		throw new Error(`Failed to read config file at "${path}": ${(err as Error).message}`, {
			cause: err,
		});
	}
	return validateConfig(raw, path);
}

export function validateConfig(raw: unknown, path: string): Config {
	if (typeof raw !== "object" || raw === null) {
		throw new Error(`Config at "${path}" must be a JSON object`);
	}
	const obj = raw as Record<string, unknown>;

	if (typeof obj.recipientEmail !== "string" || !obj.recipientEmail.includes("@")) {
		throw new Error(`Config at "${path}": "recipientEmail" must be a valid email string`);
	}
	if (
		typeof obj.storyCount !== "number" ||
		!Number.isInteger(obj.storyCount) ||
		obj.storyCount <= 0
	) {
		throw new Error(`Config at "${path}": "storyCount" must be a positive integer`);
	}

	if (typeof obj.schedule !== "object" || obj.schedule === null) {
		throw new Error(`Config at "${path}": "schedule" must be an object`);
	}
	const schedule = obj.schedule as Record<string, unknown>;

	if (typeof schedule.cron !== "string" || schedule.cron.trim() === "") {
		throw new Error(`Config at "${path}": "schedule.cron" must be a non-empty cron expression`);
	}
	if (typeof schedule.timezone !== "string" || schedule.timezone.trim() === "") {
		throw new Error(
			`Config at "${path}": "schedule.timezone" must be a non-empty IANA timezone name`,
		);
	}

	// Validate the cron expression + timezone actually parse to a real future time.
	let nextFire: Date | null;
	try {
		nextFire = Bun.cron.parse(schedule.cron, Date.now(), { tz: schedule.timezone });
	} catch (err) {
		throw new Error(
			`Config at "${path}": invalid "schedule.cron"/"schedule.timezone": ${(err as Error).message}`,
			{ cause: err },
		);
	}
	if (!nextFire) {
		throw new Error(`Config at "${path}": "schedule.cron" does not match any upcoming time`);
	}

	// Omitted "theme" defaults to Night Wire so configs written before the
	// theme setting existed keep working unchanged.
	const theme = obj.theme === undefined ? DEFAULT_THEME_ID : obj.theme;
	if (typeof theme !== "string" || !THEME_IDS.includes(theme)) {
		throw new Error(`Config at "${path}": "theme" must be one of: ${THEME_IDS.join(", ")}`);
	}

	return {
		recipientEmail: obj.recipientEmail,
		storyCount: obj.storyCount,
		schedule: { cron: schedule.cron, timezone: schedule.timezone },
		theme,
	};
}
