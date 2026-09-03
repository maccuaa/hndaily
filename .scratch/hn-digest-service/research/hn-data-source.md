# Research: HN data source for the daily digest

Ticket: [03-hn-data-source](../issues/03-hn-data-source.md)

## Recommendation

**Use the Algolia HN Search API (`hn.algolia.com/api`) as the primary data source, with the official Firebase API (`github.com/HackerNews/API`) kept as a lightweight fallback/backstop.**

Algolia's `/v1/search` endpoint answers "top 15 stories by score in the last 24 hours" in a **single HTTP request**, sorted server-side by points (confirmed against the actual Algolia indexing configuration — see §2). The Firebase API cannot do this at all natively: its list endpoints (`/v0/topstories.json`, etc.) are bare arrays of IDs with no score/time attached, forcing up to ~500 additional per-item HTTP requests plus client-side sorting for the same result. Neither API's rate limits are remotely a concern for a once-daily job. The main risk with Algolia is that its underlying open-source project has been archived (no active development since late 2023), so it is worth keeping a simple Firebase-based fallback path in case the free Algolia demo service is ever discontinued, since Firebase is HN/YC's own first-party data feed and is extremely unlikely to disappear as long as news.ycombinator.com itself exists.

---

## 1. Rate Limits and Auth Requirements

| | Firebase HN API | Algolia HN Search API |
|---|---|---|
| **API key needed?** | No — confirmed live (plain unauthenticated `GET` requests return 200 with full JSON) | No — confirmed live (plain unauthenticated `GET` requests return 200 with full JSON) |
| **Stated rate limit** | "There is currently no rate limit." | 10,000 requests/hour per IP (historical primary source; see caveat below) |
| **Practical daily-job impact** | None — even fetching all ~500 topstories individually is far under any conceivable limit | None — a digest needs 1 request/day, ~14,600x under the documented hourly cap |

**Firebase/official API:** The README states plainly: *"This first iteration will have URIs prefixed with `https://hacker-news.firebaseio.com/v0/` and is structured as described below. There is currently no rate limit."* — `HackerNews/API:README.md:13`. This sentence was deliberately added in 2016 via a merged PR titled "Add comment on rate limit" specifically to answer public questions about rate limiting (`https://github.com/HackerNews/API/pull/9`, merged). No auth header, key, or token is used by any endpoint — verified live via `curl` against `https://hacker-news.firebaseio.com/v0/topstories.json` and `/v0/item/8863.json`, both returning `200`/valid JSON with zero credentials.

**Algolia HN Search API:** The *current* documentation page at `https://hn.algolia.com/api` is a JavaScript single-page app (confirmed by fetching the raw HTML, which is just a React app shell referencing `main-*.js`/`main-*.css` bundles — no static text) and does not expose rate-limit text without executing JS, so I recovered the original, pre-rewrite documentation via the Internet Archive. The Wayback Machine capture from **2014-10-13** (`https://web.archive.org/web/20141013143139/http://hn.algolia.com/api`, the earliest/most complete static-HTML docs snapshot available) has an explicit `## Rate limits` section stating: *"We are limiting the number of API requests from a single IP to 10,000 per hour. If you or your application has been blacklisted and you think there has been an error, please contact us [support@algolia.com]."*
  - **Caveat on currency:** By the 2019 snapshots (e.g., `https://web.archive.org/web/20190205223238/https://hn.algolia.com/api`), the page had already become an Angular app (`<html ng-app="HNSearch">`) and no longer serves this text as crawlable static HTML, so I cannot directly confirm the exact number "10,000/hour" is still published today. However, I found strong structural corroboration in the actual backend proxy source code: `algolia/hn-search:app/controllers/api/v1/base_controller.rb` forwards the caller's IP to Algolia's real search cluster via `Algolia::Protocol::HEADER_FORWARDED_IP => forwarded_ip`, with a `RATE_LIMIT_WHITE_LIST` environment-variable carve-out for exempted IPs — this is precisely the mechanism Algolia's platform uses to apply per-caller-IP rate limiting when a backend proxies searches on behalf of end users. This code is present as of the repository's last substantive commit (`e27760e`, "fix(links): use https", 2023-08-21), so the IP-based rate-limiting architecture is confirmed structurally intact through late 2023, even though I could not find a current, live, primary-sourced page re-stating the exact numeric threshold.
  - No API key is required to call `/v1/search`, `/v1/search_by_date`, `/v1/items/:id`, or `/v1/users/:username` — verified live via unauthenticated `curl` calls, all returning `200`.
  - Note: `hn.algolia.com`'s own front-end embeds a separate Algolia "Search Insights" analytics key (`aa('init', {appId: 'UJ5WYC0L7X', apiKey: '28f0e1ec37a5e792e6845e67da5f20dd'})`, visible in the page's raw HTML) purely for click-through telemetry on the website — this is unrelated to, and not required for, calling the public REST search endpoints directly.

