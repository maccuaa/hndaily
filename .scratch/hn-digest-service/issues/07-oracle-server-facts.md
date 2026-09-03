Type: task
Status: open

## Question

Gather the concrete facts about the existing Oracle Cloud server needed before the email-delivery and deployment tickets can be decided. This is a checklist only you can run (requires your OCI console / SSH access):

- [ ] OS and version (e.g. Oracle Linux 8/9, Ubuntu) and CPU architecture (x86_64 vs ARM/Ampere)
- [ ] Is Bun already installed? If not, is there internet access on the box to install it?
- [ ] Current security list / network security group rules for outbound traffic — is port 25 (SMTP) or 587 already blocked or open?
- [ ] Is there a domain name you own that could be used for sending email (needed for SPF/DKIM if using OCI Email Delivery or any provider that requires domain verification)? If yes, which domain, and where is DNS hosted?
- [ ] Is this server always-on (so a cron/systemd timer can fire on schedule), or does it stop/hibernate on any schedule?
- [ ] Any existing cron jobs, systemd timers, or deployment tooling (CI/CD, Docker, etc.) already in use on this server that the digest job should follow for consistency?
