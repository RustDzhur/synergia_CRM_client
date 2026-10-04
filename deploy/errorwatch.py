#!/usr/bin/env python3
"""Сторож сервера: запускается cron каждые 5 минут и сообщает платформе (POST /api/errors/ingest) о том, что иначе осталось бы незамеченным:
  • строки ERROR / FATAL / PANIC / Exception в журналах контейнеров (postgres, redis, minio, omniroute, tts, speaches, Harness…);
  • перезапуск контейнера (с кодом выхода, признаком нехватки памяти и последними строками журнала), остановленный или «unhealthy» контейнер;
  • заполненный диск (>90%).
Дальше платформа сама объясняет ошибку человеческим языком и шлёт в Telegram (lib/errorHub.ts). Журнал самого сайта (firmspace-crm) не читаем —
его ошибки уже ловит сам сайт; здесь для него только перезапуски и состояние.
Секрет берётся из CRON_SECRET в deploy/.env (тот же, что у cron-маршрутов); адрес — SITE_URL или http://127.0.0.1:3210.
"""
import json, os, re, shutil, subprocess, sys, urllib.request

HOME = os.path.expanduser("~")
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HOME, ".errorwatch.json")
SITE = os.environ.get("SITE_URL", "http://127.0.0.1:3210")
WINDOW = os.environ.get("ERRORWATCH_WINDOW", "6m")  # чуть больше интервала cron: повторы отсекает платформа по отпечатку
SKIP_LOGS = {"firmspace-crm"}
ERR = re.compile(r"\b(ERROR|FATAL|PANIC|CRITICAL|Traceback|UnhandledPromiseRejection)\b|(?i:ECONNREFUSED|out of memory|no space left on device|segmentation fault)")
NOISE = re.compile(r"duplicate key value violates unique constraint|canceling statement due to user request|could not receive data from client: Connection reset|\"level\":\"info\"|level=info|0 errors", re.I)


def secret():
    try:
        for line in open(os.path.join(HERE, ".env"), encoding="utf8"):
            if line.startswith("CRON_SECRET="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return os.environ.get("CRON_SECRET", "")


def run(cmd, timeout=30):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


def post(payload):
    if os.environ.get("DRY"):  # проверка без отправки: ERRORWATCH_DRY=1 python3 errorwatch.py
        print("WOULD SEND:", json.dumps(payload, ensure_ascii=False)[:400])
        return True
    req = urllib.request.Request(SITE + "/api/errors/ingest", data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY})
    try:
        urllib.request.urlopen(req, timeout=20).read()
        return True
    except Exception as e:  # сайт может быть недоступен — тогда отчёт уйдёт на следующем запуске (состояние не обновляется)
        print("post failed:", e, file=sys.stderr)
        return False


KEY = secret()
if not KEY:
    print("CRON_SECRET not found in deploy/.env", file=sys.stderr)
    sys.exit(1)

try:
    state = json.load(open(STATE))
except Exception:
    state = {}
sent = 0
LIMIT = 15

rows = [l.split("|") for l in run(["docker", "ps", "-a", "--format", "{{.Names}}|{{.State}}|{{.Status}}"]).splitlines() if "|" in l]
for name, st, status in rows:
    if sent >= LIMIT:
        break
    info = run(["docker", "inspect", "-f", "{{.State.StartedAt}}|{{.State.ExitCode}}|{{.State.OOMKilled}}|{{.RestartCount}}", name]).strip().split("|")
    started = info[0] if info else ""
    prev = state.get(name, {})
    # перезапуск: время старта изменилось с прошлой проверки
    if prev.get("started") and started and started != prev["started"] and st == "running":
        tail = run(["docker", "logs", "--tail", "15", name], 20)
        oom = len(info) > 2 and info[2] == "true"
        if post({"name": name, "message": f"Контейнер {name} был перезапущен" + (" (убит из-за нехватки памяти)" if oom else ""), "lines": tail.splitlines()[-12:]}):
            sent += 1
    elif st != "running" and prev.get("state") == "running":
        if post({"name": name, "message": f"Контейнер {name} остановился ({status})", "lines": run(["docker", "logs", "--tail", "12", name], 20).splitlines()[-12:]}):
            sent += 1
    if "unhealthy" in status and prev.get("unhealthy") != started:
        if post({"name": name, "message": f"Контейнер {name} помечен как нездоровый (unhealthy)", "lines": [status]}):
            sent += 1
    state[name] = {"started": started, "state": st, "unhealthy": started if "unhealthy" in status else ""}

    if st != "running" or name in SKIP_LOGS:
        continue
    lines = [l for l in (run(["docker", "logs", "--since", WINDOW, name], 30)).splitlines() if ERR.search(l) and not NOISE.search(l)]
    if lines and sent < LIMIT:
        # одно сообщение на контейнер за запуск: первая строка — заголовок, остальные — контекст
        if post({"name": name, "message": lines[0][:500], "lines": lines[:10]}):
            sent += 1

# диск
try:
    total, used, _ = shutil.disk_usage("/")
    pct = round(used * 100 / total)
    if pct >= 90 and state.get("_disk") != "high":
        if post({"name": "диск", "source": "server", "message": f"Диск сервера заполнен на {pct}% — ENOSPC", "lines": [f"использовано {used // 2**30} из {total // 2**30} ГБ"]}):
            state["_disk"] = "high"
    elif pct < 85:
        state["_disk"] = ""
except Exception:
    pass

json.dump(state, open(STATE, "w"))
