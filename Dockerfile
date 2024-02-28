FROM node:20 as production
WORKDIR /app
COPY package.json yarn.lock ./
RUN npm pkg delete scripts.prepare
RUN corepack enable
RUN yarn ci --prod --frozen-lockfile

COPY commands ./commands
COPY events ./events
COPY modules ./modules
COPY bot.js bot.js

USER node


CMD ["yarn", "start"]