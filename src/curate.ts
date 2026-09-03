import type { Database } from "bun:sqlite";
import type { Config } from "./config";
import { getAllSentStoryIds, getLastSuccessfulRunTime } from "./db";
import { fetchTopStories } from "./hn-source";
import type { Story } from "./types";

/** Fixed Curation window (ticket 01) — does not scale with configured frequency. */
export const CURATION_WINDOW_SECONDS = 24 * 60 * 60;

/**
 * How late a run can start beyond its expected scheduled time before it's
 * treated as catching up after a missed/delayed prior run, rather than just
 * normal scheduling jitter.
 */
export const CATCHUP_GRACE_MS = 15 * 60 * 1000;

/** Overfetch factor so dedup against Send history still leaves enough Stories to fill storyCount. */
const OVERFETCH_FACTOR = 4;
const MAX_CANDIDATES = 200;

export interface CurationResult {
  stories: Story[];
  /** True if this run is a Catch-up digest (ticket 01) covering a gap since the last successful run. */
  isCatchup: boolean;
  /** Unix seconds: the start of whatever window was actually used. */
  windowStart: number;
}

/**
 * Selects the Stories for this Delivery run: the fixed Curation window
 * normally, or everything since the last successful run if a gap is
 * detected (Catch-up digest, ticket 01), deduped against Send history
 * (ticket 09) and capped at the configured story count.
 */
export async function curate(
  db: Database,
  config: Config,
  fetchStories: typeof fetchTopStories = fetchTopStories,
): Promise<CurationResult> {
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  const lastSuccess = getLastSuccessfulRunTime(db);

  let windowStart = nowSeconds - CURATION_WINDOW_SECONDS;
  let isCatchup = false;

  if (lastSuccess !== null) {
    const expectedNextFire = Bun.cron.parse(config.schedule.cron, new Date(lastSuccess * 1000), {
      tz: config.schedule.timezone,
    });
    if (expectedNextFire && nowMs - expectedNextFire.getTime() > CATCHUP_GRACE_MS) {
      isCatchup = true;
      windowStart = lastSuccess;
    }
  }

  const overfetchLimit = Math.min(config.storyCount * OVERFETCH_FACTOR, MAX_CANDIDATES);
  const candidates = await fetchStories(windowStart, overfetchLimit);

  const alreadySent = getAllSentStoryIds(db);
  const fresh = candidates.filter((story) => !alreadySent.has(story.hnId));
  const stories = fresh.slice(0, config.storyCount);

  return { stories, isCatchup, windowStart };
}
