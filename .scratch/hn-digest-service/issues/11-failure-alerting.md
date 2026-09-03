Type: grilling
Status: resolved

## Question

**Updated after ticket 05:** since the deployment model is now a long-running Docker container (not a systemd-triggered one-shot process), the systemd `OnFailure=` option no longer applies. How should you find out if a Delivery run fails to execute or fails to send? Silent failure is the main risk either way. Remaining options:

- A dead-man's-switch / heartbeat ping (e.g. healthchecks.io) at the end of each successful Delivery run — deployment-model-agnostic, still works identically inside a long-running container's `Bun.cron()` handler.
- Docker/docker-compose's own primitives: a `healthcheck:` directive plus `restart: unless-stopped` for crash recovery, or just watching `docker compose logs`/`docker events` — catches the container crashing, but not "the container's internal Bun.cron() schedule silently stopped firing while the process itself looks healthy," which the heartbeat ping catches and this doesn't.
- Accepting manual log-checking for a v1 personal tool.

Recommended: still the heartbeat-ping service — it's the one option that catches both "container crashed" and "container's alive but the scheduled Delivery run didn't actually fire," and costs nothing extra to keep from the original recommendation.

## Answer

Confirmed: a **heartbeat ping to healthchecks.io** at the end of each successful Delivery run (including Catch-up digests, ticket 01), on top of the `restart: unless-stopped` policy already decided in ticket 10. Together these catch both failure modes — a crashed/restarted container (Docker's own recovery) and a container that's alive but whose internal `Bun.cron()` schedule silently stopped firing (the heartbeat ping, which only healthchecks.io's missed-check alerting would catch).

Ticket 11 is now fully resolved — the last open ticket on this map. No new questions surfaced.

