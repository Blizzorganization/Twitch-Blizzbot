FROM ghcr.io/voidzero-dev/vite-plus AS build
WORKDIR /app

# Abhängigkeiten zuerst (besseres Caching); postinstall baut das Dashboard

COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version* ./
COPY --chown=vp:vp ./web-client/package.json web-client/package.json
RUN vp install --frozen-lockfile

COPY --chown=vp:vp . .
RUN vp -C web-client build


RUN cp "$(vp env which node | head -1)" /tmp/node


FROM ghcr.io/voidzero-dev/vite-plus:latest AS deps
WORKDIR /app
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version* ./
RUN vp install --frozen-lockfile --prod


FROM debian:bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /tmp/node /usr/local/bin/node

COPY --from=build /app/web-client/dist ./web-client/dist
COPY src src

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

USER nobody
EXPOSE 3080

CMD ["node", "src/index.js"]
