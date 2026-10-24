#!/usr/bin/env bash
# Синхронизация статей блога из CRM в новый сайт (firmspace-website).
# Работает на хосте сервера: статьи берёт из контейнера CRM (docker exec → scripts/sync-blog.mjs, NDJSON в stdout),
# раскладывает content/blog/<slug>.json по схеме сайта и картинки в public/images/blog/<slug>.jpg.
# Идемпотентно и безопасно: существующие файлы НЕ удаляются, пишутся только изменённые; картинки докачиваются,
# только если файла ещё нет. Сайт пересобирается, только если что-то изменилось.
# Cron: */30 * * * * flock -n /tmp/sync-blog.lock /home/server/crm-duplicate/deploy/vps/sync-blog.sh >> /home/server/sync-blog.log 2>&1
set -uo pipefail

SITE="${FIRMSPACE_WEBSITE_DIR:-/home/server/firmspace-website}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${CRON_ENV_FILE:-/home/server/crm-duplicate/deploy/vps/.env}"
BLOG="$SITE/content/blog"
IMG="$SITE/public/images/blog"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! docker exec firmspace-crm node scripts/sync-blog.mjs > "$TMP/posts.ndjson"; then
    echo "$(date -Is) sync-blog: CRM-контейнер не ответил (идёт выкладка?) — пропускаем" >&2
    exit 0
fi

# Python раскладывает файлы и картинки; печатает число изменений (на stdout), детали — в stderr
CHANGED="$(python3 - "$TMP" "$BLOG" "$IMG" <<'PY'
import json, os, subprocess, sys, urllib.request
tmp, blog_dir, img_dir = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(blog_dir, exist_ok=True)
os.makedirs(img_dir, exist_ok=True)
changed = written = images = missing = 0
for line in open(os.path.join(tmp, "posts.ndjson"), encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        item = json.loads(line)
    except ValueError:
        continue
    slug, data, src = item.get("slug", ""), item.get("data"), item.get("src", "")
    if not slug or not isinstance(data, dict):
        continue
    path = os.path.join(blog_dir, slug + ".json")
    # ru-переводы статей живут только на сайте (CRM их не хранит): при перезаписи
    # из CRM сохраняем уже переведённые поля, иначе каждый sync стирал бы перевод.
    old_text = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old_text:
        try:
            prev = json.loads(old_text)
            if isinstance(prev.get("title"), dict) and prev["title"].get("ru"):
                data.setdefault("title", {})["ru"] = prev["title"]["ru"]
            if isinstance(prev.get("excerpt"), dict) and prev["excerpt"].get("ru"):
                data.setdefault("excerpt", {})["ru"] = prev["excerpt"]["ru"]
            prev_body = prev.get("body") if isinstance(prev.get("body"), list) else []
            body = data.get("body") if isinstance(data.get("body"), list) else []
            for i, paragraph in enumerate(body):
                if i < len(prev_body) and isinstance(paragraph, dict) and isinstance(prev_body[i], dict):
                    ru_value = prev_body[i].get("ru")
                    if ru_value:
                        paragraph["ru"] = ru_value
        except ValueError:
            pass
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    old = old_text
    if old != text:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        written += 1
        changed += 1
    target = os.path.join(img_dir, slug + ".jpg")
    if os.path.exists(target):
        continue
    made = False
    if src.startswith("/images/blog/"):
        name = os.path.basename(src) or ""
        if name:
            # сперва public/images/blog (старые картинки), затем том /data/storage (копия cron-blog переживает пересоздание контейнера)
            for csrc in (f"firmspace-crm:/app/public/images/blog/{name}", f"firmspace-crm:/data/storage/blog-images/{name}"):
                r = subprocess.run(["docker", "cp", csrc, target], capture_output=True)
                if r.returncode == 0:
                    made = True
                    break
    elif src.startswith("http://") or src.startswith("https://"):
        try:
            urllib.request.urlretrieve(src, target)
            made = True
        except Exception:
            made = False
    if made:
        images += 1
        changed += 1
    else:
        missing += 1
print(changed)
print(f"written={written} images={images} missing_src={missing}", file=sys.stderr)
PY
)"

echo "$(date -Is) sync-blog: изменено файлов: ${CHANGED:-?}"
if [ -f /home/server/translate-blog.js ]; then
  SECRET_T=$(sed -n "s/^CRON_SECRET=//p" "$ENV_FILE" 2>/dev/null | head -1 | tr -d "\"")
  TRANSLATED=$(docker run --rm --network host -e CRON_SECRET="$SECRET_T" \
    -v /home/server/translate-blog.js:/translate-blog.js:ro \
    -v "$SITE/content/blog:/blog" \
    -e BLOG_DIR=/blog firmspace-crm:latest node /translate-blog.js 2>&1 || true)
  echo "$TRANSLATED" >> /home/server/translate-blog.log
  if echo "$TRANSLATED" | grep -qE "переведено [1-9]"; then CHANGED=$((CHANGED + 1)); fi
fi
if [ "${CHANGED:-0}" -gt 0 ] 2>/dev/null; then
    echo "sync-blog: пересобираю сайт (content/ попадает в образ на сборке)"
    (cd "$SITE/deploy" && docker compose build web && docker compose up -d web)
fi
