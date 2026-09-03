Type: grilling
Status: resolved

## Question

**Scheduling mechanism is settled by ticket 05's reopened answer: a long-running Docker container using `Bun.cron()`'s in-process mode**, not cron/systemd + a compiled one-shot binary. What remains open, blocked on the server-facts task (ticket 07 — now scoped to the Recipient's existing docker-compose setup):

- How the container is built and deployed: a `Dockerfile` alongside the existing service definitions, added to the shared `docker-compose.yml` (or an `include:`d file, per whatever ticket 07 finds); built on the server via `docker compose build`, or built/pushed to a registry via CI and pulled — follow whatever pattern the other services already use.
- Where the `bun:sqlite` Send-history file lives — a named volume or bind mount (per ticket 07's findings) so it survives container recreates, per ticket 06's requirement to keep it outside the deployed code.
- Restart policy (e.g. `restart: unless-stopped`) so the container comes back after a host reboot, consistent with the other services.

**Also covers (added after ticket 01):** delivery frequency, time-of-day, and timezone are configurable settings (read from a config file, per ticket 01's resolution) — decide how a config change actually reaches the running container's `Bun.cron()` schedule. Since the container is long-running, this most naturally means: the process re-reads the config file on each scheduled fire (cheap, no restart needed) and adjusts its *next* scheduled call to `Bun.cron()` accordingly, rather than needing to regenerate any OS-level unit — simpler than the systemd-based version of this question, since there's no external timer definition to keep in sync.

## Answer

- **Build/deploy**: a `Dockerfile` for this project, built and pushed to **GitHub Container Registry (ghcr.io)** via CI, matching the existing pattern (ticket 07: images built via CI and pulled, not built on the server). Deploys are **manual**: the Recipient runs `docker compose pull && docker compose up -d` on the server when ready, rather than an automatic pull-on-push watcher.
- **Storage**: the `bun:sqlite` Send-history file lives on a **bind mount** (already decided via tickets 06/07/09), added to the service's entry in the shared `docker-compose.yml`.
- **Restart policy**: `restart: unless-stopped` — survives host reboots, respects a deliberate manual stop.
- **Config propagation**: read once at container **startup**, not re-read per-fire. Changing story count/frequency/delivery-time/timezone (ticket 01) requires a manual container restart (`docker compose restart`) to take effect — simpler code than watching the file for changes, at the cost of one extra manual step when tuning settings.

Ticket 10 is now fully resolved; unblocks ticket 11 (failure alerting), the last open ticket on this map.

