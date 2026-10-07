#!/usr/bin/env bash
# Ежедневный бэкап: дамп базы + архив файлов, хранение 14 дней. Если настроен rclone-remote (BACKUP_REMOTE),
# копия уходит ещё и наружу — бэкап на том же диске не защищает от потери сервера.
#
# Cron (от пользователя, имеющего доступ к docker):
#   30 2 * * * /home/<пользователь>/synergia_CRM_client/deploy/vps/backup.sh >> ~/firmspace-backup.log 2>&1
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
DIR="${BACKUP_DIR:-$HOME/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DIR"

docker compose exec -T postgres pg_dump -U crm_app -Fc crm > "$DIR/crm-$STAMP.dump"
docker run --rm -v firmspace_crm_storage:/data:ro alpine:3 tar czf - -C /data . > "$DIR/storage-$STAMP.tgz"

find "$DIR" -type f \( -name 'crm-*.dump' -o -name 'storage-*.tgz' \) -mtime +14 -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$DIR" "$BACKUP_REMOTE" --include "*-$STAMP.*"
fi
echo "$(date -Is) бэкап $STAMP готов"
