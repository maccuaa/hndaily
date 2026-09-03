# Research: bun:sqlite for Send history / dedupe storage

Ticket: [06-bun-sqlite-storage](../issues/06-bun-sqlite-storage.md)

## Recommendation

**Yes — `bun:sqlite` is sufficient.** For a single-writer, once-a-day batch job tracking "seen story IDs" and a run log (almost certainly a few thousand rows total, ever), Bun's built-in SQLite driver provides everything needed: parameterized queries, transactions, prepared statements, and WAL mode, with no ORM or external database required. The API is mature (modeled directly on `better-sqlite3`), actively maintained (the bundled SQLite engine has been upgraded roughly every 1–3 months across 2023–2026), and has no open correctness issues that would affect a schema this simple at this scale.

Two caveats to design around, both cheap to avoid:
1. A currently-open bug means multi-statement strings passed to a single `.run()`/`.exec()` call can silently swallow a runtime error in a non-final statement — avoid by executing one SQL statement per `.run()` call (the natural style for schema setup anyway).
2. Bun does not auto-create the parent directory for the database file, and the recommended practice is to keep the `.sqlite` file entirely outside the git-managed code directory regardless, so `git pull`-based redeploys can never touch it.

Nothing in this research suggests reaching for `drizzle`/`kysely`/Postgres/etc. — that would be over-engineering for the stated use case.

---

## 1. API Surface and Stability

**Primary source:** `https://bun.sh/docs/api/sqlite` (redirects to `https://bun.sh/docs/runtime/sqlite`)

### Shape of the API
```js
import { Database } from "bun:sqlite";
const db = new Database("mydb.sqlite", { create: true }); // or ":memory:"
const query = db.query("select 'Hello world' as message;"); // cached Statement
query.get();
```
- `new Database(filename, options)` — `options`: `readonly`, `create`, `strict` (require `$/:/@` prefixes and throw on missing bind params), `safeIntegers` (return `bigint` instead of lossy `number` for 64-bit ints).
- `.query(sql)` compiles and **caches** the prepared statement on the `Database` (cache size = `Database.MAX_QUERY_CACHE_SIZE`, default 20); `.prepare(sql)` compiles without caching, for one-off/dynamically generated SQL.
- `Statement` methods: `.all()`, `.get()`, `.run()` (returns `{lastInsertRowid, changes}`), `.values()`, `.iterate()` (streaming), `.as(Class)` (zero-ORM row-to-class mapping), `.finalize()`, `.toString()` (debug/expanded SQL).
- Parameterized queries: named (`$foo`, `:foo`, `@foo`) and positional (`?1`, `?2`) — both documented and shown as first-class.
- Transactions: `const tx = db.transaction(fn)`, with `.deferred/.immediate/.exclusive` variants; nested transaction calls automatically become SQL `SAVEPOINT`s. Exceptions inside a transaction trigger automatic rollback and propagate normally.
- WAL mode: officially recommended — `db.run("PRAGMA journal_mode = WAL;")` — "We recommend enabling WAL mode for most applications."
- `.serialize()` / `Database.deserialize()` for in-memory snapshotting (`sqlite3_serialize`/`deserialize` under the hood).
- The docs explicitly credit **better-sqlite3** as the API's inspiration, and claim `bun:sqlite` is "roughly 3-6x faster than better-sqlite3 and 8-9x faster than deno.land/x/sqlite for read queries" (benchmarked against the Northwind dataset).

