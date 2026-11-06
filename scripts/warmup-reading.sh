#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Optional repair command; normal app startup prepares models automatically.
docker compose run --rm --no-deps reading-model-setup
