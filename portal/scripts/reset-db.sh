#!/usr/bin/env bash
# Solo desarrollo local: borra y recrea la base de datos portal_dev con datos ficticios.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
case "$DATABASE_URL_ADMIN" in *127.0.0.1*|*localhost*) ;; *) echo "Solo se permite contra una base local"; exit 1;; esac
BASE=$(basename "${DATABASE_URL_ADMIN%%\?*}")
ROOT_URL="${DATABASE_URL_ADMIN%/*}/postgres"
psql "$ROOT_URL" -qc "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$BASE' and pid <> pg_backend_pid()" >/dev/null
psql "$ROOT_URL" -qc "drop database if exists $BASE" -qc "create database $BASE"
