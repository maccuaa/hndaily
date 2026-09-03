Type: research
Status: open

## Question

Which Hacker News data source best supports fetching "top N Stories by score within a recent time window" for the Digest: the official Firebase HN API (https://github.com/HackerNews/API), the Algolia HN Search API (https://hn.algolia.com/api), or a combination of both?

Cover:
- Rate limits / auth requirements for each
- Whether score + comment count + timestamp are directly queryable/sortable server-side, or require client-side fetching of every candidate item to sort locally
- Reliability/uptime track record
- Which best supports Show HN / Ask HN filtering, if that turns out to be wanted (see ticket 01)
