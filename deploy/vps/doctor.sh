#!/usr/bin/env bash
# Сквозная проверка голоса и ИИ на сервере одной командой: ~/crm-duplicate/deploy/vps/doctor.sh
# Показывает состояние контейнеров, связь с OpenAI (scripts/check-ai.mjs) и проверку чата, распознавания и озвучки тем же кодом, что у пользователей.
cd "$(dirname "$0")" || exit 1
echo "══ Контейнеры ══"
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -E 'firmspace|^tts|speaches|caddy' | sort
echo
echo "══ Связь с OpenAI ══"
docker exec firmspace-crm node scripts/check-ai.mjs 2>&1
echo
echo "══ Сквозная проверка приложения ══"
docker exec firmspace-crm node -e '
const { createHash } = require("node:crypto");
const key = createHash("sha256").update("doctor:" + (process.env.JWT_SECRET || "")).digest("hex").slice(0, 32);
fetch("http://127.0.0.1:3000/api/internal/doctor", { headers: { "x-doctor-key": key }, signal: AbortSignal.timeout(90000) })
  .then(async (r) => {
    if (r.status === 404) return console.log("Сайт ещё на старой версии (нет /api/internal/doctor): git pull && ./deploy/vps/up.sh");
    const j = await r.json();
    if (r.status !== 200) return console.log("Ответ " + r.status + ": " + JSON.stringify(j));
    const mark = (s) => (s.ok ? "✓" : "✗") + " " + s.note + " (" + s.ms + " мс)";
    console.log("Провайдер:", j.info.provider, "| кабинет админа:", JSON.stringify(j.info.cabinetOverride));
    console.log("Чат:           " + mark(j.chat));
    console.log("Чат (голос):   " + mark(j.voiceChat));
    console.log("Распознавание: " + mark(j.stt));
    console.log("Озвучка:       " + mark(j.tts));
  })
  .catch((e) => console.log("Не достучался до сайта внутри контейнера: " + e.message));
'
echo
echo "══ Последние ошибки сайта ══"
docker logs --since 10m firmspace-crm 2>&1 | grep -iE "\[ai\]|transcribe|tts |error" | tail -15
