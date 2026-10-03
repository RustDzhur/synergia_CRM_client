#!/bin/sh
set -e
# dsh web only accepts 127.0.0.1 or 0.0.0.0 (and the CLI refuses 0.0.0.0).
HOST="${DSH_HOST:-127.0.0.1}"
TRUST=""
if [ -n "$DSH_TRUSTED_HOSTS" ]; then
  for h in $DSH_TRUSTED_HOSTS; do TRUST="$TRUST --trusted-host $h"; done
fi
echo "dsh web: bind=${HOST}:${DSH_PORT:-3080} trusted=[$DSH_TRUSTED_HOSTS]"
exec dsh web --no-open --host "$HOST" --port "${DSH_PORT:-3080}" $TRUST "$@"
