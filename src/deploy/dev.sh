#!/bin/sh
# Chạy docker compose ở chế độ dev từ bất kỳ đâu: src/deploy/dev.sh run --rm node pnpm test
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
exec docker compose --project-directory "$ROOT/src/deploy" --env-file "$ROOT/.env" \
  -f "$ROOT/src/deploy/docker-compose.yml" -f "$ROOT/src/deploy/docker-compose.dev.yml" \
  --profile tools "$@"
