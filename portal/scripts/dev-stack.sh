#!/usr/bin/env bash
# Pila local REAL para desarrollo y pruebas (sin Docker): PostgreSQL 16, Supabase Storage
# (storage-api compilado desde su código fuente, backend de ficheros en disco) y un capturador
# SMTP local. Ningún dato real: solo identidades y documentos ficticios.
#
# Uso: scripts/dev-stack.sh start|stop|reset
# Variables: PG_BIN (binarios de Postgres), PG_DATA, STORAGE_SRC (clon de supabase/storage ya
# compilado con `npm ci && npm run build`), NODE24 (node >= 24 para storage-api).
set -euo pipefail
cd "$(dirname "$0")/.."
PG_BIN=${PG_BIN:-/usr/lib/postgresql/16/bin}
PG_DATA=${PG_DATA:-/var/lib/praetoria-pg}
STORAGE_SRC=${STORAGE_SRC:-/tmp/claude-0/stack/storage}
STORAGE_DATA=${STORAGE_DATA:-/var/lib/praetoria-storage}
NODE24=${NODE24:-/tmp/claude-0/stack/node24/node_modules/node/bin/node}
LOGS=.dev/logs; mkdir -p "$LOGS"
set -a; . ./.env.local; set +a

pg_up() {
  if ! "$PG_BIN/pg_isready" -h 127.0.0.1 -p 54322 -q; then
    su postgres -s /bin/bash -c "$PG_BIN/pg_ctl -D $PG_DATA -o '-p 54322 -k /tmp' -l $PG_DATA/log start" >/dev/null
    sleep 2
  fi
}
storage_up() {
  fuser -s 5050/tcp && return 0
  mkdir -p "$STORAGE_DATA"
  ( cd "$STORAGE_SRC" && env SERVER_HOST=127.0.0.1 SERVER_PORT=5050 SERVER_ADMIN_PORT=5051 SERVER_REGION=local \
      AUTH_JWT_SECRET="${STORAGE_JWT_SECRET:-local-dev-only-jwt-secret-not-for-production-0000}" AUTH_JWT_ALGORITHM=HS256 \
      DATABASE_URL="$DATABASE_URL_ADMIN" DB_INSTALL_ROLES=true DB_ANON_ROLE=anon DB_SERVICE_ROLE=service_role \
      DB_AUTHENTICATED_ROLE=authenticated DB_SUPER_USER=postgres DB_ALLOW_MIGRATION_REFRESH=true \
      STORAGE_BACKEND=file STORAGE_FILE_BACKEND_PATH="$STORAGE_DATA" TENANT_ID=praetoria-local \
      UPLOAD_FILE_SIZE_LIMIT=26214400 UPLOAD_FILE_SIZE_LIMIT_STANDARD=26214400 \
      setsid nohup "$NODE24" dist/start/server.js > "$OLDPWD/$LOGS/storage.log" 2>&1 < /dev/null & )
  for _ in $(seq 1 30); do curl -sf 127.0.0.1:5050/status >/dev/null && return 0; sleep 1; done
  echo "storage-api no arranca: mira $LOGS/storage.log"; exit 1
}
smtp_up() {
  fuser -s 2525/tcp && return 0
  setsid nohup node --experimental-strip-types scripts/smtp-dev.ts > "$LOGS/smtp.log" 2>&1 < /dev/null &
  sleep 1
}
stop_all() { fuser -k 5050/tcp 2525/tcp >/dev/null 2>&1 || true; }

case "${1:-start}" in
  start) pg_up; storage_up; smtp_up; node --env-file=.env.local --experimental-strip-types scripts/storage-setup.ts; echo "pila local lista" ;;
  stop) stop_all ;;
  reset)
    stop_all; pg_up
    ./scripts/reset-db.sh
    rm -rf "${STORAGE_DATA:?}"/* .dev/correo
    storage_up                       # crea el esquema storage
    node --env-file=.env.local --experimental-strip-types scripts/migrate.ts
    smtp_up
    node --env-file=.env.local --experimental-strip-types scripts/storage-setup.ts
    echo "pila local reiniciada" ;;
esac
