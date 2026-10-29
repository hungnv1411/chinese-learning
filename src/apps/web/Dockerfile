# Build context = gốc repo (workspace pnpm cần cả src/packages/core).
#   docker build -f src/apps/web/Dockerfile .
# Yêu cầu: next.config có `output: 'standalone'` và `outputFileTracingRoot` trỏ về gốc repo.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY src/apps/web/package.json src/apps/web/
COPY src/packages/core/package.json src/packages/core/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Dev: mã nguồn được mount từ máy host (docker-compose.dev.yml).
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000

FROM deps AS build
COPY tsconfig.base.json ./
COPY src/packages/core src/packages/core
COPY src/apps/web src/apps/web
# Tên website, tên miền, khóa bí mật đọc lúc chạy, không đưa vào ảnh.
RUN pnpm -F @clp/web build

FROM node:22-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /repo/src/apps/web/.next/standalone ./
COPY --from=build --chown=app /repo/src/apps/web/.next/static ./src/apps/web/.next/static
COPY --from=build --chown=app /repo/src/apps/web/public ./src/apps/web/public
USER app
EXPOSE 3000
CMD ["node", "src/apps/web/server.js"]
