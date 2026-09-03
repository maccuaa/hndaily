Type: grilling
Status: open
Blocked by: 05, 07

## Question

Given the Bun-scheduling research (ticket 05) and the Oracle server facts (ticket 07), decide: cron vs. systemd timer, how the code gets onto the server and updated (manual `git pull` + `bun install`, a small deploy script, or CI/CD via GitHub Actions over SSH), and whether the app runs from source or as a compiled `bun build --compile` binary.
