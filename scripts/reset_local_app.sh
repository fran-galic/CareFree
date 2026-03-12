#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
DB_FILE="$BACKEND_DIR/db.sqlite3"
MEDIA_DIR="$BACKEND_DIR/media"

SUPERUSER_EMAIL="${SUPERUSER_EMAIL:-admin@carefree.com}"
SUPERUSER_PASSWORD="${SUPERUSER_PASSWORD:-admin123}"
SUPERUSER_FIRST_NAME="${SUPERUSER_FIRST_NAME:-Admin}"
SUPERUSER_LAST_NAME="${SUPERUSER_LAST_NAME:-User}"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Nedostaje virtualno okruzenje: $VENV_PYTHON"
  echo "Prvo kreiraj/aktiviraj backend .venv i instaliraj dependencies."
  exit 1
fi

cd "$BACKEND_DIR"

echo "Resetiram lokalnu CareFree aplikaciju na pocetno stanje..."

if [[ -f "$DB_FILE" ]]; then
  rm -f "$DB_FILE"
  echo "Obrisana baza: $DB_FILE"
else
  echo "Baza nije postojala: $DB_FILE"
fi

if [[ -d "$MEDIA_DIR" ]]; then
  rm -rf "$MEDIA_DIR"
  echo "Obrisan lokalni media direktorij: $MEDIA_DIR"
fi

echo "Pokrecem migracije..."
"$VENV_PYTHON" manage.py migrate

echo "Seedam kategorije..."
"$VENV_PYTHON" manage.py seed_help_categories --force

echo "Kreiram default superusera..."
"$VENV_PYTHON" manage.py create_superuser \
  --email "$SUPERUSER_EMAIL" \
  --password "$SUPERUSER_PASSWORD" \
  --first-name "$SUPERUSER_FIRST_NAME" \
  --last-name "$SUPERUSER_LAST_NAME"

echo
echo "Reset je gotov."
echo "Superuser login:"
echo "  Email: $SUPERUSER_EMAIL"
echo "  Password: $SUPERUSER_PASSWORD"
