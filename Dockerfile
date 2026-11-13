FROM node:22-alpine
WORKDIR /app

# Abhängigkeiten zuerst (besseres Caching); postinstall baut das Dashboard
COPY package.json package-lock.json .npmrc ./
COPY web-client/package.json web-client/
COPY web-client ./web-client
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run web:build

ENV NODE_ENV=production
EXPOSE 3080
CMD ["node", "src/index.js"]
