# Talaria UI — Vite + TanStack Start, served by server-entry.js.
#
# Build:  docker build -t packledger/talaria-ui:0.1.0 ui
# Run is wired by stack/docker-compose.yml (needs Postgres + Redis + the gateway).

# ─── build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── runtime stage ────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# SSR bundle externalizes node deps, so ship node_modules from the build stage.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server-entry.js ./server-entry.js
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "server-entry.js"]
