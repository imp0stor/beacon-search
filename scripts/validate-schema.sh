#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$PROJECT_DIR/prisma/schema.prisma"
TMP_DIFF="$(mktemp /tmp/beacon-schema-diff.XXXXXX.sql)"

cleanup() {
  rm -f "$TMP_DIFF"
}
trap cleanup EXIT

cd "$PROJECT_DIR"

# Load environment variables from .env when present
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "❌ Prisma schema file not found: $SCHEMA_FILE"
  echo "Create/update it first (e.g., 'npx prisma db pull --schema prisma/schema.prisma')."
  exit 1
fi

DB_URL="${BEACON_SCHEMA_DB_URL:-}"

if [[ -z "$DB_URL" && -n "${POSTGRES_PASSWORD:-}" ]]; then
  DB_URL="postgresql://${POSTGRES_USER:-beacon}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-beacon_search}"
fi

if [[ -z "$DB_URL" ]]; then
  DB_URL="${DATABASE_URL:-}"
fi

if [[ -z "$DB_URL" ]]; then
  echo "❌ No database connection URL available."
  echo "Set BEACON_SCHEMA_DB_URL, POSTGRES_* variables, or DATABASE_URL."
  exit 1
fi

echo "🔍 Validating Prisma schema against live database..."

# Compare desired datamodel against live database schema
npx prisma@5.22.0 migrate diff \
  --from-schema-datamodel "$SCHEMA_FILE" \
  --to-url "$DB_URL" \
  --script > "$TMP_DIFF"

# Keep only actionable SQL (ignore comments/whitespace)
ACTIONABLE_DIFF="$(sed '/^--/d;/^\/\*/d;/^\s*\*/d;/^\*\//d;/^\s*$/d' "$TMP_DIFF" || true)"

if [[ -n "$ACTIONABLE_DIFF" ]]; then
  echo "❌ Schema mismatch detected!"
  echo "Differences between prisma/schema.prisma and the running database:"
  cat "$TMP_DIFF"
  exit 1
fi

echo "✅ Schema is valid"
exit 0
