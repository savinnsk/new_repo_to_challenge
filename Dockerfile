# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json

FROM manifests AS dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev

FROM dependencies AS dev
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data /app
USER node

FROM dependencies AS api-builder
COPY apps/api ./apps/api
COPY packages/contracts ./packages/contracts
RUN npm run build -w @nexo/api

FROM manifests AS api-dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace=@nexo/api --workspace=@nexo/contracts

FROM base AS api
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001 DATABASE_PATH=/data/nexo.sqlite
RUN mkdir -p /data && chown node:node /data
COPY --from=api-dependencies /app/node_modules ./node_modules
COPY --from=manifests /app/package.json ./package.json
COPY --from=manifests /app/apps/api/package.json ./apps/api/package.json
COPY --from=manifests /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=api-builder --chown=node:node /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3001
CMD ["node", "dist/apps/api/src/server.js"]

FROM dependencies AS web-builder
ARG API_ORIGIN=http://api:3001
ENV NODE_ENV=production NEXT_STANDALONE=true API_ORIGIN=$API_ORIGIN
COPY apps/web ./apps/web
COPY packages/contracts ./packages/contracts
RUN mkdir -p apps/web/public && npm run build -w @nexo/web

FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=web-builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
