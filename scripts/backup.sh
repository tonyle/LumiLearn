#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
destination="${1:-$PWD/backups}"
mkdir -p "$destination"
destination="$(cd "$destination" && pwd -P)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$destination/$stamp"
mkdir "$backup_dir"
# Use credentials already configured inside the container; never print secrets.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
docker compose exec -T db pg_restore --list < "$backup_dir/database.dump" > "$backup_dir/database.contents"
docker compose run --rm --no-deps -T --entrypoint tar app -czf - -C /app/data/uploads . > "$backup_dir/uploads.tar.gz"
tar -tzf "$backup_dir/uploads.tar.gz" > "$backup_dir/uploads.contents"
(cd "$backup_dir" && shasum -a 256 database.dump uploads.tar.gz > SHA256SUMS)
printf '%s\n' 'Complete database + uploads backup. Keep this folder private.' > "$backup_dir/COMPLETE"
echo "Backup created and verified: $backup_dir"
