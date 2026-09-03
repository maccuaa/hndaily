# hndaily

Self-hosted Hacker News digest emailer — a personal replacement for [HN Digest](https://hndigest.com/) and [hnbrew](https://hnbrew.com/), self-hosted on Oracle Cloud.

Fetches top HN stories (title, link, points, comment count) and emails a Digest on a configurable schedule. See [`CONTEXT.md`](CONTEXT.md) for the domain glossary and [`docs/adr/`](docs/adr/) for the architecture decisions. Planning history is in [`.scratch/`](.scratch/).

## How it works

A single long-running process (`src/index.ts`) registers a [`Bun.cron()`](https://bun.sh/docs/runtime/cron) schedule. On each fire it:

1. **Curates** — fetches candidate Stories (Algolia HN Search API, falling back to the official Firebase API), filters out anything already sent, caps at the configured story count.
2. **Renders** — builds a plain-ish HTML email.
3. **Sends** — via SMTP through OCI Email Delivery.
4. **Records** — the run and its Stories in a `bun:sqlite` database, so they're never resent.
5. **Pings** — a healthchecks.io heartbeat, if configured.

If a scheduled run is missed or delayed, the next run detects the gap and sends a **Catch-up digest** covering everything missed, instead of just the usual fixed lookback window (see [ADR 0001](docs/adr/0001-fixed-curation-window-with-catchup-digest.md)).

## Configuration

Copy [`config.example.json`](config.example.json) to `config.json` and edit:

```json
{
  "recipientEmail": "you@example.com",
  "storyCount": 25,
  "schedule": { "cron": "0 7 * * *", "timezone": "America/Toronto" }
}
```

- `storyCount` — how many Stories per Digest.
- `schedule.cron` — a standard 5-field cron expression; covers both frequency and time-of-day (e.g. `0 7 * * *` = daily at 7am, `0 7 * * 1` = weekly on Mondays).
- `schedule.timezone` — an IANA timezone name.

Changing this file requires restarting the process/container to take effect (it's read once at startup).

## Environment variables

See [`.env.example`](.env.example) for the full list (SMTP connection details, credentials, and an optional healthchecks.io heartbeat URL).

## Local development

```
bun install
cp config.example.json config.json   # edit as needed
bun test
bun run typecheck
bun run start   # requires HNDAILY_SMTP_* env vars set; see .env.example
```

## Deployment

This project is deployed as a Docker container into the Recipient's existing docker-compose stack (not its own compose file) — see [`docker-compose.snippet.yml`](docker-compose.snippet.yml) for the service entry and one-time host setup (bind-mount directory permissions, `.env` additions).

Images are built for `linux/arm64` and published to `ghcr.io/maccuaa/hndaily` via [CI](.github/workflows/publish.yml) on every push to `main`. Deploys are manual:

```
docker compose pull hndaily
docker compose up -d hndaily
```

