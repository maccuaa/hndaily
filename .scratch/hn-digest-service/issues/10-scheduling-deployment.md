Type: grilling
Status: open
Blocked by: 05, 07

## Question

Given the Bun-scheduling research (ticket 05) and the Oracle server facts (ticket 07), decide: cron vs. systemd timer, how the code gets onto the server and updated (manual `git pull` + `bun install`, a small deploy script, or CI/CD via GitHub Actions over SSH), and whether the app runs from source or as a compiled `bun build --compile` binary.

**Also covers (added after ticket 01):** delivery frequency, time-of-day, and timezone are configurable settings (read from a config file, per ticket 01's resolution), not hardcoded — decide how a config change (e.g. switching from daily to weekly, or changing the delivery time) actually propagates to the scheduler's trigger. Options include: (a) regenerate/re-enable the systemd timer's `OnCalendar=` value from config on every deploy or config change, or (b) run the timer at a fixed, more frequent cadence (e.g. hourly) and have the script itself no-op unless the current time matches the configured schedule. Recommend evaluating against the research's systemd findings — (a) is more "correct" but needs a small script to template/reload the unit; (b) is simpler to deploy but wastes a few no-op runs per day.

