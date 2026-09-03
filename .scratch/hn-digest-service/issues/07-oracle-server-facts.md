Type: task
Status: resolved

## Question

Gather the concrete facts about the existing Oracle Cloud server needed before the email-delivery and deployment tickets can be decided. This is a checklist only you can run (requires your OCI console / SSH access).

**Updated after ticket 05:** the Recipient runs all services on this server as Docker containers via docker-compose (not bare-host processes), so the checklist below is scoped to that reality.

- [x] OS and version, and CPU architecture (x86_64 vs ARM/Ampere) — for picking the right Bun Docker image platform/tag
- [x] Docker / docker-compose version in use, and where the compose file(s) live (one shared `docker-compose.yml`, or split per service with `include:`?)
- [x] Is this server always-on, or does it stop/hibernate on any schedule?
- [x] How are secrets/env vars organized for existing services — a shared `.env` file docker-compose reads, per-service `.env` files, something else? (Needed so the new SMTP credentials from ticket 08 follow the same convention.)
- [x] What's the convention for persistent data on this server — named Docker volumes vs. bind mounts — for services that need state to survive container recreates? (Needed for where the `bun:sqlite` Send-history file lives, per ticket 06.)
- [x] Is there a container registry/CI pipeline already used to build and push images for other services, or are images built directly on the server?

## Answer

- **OS/arch**: Ubuntu 24.04.4 LTS, ARM64 (Ampere).
- **docker-compose layout**: a single shared `docker-compose.yml` at the compose root (not split per service).
- **Always-on**: yes.
- **Secrets convention**: one shared `.env` file at the compose root. Docker Compose uses it for `${VAR}` substitution directly in the compose YAML — each secret is referenced explicitly per-service under `environment:` (e.g. `environment: - SMTP_PASSWORD=${SMTP_PASSWORD}`), **not** via a service-level `env_file:` directive, and the `.env` file itself is never mounted into any container.
- **Persistent data convention**: bind mounts for data that must be backed up/persisted; named Docker volumes for data that's acceptable to lose. The Recipient has already decided this project's `bun:sqlite` Send-history file (ticket 06) gets a **bind mount**, since losing Send history would cause resent duplicate stories rather than being truly disposable.
- **Registry/CI**: images are built and pushed to a registry via CI, then pulled onto the server — not built directly on the server.

These facts fully unblock tickets 08 (email delivery mechanism) and 10 (scheduling & deployment).

