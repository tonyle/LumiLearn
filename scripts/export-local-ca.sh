#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source_path="data/caddy/data/caddy/pki/authorities/local/root.crt"
for attempt in {1..10}; do
  [[ -f "$source_path" ]] && break
  sleep 1
done
if [[ ! -f "$source_path" ]]; then
  echo 'Local CA is not ready. Start Caddy with bash scripts/start.sh, then retry.' >&2
  exit 1
fi
mkdir -p data/certificates
# Export only the PUBLIC certificate. Never copy root.key or the CA directory.
cp "$source_path" data/certificates/lumilearn-root.crt
chmod 644 data/certificates/lumilearn-root.crt
echo 'Public certificate: data/certificates/lumilearn-root.crt'
