Type: grilling
Status: open
Blocked by: 06

## Question

Given the `bun:sqlite` research findings (ticket 06), confirm the Send history schema and retention policy: how long to keep old Delivery run / Story records, whether to store full Story metadata or just HN item IDs, and whether any of this data needs to survive a server rebuild (backup/restore expectations).

**Also covers (added after ticket 01):** the schema must support detecting gaps for the Catch-up digest — i.e. tracking each Delivery run's success/timestamp so a later run can tell "was the last scheduled run missed or delayed, and if so, since when," not just "which Stories were already sent." Confirm what a run needs to record (e.g. a `delivery_runs` table with status/timestamp, alongside the sent-Stories table) to make that gap check a simple query.

