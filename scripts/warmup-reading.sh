#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# This one-off model installer has outbound internet; inference stays internal.
docker compose --profile model-setup run --rm --no-deps reading-model-setup
