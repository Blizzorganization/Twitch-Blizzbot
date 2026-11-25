FROM node:22-alpine
WORKDIR /app

# Abhängigkeiten zuerst (besseres Caching). Liegt eine pnpm-lock.yaml im Projekt, wird pnpm benutzt, sonst npm.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc ./
COPY web-client/package.json web-client/
RUN if [ -f pnpm-lock.yaml ]; then \
      npm install -g pnpm@10 && pnpm install --frozen-lockfile --ignore-scripts; \
    else \
      npm install --no-audit --no-fund --ignore-scripts; \
    fi

COPY . .
# Dashboard bauen (Ergebnis: web-client/dist, wird vom Bot ausgeliefert)
RUN npm run web:build

ENV NODE_ENV=production
EXPOSE 3080
CMD ["node", "src/index.js"]
