#!/usr/bin/env node
// Проверка связи с OpenAI изнутри контейнера: docker exec firmspace-crm node scripts/check-ai.mjs
// Ключ не печатается: только его длина и первые символы. Показывает, какой адрес реально используется, доходит ли сеть, принимает ли OpenAI ключ,
// отвечает ли чат и доступна ли модель распознавания речи.
const GATEWAY = /omniroute|omiroute|openrouter/i;
const key = (process.env.OPENAI_API_KEY || "").trim();
const rawUrl = (process.env.OPENAI_API_URL || "").trim();
const base = (rawUrl && !GATEWAY.test(rawUrl) ? rawUrl : "https://api.openai.com/v1").replace(/\/+$/, "");
const line = (ok, text) => console.log(`${ok ? "✓" : "✗"} ${text}`);

console.log("— Настройки в контейнере —");
line(!!key, key ? `OPENAI_API_KEY есть (длина ${key.length}, начало «${key.slice(0, 5)}…»)` : "OPENAI_API_KEY пуст — контейнер не получил ключ (файл .env не тот или контейнер не пересоздан командой up -d)");
if (key && !key.startsWith("sk-")) line(false, "ключ OpenAI начинается с «sk-»; у вас другое начало — возможно, это ключ шлюза или в начале лишние символы/кавычки");
if (/["'\s]/.test(process.env.OPENAI_API_KEY || "")) line(false, "в значении ключа есть кавычки или пробелы — уберите их в .env");
if (rawUrl) line(!GATEWAY.test(rawUrl), `OPENAI_API_URL=${rawUrl}${GATEWAY.test(rawUrl) ? " — шлюз, игнорируется, используется api.openai.com" : ""}`);
console.log(`Используемый адрес: ${base}`);
if (!key) process.exit(2);

const call = async (path, init = {}) => {
  try {
    const res = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    let msg = ""; try { msg = JSON.parse(text)?.error?.message || ""; } catch { /* не JSON */ }
    return { status: res.status, msg: msg.replace(key, "•••").slice(0, 200) };
  } catch (e) {
    return { status: 0, msg: `${e?.cause?.code || e?.name}: ${e?.cause?.message || e?.message}`.slice(0, 200) };
  }
};

console.log("— Связь —");
const models = await call("/models");
if (models.status === 0) line(false, `нет соединения с ${base}: ${models.msg} (контейнер сайта должен быть в сети с выходом в интернет — firmspace_ai)`);
else if (models.status === 401) line(false, `OpenAI не принял ключ (401): ${models.msg}`);
else if (models.status === 200) line(true, "ключ принят");
else line(false, `ответ ${models.status}: ${models.msg}`);

if (models.status === 200) {
  // Чат, как в приложении: если заданы AI_API_URL и AI_API_KEY, он идёт напрямую к тому провайдеру (например, DeepSeek), иначе — к OpenAI
  const direct = process.env.AI_API_URL && process.env.AI_API_KEY;
  const chatBase = direct ? process.env.AI_API_URL.trim().replace(/\/+$/, "") : base;
  const chatKey = direct ? process.env.AI_API_KEY.trim() : key;
  const raw = process.env.AI_MODEL || "gpt-4.1-mini";
  const model = direct || /^(gpt-|o\d|chatgpt-)/.test(raw) ? raw : "gpt-4.1-mini";
  console.log(`Чат: ${direct ? chatBase + " (прямой провайдер AI_API_URL)" : "OpenAI"}, модель ${model}${model !== raw ? ` (AI_MODEL=${raw} — не модель OpenAI, приложение подставит ${model})` : ""}`);
  let chat;
  try {
    const r = await fetch(`${chatBase}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chatKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: "user", content: "ping" }] }), signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    chat = { status: r.status, msg: String(j?.error?.message || "").replace(chatKey, "•••").slice(0, 200) };
  } catch (e) { chat = { status: 0, msg: String(e?.cause?.code || e?.message) }; }
  line(chat.status === 200, chat.status === 200 ? "чат отвечает" : `чат: ответ ${chat.status} ${chat.msg}${chat.status === 429 ? " — на балансе нет денег или превышен лимит" : ""}`);
  const ids = (await (await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })).json().catch(() => ({}))).data?.map((m) => m.id) ?? [];
  for (const m of ["whisper-1", "gpt-4o-transcribe"]) line(ids.includes(m), `модель распознавания речи ${m} ${ids.includes(m) ? "доступна" : "недоступна для этого ключа"}`);
}

if (process.env.ELEVENLABS_API_KEY) {
  console.log("— ElevenLabs (распознавание узбекского) —");
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY.trim() }, signal: AbortSignal.timeout(20000) });
    line(r.ok, r.ok ? "ключ ElevenLabs принят" : `ElevenLabs ответил ${r.status}${r.status === 401 ? " — ключ не подходит" : ""}`);
  } catch (e) { line(false, `нет соединения с ElevenLabs: ${e?.cause?.code || e?.message}`); }
}
