FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/master ./apps/master
RUN pnpm install

FROM deps AS build
RUN pnpm --filter @roundtable/master... build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/master/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/master/package.json ./package.json
EXPOSE 8787
CMD ["node", "dist/server.js"]
