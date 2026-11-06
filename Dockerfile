# See https://bun.sh/guides/ecosystem/docker for the base pattern.
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS base
WORKDIR /usr/src/app

# Install dependencies into a temp directory first — cached separately from
# the app source so dependency installs aren't repeated on every code change.
FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Distroless has no shell, so the release stage can't RUN mkdir/chown. Create
# /data here and COPY it in, so a fresh named volume still inherits 1000:1000.
FROM base AS data-dir
RUN mkdir /data

# Copy production dependencies and source code into the official distroless Bun
# image (no shell, no package manager). Keep this stage COPY-only: there is no
# /bin/sh to RUN and no passwd entries, so USER and --chown must be numeric.
FROM oven/bun:1.4.4-distroless@sha256:153a951ae40106e125898103e6e990ee0f38e6aee7f561029e26cf9fbed23470 AS release
WORKDIR /usr/src/app
COPY --from=install /temp/prod/node_modules node_modules
COPY src ./src
COPY package.json .
COPY --from=data-dir --chown=1000:1000 /data /data

ENV NODE_ENV=production
# Bun only colors logs on a TTY, and `docker compose logs` is a pipe, so force it (FORCE_COLOR=0 disables).
ENV FORCE_COLOR=1
USER 1000:1000
# The whole command lives in ENTRYPOINT (replacing the base image's `bun` one)
# so `--run-once`/`--dry-run` still work as container args.
ENTRYPOINT ["/usr/local/bin/bun", "run", "src/index.ts"]
