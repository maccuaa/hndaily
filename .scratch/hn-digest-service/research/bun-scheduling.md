# Research: Bun scheduling/cron approach on Linux

Ticket: [05-bun-scheduling-approach](../issues/05-bun-scheduling-approach.md)

## Recommendation (TL;DR)

| Decision | Recommendation |
|---|---|
| **Scheduler** | **systemd timer + service unit**, not plain crontab |
| **Deployment** | **`bun build --compile` standalone binary**, not a system-wide `bun run` install |
| **ARM64 (Oracle Ampere)** | Fully, officially supported — no special caveats found |
| **Bun's native `Bun.cron()`** | Real and useful, but its "OS-level" mode is a thin wrapper that writes into **crontab** on Linux — it does not give you systemd's failure hooks, so for this use case hand-roll the systemd timer/service pair instead of relying on `Bun.cron()`'s installer |

Rationale in one paragraph: Bun compiles natively for `linux-arm64` (glibc and musl) as a first-class, documented target, so the Ampere-vs-x86_64 question is a non-issue either way (bun.sh/docs/installation; github.com/oven-sh/bun README). `bun build --compile` produces a single self-contained executable with the Bun runtime embedded, explicitly designed for cross-compilation to a *different* OS/arch than the build host (bun.sh/docs/bundler/executables), which removes the need to install/upgrade Bun on the server at all — smaller attack surface, faster cold start (bytecode-compiled), and one less moving part to patch. For the schedule itself, systemd timers give you free journald log capture and filtering, `systemctl status` exit-code visibility, configurable auto-retry (`Restart=`/`RestartSec=`), and a documented, first-class failure hook (`OnFailure=`) that a plain crontab entry cannot match — crontab's only native failure signal is an email that requires a working local MTA and, per the cron man page itself, fires on **any output**, not specifically on failure (man7.org crontab.5/cron.8). Bun's own built-in cron feature is real (`Bun.cron`) but on Linux its "OS-level" registration mode literally shells out to install a **crontab** line (bun.sh/docs/runtime/cron), so it doesn't give you systemd's advantages — it's an alternative to writing crontab by hand, not to systemd.

---

## 1. Bun's Linux platform/architecture support (ARM64/aarch64)

**Officially supported, first-class target.** Bun's own GitHub README states plainly:

> "Bun supports Linux (x64 & arm64), macOS (x64 & Apple Silicon), and Windows (x64 & arm64)."
(github.com/oven-sh/bun, root README)

This is reinforced by the bundler docs, which list `bun-linux-arm64` (glibc) and `bun-linux-arm64-musl` as documented, named `--compile --target` values alongside `bun-linux-x64` (bun.sh/docs/bundler/executables, "Supported targets" table). The official Docker images also explicitly cover both architectures:

> "Bun provides a Docker image that supports both Linux x64 and arm64." (bun.sh/docs/installation)

**Kernel version requirement (minor discrepancy between two primary sources):**
- bun.sh/docs/installation: "We recommend kernel version 5.6 or higher. Bun runs on kernels as old as 3.10 (RHEL 7) with graceful degradation of newer syscalls."
- github.com/oven-sh/bun README: "Kernel version 5.6 or higher is strongly recommended, but the minimum is 5.1."

Both agree on the 5.6+ recommendation; they disagree on the stated absolute floor (3.10 vs 5.1). In practice this is moot for Oracle Cloud — stock Ubuntu 22.04/24.04 and Oracle Linux 8/9 images ship kernels well above 5.6 — but it's worth flagging as an inconsistency between Bun's two primary docs surfaces. Check with `uname -r` as the docs suggest.

**libc variant matters more than CPU arch on Linux:** Bun ships separate glibc and musl arm64 binaries. The install script "automatically chooses the correct binary for your system," but if you ever see a `GLIBC_... not found` error (e.g., on Alpine), switch to the musl build (bun.sh/docs/installation, "Musl Binaries" section: "Bun's glibc binaries require glibc 2.17 or newer"). Standard Oracle Cloud Ubuntu/Oracle Linux images use glibc, so this is only relevant if you pick an Alpine-based image.

