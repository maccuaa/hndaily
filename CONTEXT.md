# hndaily

A personal, single-recipient service that fetches Hacker News stories and emails a daily digest, replacing the (unreliable) hosted hndigest.com and hnbrew.com subscriptions.

## Language

**Digest**:
The single daily email sent to the Recipient, containing that day's curated Stories.
_Avoid_: Newsletter, update, report

**Story**:
An individual Hacker News item eligible for inclusion in a Digest — carries an HN item ID, title, URL, score, and comment count.
_Avoid_: Post, article, item (too generic on its own)

**Recipient**:
The one email address a Digest is sent to. This is a single-user personal tool: there is no signup, no multi-tenant subscriber list, no unsubscribe flow.
_Avoid_: Subscriber, user, customer

**Curation window**:
The rule set that decides which Stories qualify for a given day's Digest (e.g. score threshold, lookback period, story count cap, category filters).
_Avoid_: Filter, criteria

**Send history**:
The record of which Stories have already appeared in a past Digest, checked to avoid sending the same Story twice.
_Avoid_: Log, archive

**Delivery run**:
One execution of the daily scheduled job: fetch candidate Stories, apply the Curation window, render the Digest, send it, update Send history.
_Avoid_: Job, cron run, build (reserve for the scheduling mechanism itself)
