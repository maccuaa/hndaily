Type: task
Status: claimed

## Question

Gather the concrete facts about the existing Oracle Cloud server needed before the email-delivery and deployment tickets can be decided. This is a checklist only you can run (requires your OCI console / SSH access).

**Updated after ticket 05:** the Recipient runs all services on this server as Docker containers via docker-compose (not bare-host processes), so the checklist below is scoped to that reality.

- [ ] OS and version, and CPU architecture (x86_64 vs ARM/Ampere) — for picking the right Bun Docker image platform/tag
- [ ] Docker / docker-compose version in use, and where the compose file(s) live (one shared `docker-compose.yml`, or split per service with `include:`?)
- [ ] Is this server always-on, or does it stop/hibernate on any schedule?
- [ ] How are secrets/env vars organized for existing services — a shared `.env` file docker-compose reads, per-service `.env` files, something else? (Needed so the new SMTP credentials from ticket 08 follow the same convention.)
- [ ] What's the convention for persistent data on this server — named Docker volumes vs. bind mounts — for services that need state to survive container recreates? (Needed for where the `bun:sqlite` Send-history file lives, per ticket 06.)
- [ ] Is there a container registry/CI pipeline already used to build and push images for other services, or are images built directly on the server?

