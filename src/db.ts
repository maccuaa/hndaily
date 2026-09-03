import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Story } from "./types";

/**
 * Send history storage (ticket 06/09): tracks each Delivery run's
 * success/timestamp (for Catch-up gap detection) and every Story ever sent
 * (for dedup). Kept indefinitely — no pruning.
 */

export interface DeliveryRunRecord {
  startedAt: number;
  status: "success" | "failure";
  isCatchup: boolean;
  storiesSentCount: number;
}

/** Opens (creating if needed) the sqlite database and ensures the schema exists. */
export function openDb(path: string): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");

  // One statement per .run() call — a multi-statement string can silently
  // swallow a runtime error in a non-final statement (bun:sqlite gotcha).
  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      is_catchup INTEGER NOT NULL DEFAULT 0,
      stories_sent_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sent_stories (
      hn_id INTEGER NOT NULL,
      delivery_run_id INTEGER NOT NULL REFERENCES delivery_runs(id),
      title TEXT NOT NULL,
      url TEXT,
      points INTEGER NOT NULL,
      num_comments INTEGER NOT NULL,
      sent_at INTEGER NOT NULL,
      PRIMARY KEY (hn_id, delivery_run_id)
    );
  `);

  return db;
}

/** Unix-seconds timestamp of the last successful Delivery run, or null if there's never been one. */
export function getLastSuccessfulRunTime(db: Database): number | null {
  const row = db
    .query<{ ts: number | null }, []>(
      "SELECT MAX(started_at) AS ts FROM delivery_runs WHERE status = 'success'",
    )
    .get();
  return row?.ts ?? null;
}

/**
 * Every HN item id ever sent. Retention is indefinite (ticket 09) and the
 * table stays small at personal scale, so a full-table read is simplest —
 * no need for a parameterized IN-clause against the candidate set.
 */
export function getAllSentStoryIds(db: Database): Set<number> {
  const rows = db.query<{ hn_id: number }, []>("SELECT hn_id FROM sent_stories").all();
  return new Set(rows.map((r) => r.hn_id));
}

/** Records a Delivery run and returns its new row id. */
export function recordDeliveryRun(db: Database, run: DeliveryRunRecord): number {
  const result = db.run(
    "INSERT INTO delivery_runs (started_at, status, is_catchup, stories_sent_count) VALUES (?, ?, ?, ?)",
    [run.startedAt, run.status, run.isCatchup ? 1 : 0, run.storiesSentCount],
  );
  return Number(result.lastInsertRowid);
}

/** Records the Stories sent as part of a given Delivery run, in one transaction. */
export function recordSentStories(db: Database, deliveryRunId: number, stories: Story[]): void {
  const insert = db.query(
    `INSERT INTO sent_stories (hn_id, delivery_run_id, title, url, points, num_comments, sent_at)
     VALUES ($hnId, $deliveryRunId, $title, $url, $points, $numComments, $sentAt)`,
  );
  const insertAll = db.transaction((items: Story[]) => {
    const sentAt = Math.floor(Date.now() / 1000);
    for (const story of items) {
      insert.run({
        $hnId: story.hnId,
        $deliveryRunId: deliveryRunId,
        $title: story.title,
        $url: story.url,
        $points: story.points,
        $numComments: story.numComments,
        $sentAt: sentAt,
      });
    }
  });
  insertAll(stories);
}
