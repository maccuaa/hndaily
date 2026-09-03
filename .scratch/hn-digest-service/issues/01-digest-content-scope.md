Type: grilling
Status: resolved

## Question

What should each day's Digest actually contain, and what about hndigest.com/hnbrew.com's current output should this NOT replicate?

Specifically:
- How many Stories per Digest, and what's the Curation window (e.g. top N by score over a fixed lookback like 24h, a minimum score/comment threshold, separate Ask HN / Show HN sections)?
- Format: plain text vs HTML; just title/link/points/comments, or richer (short summary, top comment excerpt)?
- Any personalization for v1 (keyword/domain filters), or is that deferred (see map's "Not yet specified")?
- What specifically annoys you about hndigest's/hnbrew's current emails today, beyond "unreliable delivery" — anything about their content, format, or timing that should NOT carry over?

Recommended starting point (open to override): plain-ish HTML digest, top 15 Stories by score from the last 24h, title + link + points + comment count only, no AI summaries or personalization for v1 — matches existing feature parity at the lowest implementation cost; personalization can graduate out of "Not yet specified" later if wanted.

## Answer

- **Story count & curation**: always top stories by score (no separate Ask HN/Show HN sections); story count defaults to 25 but is a **configurable** setting, not hardcoded.
- **Format**: plain-ish HTML — title, link, points, comment count only. No summaries or comment excerpts for v1.
- **Personalization**: none for v1 (confirmed deferred — stays in "Not yet specified").
- **What to avoid**: nothing about hndigest/hnbrew's content or format — the only complaint is delivery unreliability. Content/format parity is fine as a starting point.
- **New scope surfaced**: story count, Delivery run **frequency**, delivery time-of-day, and timezone are all **configurable settings**, read from a plain config file (JSON/TOML) that the next run picks up — no CLI/UI needed (single-recipient personal tool).
- **Frequency** is genuinely variable (daily, every N days, weekly, or more than once/day), not just an adjustable time-of-day.
- **Curation window stays fixed** regardless of frequency (e.g. always last 24h) rather than scaling to "since last digest" — paired with a new **Catch-up digest**: if a run detects Stories that fell outside the window before a delayed/missed prior run could send them, a supplementary digest covers the gap since the last successful Delivery run. This reuses the already-decided Send history mechanism (ticket 06) rather than requiring a scaling window or new infrastructure. See [ADR 0001](../../../docs/adr/0001-fixed-curation-window-with-catchup-digest.md) for the reasoning, and the updated [`CONTEXT.md`](../../../CONTEXT.md) glossary (Digest/Delivery run no longer assume daily; new "Catch-up digest" term).
- **Web archive/browsable history**: considered (would let you browse past digests independent of email delivery), but explicitly **skipped for v1** — the catch-up digest already solves the reliability angle more cheaply, and browsability wasn't wanted for its own sake. Removed from "Not yet specified" (was speculative fog; now a settled no, not a graduated ticket).

Ticket 09 (data storage/dedupe) is updated to explicitly cover the Send-history schema needed to detect gaps for the catch-up digest.
