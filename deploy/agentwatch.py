#!/usr/bin/env python3
"""Сторож агентов Harness: запускается cron каждую минуту и сообщает платформе (POST /api/office/heartbeat), когда агент последний раз что-то делал.
По этим сигналам робот платформы в Робот-офисе (SEO-агент — «Sven») сидит за компьютером «в работе» или отдыхает.
Что считается активностью: самое свежее изменение любого файла в рабочей папке агента внутри контейнера Harness (журнал, вывод, правки в клоне сайта).
Подпись над головой робота — последняя строка журнала агента (log.md / loop.log); похожее на ключи вырезается и на сервере, и на сайте.
Секрет берётся из CRON_SECRET в deploy/.env (как у errorwatch.py); адрес — SITE_URL или http://127.0.0.1:3210. Проверка без отправки: DRY=1 python3 agentwatch.py
"""
import datetime, json, os, re, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.environ.get("SITE_URL", "http://127.0.0.1:3210")
CONTAINER = os.environ.get("HARNESS_CONTAINER", "dsh")
AGENTS = {"seo-agent": "log.md", "article-writer": "log.md", "mail-sorter": "loop.log"}
SKIP = "-not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.tools/*' -not -path '*/.typecheck/*' -not -path '*/.next/*'"


def secret():
    for env in (os.path.join(HERE, ".env"), os.path.join(HERE, "vps", ".env")):
        try:
            for line in open(env, encoding="utf8"):
                if line.startswith("CRON_SECRET="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
        except OSError:
            pass
    return os.environ.get("CRON_SECRET", "")


def sh(script, timeout=20):
    try:
        return subprocess.run(["docker", "exec", CONTAINER, "sh", "-c", script], capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


def post(payload, key):
    if os.environ.get("DRY"):
        print("WOULD SEND:", json.dumps(payload, ensure_ascii=False))
        return True
    req = urllib.request.Request(SITE + "/api/office/heartbeat", data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
    try:
        urllib.request.urlopen(req, timeout=20).read()
        return True
    except Exception as e:
        print("post failed:", e, file=sys.stderr)
        return False


def main():
    key = secret()
    if not key:
        print("CRON_SECRET not found in deploy/.env", file=sys.stderr)
        return 1
    for agent, log in AGENTS.items():
        base = f"/workspace/{agent}"
        newest = sh(f"find {base} -type f {SKIP} -printf '%T@\\n' 2>/dev/null | sort -nr | head -1").strip()
        if not newest:
            continue  # папки агента нет — это не наш случай
        try:
            ts = datetime.datetime.fromtimestamp(float(newest), datetime.timezone.utc).isoformat()
        except ValueError:
            continue
        lines = [l.strip() for l in sh(f"tail -n 8 {base}/{log} 2>/dev/null").splitlines() if l.strip()]
        note = re.sub(r"^[#>*\-\s`|]+", "", lines[-1])[:140] if lines else ""
        post({"agent": agent, "lastActivity": ts, "note": note}, key)
    return 0


sys.exit(main())
