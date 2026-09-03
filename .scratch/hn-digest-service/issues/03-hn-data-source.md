Type: research
Status: resolved

## Question

Which Hacker News data source best supports fetching "top N Stories by score within a recent time window" for the Digest: the official Firebase HN API (https://github.com/HackerNews/API), the Algolia HN Search API (https://hn.algolia.com/api), or a combination of both?

Cover:
- Rate limits / auth requirements for each
- Whether score + comment count + timestamp are directly queryable/sortable server-side, or require client-side fetching of every candidate item to sort locally
- Reliability/uptime track record
- Which best supports Show HN / Ask HN filtering, if that turns out to be wanted (see ticket 01)

## Answer

**Use the Algolia HN Search API as the primary data source, with the official Firebase API kept as a lightweight fallback.** Algolia's `/v1/search` answers "top 15 stories by score in the last 24h" in one request (`tags=story&numericFilters=created_at_i>{ts}`), sorted server-side by points — confirmed live and against Algolia's own indexing config (`customRanking: ['desc(points)', 'desc(num_comments)']`). Firebase's list endpoints (`topstories.json` etc.) are bare ID arrays with no score/time, requiring up to ~500 extra per-item requests and client-side sorting for the same result. Neither API needs an auth key; neither's rate limits are a concern for a once-daily job. Caveat: Algolia's backing repo (`algolia/hn-search`) is archived (no dev since Nov 2023) though the hosted service still works — hence keeping Firebase, HN/YC's own first-party feed, as a fallback.

Full findings, citations, and concrete example queries: [`research/hn-data-source.md`](https://github.com/maccuaa/hndaily/blob/research/hn-data-source/.scratch/hn-digest-service/research/hn-data-source.md) (branch `research/hn-data-source`).
