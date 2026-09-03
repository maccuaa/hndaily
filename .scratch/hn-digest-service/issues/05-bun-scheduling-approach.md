Type: research
Status: resolved

## Question

What's the best way to run a Bun script once per day on a Linux server: OS cron, a systemd timer + service unit, or something Bun-specific? Cover:

- Bun's Linux platform/architecture support, including ARM64 — Oracle Cloud's free tier commonly provides Ampere ARM instances, so confirm Bun runs there without caveats
- Trade-offs between plain crontab and systemd timers for a single daily job: failure visibility, retry behavior, logging, ease of "did it actually run" alerting (feeds ticket 11)
- Whether Bun needs to be installed system-wide / via a version manager, or can be compiled to a single standalone executable (`bun build --compile`) to simplify deployment

## Answer

**systemd timer + service unit, running a `bun build --compile` standalone binary** (not plain crontab, not a system-wide Bun install). Bun officially supports Linux ARM64 (glibc and musl), so Oracle's Ampere free-tier shape is a non-issue. Bun's own `Bun.cron()` "OS-level" mode is real but just writes a crontab line on Linux — no systemd advantages — so hand-roll the systemd unit/timer pair instead. systemd wins on every operational axis that matters for unattended alerting: `journalctl`-based structured logs (vs. cron's output-triggered-not-failure-triggered mail), `Restart=on-failure` retries, and a first-class `OnFailure=` hook to trigger a separate alert unit (feeds ticket 11 directly) — none of which plain cron has. `bun build --compile --target=bun-linux-arm64` cross-compiles from any dev machine with no Bun runtime needed on the server at all.

Full findings, citations, and a concrete recommended systemd unit/timer setup: [`research/bun-scheduling.md`](https://github.com/maccuaa/hndaily/blob/research/bun-scheduling/.scratch/hn-digest-service/research/bun-scheduling.md) (branch `research/bun-scheduling`).
