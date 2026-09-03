import { describe, expect, test } from "bun:test";
import type { Config } from "../src/config";
import { curate } from "../src/curate";
import { openDb, recordDeliveryRun, recordSentStories } from "../src/db";
import type { Story } from "../src/types";

function config(overrides: Partial<Config> = {}): Config {
  return {
    recipientEmail: "you@example.com",
    storyCount: 3,
    schedule: { cron: "0 * * * *", timezone: "UTC" }, // hourly
    ...overrides,
  };
}

function story(overrides: Partial<Story> = {}): Story {
  return {
    hnId: 1,
    title: "A story",
    url: "https://example.com",
    points: 100,
    numComments: 10,
    createdAt: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("curate", () => {
  test("uses the fixed window and is not a catch-up when there's no previous run", async () => {
    const db = openDb(":memory:");
    const candidates = [story({ hnId: 1 }), story({ hnId: 2 })];
    const fetchStories = async () => candidates;

    const result = await curate(db, config(), fetchStories);

    expect(result.isCatchup).toBe(false);
    expect(result.stories).toEqual(candidates);
  });

  test("is not a catch-up when the last successful run was recent (within schedule + grace)", async () => {
    const db = openDb(":memory:");
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    recordDeliveryRun(db, {
      startedAt: oneMinuteAgo,
      status: "success",
      isCatchup: false,
      storiesSentCount: 0,
    });
    const fetchStories = async () => [story()];

    const result = await curate(db, config(), fetchStories);

    expect(result.isCatchup).toBe(false);
  });

  test("is a catch-up, using the last-success time as the window start, when a run was clearly missed", async () => {
    const db = openDb(":memory:");
    const threeHoursAgo = Math.floor(Date.now() / 1000) - 3 * 60 * 60;
    recordDeliveryRun(db, {
      startedAt: threeHoursAgo,
      status: "success",
      isCatchup: false,
      storiesSentCount: 0,
    });
    let requestedSince = -1;
    const fetchStories = async (since: number) => {
      requestedSince = since;
      return [story()];
    };

    const result = await curate(db, config(), fetchStories);

    expect(result.isCatchup).toBe(true);
    expect(result.windowStart).toBe(threeHoursAgo);
    expect(requestedSince).toBe(threeHoursAgo);
  });

  test("filters out Stories already recorded in Send history", async () => {
    const db = openDb(":memory:");
    const runId = recordDeliveryRun(db, {
      startedAt: Math.floor(Date.now() / 1000) - 100,
      status: "success",
      isCatchup: false,
      storiesSentCount: 1,
    });
    recordSentStories(db, runId, [story({ hnId: 1 })]);
    const fetchStories = async () => [story({ hnId: 1 }), story({ hnId: 2 })];

    const result = await curate(db, config(), fetchStories);

    expect(result.stories.map((s) => s.hnId)).toEqual([2]);
  });

  test("caps the result at the configured storyCount", async () => {
    const db = openDb(":memory:");
    const candidates = [1, 2, 3, 4, 5].map((hnId) => story({ hnId }));
    const fetchStories = async () => candidates;

    const result = await curate(db, config({ storyCount: 2 }), fetchStories);

    expect(result.stories).toHaveLength(2);
    expect(result.stories.map((s) => s.hnId)).toEqual([1, 2]);
  });

  test("overfetches beyond storyCount to leave room for dedup", async () => {
    const db = openDb(":memory:");
    let requestedLimit = -1;
    const fetchStories = async (_since: number, limit: number) => {
      requestedLimit = limit;
      return [];
    };

    await curate(db, config({ storyCount: 3 }), fetchStories);

    expect(requestedLimit).toBeGreaterThan(3);
  });
});
