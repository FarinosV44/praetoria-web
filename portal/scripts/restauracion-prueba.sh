#!/usr/bin/env bash
# Prueba de restauración (solo local): restaura la última copia en una base de datos nueva y
# comprueba que los recuentos coinciden con la original y que cada objeto existe en la copia.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
DEST=${1:?Directorio de copias}; SELLO=${2:?Sello de la copia}
case "$DATABASE_URL_ADMIN" in *127.0.0.1*|*localhost*) ;; *) echo "Solo en local"; exit 1;; esac
( cd "$DEST" && sha256sum -c "copia-$SELLO.sha256" )
RAIZ="${DATABASE_URL_ADMIN%/*}"
psql "$RAIZ/postgres" -qc "drop database if exists restauracion_prueba" -qc "create database restauracion_prueba"
for r in anon authenticated service_role; do psql "$RAIZ/postgres" -qc "do \$\$ begin if not exists (select 1 from pg_roles where rolname='$r') then create role $r; end if; end \$\$" ; done
pg_restore -d "$RAIZ/restauracion_prueba" --no-owner "$DEST/portal-$SELLO.dump" 2>/dev/null || true
Q="select (select count(*) from identidad.\"user\")||'/'||(select count(*) from portal.solicitudes)||'/'||(select count(*) from portal.documentos)||'/'||(select count(*) from portal.eventos)||'/'||(select count(*) from storage.objects)"
O=$(psql "$DATABASE_URL_ADMIN" -Atc "$Q"); R=$(psql "$RAIZ/restauracion_prueba" -Atc "$Q")
echo "original usuarios/solicitudes/documentos/eventos/objetos: $O"
echo "restaurada:                                              $R"
[ "$O" = "$R" ] || { echo "LA RESTAURACIÓN NO COINCIDE"; exit 1; }
TMP=$(mktemp -d); tar -C "$TMP" -xzf "$DEST/objetos-$SELLO.tar.gz"
FALTAN=0
for k in $(psql "$RAIZ/restauracion_prueba" -Atc "select storage_key from portal.documentos"); do
  find "$TMP" -path "*$k*" | grep -q . || { echo "falta el objeto $k"; FALTAN=$((FALTAN+1)); }
done
rm -rf "$TMP"; psql "$RAIZ/postgres" -qc "drop database restauracion_prueba"
[ "$FALTAN" = 0 ] && echo "Restauración verificada: datos y objetos completos." || exit 1