### Stability signal
The docs page carries **no explicit "stable"/"experimental" label** (unlike Node's stability-index convention) — this is a minor documentation gap I could not close from the docs alone. However, circumstantial evidence points strongly to production maturity:
- Test coverage is substantial: `test/js/bun/sqlite/sqlite.test.js` alone is ~96.8 KB, plus dedicated `column-types.test.js`, `sqlite-cross-process.js`, and `sql-timezone.test.js` (`https://github.com/oven-sh/bun/tree/main/test/js/bun/sqlite`).
- The bundled SQLite engine is upgraded on a steady cadence, showing active investment: 3.38.5→3.44.2 (`https://github.com/oven-sh/bun/pull/7668`, closed 2023-12-15), →3.45.0 adding JSONB support (`https://github.com/oven-sh/bun/pull/8196`), →3.47.0 (`https://github.com/oven-sh/bun/pull/15144`, 2024-11-14), →3.51.0 (`https://github.com/oven-sh/bun/pull/24530`, 2025-11-09), →3.51.100/3.51.200/3.53.0 through March 2026 (`#25243`, `#25957`, `#27912`).
- As of Bun v1.4.0 (released 2026-08-20, per `https://api.github.com/repos/oven-sh/bun/releases/latest`), `process.versions.sqlite` now exposes the exact linked SQLite version at runtime (`https://github.com/oven-sh/bun/issues/15494`, implemented comment from the Bun lead maintainer).
- Bun **statically links its own SQLite build on every platform** — a vendored amalgamation on Linux/Windows, Apple's SQLite statically linked on macOS — and does **not** dynamically link to whatever `sqlite3` happens to be on the host OS (`https://github.com/oven-sh/bun/issues/16717`, maintainer-confirmed comment thread). For a Linux server deployment, this means behavior is fully determined by the Bun version you install, not by the host's system packages.
- The `bun:sqlite`-labeled issue tracker (30 open / 55 closed as of this research) is now dominated by **feature requests**, not correctness bugs: async API (`#978`, open since 2022, 36 👍), user-defined functions (`#1474`), SQLCipher support (`#11397`), virtual tables (`#23063`). Nearly all segfault/hang-class bugs found in the history are from 2023 and long since closed (e.g., `#5756`, `#2007`, `#1978`).

### Gotcha found: multi-statement `.run()`/`.exec()` silently swallows step-time errors
This is the one correctness issue worth designing around. `Database.prototype.run()`/`.exec()` accepts a semicolon-separated multi-statement SQL string. If a **runtime** error (constraint violation, `RAISE(ABORT)` trigger, etc. — as opposed to a syntax error) occurs in a statement that isn't the last one in the string, the error is currently discarded and execution silently continues:
```js
db.run(`INSERT INTO t VALUES (1,'a'); INSERT INTO t VALUES (1,'clash'); INSERT INTO t VALUES (2,'b');`);
// returns normally; the clashing row is skipped but no exception is thrown
```
- Reported independently twice: `https://github.com/oven-sh/bun/issues/37415` (2026-08-11) and `https://github.com/oven-sh/bun/issues/41010` (2026-08-31, closed as duplicate).
- Fix PR is open but **unmerged as of this research**: `https://github.com/oven-sh/bun/pull/37418` ("Fixes #37415, Fixes #41010").
- Root cause per the PR description: the multi-statement loop in `JSSQLStatement.cpp` checks `sqlite3_prepare_v3`'s result but not the `sqlite3_step` loop's result, so a step-time error gets overwritten by the next statement's (successful) prepare.
- **Practical mitigation:** execute one SQL statement per `.run()`/`.prepare()` call instead of concatenating multiple statements into one string. This is the natural style for a schema-init script and sidesteps the bug entirely.

### Adjacent APIs worth being aware of (not recommended over `bun:sqlite` here)
- Bun also ships `Bun.SQL`/`Bun.sql`, a newer **unified** SQL client with tagged-template syntax that includes a SQLite adapter (`new SQL("sqlite://myapp.db")` or `{ adapter: "sqlite" }`), aimed at code that wants one interface across Postgres/MySQL/SQLite (`https://bun.sh/docs/api/sql`, redirects to `https://bun.sh/docs/runtime/sql`). For a dedicated single-database app, `bun:sqlite` is the more directly-documented, longer-established, purpose-built driver — no reason to switch.
- Bun also implements `node:sqlite` (Node's own built-in SQLite module) for Node.js compatibility, reportedly passing 100% of Node's `node:sqlite` test suite (`https://bun.sh/blog/bun-v1.4`). This is a Node-compat shim, not a reason to prefer it over the native `bun:sqlite` API.

---

## 2. Migration / Schema Management

**Finding: Bun ships no built-in migration tooling.** I found no migration CLI, subcommand, or framework in Bun's docs or CLI reference. The standard, documented pattern is exactly what you'd expect for a project this size: run idempotent DDL at startup, shown directly in Bun's own docs example (`https://bun.sh/docs/api/sqlite`):
```js
db.run("create table foo (bar text);");
```
i.e., `CREATE TABLE IF NOT EXISTS ...` executed once at process start.

### Recommended approach for this project
Given two small, stable tables (seen-story tracking + run log), the lightest-weight and most idiomatic approach is:
1. `CREATE TABLE IF NOT EXISTS` statements, run individually (not concatenated into one multi-statement string, per the bug noted in §1).
2. If/when the schema needs to evolve later, use SQLite's own built-in `PRAGMA user_version` — "an integer that is available to applications to use however they want [for versioning]... at offset 60 in the database header" (`https://www.sqlite.org/pragma.html#pragma_user_version`). Read it at startup, compare against the version your code expects, run any needed `ALTER TABLE` statements (each as its own `.run()` call), then bump it — no extra migrations table, no framework, zero added dependencies.

### Lightweight community tools commonly paired with `bun:sqlite` (brief, as requested)
If the schema is expected to grow non-trivially, these are the tools people actually reach for instead of a full ORM:
- **Drizzle ORM** has a native `drizzle-orm/bun-sqlite` driver and pairs with `drizzle-kit` for generated migrations (`https://orm.drizzle.team/docs/sqlite/connect-bun-sqlite`). This is the most common "schema-as-code + migrations" pairing, but it is a full ORM — more than this project needs per your stated preference.
- **Kysely** (a SQL query builder, not a full ORM) has community-maintained `bun:sqlite` dialects on npm (`kysely-bun-sqlite`, `@meck93/kysely-bun-sqlite`, `@pikku/kysely-bun-sqlite` — confirmed present via the npm registry search API) plus its own built-in lightweight `Migrator` class that works with any dialect.
- **umzug** — a framework/database-agnostic migration runner (`https://www.npmjs.com/package/umzug`, "Framework-agnostic migration tool for Node") that can wrap raw `bun:sqlite` calls directly with no ORM or query builder at all — the closest thing to "just add a migration runner" without extra abstraction layers.

For a 2-table schema, I'd skip all three and just use `CREATE TABLE IF NOT EXISTS` + `PRAGMA user_version` directly.

---

## 3. Practical Considerations for a Linux Server with `git pull`-based Redeploys

### Keep the database file outside the deployed code directory
Bun's `Database` constructor treats the filename as an ordinary filesystem path — nothing ties it to the source tree (`https://bun.sh/docs/api/sqlite`). Two concrete findings reinforce keeping it **outside** the git-managed directory:
- **Bun does not auto-create parent directories** for the database file path. `new Database("./data/digest.sqlite")` throws `unable to open database file` if `./data` doesn't exist — this is a confirmed, still-open issue (`https://github.com/oven-sh/bun/issues/3888`, opened 2023-07-30). You must `mkdir -p` the directory yourself before opening the database (once, during provisioning — or defensively in code via `fs.mkdirSync(dir, { recursive: true })`).
- Since redeploy = `git pull` + restart, any data file living inside the repo directory risks being touched by a hard reset, clean checkout, or `.gitignore` misconfiguration. Storing the `.sqlite` file at a fixed path outside the repo (e.g., a sibling `data/` directory or a conventional location like `/var/lib/<appname>/`) means redeploys never need special-casing — this is standard Linux service hygiene, not something Bun's docs cover directly, so I'm flagging it as general operational practice rather than a documented Bun claim.

### WAL mode: real benefit, two host-level constraints to respect
Bun's docs recommend WAL mode for "most applications" via `PRAGMA journal_mode = WAL;` (`https://bun.sh/docs/api/sqlite`). Underlying SQLite-level constraints (apply identically inside `bun:sqlite`, since it's the same engine) that matter for a self-hosted deployment:
- **"WAL does not work over a network filesystem"** — all processes touching the DB must be on the same host, because WAL coordination requires shared memory (`https://www.sqlite.org/wal.html`). Don't put the `.sqlite` file on an NFS/SMB/NAS-mounted directory.
- WAL requires **write access to the containing directory**, not just the DB file itself, whenever the `-shm` companion file doesn't already exist ("write access on the directory containing the database file if the '-shm' file does not exist" — `https://www.sqlite.org/wal.html`). Whatever Linux user runs the Bun process (e.g., a dedicated systemd service account) needs write permission on the data directory, not just the file.
- **Sidecar file (`-wal`, `-shm`) cleanup differs by platform**, per Bun's docs: macOS uses Apple's SQLite build with persistent WAL enabled, so sidecar files persist after `.close()`; **Linux and Windows use Bun's own statically-linked SQLite, which follows upstream defaults and "typically removes the sidecar files after close when no other connections are open"** (`https://bun.sh/docs/api/sqlite`). On your Linux server, default cleanup should just work; the extra `db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0)` + `PRAGMA wal_checkpoint(TRUNCATE)` dance shown in the docs is mainly relevant if you develop/test on macOS and want cross-platform parity.

### Crash-safety across restarts (directly answers the "redeploy mid-run" worry)
SQLite's own documentation states plainly: *"An SQLite database is highly resistant to corruption. If an application crash, or an operating-system crash, or even a power failure occurs in the middle of a transaction, the partially written transaction should be automatically rolled back the next time the database file is accessed. The recovery process is fully automatic..."* (`https://www.sqlite.org/howtocorrupt.html`). Practically: if your redeploy script kills/restarts the Bun process mid-run, the database will not be corrupted — the next run's first database access triggers automatic recovery. No special handling required.

### Backup approach for a single small file
Because this is a **once-daily batch job**, not a continuously-running server with concurrent writers, there's no concurrent-transaction hazard as long as your backup step doesn't overlap the job's write window. SQLite's own guidance: a plain file copy is safe "as long as there are no transactions in progress while the copy is taking place," **but** if using WAL mode, any `-wal`/`-journal` sidecar file must be copied together with the main file, or you must ensure they don't exist (i.e., fully checkpointed) at copy time (`https://www.sqlite.org/howtocorrupt.html`). Three safe, low-effort recipes, in increasing order of robustness:
1. **Simplest:** after the daily job finishes, run `PRAGMA wal_checkpoint(TRUNCATE);` then `db.close()` (per Bun's documented WAL-cleanup recipe), which leaves only the single main `.sqlite` file — then a plain `cp mydb.sqlite backups/mydb-$(date +%F).sqlite` from cron is fully safe.
2. **More robust, no timing dependency:** use SQLite's own `VACUUM INTO 'backup-path.sqlite'` command (`https://www.sqlite.org/lang_vacuum.html#vacuuminto`), run as `db.run("VACUUM INTO ?", [path])` at the end of the same Bun script — it always produces one consistent, compacted snapshot regardless of WAL/checkpoint state, with no external cron job needed.
3. **Fully JS-native:** use `bun:sqlite`'s own `.serialize()` (documented, returns a `Uint8Array`) and write it out via `Bun.write(path, db.serialize())` from inside the script — no shell `cp` involved at all.

For a personal HN-digest tracker (likely low tens of thousands of rows over years, well under a few MB), any of the above run once daily with simple rotation (keep last N days, delete older) is more than sufficient — no streaming/continuous backup infrastructure needed. (`https://www.sqlite.org/backup.html` additionally documents the C-level Online Backup API and the SSH-based `sqlite3_rsync` tool as alternatives, but both are overkill at this scale.)

---

## 4. Known Limitations / Gotchas for a Small Always-On Background Job

- **Platform/version requirements are a non-issue here.** Bun supports Linux x64/arm64, macOS x64/Apple Silicon, and Windows x64/arm64 (`https://github.com/oven-sh/bun` README). For Linux specifically, Bun's install docs state: *"We recommend kernel version 5.6 or higher. Bun runs on kernels as old as 3.10 (RHEL 7) with graceful degradation of newer syscalls"* (`https://bun.sh/docs/installation`) — effectively any current Linux server qualifies, and `bun:sqlite` itself requires nothing beyond normal file I/O.
- **No dynamic linking to host SQLite, on any OS** — Bun statically links its own vendored SQLite build (`https://github.com/oven-sh/bun/issues/16717`). Good for consistency (no drift based on the server's installed `sqlite3` package), but means using extensions or a custom SQLite build requires Bun's explicit `Database.setCustomSQLite(path)` escape hatch, documented primarily as a macOS workaround since Apple's system SQLite lacks extension-loading support (`https://bun.sh/docs/api/sqlite`, `.loadExtension()` section) — not relevant here since this project needs no SQLite extensions.
- **Multi-statement `.run()`/`.exec()` swallowed-error bug** — covered in detail in §1/§2; unmerged as of this research (`https://github.com/oven-sh/bun/pull/37418`). Avoid by running one statement per call.
- **Synchronous-only API** — there is no async variant; `#978` ("Asynchronous SQLite API," open since 2022, 36 👍, `https://github.com/oven-sh/bun/issues/978`) remains unimplemented. This is a non-issue for a batch job that runs once a day doing a handful of small queries; it would only matter if this ever became a concurrently-loaded HTTP server.
- **Historical crash-class bugs, virtually all closed by 2024**: e.g., segfault on `.loadExtension()` when unavailable (`#5756`, closed 2023-09-21), "Illegal instruction" on a `NOT NULL` text column (`#2007`, closed 2023-02-08). More recent crash-adjacent fixes are narrow edge cases involving malformed/degenerate SQL text, already resolved quickly: `#40911` ("throw instead of crashing when `prepare()` gets SQL with no statement," e.g. an all-whitespace string — previously segfaulted, now throws a clean `RangeError`; closed 2026-08-29) and `#34186` ("stop `exec`/`run` from hanging on embedded NUL in SQL string" — a NUL byte in the SQL text previously spun the process at 100% CPU forever; closed 2026-07-15). **Practical takeaway:** these all involve degenerate/malformed SQL text (empty statements, embedded NULs) — a project that only ever runs its own hand-written schema/query strings (never forwards untrusted input as raw SQL) has essentially zero exposure to this bug class.
- **One still-open, unconfirmed segfault report** during a ~4-million-row bulk import on Linux x64/Bun v1.2.12 (`https://github.com/oven-sh/bun/issues/19470`, filed 2025-05-05, minimal repro, no confirmed fix visible in the tracker). Flagged for completeness, but a personal digest job inserting/checking on the order of dozens of rows per day is many orders of magnitude below the scale where this was observed.
- **Directory auto-creation gotcha** (`#3888`, still open) — already covered in §3; must ensure the data directory exists yourself.
- **Windows-specific `"database is locked"` issue** (`#16119`) — irrelevant, since the target deployment is Linux.
- **SQLite version reporting cosmetic issue** (`#16717`) — a minor version-string discrepancy report, not a functional risk, and now largely superseded by the new `process.versions.sqlite` introspection point added in Bun v1.4.0.

---

## Gaps and Uncertainties
- I could not find an explicit "stable"/"production-ready" designation on Bun's own docs page for `bun:sqlite` (no stability-index-style label as Node.js uses) — my maturity assessment is based on circumstantial evidence (test suite size, issue-tracker composition, release cadence) rather than a direct maintainer claim of "stable."
- I could not pin down the exact Bun version in which `bun:sqlite` was first introduced (spot-checked the `v0.1.5` and `v0.6.0` blog posts; neither announced it as new, suggesting it predates both, but I did not exhaustively search every early release post).
- I could not verify the precise SQLite patch version bundled in the exact `v1.4.0` release tag vs. current `main` HEAD — the evidence trail (`#27912` → 3.53.0 merged 2026-03-08; `#30452` → 3.53.400 still open/unmerged as of this research) supports "at least 3.53.0, updated roughly every 4–8 weeks" rather than a single precise pinned number.
