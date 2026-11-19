# See https://bun.sh/guides/ecosystem/docker for the base pattern.
FROM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS base
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
FROM oven/bun:1.4.5-distroless@sha256:3a210956422ad81cf7532e1fc1f2eb9275d6ef4c2337a9d25d530f798e80726a AS release
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
