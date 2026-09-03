Type: research
Status: resolved

## Question

What does it take to send outbound email FROM an Oracle Cloud (OCI) compute instance? Specifically:

- Does OCI block outbound SMTP (port 25) by default, as most major clouds do for spam prevention — and if so, what's the workaround (request an exception, use port 587/465 to an authenticated relay, or use OCI's own Email Delivery service)?
- What does OCI's Email Delivery service require to set up: domain ownership verification, SPF/DKIM/DMARC records, any approval/allowlisting process, free-tier sending limits, and cost beyond free tier?
- Is there a simpler alternative worth weighing for a single-recipient use case — a third-party transactional provider (SES, Mailgun, Resend, Postmark) or even an existing personal email account's SMTP with an app password — that avoids domain-verification overhead entirely?

This directly informs ticket 08 (email delivery mechanism).

## Answer

**Recommended: SMTP with an app password on an existing Gmail/Fastmail account** — no new DNS, domain, account, or IAM setup, ~5 minutes total. **Next best (own-domain option): Resend free tier** (3,000/mo, 2-3 DNS records, one API key). **OCI Email Delivery works and is free at this volume**, but requires the most setup of any option (IAM group/user/policy, email-domain + SPF + DKIM, approved-sender registration, then SMTP-credential generation). Oracle's own docs never state their outbound-port-25 policy either way (unlike AWS/GCP/Azure, which all explicitly document blocking it) — but this turns out not to matter: every viable option here (OCI, SES, Resend, Postmark, Gmail/Fastmail) sends over authenticated port 465/587, never raw port 25.

Full findings, citations, and the alternatives comparison table: [`research/oracle-email-constraints.md`](https://github.com/maccuaa/hndaily/blob/research/oracle-email-constraints/.scratch/hn-digest-service/research/oracle-email-constraints.md) (branch `research/oracle-email-constraints`).
