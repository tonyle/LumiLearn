#!/usr/bin/env bash
set -euo pipefail
base="${APP_URL:-http://localhost:3000}"
curl --fail --silent --show-error "$base/api/health/live" >/dev/null
curl --fail --silent --show-error "$base/api/health/ready" >/dev/null
echo "LumiLearn live and ready at $base"
