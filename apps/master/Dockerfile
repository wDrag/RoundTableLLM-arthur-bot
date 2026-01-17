FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/master ./apps/master
RUN pnpm install

FROM deps AS build
RUN pnpm --filter @roundtable/master... build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/apps/master/dist ./apps/master/dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/master/node_modules ./apps/master/node_modules
COPY --from=build /app/packages ./packages
COPY --from=deps /app/apps/master/package.json ./apps/master/package.json
COPY llm.config.json ./llm.config.json
EXPOSE 8787
CMD ["node", "apps/master/dist/server.js"]
