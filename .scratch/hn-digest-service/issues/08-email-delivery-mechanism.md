Type: grilling
Status: open
Blocked by: 07

## Question

**Mechanism is effectively settled by ticket 04's reopened answer: use OCI Email Delivery** (already configured for other projects — just needs a new Approved Sender + SMTP credentials for this project). What remains open, blocked on the server-facts task (ticket 07):

- Where secrets (the new SMTP credentials) are stored and read from on the server (e.g. a `.env` file with restricted permissions vs. an OCI Vault secret) — pick the simplest option that doesn't commit secrets to git, consistent with whatever convention (if any) ticket 07 finds already in use on the server.
- Whether to reuse an existing SMTP credential set (if under the free tier's 2-per-user cap) or generate a new one dedicated to this project.