**A note on Firebase's underlying infrastructure:** Firebase Realtime Database (which hosts the official API) documents global quotas such as *"Simultaneous connections: 200,000* (*The Spark [free] plan limit on simultaneous connections is 100*)" — `https://firebase.google.com/docs/database/usage/limits`. This is a constraint on the database *owner's* (HN/YC's) plan, not on a client issuing stateless HTTPS `GET` requests to the `.json` REST endpoints (as opposed to a persistent Firebase SDK/WebSocket connection), so it is not a practical constraint for this digest job.

---

## 2. Server-Side Queryability/Sortability of Score, Comments, Timestamp

This is the decisive functional difference between the two APIs.

### Firebase: IDs only, no server-side sort/filter by score or time

The README's "Live Data" section (`HackerNews/API:README.md:163-208`) documents these list endpoints, and **every one of them returns only a bare JSON array of integer IDs** — no score, timestamp, or comment count is included in the list response itself:

- `/v0/topstories.json` — *"Up to 500 top and new stories are at `/v0/topstories`"* (`README.md:179`) — confirmed live: returns exactly 500 IDs, no other fields.
- `/v0/newstories.json` — same structure, confirmed live: 500 IDs.
- `/v0/beststories.json` — *"Best stories are at `/v0/beststories`"* (`README.md:179`) — confirmed live: 200 IDs. Note this is HN's own internal "best" ranking algorithm (not a user-controllable "top by raw score in last N hours" query) — it reflects Hacker News's current front-page-style ranking, not a literal points sort over an arbitrary window.
- `/v0/askstories.json`, `/v0/showstories.json`, `/v0/jobstories.json` — *"Up to 200 of the latest Ask HN, Show HN, and Job stories"* (`README.md:189`, emphasis on "latest" = recency-ordered, not score-ordered) — confirmed live: 23, 129, and 31 IDs respectively at test time.

To get score (`score`), timestamp (`time`), or comment count (`descendants`) for **any** of these IDs, you must issue a separate `GET /v0/item/<id>.json` per ID (field table at `README.md:29-45`). There is no query parameter anywhere in this API to filter by a time window or sort by score — the design is explicitly acknowledged as low-level: *"The v0 API is essentially a dump of our in-memory data structures... it's not the ideal public API, but it's the one we could release in the time we had"* (`README.md:19-21`). Concretely, building "top 15 by score in last 24h" from Firebase requires: 1 request to `topstories.json` (or `newstories.json` to guarantee full 24h coverage, since `topstories` reflects current front-page-style ranking rather than a strict recency feed) + up to 500 individual `item/<id>.json` requests, then client-side filtering on `time` and sorting on `score`.

### Algolia: score, comments, and time are native, combinable, server-side query parameters

Confirmed via the archived original docs (`https://web.archive.org/web/20141013143139/http://hn.algolia.com/api`) and live testing:

- `numericFilters=` supports the fields **`created_at_i`** (unix timestamp), **`points`**, and **`num_comments`**, with operators `<`, `<=`, `=`, `>`, `>=`, combinable with commas for AND (e.g., `created_at_i>X,points>100` — tested live, correctly returned only matching results).
- `tags=story` filters to stories only (excludes comments/polls/jobs).
- **Sorting by score is a genuine server-side ranking, not a client-side artifact.** I confirmed this at the source: the Algolia indexing configuration in the official frontend/backend repo explicitly sets
  ```ruby
  customRanking ['desc(points)', 'desc(num_comments)']
  ranking ['typo', 'proximity', 'attribute', 'custom']
  ```
  (`algolia/hn-search:README.md`, "Indexing Configuration" section). Since a digest query has no free-text search term, the `typo`/`proximity`/`attribute` ranking tiers are moot, so results collapse to the `custom` tier — i.e., **sorted by points descending, ties broken by num_comments descending, entirely on Algolia's servers.**
  - I verified this behaviorally: `GET https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>{ts}` (no query text) returned hits in strict monotonically-decreasing `points` order (890, 689, 452, 396, 337, 336, 307, 261...).
  - I also verified `/search_by_date` (same filters) instead sorts strictly reverse-chronologically by `created_at`, confirming the two endpoints have genuinely distinct, documented sort semantics — *"Request (sorted by relevance, then points, then number of comments) GET `/v1/search?query=...`"* vs. *"Request (sorted by date, more recent first) GET `/v1/search_by_date?query=...`"* (2014 archived docs, op. cit.).
- Response objects include `points`, `num_comments`, `created_at` (ISO-8601) and `created_at_i` (unix), `title`, `url`, `author`, and `objectID` (the HN item id) directly in the hit — no secondary per-item fetch needed at all.
- `hitsPerPage` supports up to **1000** per page (Algolia's general platform docs: default 20, min 1, max 1000 — `https://www.algolia.com/doc/api-reference/api-parameters/hitsPerPage/`; confirmed empirically — a request for `hitsPerPage=1000` returned exactly 1000 hits).

**Field-name mapping to be aware of when building the digest** (both APIs, cross-checked): Firebase `score` ⇄ Algolia `points`; Firebase `descendants` ⇄ Algolia `num_comments`; Firebase `time` (unix) ⇄ Algolia `created_at_i` (unix)/`created_at` (ISO-8601); Firebase `id` ⇄ Algolia `objectID`/`story_id`. Both APIs source `title` as raw HTML that may contain HTML-encoded entities — Firebase's field table explicitly states *"title | The title of the story, poll or job. **HTML**."* (`HackerNews/API:README.md:43`, language added specifically in merged PR `https://github.com/HackerNews/API/pull/20`, "clarify title may use HTML encoded entities") — decode entities defensively regardless of which source you use.

---

## 3. Reliability / Uptime / Deprecation Signals

**No formal deprecation notice was found for either API.** Both are live and returning current data as of testing. However, their maintenance postures differ meaningfully:

**Firebase HN API (`HackerNews/API`):**
- Repository is **not archived** (`archived: false` via GitHub API) and still receives merged PRs, most recently `8a0528f` on 2025-01-01 (a copyright-year bump). Commit history since 2019 is dominated by trivial LICENSE-year updates and small doc clarifications (e.g., PR #22 removing an incorrect `url` field from Ask HN responses in 2020, PR #19 clarifying that `topstories` can include jobs in 2019) — i.e., low-churn but not abandoned.
- **Issues are disabled on the repo** (`has_issues: false`, `has_discussions: false` via GitHub API), and a GitHub issue-search scoped to this repo for rate-limit/outage/deprecation keywords returned 0 outage-related results and only the single historical PR #9 discussed above. This means there is no visible public backlog of outage reports on the canonical repo — but it also means the repo is not really a place where operational problems would surface even if they occurred.
- No status page specific to this API; it rides on Firebase Realtime Database, whose general dashboard (`https://status.firebase.google.com/`) showed, at time of testing, no active incident affecting Realtime Database (the only active banner concerned the unrelated, already-announced deprecation of *Firebase Dynamic Links*). Full historical incident detail on that dashboard is JS-rendered and wasn't fully extractable via static fetch — flagged as a gap below.

**Algolia HN Search API (`hn.algolia.com/api`):**
- The backing source repository, `algolia/hn-search`, **is archived** (`archived: true`, `pushed_at: 2023-11-04` via GitHub API) — GitHub read-only-archives repositories that are no longer maintained. The last substantive commit was `e27760e` ("fix(links): use https") on 2023-08-21; the commit history shows feature work trailing off through 2021-2023 (e.g., `952712a` "remove virtual replicas from settings", `7b25c7c` "set minProximity to 7 instead of 8", both 2021-2022), consistent with the project moving to end-of-life maintenance before formal archival.
- Despite the source repo being archived, **the live hosted service is still functioning and serving fresh data** — verified directly: a live query returned Hacker News stories from the current day of testing with correct, internally-consistent points/comment counts.
- No Algolia-specific SLA is published for this free community demo (distinct from Algolia's paid, contractually-SLA'd product). Algolia's general status page (`https://status.algolia.com/`) exists but is also a JS single-page app; I could not locate a plain JSON/incident-history endpoint reachable without executing its JS bundle, so I could not extract a specific historical-incident log from a primary source — flagged as a gap below.
- **Practical risk takeaway:** because the source project is archived and unmaintained, if the free hosted API were ever discontinued or silently broken, there is unlikely to be an active team monitoring/announcing it via that repo. This is the strongest argument in favor of keeping Firebase as a fallback, since Firebase is HN/YC's own production data feed underlying news.ycombinator.com itself.

---

## 4. Filtering by Story Type (Show HN, Ask HN)

**Firebase API** provides dedicated endpoints — `/v0/askstories.json` and `/v0/showstories.json` (`HackerNews/API:README.md:187-195`) — confirmed live (23 and 129 IDs respectively at test time). However, these share the same fundamental limitation as `topstories`/`beststories`: they are **recency-ordered ID lists only** (*"the latest Ask HN, Show HN... stories"*), not score-ordered, and include no score/time fields — so combining "Show HN" + "top by score in last 24h" still requires fetching every returned item individually and sorting client-side.

**Algolia API** supports story-type filtering as a first-class `tags` value that composes directly with the score/time filters in the *same single request*: `tags=ask_hn` and `tags=show_hn` are documented tag values (2014 archived docs) and confirmed live — e.g., `tags=ask_hn` returned results tagged `["story","author_...","story_...","ask_hn"]`. Because `tags` and `numericFilters` combine in one query (e.g., `tags=show_hn&numericFilters=created_at_i>X,points>50`), Algolia can natively answer "top N Show HN posts by score in the last 24 hours" in one request — something Firebase cannot do without the same N+1 fetch-and-sort workaround. Algolia also documents that tags are ANDed by default and ORed via parentheses — e.g. `author_pg,(story,poll)` filters `author=pg AND (type=story OR type=poll)` (2014 archived docs, op. cit.) — so `tags=(story,ask_hn,show_hn)` would let a future version of the digest include ordinary stories plus Ask/Show HN in one combined, still-score-sorted query.

---

## 5. Concrete Example: "Top 15 Stories by Score, Last 24 Hours"

### Algolia (recommended) — one request

```
GET https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i%3E{UNIX_TIMESTAMP_24H_AGO}&hitsPerPage=15
```

I ran this live (with `{UNIX_TIMESTAMP_24H_AGO}` computed at request time) and it returned exactly 15 hits, in verified strict points-descending order, each with `points`, `num_comments`, `created_at`, `title`, and `objectID` populated directly — no further requests needed.

To restrict to a minimum score threshold too (e.g., ignore anything under 100 points): append `,points%3E100` to `numericFilters` (comma = AND) — tested live, correctly narrowed results to 26 matching stories.

To get *only* Ask HN or Show HN posts in the same style of query, swap `tags=story` for `tags=ask_hn` or `tags=show_hn` (both confirmed live).

### Firebase (fallback) — one list request + up to ~500 item requests + client-side work

```
GET https://hacker-news.firebaseio.com/v0/topstories.json         # or newstories.json for full 24h recency coverage
     → returns up to 500 bare IDs (confirmed live: exactly 500)
GET https://hacker-news.firebaseio.com/v0/item/{id}.json           # repeat per ID
     → each returns {..., "score":, "time":, "descendants":, "title":, "url":, "type":, ...}
```

Client-side: filter items where `type == "story"` and `time >= now - 86400`, sort remaining by `score` descending, take the top 15. This requires up to 500 additional HTTP round-trips (parallelizable, but still far more requests, latency, and failure surface than Algolia's single call) and no server-side guarantee that all 24-hour-old-or-newer stories are even present in the 500-item `topstories`/`newstories` snapshot (a very high-volume day could theoretically push borderline stories out of the top 500 before your job runs, though for HN's normal volume this is not a practical issue).

---

## Gaps and Uncertainties

- **Exact current Algolia rate-limit number is not re-confirmable from a live, primary, static source.** The `10,000 requests/hour/IP` figure is well-documented in the original (2014) API docs and structurally corroborated by the still-present IP-forwarding rate-limit code in the archived backend repo (`base_controller.rb`, last touched 2023), but the live docs page is a JS SPA that no longer republishes this number anywhere I could scrape statically. I was unable to execute the site's JS bundle to check for an updated figure. This is very unlikely to matter for a once-daily job regardless of the exact current number.
- **Full historical incident/outage logs for both platforms were not fully extractable.** Both `status.algolia.com` and `status.firebase.google.com` are JavaScript-rendered dashboards; I could confirm no *active* incident banner relevant to either service at test time, but could not pull a structured, date-stamped incident history from a primary source within the scope of this investigation. If uptime history is a hard requirement, someone with a browser should manually review these two dashboards' incident archives.
- **HTML-entity-escaping behavior of `title` was not conclusively cross-verified between the two APIs** with a live example (I could not find a currently-listed story with a literal ampersand/entity in its title to diff side-by-side during testing). Treat both sources' `title` field as HTML per Firebase's explicit field documentation and decode defensively regardless of source.
- **Algolia's exact current uptime/SLA commitment for the free `hn.algolia.com` demo (as opposed to Algolia's paid product) is not documented anywhere I could find** — reasonable to assume "best-effort, no formal SLA," which is the standard basis for recommending Firebase as a fallback path.
