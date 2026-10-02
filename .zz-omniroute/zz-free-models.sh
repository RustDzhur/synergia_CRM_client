#!/usr/bin/env bash
# Какие модели в каталоге шлюза: бесплатные (:free) и по провайдерам (префиксы).
set -uo pipefail
cd "$HOME/omniroute"
KEY="$(cat crm-key.txt)"
curl -s -m 25 http://127.0.0.1:3111/v1/models -H "Authorization: Bearer ${KEY}" > /tmp/zz-models.json
python3 - <<'PY'
import json
d = json.load(open('/tmp/zz-models.json'))
ids = [m["id"] for m in d["data"]]
print(len(ids), "models total")
print("free:", [i for i in ids if ":free" in i])
prefs = sorted(set(i.split("/")[0] for i in ids))
print("prefixes:", prefs)
PY
rm -f /tmp/zz-models.json
