#!/usr/bin/env bash
set -euo pipefail
destination="${1:-backups}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$destination/$stamp"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-lumilearn}" -d "${POSTGRES_DB:-lumilearn}" -Fc > "$destination/$stamp/database.dump"
docker compose run --rm --no-deps -v "$PWD/$destination/$stamp:/backup" app sh -c 'tar -czf /backup/uploads.tar.gz -C /app/data/uploads .'
chmod -R go-rwx "$destination/$stamp"
echo "Backup created at $destination/$stamp (access-controlled, not encrypted)."
