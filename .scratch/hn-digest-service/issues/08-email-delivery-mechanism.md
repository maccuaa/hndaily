Type: grilling
Status: resolved

## Question

**Mechanism is settled by ticket 04's reopened answer (use OCI Email Delivery) and secrets storage is settled by ticket 05's reopened answer (environment variables via docker-compose).** What remains open, blocked on the server-facts task (ticket 07):

- The exact env-var/`.env` file convention to follow, consistent with however ticket 07 finds the Recipient's other docker-compose services already organizing secrets.
- Whether to reuse an existing SMTP credential set (if under the free tier's 2-per-user cap) or generate a new one dedicated to this project.

## Answer

- **From-address / Approved Sender**: `hndaily@snowcastle.ca` — to be created as a new OCI Email Delivery Approved Sender (self-service, per ticket 04's research; the domain is already SPF/DKIM-verified from the Recipient's existing OCI Email Delivery setup).
- **SMTP credentials**: generate a **new, dedicated credential set** for this project — the Recipient has room under the free tier's 2-per-user cap.
- **Env var naming**: prefixed with the project name to avoid collisions in the shared root `.env` file (ticket 07), e.g. `HNDAILY_SMTP_USERNAME` / `HNDAILY_SMTP_PASSWORD`, referenced explicitly in this service's `environment:` block in the shared `docker-compose.yml` — consistent with the existing per-service reference pattern (no `env_file:` injection).

Ticket 08 is now fully resolved; no new sub-questions surfaced.

