Type: research
Status: open

## Question

What does it take to send outbound email FROM an Oracle Cloud (OCI) compute instance? Specifically:

- Does OCI block outbound SMTP (port 25) by default, as most major clouds do for spam prevention — and if so, what's the workaround (request an exception, use port 587/465 to an authenticated relay, or use OCI's own Email Delivery service)?
- What does OCI's Email Delivery service require to set up: domain ownership verification, SPF/DKIM/DMARC records, any approval/allowlisting process, free-tier sending limits, and cost beyond free tier?
- Is there a simpler alternative worth weighing for a single-recipient use case — a third-party transactional provider (SES, Mailgun, Resend, Postmark) or even an existing personal email account's SMTP with an app password — that avoids domain-verification overhead entirely?

This directly informs ticket 08 (email delivery mechanism).
