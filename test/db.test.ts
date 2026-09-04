import { describe, expect, test } from "bun:test";

import {
	getAllSentStoryIds,
	getLastSuccessfulRunTime,
	openDb,
	recordDeliveryRun,
	recordSentStories,
} from "../src/db";
import type { Story } from "../src/types";

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

describe("db", () => {
	test("openDb creates the schema on a fresh in-memory database", () => {
		const db = openDb(":memory:");
		expect(getLastSuccessfulRunTime(db)).toBeNull();
		expect(getAllSentStoryIds(db)).toEqual(new Set());
	});

	test("getLastSuccessfulRunTime ignores failed runs and picks the latest success", () => {
		const db = openDb(":memory:");
		recordDeliveryRun(db, {
			startedAt: 100,
			status: "success",
			isCatchup: false,
			storiesSentCount: 1,
		});
		recordDeliveryRun(db, {
			startedAt: 300,
			status: "failure",
			isCatchup: false,
			storiesSentCount: 0,
		});
		recordDeliveryRun(db, {
			startedAt: 200,
			status: "success",
			isCatchup: false,
			storiesSentCount: 1,
		});

		expect(getLastSuccessfulRunTime(db)).toBe(200);
	});

	test("recordDeliveryRun returns incrementing row ids", () => {
		const db = openDb(":memory:");
		const id1 = recordDeliveryRun(db, {
			startedAt: 100,
			status: "success",
			isCatchup: false,
			storiesSentCount: 0,
		});
		const id2 = recordDeliveryRun(db, {
			startedAt: 200,
			status: "success",
			isCatchup: false,
			storiesSentCount: 0,
		});
		expect(id2).toBeGreaterThan(id1);
	});

	test("recordSentStories makes ids show up in getAllSentStoryIds", () => {
		const db = openDb(":memory:");
		const runId = recordDeliveryRun(db, {
			startedAt: 100,
			status: "success",
			isCatchup: false,
			storiesSentCount: 2,
		});
		recordSentStories(db, runId, [story({ hnId: 1 }), story({ hnId: 2 })]);

		expect(getAllSentStoryIds(db)).toEqual(new Set([1, 2]));
	});

	test("the same hn_id can be recorded again under a different delivery run (composite key)", () => {
		// Not expected in practice (dedup happens before recording), but the
		// schema's composite primary key (hn_id, delivery_run_id) should allow it
		// without throwing, rather than a bare hn_id primary key that would reject it.
		const db = openDb(":memory:");
		const run1 = recordDeliveryRun(db, {
			startedAt: 100,
			status: "success",
			isCatchup: false,
			storiesSentCount: 1,
		});
		const run2 = recordDeliveryRun(db, {
			startedAt: 200,
			status: "success",
			isCatchup: false,
			storiesSentCount: 1,
		});

		recordSentStories(db, run1, [story({ hnId: 42 })]);
		expect(() => recordSentStories(db, run2, [story({ hnId: 42 })])).not.toThrow();
	});

	test("recordSentStories stores a null url for self-posts", () => {
		const db = openDb(":memory:");
		const runId = recordDeliveryRun(db, {
			startedAt: 100,
			status: "success",
			isCatchup: false,
			storiesSentCount: 1,
		});
		recordSentStories(db, runId, [story({ hnId: 7, url: null })]);

		expect(getAllSentStoryIds(db)).toEqual(new Set([7]));
	});
});
