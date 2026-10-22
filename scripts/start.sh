#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export IPAD_APP_URL
IPAD_APP_URL="$(bash scripts/check-lan.sh --url)"
node scripts/save-lan-url.mjs
echo "iPad address: $IPAD_APP_URL"
# Export the host address: a Docker container sees its own network, not host Wi-Fi.
docker compose up -d --wait "$@"
echo "Open Parent → Settings to scan the iPad QR code."
