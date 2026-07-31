#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
PYTHON_BIN="${PYTHON_BIN:-$BACKEND_DIR/.venv/bin/python}"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Backend Python environment not found at: $PYTHON_BIN" >&2
  echo "Create it with: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi

echo "Resetting local SQLite database and local media directory."
rm -f "$BACKEND_DIR/db.sqlite3"
rm -rf "$BACKEND_DIR/media"
mkdir -p "$BACKEND_DIR/media"

cd "$BACKEND_DIR"

APP_ENV=development DEBUG=True "$PYTHON_BIN" manage.py migrate
APP_ENV=development DEBUG=True "$PYTHON_BIN" manage.py seed_help_categories

if [ "${CREATE_LOCAL_ADMIN:-false}" = "true" ]; then
  if [ -z "${SUPERUSER_PASSWORD:-}" ]; then
    echo "CREATE_LOCAL_ADMIN=true requires SUPERUSER_PASSWORD." >&2
    exit 1
  fi

  APP_ENV=development DEBUG=True "$PYTHON_BIN" manage.py create_superuser \
    --email "${SUPERUSER_EMAIL:-admin@carefree.local}" \
    --password "$SUPERUSER_PASSWORD" \
    --first-name "${SUPERUSER_FIRST_NAME:-Admin}" \
    --last-name "${SUPERUSER_LAST_NAME:-User}"
fi

echo "Local backend reset complete."
