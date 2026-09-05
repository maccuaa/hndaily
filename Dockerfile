# See https://bun.sh/guides/ecosystem/docker for the base pattern.
FROM oven/bun:1@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS base
WORKDIR /usr/src/app

# Install dependencies into a temp directory first — cached separately from
# the app source so dependency installs aren't repeated on every code change.
FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Copy production dependencies and source code into the final image.
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY src ./src
COPY package.json .

ENV NODE_ENV=production
USER bun
ENTRYPOINT ["bun", "run", "src/index.ts"]
