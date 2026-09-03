# Map: Self-hosted HN digest service

## Destination

A locked technical/architecture spec for a self-hosted, single-recipient, daily Hacker News digest email service that replaces hndigest.com and hnbrew.com — covering Story curation rules, data storage, the email delivery pipeline, scheduling, and deployment on the user's existing Oracle Cloud server. Ready to hand off to an implementation session.

V1 scope: a reliable daily email with a ranked list of top HN stories (title, link, points, comment count). Richer curation (AI summaries, personalization) is explicitly deferred — see "Not yet specified".

## Notes

- Domain glossary lives in [`CONTEXT.md`](../../CONTEXT.md): Digest, Story, Recipient, Curation window, Send history, Delivery run.
- Standing preference: simplicity first. Assume a single Bun service/package unless a concrete reason to split emerges — see ticket 02, which challenges the original "microservices" framing.
- Runtime: Bun, deployed to the user's existing Oracle Cloud server (not a new managed platform).
- Deployment model: a long-running **Docker container** managed via the Recipient's existing **docker-compose** setup (confirmed via ticket 05's reopening) — not a bare-host systemd timer or cron job. Every other service on the box already runs this way.
- Every grilling ticket: call the Skill tool for "grilling" and "domain-modeling".
- Tracker: local markdown (this effort opted out of GitHub Issues even though the repo itself — https://github.com/maccuaa/hndaily — is on GitHub).

## Decisions so far

<!-- one line per closed ticket, gist + link -->

- [01 - Digest content scope](issues/01-digest-content-scope.md): top stories by score, configurable count/frequency/time/timezone via a config file; fixed lookback window + a new Catch-up digest for missed content (see [ADR 0001](../../docs/adr/0001-fixed-curation-window-with-catchup-digest.md)); web archive idea considered and declined for v1.
- [02 - Project structure](issues/02-project-structure.md): a single Bun package at the repo root, not multiple microservices — the pipeline is one Delivery run per invocation, no concurrent-load/scaling reason to split.
- [03 - HN data source](issues/03-hn-data-source.md): Algolia HN Search API as primary (server-side score/time filtering in one request), official Firebase API kept as fallback.
- [04 - Oracle email constraints](issues/04-oracle-email-constraints.md): **reopened and revised** — use OCI Email Delivery (already configured for other projects, so the original setup-cost objection doesn't apply here); just needs a new Approved Sender + SMTP credentials (see [ADR 0002](../../docs/adr/0002-use-oci-email-delivery.md)).
- [05 - Bun scheduling approach](issues/05-bun-scheduling-approach.md): **reopened and revised** — a long-running Docker container using `Bun.cron()` in-process scheduling, not a systemd timer + compiled binary, to match the Recipient's existing docker-compose infrastructure (see [ADR 0003](../../docs/adr/0003-docker-container-with-bun-cron.md)).
- [06 - bun:sqlite storage](issues/06-bun-sqlite-storage.md): `bun:sqlite` is sufficient for Send history/logging — no ORM or external DB; keep the `.sqlite` file outside the git-managed directory.
- [07 - Oracle server facts](issues/07-oracle-server-facts.md): Ubuntu 24.04 ARM64, single docker-compose.yml, always-on, shared root `.env` with per-service `environment:` references, images built via CI and pulled (not built on server), bind mount for this project's persisted data.
- [08 - Email delivery mechanism](issues/08-email-delivery-mechanism.md): sends from `hndaily@snowcastle.ca` (new OCI Email Delivery Approved Sender), a new dedicated SMTP credential set, `HNDAILY_`-prefixed env vars in the shared `.env` file.

## Not yet specified

- Future personalization/filtering beyond the v1 curation rules (topic/keyword weighting, ML-based ranking) — depends on how v1 feels once running; not sharp enough to ticket yet.
- Long-term backup/resilience if the Oracle VM is lost — low priority for a personal tool; revisit once the deployment ticket (10) lands and there's an actual deployment shape to back up.

## Out of scope

- Multi-recipient/subscriber management, signup, unsubscribe flows, billing — this is a single-recipient personal tool, not a product for others.
- Building a public service for others to use — explicitly "for my own purposes"; the goal is to replace, not compete with, hndigest.com/hnbrew.com.
