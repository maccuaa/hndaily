import { describe, expect, test } from "bun:test";

import type { Config } from "../src/config";
import { getAllSentStoryIds, openDb } from "../src/db";
import { runDeliveryRun } from "../src/delivery-run";
import type { MailerConfig } from "../src/mailer";
import type { Story } from "../src/types";

function config(): Config {
	return {
		recipientEmail: "you@example.com",
		storyCount: 3,
		schedule: { cron: "0 7 * * *", timezone: "UTC" },
		theme: "night-wire",
	};
}

function mailerConfig(): MailerConfig {
	return {
		host: "smtp.example.com",
		port: 465,
		username: "u",
		password: "p",
		from: "hndaily@snowcastle.ca",
	};
}

function story(overrides: Partial<Story> = {}): Story {
	return {
		hnId: 1,
		title: "A story",
		url: "https://example.com",
		points: 100,
		numComments: 10,
		createdAt: 1_700_000_000,
		...overrides,
	};
}

describe("runDeliveryRun", () => {
	test("on success: records a success run, records sent stories, and pings the heartbeat", async () => {
		const db = openDb(":memory:");
		const stories = [story({ hnId: 1 }), story({ hnId: 2 })];
		let heartbeatCalledWith: string | undefined;
		let mailSentTo: string | undefined;

		await runDeliveryRun(
			{
				db,
				config: config(),
				mailerConfig: mailerConfig(),
				heartbeatUrl: "https://hc-ping.com/abc",
			},
			{
				curateFn: async () => ({ stories, isCatchup: false, windowStart: 0 }),
				renderFn: () => ({ subject: "s", html: "h" }),
				sendMailFn: async (_mc, to) => {
					mailSentTo = to;
				},
				sendHeartbeatFn: async (url) => {
					heartbeatCalledWith = url;
				},
			},
		);

		expect(mailSentTo).toBe("you@example.com");
		expect(heartbeatCalledWith).toBe("https://hc-ping.com/abc");
		expect(getAllSentStoryIds(db)).toEqual(new Set([1, 2]));
	});

	test("on success without a configured heartbeat URL: does not attempt to ping", async () => {
		const db = openDb(":memory:");
		let heartbeatCalled = false;

		await runDeliveryRun(
			{ db, config: config(), mailerConfig: mailerConfig(), heartbeatUrl: null },
			{
				curateFn: async () => ({ stories: [], isCatchup: false, windowStart: 0 }),
				renderFn: () => ({ subject: "s", html: "h" }),
				sendMailFn: async () => {},
				sendHeartbeatFn: async () => {
					heartbeatCalled = true;
				},
			},
		);

		expect(heartbeatCalled).toBe(false);
	});

	test("on failure: records a failed run, does not record sent stories, does not ping, and re-throws", async () => {
		const db = openDb(":memory:");
		let heartbeatCalled = false;

		await expect(
			runDeliveryRun(
				{
					db,
					config: config(),
					mailerConfig: mailerConfig(),
					heartbeatUrl: "https://hc-ping.com/abc",
				},
				{
					curateFn: async () => ({ stories: [story()], isCatchup: false, windowStart: 0 }),
					renderFn: () => ({ subject: "s", html: "h" }),
					sendMailFn: async () => {
						throw new Error("SMTP connection refused");
					},
					sendHeartbeatFn: async () => {
						heartbeatCalled = true;
					},
				},
			),
		).rejects.toThrow("SMTP connection refused");

		expect(heartbeatCalled).toBe(false);
		expect(getAllSentStoryIds(db)).toEqual(new Set());
	});
});
