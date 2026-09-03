Type: grilling
Status: open
Blocked by: 04, 07

## Question

Given the findings from the Oracle email-constraints research (ticket 04) and the server-facts task (ticket 07), which email delivery mechanism should the Digest use: OCI Email Delivery, a third-party transactional provider, or an existing personal email account's SMTP?

Also covers: where secrets (SMTP credentials / API keys) are stored and read from on the server (e.g. a `.env` file with restricted permissions vs. an OCI Vault secret) — pick the simplest option that doesn't commit secrets to git.
