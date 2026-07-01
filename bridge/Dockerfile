# talaria-bridge — transparent Hermes-dashboard proxy + mission interceptor.
# Multi-stage: build TS → run compiled JS on a slim runtime.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
EXPOSE 9119
# Runs as the built-in non-root 'node' user.
USER node
CMD ["node", "dist/index.js"]
