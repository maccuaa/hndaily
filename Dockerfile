# See https://bun.sh/guides/ecosystem/docker for the base pattern.
FROM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS base
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
