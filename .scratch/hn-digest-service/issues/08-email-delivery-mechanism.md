Type: grilling
Status: open
Blocked by: 07

## Question

**Mechanism is settled by ticket 04's reopened answer (use OCI Email Delivery) and secrets storage is settled by ticket 05's reopened answer (environment variables via docker-compose).** What remains open, blocked on the server-facts task (ticket 07):

- The exact env-var/`.env` file convention to follow, consistent with however ticket 07 finds the Recipient's other docker-compose services already organizing secrets.
- Whether to reuse an existing SMTP credential set (if under the free tier's 2-per-user cap) or generate a new one dedicated to this project.

