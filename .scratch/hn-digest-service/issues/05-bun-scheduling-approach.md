Type: research
Status: resolved

## Question

What's the best way to run a Bun script once per day on a Linux server: OS cron, a systemd timer + service unit, or something Bun-specific? Cover:

- Bun's Linux platform/architecture support, including ARM64 — Oracle Cloud's free tier commonly provides Ampere ARM instances, so confirm Bun runs there without caveats
- Trade-offs between plain crontab and systemd timers for a single daily job: failure visibility, retry behavior, logging, ease of "did it actually run" alerting (feeds ticket 11)
- Whether Bun needs to be installed system-wide / via a version manager, or can be compiled to a single standalone executable (`bun build --compile`) to simplify deployment

## Answer

**Updated — reopened with new information.** The recommendation below assumed a bare-host deployment (no existing container infrastructure). That assumption doesn't hold: the Recipient runs every service on their Oracle server as Docker containers via docker-compose, and wants this project to follow the same pattern rather than being the one bare-host systemd job among containers.

**Recommendation revised: a long-running Docker container using `Bun.cron()`'s in-process scheduling mode**, not a systemd timer triggering a compiled one-shot binary. Per the original research (§2, still accurate as general Bun documentation), `Bun.cron(schedule, handler)` run inside a persistent process is exactly the in-process mode designed for a long-running server — a natural fit once the deployment unit is a long-running container rather than a bare-host process the OS scheduler invokes. The Recipient has explicitly accepted the resource tradeoff (a process idling ~99% of the day, expected to be minimal) in exchange for operational consistency with every other service on the box — one docker-compose stack, one deployment/monitoring pattern, no bare-host systemd units to maintain alongside the containers. See [ADR 0003](../../../docs/adr/0003-docker-container-with-bun-cron.md).

This also answers ticket 08's remaining open question: SMTP credentials (and other secrets) are passed via **environment variables**, following docker-compose's standard `environment:`/`.env` pattern — see ticket 08 for the updated framing.

Full findings on Bun's platform support and `Bun.cron()`'s two modes (still useful reference, just applied differently): [`research/bun-scheduling.md`](https://github.com/maccuaa/hndaily/blob/research/bun-scheduling/.scratch/hn-digest-service/research/bun-scheduling.md) (branch `research/bun-scheduling`).

---

*Original research and recommendation (below) — the Bun platform/ARM64 support findings and the crontab-vs-systemd comparison remain accurate as general reference; the systemd-specific deployment recommendation just no longer applies given the Recipient's existing Docker-based infrastructure.*

**Original: systemd timer + service unit, running a `bun build --compile` standalone binary** (not plain crontab, not a system-wide Bun install). Bun officially supports Linux ARM64 (glibc and musl), so Oracle's Ampere free-tier shape is a non-issue. Bun's own `Bun.cron()` "OS-level" mode is real but just writes a crontab line on Linux — no systemd advantages — so hand-roll the systemd unit/timer pair instead. systemd wins on every operational axis that matters for unattended alerting: `journalctl`-based structured logs (vs. cron's output-triggered-not-failure-triggered mail), `Restart=on-failure` retries, and a first-class `OnFailure=` hook to trigger a separate alert unit (feeds ticket 11 directly) — none of which plain cron has. `bun build --compile --target=bun-linux-arm64` cross-compiles from any dev machine with no Bun runtime needed on the server at all.
