Type: grilling
Status: resolved
Blocked by: 06

## Question

Given the `bun:sqlite` research findings (ticket 06), confirm the Send history schema and retention policy: how long to keep old Delivery run / Story records, whether to store full Story metadata or just HN item IDs, and whether any of this data needs to survive a server rebuild (backup/restore expectations).

**Also covers (added after ticket 01):** the schema must support detecting gaps for the Catch-up digest — i.e. tracking each Delivery run's success/timestamp so a later run can tell "was the last scheduled run missed or delayed, and if so, since when," not just "which Stories were already sent." Confirm what a run needs to record (e.g. a `delivery_runs` table with status/timestamp, alongside the sent-Stories table) to make that gap check a simple query.

## Answer

- **Retention**: keep everything indefinitely — no pruning. At personal scale (dozens of Stories/day) the file stays tiny for years; simplest option, revisit only if size ever becomes a real problem.
- **Story metadata**: store full metadata at send-time (title, url, points, comment count, HN id), not just the bare ID — makes the Catch-up digest self-contained without re-fetching from the HN API, where a story could be gone or edited by catch-up time.
- **Backup/restore**: relies on the bind mount (ticket 07) plus whatever existing mechanism already backs up other bind-mounted service data on this server — no new backup step needed for this project specifically.
- **Schema** (two tables):
  ```sql
  CREATE TABLE IF NOT EXISTS delivery_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,          -- unix timestamp
    status TEXT NOT NULL,                 -- 'success' | 'failure'
    is_catchup INTEGER NOT NULL DEFAULT 0, -- was this itself a Catch-up digest run?
    stories_sent_count INTEGER NOT NULL DEFAULT 0
  );

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
  ```
  **Gap check** (for the Catch-up digest, ticket 01): compare now against `MAX(started_at) WHERE status = 'success'` in `delivery_runs`. If the gap exceeds the expected interval derived from the configured frequency (ticket 01), the next run fetches everything since that last successful run (not just the fixed Curation window) and marks itself `is_catchup = 1`.

