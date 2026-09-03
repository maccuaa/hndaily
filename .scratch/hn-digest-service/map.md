# Map: Self-hosted HN digest service

## Destination

A locked technical/architecture spec for a self-hosted, single-recipient, daily Hacker News digest email service that replaces hndigest.com and hnbrew.com — covering Story curation rules, data storage, the email delivery pipeline, scheduling, and deployment on the user's existing Oracle Cloud server. Ready to hand off to an implementation session.

V1 scope: a reliable daily email with a ranked list of top HN stories (title, link, points, comment count). Richer curation (AI summaries, personalization) is explicitly deferred — see "Not yet specified".

## Notes

- Domain glossary lives in [`CONTEXT.md`](../../CONTEXT.md): Digest, Story, Recipient, Curation window, Send history, Delivery run.
- Standing preference: simplicity first. Assume a single Bun service/package unless a concrete reason to split emerges — see ticket 02, which challenges the original "microservices" framing.
- Runtime: Bun, deployed to the user's existing Oracle Cloud server (not a new managed platform).
- Every grilling ticket: call the Skill tool for "grilling" and "domain-modeling".
- Tracker: local markdown (this effort opted out of GitHub Issues even though the repo itself — https://github.com/maccuaa/hndaily — is on GitHub).

## Decisions so far

<!-- one line per closed ticket, gist + link -->

## Not yet specified

- Future personalization/filtering beyond the v1 curation rules (topic/keyword weighting, ML-based ranking) — depends on how v1 feels once running; not sharp enough to ticket yet.
- Whether to add a lightweight web view/archive of past digests alongside the email — speculative, not requested, no shape yet.
- Long-term backup/resilience if the Oracle VM is lost — low priority for a personal tool; revisit once the deployment ticket (10) lands and there's an actual deployment shape to back up.

## Out of scope

- Multi-recipient/subscriber management, signup, unsubscribe flows, billing — this is a single-recipient personal tool, not a product for others.
- Building a public service for others to use — explicitly "for my own purposes"; the goal is to replace, not compete with, hndigest.com/hnbrew.com.
