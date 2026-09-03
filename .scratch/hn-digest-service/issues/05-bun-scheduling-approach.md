Type: research
Status: open

## Question

What's the best way to run a Bun script once per day on a Linux server: OS cron, a systemd timer + service unit, or something Bun-specific? Cover:

- Bun's Linux platform/architecture support, including ARM64 — Oracle Cloud's free tier commonly provides Ampere ARM instances, so confirm Bun runs there without caveats
- Trade-offs between plain crontab and systemd timers for a single daily job: failure visibility, retry behavior, logging, ease of "did it actually run" alerting (feeds ticket 11)
- Whether Bun needs to be installed system-wide / via a version manager, or can be compiled to a single standalone executable (`bun build --compile`) to simplify deployment
