Type: research
Status: resolved

## Question

What does it take to send outbound email FROM an Oracle Cloud (OCI) compute instance? Specifically:

- Does OCI block outbound SMTP (port 25) by default, as most major clouds do for spam prevention — and if so, what's the workaround (request an exception, use port 587/465 to an authenticated relay, or use OCI's own Email Delivery service)?
- What does OCI's Email Delivery service require to set up: domain ownership verification, SPF/DKIM/DMARC records, any approval/allowlisting process, free-tier sending limits, and cost beyond free tier?
- Is there a simpler alternative worth weighing for a single-recipient use case — a third-party transactional provider (SES, Mailgun, Resend, Postmark) or even an existing personal email account's SMTP with an app password — that avoids domain-verification overhead entirely?

This directly informs ticket 08 (email delivery mechanism).

## Answer

**Updated — reopened with new information.** The original recommendation below assumed setting OCI Email Delivery up from scratch, where it was the most setup-heavy option compared. That assumption doesn't hold: the Recipient already has OCI Email Delivery fully configured for other projects (domain verified, SPF/DKIM live, IAM group/policy in place). None of that setup cost applies here.

**Recommendation revised: use OCI Email Delivery.** The only remaining per-project steps are self-service: create a new Approved Sender for this project's From-address, then generate (or reuse, if still under the free tier's 2-credential-set-per-user cap) SMTP credentials. This is no more work than setting up Gmail/Fastmail from scratch, and it keeps the whole deployment inside the same Oracle Cloud account already being used, rather than depending on a personal email account. See [ADR 0002](../../../docs/adr/0002-use-oci-email-delivery.md) and ticket 08 for the finalized delivery-mechanism decision.

---

*Original research and recommendation (below) — the general facts, alternatives comparison, and setup-complexity findings remain accurate as reference material; they're just no longer decisive for this Recipient specifically, since OCI's setup cost here is already sunk.*

**Original: Recommended SMTP with an app password on an existing Gmail/Fastmail account** — no new DNS, domain, account, or IAM setup, ~5 minutes total. **Next best (own-domain option): Resend free tier** (3,000/mo, 2-3 DNS records, one API key). **OCI Email Delivery works and is free at this volume**, but requires the most setup of any option (IAM group/user/policy, email-domain + SPF + DKIM, approved-sender registration, then SMTP-credential generation). Oracle's own docs never state their outbound-port-25 policy either way (unlike AWS/GCP/Azure, which all explicitly document blocking it) — but this turns out not to matter: every viable option here (OCI, SES, Resend, Postmark, Gmail/Fastmail) sends over authenticated port 465/587, never raw port 25.

Full findings, citations, and the alternatives comparison table: [`research/oracle-email-constraints.md`](https://github.com/maccuaa/hndaily/blob/research/oracle-email-constraints/.scratch/hn-digest-service/research/oracle-email-constraints.md) (branch `research/oracle-email-constraints`).
