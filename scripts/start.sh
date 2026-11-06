#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
lan_url="$(bash scripts/check-lan.sh --url)"
# A private proxy secret distinguishes Caddy's HTTPS forwarding from forged headers.
mkdir -p data/caddy data/certificates
if [[ ! -s data/caddy/proxy-secret ]]; then
  (umask 077; node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))' > data/caddy/proxy-secret)
fi
chmod 600 data/caddy/proxy-secret
export INTERNAL_PROXY_SECRET
INTERNAL_PROXY_SECRET="$(cat data/caddy/proxy-secret)"
export LUMI_LAN_HOST IPAD_APP_URL
LUMI_LAN_HOST="$(node -e 'process.stdout.write(new URL(process.argv[1]).hostname)' "$lan_url")"
IPAD_APP_URL="https://${LUMI_LAN_HOST}:3443"
node scripts/save-lan-url.mjs
echo "iPad address: $IPAD_APP_URL"
# Export host address: a Docker container sees its own network, not host Wi-Fi.
docker compose up -d --wait "$@"
bash scripts/export-local-ca.sh
echo "Open Parent → Settings to scan the iPad QR code. See docs/ipad-https.md to trust the local certificate."
