#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apps/node-backend"
APP_NAME="node-backend"
HEALTH_PATH="http://127.0.0.1:3000/api/healthz"
NGINX_HEALTH="http://127.0.0.1/api/healthz"

cd "$APP_DIR"

echo "==> git fetch/pull"
git fetch --all --prune || true
# 현재 브랜치 기준으로 rebase pull
git pull --rebase || true

# 런타임용 환경 변수 주입 (커밋/빌드시간/버전)
GIT_COMMIT="$(git rev-parse --short HEAD || echo unknown)"
BUILD_TIME="$(date -u +%FT%TZ)"
APP_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo 0.0.0)"

# .env.runtime 에 덮어쓰기(존재하면 갱신)
cat > .env.runtime <<RUNTIME
APP_NAME=$APP_NAME
APP_VERSION=$APP_VERSION
GIT_COMMIT=$GIT_COMMIT
BUILD_TIME=$BUILD_TIME
RUNTIME

echo "==> install deps (try npm ci, fallback npm install)"
if npm ci --omit=dev; then
  true
else
  npm install --omit=dev
fi

echo "==> prisma generate & migrate deploy"
npx prisma generate
npx prisma migrate deploy

echo "==> pm2 reload/start"
# 프로세스가 없으면 start, 있으면 reload
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  # 첫 기동
  NODE_ENV=production pm2 start src/server.js --name "$APP_NAME"
fi
pm2 save || true

echo "==> health check (node 직접)"
for i in {1..20}; do
  if curl -fsS "$HEALTH_PATH" >/dev/null; then
    echo "[OK] Healthz passed"
    break
  fi
  sleep 0.5
  if [[ $i -eq 20 ]]; then
    echo "[ERR] Healthz failed (node)"
    exit 1
  fi
done

echo "==> health check (nginx 경유)"
for i in {1..20}; do
  if curl -fsS "$NGINX_HEALTH" >/dev/null; then
    echo "[OK] Nginx proxy passed (ver=${APP_VERSION}, commit=${GIT_COMMIT}, time=${BUILD_TIME})"
    break
  fi
  sleep 0.5
  if [[ $i -eq 20 ]]; then
    echo "[WARN] Nginx proxy health failed (백엔드는 정상). Nginx 설정을 확인하세요."
  fi
done

echo "[OK] Deploy complete"
