#!/usr/bin/env bash
# Copia de seguridad del portal: base de datos (esquemas identidad, portal, storage, migraciones)
# + objetos del almacenamiento. Uso: scripts/copia.sh <directorio-destino>
# En Supabase, las copias automáticas de la base de datos NO incluyen los archivos de Storage:
# esta copia de objetos es imprescindible. Guarda el resultado cifrado y fuera del servidor.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env.local ] && . ./.env.local; set +a
DEST=${1:?Indica el directorio de destino}
SELLO=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$DEST"
pg_dump "$DATABASE_URL_ADMIN" -Fc -n identidad -n portal -n storage -n migraciones -f "$DEST/portal-$SELLO.dump"
if [ -n "${STORAGE_DATA:-}" ] || [ -d /var/lib/praetoria-storage ]; then
  tar -C "${STORAGE_DATA:-/var/lib/praetoria-storage}" -czf "$DEST/objetos-$SELLO.tar.gz" .
fi
( cd "$DEST" && sha256sum portal-$SELLO.dump objetos-$SELLO.tar.gz 2>/dev/null > copia-$SELLO.sha256 )
echo "$SELLO"
