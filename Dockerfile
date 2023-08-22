FROM node:20 as production
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm pkg delete scripts.prepare
RUN corepack enable
RUN pnpm install --frozen-lockfile --prod

COPY commands ./commands
COPY events ./events
COPY modules ./modules
COPY bot.js bot.js

USER node


CMD ["pnpm", "start"]