# hndaily

A personal, single-recipient service that fetches Hacker News stories and emails a digest on a configurable schedule, replacing the (unreliable) hosted hndigest.com and hnbrew.com subscriptions.

## Language

**Digest**:
The email sent to the Recipient on each Delivery run, containing that run's curated Stories.
_Avoid_: Newsletter, update, report, daily digest (frequency is configurable, not fixed to daily)

**Catch-up digest**:
A supplementary Digest sent when a Delivery run finds Stories that fell outside the Curation window's lookback before a delayed or missed prior run could send them. Covers the gap since the last successful Delivery run.
_Avoid_: Backfill, retry email

**Story**:
An individual Hacker News item eligible for inclusion in a Digest — carries an HN item ID, title, URL, score, and comment count.
_Avoid_: Post, article, item (too generic on its own)

**Recipient**:
The one email address a Digest is sent to. This is a single-user personal tool: there is no signup, no multi-tenant subscriber list, no unsubscribe flow.
_Avoid_: Subscriber, user, customer

**Curation window**:
The rule set that decides which Stories qualify for a Digest: a fixed lookback period (independent of Delivery run frequency) plus a configurable story-count cap, always ranked by score.
_Avoid_: Filter, criteria

**Send history**:
The record of which Stories have already appeared in a past Digest, checked to avoid sending the same Story twice.
_Avoid_: Log, archive

**Delivery run**:
One execution of the scheduled job: fetch candidate Stories, apply the Curation window, render the Digest, send it, update Send history. Frequency is a configurable setting, not fixed to any particular cadence.
_Avoid_: Job, cron run, build (reserve for the scheduling mechanism itself)

**Theme**:
The Digest's visual identity — header/logo, story-row layout, and footer (`src/themes/`), selected by the `theme` config setting. Two ship today: `night-wire` (default, quiet/dark) and `front-page` (bold, HN-style masthead with ranked stories). Purely presentational — never changes which Stories are selected or the Curation window.
_Avoid_: Template, skin (this codebase's term is "Theme")

**Heartbeat**:
A liveness-only ping to healthchecks.io at the end of a successful Delivery run — no content, alerts only when pings *stop* arriving (a dead man's switch), not on any specific outcome.
_Avoid_: Notification, alert (those carry content — see Notification)

**Notification**:
A content-bearing message sent via ntfy reporting a specific Delivery run's outcome — success or failure — as it happens. A short-term addition alongside the Heartbeat, until the Heartbeat alone proves reliable.
_Avoid_: Heartbeat (that's liveness-only, with no content)
