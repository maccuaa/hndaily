Type: research
Status: resolved

## Question

Is Bun's built-in SQLite support (`bun:sqlite`) sufficient for tracking Send history (which Stories have already appeared in a past Digest) and basic Delivery run logging, without adding an ORM or external database? Cover:

- API surface and stability of `bun:sqlite`
- Migration/schema-management approach that fits a project this small (raw SQL vs. a lightweight migration tool)
- Whether the SQLite file needs any special handling for backup, or survives redeploys on the Oracle server (relates to ticket 10)

## Answer

**Yes, `bun:sqlite` is sufficient** — no ORM or external database needed. Mature, `better-sqlite3`-inspired API with parameterized queries, transactions, and WAL mode; actively maintained (bundled SQLite upgraded every 1-3 months). Schema management: just `CREATE TABLE IF NOT EXISTS` run at startup (one statement per `.run()` call — a currently-open bug silently swallows runtime errors in non-final statements of a multi-statement string), plus SQLite's built-in `PRAGMA user_version` if the schema ever needs to evolve — no migration framework warranted for a 2-table schema. For deployment: keep the `.sqlite` file outside the git-managed directory (Bun doesn't auto-create parent directories, and this means `git pull` redeploys never touch the data file); SQLite's automatic crash recovery makes mid-run restarts safe; back up with `VACUUM INTO` run at the end of each Delivery run.

Full findings, citations, and gotchas: [`research/bun-sqlite-storage.md`](https://github.com/maccuaa/hndaily/blob/research/bun-sqlite-storage/.scratch/hn-digest-service/research/bun-sqlite-storage.md) (branch `research/bun-sqlite-storage`).
