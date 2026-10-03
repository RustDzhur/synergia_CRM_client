#!/usr/bin/env bash
# Автоматическая выкладка на сервер без Vercel и без входящих соединений (у подключения DS-Lite
# их нет): скрипт сам опрашивает GitHub. Раз в пару минут (см. cron) он смотрит ветку выкладки
# и, если появился новый коммит с зелёным CI, пересобирает и перезапускает контейнер.
#
# Настройки — переменными окружения или в deploy/autodeploy.env:
#   DEPLOY_BRANCH  ветка выкладки (по умолчанию main — единственная основная ветка проекта)
#   REPO_SLUG      owner/repo на GitHub (нужен для проверки статуса CI)
#   REQUIRE_CI     1 — выкладывать только зелёный CI (по умолчанию), 0 — выкладывать всегда
set -uo pipefail

HOME_DIR="${HOME:-/home/server}"
[ -f "$HOME_DIR/crm-duplicate/deploy/autodeploy.env" ] && . "$HOME_DIR/crm-duplicate/deploy/autodeploy.env"

REPO_DIR="${REPO_DIR:-$HOME_DIR/crm-duplicate}"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"
REPO_SLUG="${REPO_SLUG:-RustDzhur/synergia_CRM_client}"
REQUIRE_CI="${REQUIRE_CI:-1}"
STATE="$HOME_DIR/.crm-autodeploy.state"
LOG="$HOME_DIR/crm-autodeploy.log"
CI_RECHECK_SECONDS="${CI_RECHECK_SECONDS:-180}"

log() { printf '%s %s\n' "$(date -Is)" "$*" >> "$LOG"; }

cd "$REPO_DIR" || { log "нет каталога $REPO_DIR"; exit 1; }

git fetch --quiet "$REMOTE" "$BRANCH" || { log "git fetch не удался"; exit 1; }
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "$REMOTE/$BRANCH")"
# Метка «этот коммит реально запущен»: пишется только после успешной сборки. Без неё авария посреди сборки (03.10.2026 упала ВМ) оставляла
# репозиторий на новом коммите, скрипт видел «локальный = удалённый» и больше никогда не пересобирал контейнер.
DEPLOYED_FILE="$HOME_DIR/.crm-deployed"
RETRY=0
if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
    DEPLOYED_SHA="$(cat "$DEPLOYED_FILE" 2>/dev/null || true)"
    [ -z "$DEPLOYED_SHA" ] && { echo "$LOCAL_SHA" > "$DEPLOYED_FILE"; exit 0; }  # первая версия скрипта: считаем текущий коммит запущенным
    [ "$DEPLOYED_SHA" = "$LOCAL_SHA" ] && exit 0
    # коммит скачан, но не собран: CI для него уже был зелёным — пересобираем, но не больше 3 попыток подряд (иначе поломанная сборка крутилась бы каждые 2 минуты)
    TRIES="$(cat "$HOME_DIR/.crm-deploy-tries" 2>/dev/null || echo 0)"
    if [ "$TRIES" -ge 3 ]; then exit 0; fi
    echo $((TRIES + 1)) > "$HOME_DIR/.crm-deploy-tries"
    RETRY=1
fi

# ── ждём зелёный CI нового коммита (API GitHub опрашиваем не чаще раза в CI_RECHECK_SECONDS) ──
if [ "$REQUIRE_CI" = "1" ] && [ "$RETRY" = "0" ]; then
    read -r CACHED_SHA CACHED_STATUS CACHED_AT < <(cat "$STATE" 2>/dev/null || echo "none none 0")
    NOW="$(date +%s)"
    if [ "$CACHED_SHA" != "$REMOTE_SHA" ] || { [ "$CACHED_STATUS" = "pending" ] && [ $((NOW - ${CACHED_AT:-0})) -ge "$CI_RECHECK_SECONDS" ]; }; then
        STATUS="$(curl -s -m 20 -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/$REPO_SLUG/commits/$REMOTE_SHA/check-runs" |
            python3 -c "
import sys, json
try:
    runs = json.load(sys.stdin).get('check_runs', [])
except Exception:
    print('unknown'); raise SystemExit
if not runs: print('none')
elif any(r.get('status') != 'completed' for r in runs): print('pending')
elif all(r.get('conclusion') == 'success' for r in runs): print('success')
else: print('failure')
" 2>/dev/null || echo unknown)"
        echo "$REMOTE_SHA $STATUS $NOW" > "$STATE"
        case "$STATUS" in
            pending) log "новый коммит ${REMOTE_SHA:0:7}: ждём CI"; exit 0 ;;
            failure) log "новый коммит ${REMOTE_SHA:0:7}: CI красный — выкладка пропущена"; exit 0 ;;
        esac
    else
        exit 0
    fi
fi

log "выкладываю ${REMOTE_SHA:0:7} (было ${LOCAL_SHA:0:7})"
git reset --hard --quiet "$REMOTE_SHA" || { log "git reset не удался"; exit 1; }

# Хеш коммита в .env: контейнер отдаёт его в /api/health, видно какая версия живёт
if grep -q '^DEPLOYED_COMMIT=' deploy/.env 2>/dev/null; then
    sed -i "s|^DEPLOYED_COMMIT=.*|DEPLOYED_COMMIT=$REMOTE_SHA|" deploy/.env
else
    echo "DEPLOYED_COMMIT=$REMOTE_SHA" >> deploy/.env
fi
if docker compose -f deploy/docker-compose.yml up -d --build >> "$LOG" 2>&1; then
    echo "$REMOTE_SHA" > "$DEPLOYED_FILE"; rm -f "$HOME_DIR/.crm-deploy-tries"
    log "готово: запущено в $(docker inspect -f '{{.State.StartedAt}}' firmspace-crm 2>/dev/null || echo '?')"
    # Каждая сборка оставляет слои в кэше (до 35 ГБ за пару дней) — именно они переполнили диск VM и пул Proxmox 03.10.2026.
    # Оставляем 4 ГБ кэша, чтобы следующая сборка шла быстро, остальное и «висячие» образы убираем.
    docker builder prune -f --keep-storage 4gb >> "$LOG" 2>&1 || true
    docker image prune -f >> "$LOG" 2>&1 || true
else
    log "СБОЙ сборки/запуска — смотри строки выше"
    exit 1
fi

# Естественный голос Айрис — отдельный контейнер `tts` (свой проект compose). up -d без изменений в
# конфиге ничего не перезапускает; если он не поднялся, сайт работает дальше — озвучка уйдёт на голос браузера.
# Площадка агентов (Harness): определение — deploy/agents, секреты — deploy/agents/.env (в git их нет). Без изменений в конфиге
# up -d ничего не перезапускает; сбой Harness сайт не затрагивает.
if [ -f deploy/agents/docker-compose.yml ] && [ -f deploy/agents/.env ]; then
    docker compose -p dsh -f deploy/agents/docker-compose.yml up -d >> "$LOG" 2>&1 || log "агенты: Harness не запустился (сайт работает)"
fi
if [ -f deploy/docker-compose.tts.yml ]; then
    docker compose -p tts -f deploy/docker-compose.tts.yml up -d >> "$LOG" 2>&1 || log "tts: контейнер озвучки не запустился (Айрис говорит голосом браузера)"
fi
