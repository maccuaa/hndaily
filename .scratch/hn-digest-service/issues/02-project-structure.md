Type: grilling
Status: open

## Question

The original idea was "Bun microservices running a daily cron job" (plural). For a single daily Delivery run (fetch → curate → render → send → record), is more than one service actually justified, or does a single Bun script/package handle the whole pipeline?

If a split is wanted, where's the seam (e.g. fetch/curate vs. render/send), and why does that seam need to be a separate deployable service rather than just separate modules in one codebase?

Also covers repo layout: single package at the repo root, or a workspace/monorepo split?

Recommended: a single Bun package/service. A daily cron job has no concurrent-load or independent-scaling reason to split; "microservices" here would add deployment/ops surface (multiple processes, inter-service calls, more places to fail) with no corresponding benefit. Revisit only if a concrete reason to split emerges during implementation.
