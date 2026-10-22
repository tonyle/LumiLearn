#!/usr/bin/env bash
set -euo pipefail
source_dir="${1:?Usage: scripts/restore.sh BACKUP_DIRECTORY}"
test -f "$source_dir/database.dump" && test -f "$source_dir/uploads.tar.gz"
echo "Restore overwrites the current LumiLearn database and upload volume. Set CONFIRM_RESTORE=yes to continue."
[[ "${CONFIRM_RESTORE:-}" == "yes" ]] || exit 2
docker compose exec -T db pg_restore --clean --if-exists -U "${POSTGRES_USER:-lumilearn}" -d "${POSTGRES_DB:-lumilearn}" < "$source_dir/database.dump"
docker compose run --rm --no-deps -v "$PWD/$source_dir:/backup:ro" app sh -c 'find /app/data/uploads -mindepth 1 -maxdepth 1 -delete && tar -xzf /backup/uploads.tar.gz -C /app/data/uploads'
echo "Restore complete."