**CPU microarchitecture caveats are an x64-only concern.** The docs' entire "CPU Requirements" section (Nehalem/SSE4.2 baseline, Bulldozer for AMD) is scoped to the x64 binary only — "Bun ships a single x64 binary per platform. It targets the Nehalem microarchitecture (SSE4.2)..." (bun.sh/docs/installation, "CPU Requirements"). No equivalent ARM baseline/feature-level table is published, implying Bun does not gate arm64 support behind a specific ARM revision — any current-generation aarch64 server chip (including Ampere Altra/Altra Max used by OCI's free-tier "Ampere A1" shape) is within scope.

**Known-issue check via GitHub Issues (github.com/oven-sh/bun):** I searched the issue tracker via the GitHub REST search API for ARM64-specific crash reports (`repo:oven-sh/bun arm64 in:title label:crash` → 9 total results ever; `aarch64 OR ampere OR "oracle cloud"` → mostly noise/false positives from unrelated issues incidentally containing "aarch64" in stack traces). The handful of genuine arm64 crash reports found (e.g., issue #22005, a segfault under Elysia middleware on Bun v1.2.15/Linux arm64, closed same-day and labeled `old-version`; issue #21679, a Raspberry Pi crash inside a **third-party native Rollup addon**, `@rollup/rollup-linux-arm64-gnu`, not Bun's own arm64 code) look like ordinary version-specific bugs rather than a systemic arm64 platform limitation, and nothing turned up referencing Oracle Cloud or Ampere specifically. I did not find a canonical "known ARM caveats" doc page — this is the practical ceiling of what primary sources surface; treat the absence of a dedicated caveats page as reasonable but not airtight evidence.

---

## 2. Does Bun have built-in scheduling, or is OS-level cron/systemd the standard approach?

**Bun does have a native, documented cron primitive** — this was the most notable finding of this research. Per bun.sh/docs/runtime/cron, Bun ships `Bun.cron` with two distinct modes:

**(a) In-process scheduling** — `Bun.cron(schedule, handler, options?)` runs a callback on a schedule *inside a long-running Bun process*:
```js
Bun.cron("0 * * * *", async () => { await cleanupTempFiles(); });
```
This requires no system daemon, "shares state... between invocations," but explicitly **does not survive process exit or reboot** (bun.sh/docs/runtime/cron, comparison table). It's designed for long-running servers, not a once-a-day batch script that isn't otherwise resident in memory.

**(b) OS-level registration** — `Bun.cron(path, schedule, title)` is a *programmatic installer* that registers a job with the **host OS's own scheduler**:
```js
await Bun.cron("./worker.ts", "30 2 * * MON", "weekly-report");
```
Per the docs' "How it works per platform" section, **on Linux this literally uses crontab**:

> "Bun uses crontab to register jobs. Bun stores each job as a line in your user's crontab with a `# bun-cron: <title>` marker comment above it. The crontab entry looks like: `<schedule> '<bun-path>' run --cron-title=<title> --cron-period='<schedule>' '<script-path>'`" (bun.sh/docs/runtime/cron, "Linux" subsection)

On macOS it writes a `launchd` plist; on Windows it registers a Task Scheduler XML task (same page, "macOS"/"Windows" subsections). The registered script must export a Cloudflare-Workers-style `scheduled()` handler (`export default { scheduled(controller) {...} }`).

**This directly answers the research question: Bun's own built-in scheduler is not an independent daemon — on Linux it is crontab with a friendlier API on top.** The docs even point you at crontab's own log surfaces for troubleshooting registered jobs: `journalctl -u cron` (systemd-based distros) or `grep CRON /var/log/syslog` (older syslog-based systems) (bun.sh/docs/runtime/cron, "Logs" under "Linux"). Bun does not offer any way to register the job via systemd timers instead of crontab — that mapping is hardcoded per-OS.

**Practical implication for your use case:** if you want systemd's failure-hook/journald benefits (see §3), don't use `Bun.cron(path, schedule, title)` — it will only ever give you a crontab entry on Linux. Either (a) use plain OS-level systemd timer + service units that invoke your script directly (recommended, see §4), or (b) use `Bun.cron()`'s in-process mode inside a systemd-managed long-running Bun service that never exits — more moving parts than necessary for "run once a day."

Other relevant, sourced behaviors of `Bun.cron` (bun.sh/docs/runtime/cron):
- Standard 5-field POSIX cron syntax, `@daily`/`@weekly`/etc. nicknames, and day-of-month-OR-day-of-week matching semantics identical to POSIX cron.
- A "no-overlap guarantee" for the in-process mode: the next fire is computed only after the previous handler's promise settles, so slow runs can't stack.
- Windows Task Scheduler imposes a 48-trigger cap that can reject certain high-frequency expressions — irrelevant for a once-daily job, but documented as a genuine cross-platform gotcha of the feature.
- Errors in the in-process handler follow `setTimeout` semantics (uncaught → `process.on("uncaughtException")`/`unhandledRejection`; unhandled, the process exits with code 1) — useful if you do go the long-running-process route.

---

## 3. crontab vs. systemd timer + service unit — failure visibility, retries, alerting

### Failure visibility / logging

**Plain cron's only native signal is email, and it's not failure-specific.** Per the official man pages:
- crontab(5): "cron... looks at the MAILTO variable if a mail needs to be sent as a result of running any commands... If MAILTO is defined (and non-empty), mail is sent to the specified address... If MAILTO is defined but empty (MAILTO=""), no mail is sent. Otherwise, mail is sent to the owner of the crontab." (man7.org/linux/man-pages/man5/crontab.5.html)
- cron(8) is explicit that this is output-triggered, **not exit-status-triggered**: "When executing commands, any output is mailed to the owner of the crontab... Any job output can also be sent to syslog by using the -s option." (man7.org/linux/man-pages/man8/cron.8.html)

So the common mental model of "cron only emails on error" is not quite accurate per the primary source — classic cron mails on *any stdout/stderr output*, success or failure alike, which in practice means either noisy mailboxes (if your script logs anything on success) or silent failures (if you suppress output to avoid the noise). It also depends on a working local MTA (`sendmail(8)`) being configured on the box — not a given on a bare personal cloud VM — otherwise the mail simply has nowhere to go.

**systemd gives you structured, queryable logs with no extra plumbing.** Because a systemd service's process tree is supervised by the manager, `systemctl status <unit>` reports the unit's current/last state, and `journalctl` captures and lets you query the unit's log stream directly:
> `journalctl` "print[s] log entries stored in the journal... If one or more match arguments are passed, the output is filtered accordingly. A match is in the format 'FIELD=VALUE', e.g. '_SYSTEMD_UNIT=httpd.service'..." (man7.org/linux/man-pages/man1/journalctl.1.html)

So `journalctl -u my-daily-job.service --since "1 day ago"` gets you exactly the last run's output and systemd's own start/stop/failure annotations, filterable by time, priority, or boot — no mail server, no log file rotation to manage yourself. Additionally, because `Type=exec`/`Type=oneshot` services report their actual invocation success back to the manager — "note that this means systemctl start command lines for exec services will report failure when the service's binary cannot be invoked successfully" (freedesktop.org, systemd.service(5), "Type=" section) — a bad path, missing binary, or wrong `User=` becomes a visible unit failure state, not a silently-swallowed cron error.

### Retry behavior

Plain cron has **no retry concept at all** — a failed run just waits for the next scheduled tick. systemd services support configurable auto-restart:
> `Restart=` "Configures whether the service shall be restarted when the service process exits, is killed, or a timeout is reached... Takes one of no, on-success, on-failure, on-abnormal, on-watchdog, on-abort, or always." (freedesktop.org, systemd.service(5), "Restart=")

Combined with `RestartSec=` (delay before restart, default 100ms) and, if you want back-off, `RestartSteps=`/`RestartMaxDelaySec=` for exponential-backoff retry intervals (e.g., `RestartSec=10s`, `RestartSteps=4`, `RestartMaxDelaySec=160s` → retries at 10s, 20s, 40s, 80s, 160s...) (freedesktop.org, systemd.service(5), "RestartSec="/"RestartSteps="/"RestartMaxDelaySec="). For a "fetch data, send email" job, `Restart=on-failure` with a couple of `RestartSec=` retries before giving up is straightforward and has no crontab equivalent.

### Failure alerting hook

This is the most decisive difference for your use case. systemd units support a first-class failure hook:
> `OnFailure=` "A space-separated list of one or more units that are activated when this unit enters the 'failed' state." (freedesktop.org, systemd.unit(5), "OnFailure=")

This lets you point at a second, small `oneshot` unit (e.g., one that curls a webhook, sends a push notification, or hits an alerting API) that fires *only* when your daily job unit actually fails — precise, push-based alerting with zero reliance on a local mail transfer agent. Plain crontab has no equivalent primitive; any such logic has to be hand-rolled inside the cron command line itself (`... || curl -X POST ...`), which is more fragile (miss it once and every job needs the same boilerplate) than a manager-level `OnFailure=` dependency declared once.

### Scheduling syntax and "catch-up" behavior

Both support calendar-style daily scheduling. crontab(5) documents the standard 5-field format plus the `@daily` nickname shorthand: `@daily : Run once a day, ie. "0 0 * * *"` (man7.org/linux/man-pages/man5/crontab.5.html, "EXTENSIONS"). systemd timers use `OnCalendar=` with an equivalent shorthand — `daily → *-*-* 00:00:00` — documented in systemd.time(7) (freedesktop.org/.../systemd.time.html, "Calendar Events").

One meaningful advantage for a server that might reboot or be stopped/started (common for a personal always-on-but-occasionally-rebooted OCI instance): systemd timers support
> `Persistent=` "If true, the time when the service unit was last triggered is stored on disk. When the timer is activated, the service unit is triggered immediately if it would have been triggered at least once during the time when the timer was inactive... This is useful to catch up on missed runs of the service when the system was powered down." (freedesktop.org, systemd.timer(5), "Persistent=")

Plain vixie-cron/cronie has no equivalent — if the machine is off at 02:00 daily, that day's job is simply skipped (some distros mitigate this only via the separate `anacron`/`/etc/cron.d` mechanism referenced in cron(8), which is its own subsystem, not something you get "for free" from a per-user crontab entry). `AccuracySec=`/`RandomizedDelaySec=` are also available on the timer if you ever want to jitter the exact firing time, though for a single personal job this is unnecessary (freedesktop.org, systemd.timer(5)).

### Summary table

| Concern | crontab | systemd timer + service |
|---|---|---|
| Failure notification | Email, requires local MTA, fires on *any output* not just failure (cron.8, crontab.5) | `OnFailure=` unit hook, precise, no MTA needed (systemd.unit.5) |
| Logs | Mail body or manual redirect (`>> file 2>&1`) or syslog (`-s` flag) (crontab.5, cron.8) | Automatic, structured, queryable via `journalctl -u <unit>` (journalctl.1) |
| Status introspection | None built-in | `systemctl status <unit>` shows last run's success/failure/exit code |
| Retry on failure | None | `Restart=on-failure` + `RestartSec=`/backoff (systemd.service.5) |
| Missed-run catch-up | Not for per-user crontab (needs separate anacron) | `Persistent=true` (systemd.timer.5) |
| Setup complexity | One line | Two small unit files |

---

## 4. System-wide Bun install vs. `bun build --compile` standalone binary

**`bun build --compile` produces a genuinely standalone, dependency-free executable.** Per bun.sh/docs/bundler/executables:

> "Bun's bundler implements a `--compile` flag for generating a standalone binary from a TypeScript or JavaScript file... Bun bundles all imported files and packages into the executable, along with a copy of the Bun runtime. All built-in Bun and Node.js APIs are supported."

The "Deploying to production" section frames this as the recommended pattern, not a niche feature: "Compiled executables reduce memory usage and improve Bun's start time... Compiled executables move that cost from runtime to build time," with a suggested production invocation of `bun build --compile --minify --sourcemap ./app.ts --outfile myapp`, optionally adding `--bytecode` to move JS parsing overhead to build time and further shorten cold-start latency (bun.sh/docs/bundler/executables, "Deploying to production"/"Bytecode compilation"). For a job that runs once a day and needs to start fast and exit cleanly, this is a good fit.

**Cross-compilation is explicitly supported and does *not* require building on a matching OS/arch host.** The docs are direct about this:

> "Use the `--target` flag to compile your standalone executable for a different operating system, architecture, or version of Bun **than the machine you're running `bun build` on**." (bun.sh/docs/bundler/executables, "Cross-compile to other platforms," emphasis added)

with worked examples for exactly your target:
```
bun build --compile --target=bun-linux-arm64 ./index.ts --outfile myapp   # e.g. Graviton or Raspberry Pi
bun build --compile --target=bun-linux-x64   ./index.ts --outfile myapp   # "most servers"
```
Documented targets include both glibc and musl variants for each architecture (`bun-linux-arm64`, `bun-linux-arm64-musl`, `bun-linux-x64`, `bun-linux-x64-musl`) (same page, "Supported targets" table) — so you can build for Oracle's Ampere (arm64) shape from a macOS/Windows/x64-Linux dev machine, or build for both x64 and arm64 from one machine and ship whichever binary matches whatever shape you actually provisioned, without needing Bun installed on the server at all.

**Caveats found for `--compile`/cross-compilation:**
- Windows-only metadata flags (icon, publisher, version, etc.) explicitly do not work cross-compiled: "Except for `hideConsole`, you can't use these flags when cross-compiling because they depend on Windows APIs" (bun.sh/docs/bundler/executables, "Windows-specific flags") — not relevant to a Linux target, but shows cross-compilation isn't 100% capability-parity in all cases.
- N-API/native addons (`.node` files) can be embedded into a compiled executable, but the docs flag a packaging gotcha: "If you're using `@mapbox/node-pre-gyp` or similar tools, require the `.node` file directly, or it won't bundle correctly" (bun.sh/docs/bundler/executables, "Embed N-API Addons"). By inference (not stated verbatim in the docs), this also means if your project depends on any prebuilt native npm module, cross-compiling from a different host OS/arch would embed the *host's* native binary rather than one built for the target — a real constraint if you ever add a native dependency, though irrelevant for a plain "fetch + send email" script using only JS/TS and Bun's built-ins (`fetch`, and possibly `Bun.sql`/an SMTP library).
- The target Linux server still needs `glibc 2.17+` (for the non-musl targets) — "Bun's glibc binaries require glibc 2.17 or newer" (bun.sh/docs/installation, "Musl Binaries") — a non-issue on any current Ubuntu/Oracle Linux OCI image, but pick the `-musl` target if you ever run Alpine.
- `--compile` does not support `--outdir`, `--public-path`, `--target=node`, `--target=browser` (without HTML entrypoints), or `--no-bundle` (bun.sh/docs/bundler/executables, "Unsupported CLI arguments") — none of these matter for a plain script.

**If you don't compile, system-wide installation is also well-documented and simple** — official install script (`curl -fsSL https://bun.com/install | bash`), npm (`npm install -g bun`), Homebrew, or Docker images (bun.sh/docs/installation). Once installed, "the binary can upgrade itself" via `bun upgrade` (with `--canary`/`--stable` variants documented) (bun.sh/docs/installation, "Upgrading"/"Canary Builds"). This is a perfectly valid path — it's what `Bun.cron()`'s OS-level installer assumes exists (its crontab line literally invokes `'<bun-path>' run ...`, per §2) — but it means the server carries a general-purpose JS runtime, transpiler, and package manager for the sole purpose of running one script once a day, and you're responsible for periodically running `bun upgrade` yourself. Given the job is a single, self-contained script (fetch + email) with presumably no exotic native dependencies, the standalone compiled binary is the leaner, more appropriate choice: no runtime to patch, no `bun install` step on the server, no PATH setup, and (per the docs' own framing) better startup latency and memory footprint.

---

## Concrete recommended setup

Given all of the above, a synthesis (unit-file directives are all cited above from systemd.service(5)/systemd.timer(5)/systemd.unit(5)):

1. Cross-compile locally (or in CI) for the server's actual arch:
   ```
   bun build --compile --minify --sourcemap --bytecode \
     --target=bun-linux-arm64 ./daily-job.ts --outfile daily-job
   # (use --target=bun-linux-x64 instead if the instance turns out x86_64)
   ```
   Copy the resulting single `daily-job` binary to the server (e.g. `/opt/daily-job/daily-job`) — no Bun install needed on the box at all.

2. `/etc/systemd/system/daily-job.service`:
   ```ini
   [Unit]
   Description=Daily data fetch and email job
   OnFailure=daily-job-alert.service

   [Service]
   Type=oneshot
   ExecStart=/opt/daily-job/daily-job
   Restart=on-failure
   RestartSec=5min
   ```
   (`Type=oneshot` per systemd.service(5) is the documented fit for a run-to-completion job; `OnFailure=` per systemd.unit(5) fires the alert unit only on failure; `Restart=`/`RestartSec=` per systemd.service(5) give a couple of automatic retries first.)

3. `/etc/systemd/system/daily-job.timer`:
   ```ini
   [Unit]
   Description=Run daily-job.service once a day

   [Timer]
   OnCalendar=daily
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```
   (`OnCalendar=daily` and `Persistent=true` per systemd.timer(5), the latter ensuring a missed run — e.g., the instance was rebooting at the scheduled time — still executes on next boot.)

4. `daily-job-alert.service` — a small separate unit (e.g., `ExecStart=/usr/bin/curl -fsS -X POST https://your-alert-webhook...`) that only ever runs when `OnFailure=` triggers it.

5. `systemctl enable --now daily-job.timer`; check with `systemctl list-timers`, `systemctl status daily-job.service`, and `journalctl -u daily-job.service` per journalctl(1)/systemctl(1).

---

## Gaps and uncertainties

- I could not retrieve the exact `StandardOutput=`/`StandardError=` default-value passage from `systemd.exec(5)` within my fetch budget (the live document is very large and paginated by character offset; I landed repeatedly in the "Sandboxing" section instead of "Logging and Standard Input/Output"). The claim that systemd captures a service's stdout/stderr into the journal by default is extremely well-established systemd behavior and is indirectly corroborated by journalctl(1)'s description of per-unit structured log filtering (`_SYSTEMD_UNIT=`), but I was not able to pull the literal directive text as a direct quote — flagging this so it can be independently spot-checked if precision matters (`man systemd.exec` → "Logging and Standard Input/Output" section, or `systemctl show -p StandardOutput daily-job.service` on a live box).
- ARM64 "known caveats": I found no dedicated Bun doc page enumerating ARM-specific limitations, and GitHub issue search for arm64+crash (9 results all-time) turned up nothing indicating a systemic platform problem or anything Oracle/Ampere-specific — but absence of evidence in a keyword search isn't a certified clean bill of health; if this matters for a production-critical job, I'd suggest simply smoke-testing the compiled `bun-linux-arm64` binary on the actual OCI Ampere shape before relying on it.
- The "native addon breaks cross-compilation" caveat in §4 is my inference from the documented N-API embedding mechanics, not a verbatim statement in Bun's docs — flagged inline above as inferred rather than verified.
- I did not investigate Oracle Cloud–specific provisioning details (e.g., default OCI Ubuntu image kernel version, whether `unzip`/`curl` are preinstalled) since these fall outside the requested primary-source set (Bun docs/GitHub, systemd docs, crontab man pages); if useful, that would need a separate lookup against Oracle's own documentation. **See ticket 07 (Oracle server facts) for account-specific verification.**
- Tool note: the GitHub MCP tools available to me in this environment are scoped to a private GitHub Enterprise instance, not public github.com, so all `oven-sh/bun` lookups above were done via direct `web_fetch` calls to github.com/raw.githubusercontent.com/api.github.com rather than the GitHub MCP server tools.
