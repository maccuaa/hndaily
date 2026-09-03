Type: research
Status: open

## Question

Is Bun's built-in SQLite support (`bun:sqlite`) sufficient for tracking Send history (which Stories have already appeared in a past Digest) and basic Delivery run logging, without adding an ORM or external database? Cover:

- API surface and stability of `bun:sqlite`
- Migration/schema-management approach that fits a project this small (raw SQL vs. a lightweight migration tool)
- Whether the SQLite file needs any special handling for backup, or survives redeploys on the Oracle server (relates to ticket 10)
