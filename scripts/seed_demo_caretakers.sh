#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

cd "$BACKEND_DIR"

B2_KEY_ID="" \
B2_APPLICATION_KEY="" \
B2_BUCKET_NAME="" \
B2_ENDPOINT="" \
B2_REGION="" \
./.venv/bin/python manage.py seed_demo_caretakers "$@"
