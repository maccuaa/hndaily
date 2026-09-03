Type: grilling
Status: open
Blocked by: 10

## Question

How should you find out if a Delivery run fails to execute or fails to send? Silent failure is the main risk of a single daily cron job with no UI. Options include: a dead-man's-switch / heartbeat ping (e.g. healthchecks.io), systemd's `OnFailure=` unit sending a separate alert, or just accepting manual log-checking for a v1 personal tool.

Recommended: a free heartbeat-ping service (healthchecks.io or similar), pinged at the end of a successful Delivery run — cheap, simple, and catches "cron didn't fire" as well as "job crashed," which log-checking alone would miss.
