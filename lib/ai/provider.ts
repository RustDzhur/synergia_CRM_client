import { ProviderError, fetchProvider } from "@/lib/http";
import { aiOverrides } from "./config";

// Тонкий слой над API языковых моделей. Внутри CRM разговор — это список Msg; адаптеры переводят его в формат
// OpenAI (Chat Completions + tools) или Anthropic (Messages + tools). Ключ — только в переменных окружения сервера.
export type Msg =
    | { role: "user"; text: string }
    | { role: "assistant"; text: string; calls?: ToolCall[] }
    | { role: "tool"; callId: string; name: string; content: string };
export interface ToolCall { id: string; name: string; args: Record<string, unknown> }
export interface ToolDef { name: string; description: string; parameters: Record<string, unknown> }
export interface Reply { text: string; calls: ToolCall[] }

export type ProviderId = "anthropic" | "openai";

export function aiProvider(): ProviderId | null {
    const wanted = process.env.AI_PROVIDER;
    if (wanted === "openai" && (process.env.OPENAI_API_KEY || process.env.AI_API_KEY)) return "openai";
    if (wanted === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.OPENAI_API_KEY || process.env.AI_API_KEY) return "openai";
    return null;
}
export const aiConfigured = () => !!aiProvider();
// Шлюзы (OmniRoute, OpenRouter) отключены: владелец ушёл от них из-за нестабильного соединения для голоса. Старые значения из .env
// (адрес шлюза в OPENAI_API_URL, имена вида openrouter/openai/…) не должны ломать работу — адрес игнорируется, имя модели очищается.
const GATEWAY_HOST = /omniroute|omiroute|openrouter/i;
/** Базовый адрес OpenAI: OPENAI_API_URL, если это не отключённый шлюз (прокси или совместимый сервис остаются возможными). */
export const openaiBase = () => {
    const u = process.env.OPENAI_API_URL?.trim();
    return u && !GATEWAY_HOST.test(u) ? trim(u) : "https://api.openai.com/v1";
};
/** Имя модели из .env без шлюзового префикса; имя чужой модели шлюза (openrouter/anthropic/…) заменяется значением по умолчанию. */
const plainModel = (m: string | undefined, fallback: string, ok: RegExp = /./) => {
    if (!m) return fallback;
    const name = m.replace(/^openrouter\//, "").replace(/^openai\//, "");
    return /^openrouter\//.test(m) && !/^openrouter\/openai\//.test(m) || !ok.test(name) ? fallback : name;
};

// Модели меняются — имя всегда можно задать переменной AI_MODEL
// Если чат идёт к самому OpenAI (прямого AI_API_URL нет), имя модели обязано быть openai-шным: чужое имя из старого .env (cc/…, deepseek-…, claude-…)
// OpenAI отвергает ответом 400 «invalid model ID», и ассистент молчал бы. Тогда берётся модель по умолчанию.
export const aiModel = (p: ProviderId) =>
    plainModel(process.env.AI_MODEL, p === "anthropic" ? "claude-sonnet-5" : "gpt-4.1-mini", p === "openai" && !process.env.AI_API_URL ? /^(gpt-|o\d|chatgpt-)/ : /./);

const trim = (s: string) => s.replace(/\/+$/, "");

/** Отказ шлюза/провайдера с HTTP-кодом: по нему complete() решает, пробовать ли следующую модель. */
export class GatewayError extends ProviderError {
    constructor(message: string, public status: number, public detail = "") { super(message); }
}
// Бесплатные модели за шлюзом (OmniRoute/OpenRouter) то «не поддерживают инструменты», то «только для агентных сред», то перегружены (403/404/429/503,
// ALL_TARGETS_SKIPPED). Это не поломка сайта, а повод взять другую модель — поэтому такие отказы пробуем обойти, а не сразу показывать человеку.
const retryable = (e: unknown) =>
    (e instanceof GatewayError && ([0, 402, 403, 404, 408, 409, 425, 429, 500, 502, 503, 504].includes(e.status) || /ALL_TARGETS_SKIPPED|no endpoints|temporarily|overloaded|model.{0,40}(not|exist|found|support)/i.test(e.detail))) ||
    (e instanceof ProviderError && /timeout|timed out|aborted|fetch failed|empty answer/i.test(e.message));

async function post<T>(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 55000): Promise<T> {
    const res = await fetchProvider(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }, timeoutMs);
    const json = (await res.json().catch(() => null)) as ({ error?: { message?: string } | string } & T) | null;
    if (!res.ok || !json) {
        const detail = typeof json?.error === "string" ? json.error : json?.error?.message;
        console.warn("[ai] provider error", res.status, String(detail ?? "").slice(0, 200)); // не console.error: о цепочке запасных моделей сообщает complete(), а не каждая попытка
        throw new GatewayError(res.status === 401 ? "The AI provider rejected the API key" : res.status === 429 ? "The AI provider is busy or out of quota. Try again later." : `The AI provider returned an error (${res.status})`, res.status, String(detail ?? ""));
    }
    return json;
}

// ── OpenAI ──
// Куда ходит чат. По умолчанию — шлюз (OPENAI_API_URL + OPENAI_API_KEY, как для распознавания речи). Если заданы AI_API_URL и AI_API_KEY, чат идёт НАПРЯМУЮ
// к провайдеру (например, DeepSeek: https://api.deepseek.com/v1), а шлюз остаётся запасным путём и для распознавания речи.
const gatewayEndpoint = () => ({ url: openaiBase(), key: process.env.OPENAI_API_KEY ?? "" });
const primaryEndpoint = () => (process.env.AI_API_URL && process.env.AI_API_KEY ? { url: trim(process.env.AI_API_URL), key: process.env.AI_API_KEY } : gatewayEndpoint());
type Endpoint = { url: string; key: string };

async function openai(system: string, msgs: Msg[], tools: ToolDef[], model = aiModel("openai"), timeoutMs = 55000, ep: Endpoint = primaryEndpoint()): Promise<Reply> {
    const messages: unknown[] = [{ role: "system", content: system }];
    for (const m of msgs) {
        if (m.role === "user") messages.push({ role: "user", content: m.text });
        else if (m.role === "assistant") messages.push({ role: "assistant", content: m.text || null, ...(m.calls?.length ? { tool_calls: m.calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) });
        else messages.push({ role: "tool", tool_call_id: m.callId, content: m.content });
    }
    const j = await post<{ choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }>(
        `${ep.url}/chat/completions`,
        { Authorization: `Bearer ${ep.key}` },
        // Ограничение сверху обязательно: шлюз (OmniRoute/OpenRouter) без него считает
        // бюджет на максимум модели (~65k токенов) и отказывает при малом балансе (402).
        // Пустой список инструментов не отправляем: шлюз (OmniRoute) в ответ на tools: [] заставлял модель «вызвать инструмент», и текст приходил пустым —
        // именно так молчал «Проанализировать с помощью ИИ» в отчётах
        { model, max_tokens: 2000, messages, ...(tools.length ? { tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) } : {}) },
        timeoutMs
    );
    const msg = j.choices?.[0]?.message;
    if (!msg) throw new ProviderError("The AI provider returned an empty answer");
    return { text: msg.content ?? "", calls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: parseArgs(c.function.arguments) })) };
}

// ── Anthropic ──
async function anthropic(system: string, msgs: Msg[], tools: ToolDef[], model = aiModel("anthropic"), timeoutMs = 55000): Promise<Reply> {
    const messages: { role: "user" | "assistant"; content: unknown[] }[] = [];
    const push = (role: "user" | "assistant", block: unknown) => {
        const last = messages[messages.length - 1];
        if (last && last.role === role) last.content.push(block);
        else messages.push({ role, content: [block] });
    };
    for (const m of msgs) {
        if (m.role === "user") push("user", { type: "text", text: m.text });
        else if (m.role === "assistant") {
            if (m.text) push("assistant", { type: "text", text: m.text });
            for (const c of m.calls ?? []) push("assistant", { type: "tool_use", id: c.id, name: c.name, input: c.args });
        } else push("user", { type: "tool_result", tool_use_id: m.callId, content: m.content });
    }
    const j = await post<{ content?: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[] }>(
        `${trim(process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1")}/messages`,
        { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
        { model, max_tokens: 2000, system, messages, ...(tools.length ? { tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) } : {}) },
        timeoutMs
    );
    const blocks = j.content ?? [];
    return {
        text: blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim(),
        calls: blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id ?? "", name: b.name ?? "", args: b.input ?? {} })),
    };
}

function parseArgs(raw: string): Record<string, unknown> {
    try {
        const v = JSON.parse(raw || "{}");
        return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
        return {};
    }
}

// Быстрая модель для голосовых разговоров (AI_VOICE_MODEL): человек ждёт ответ вслух, и каждая секунда слышна.
// Не ответила — тот же запрос уходит на основную модель, так что голос не ломается из-за капризов быстрой.
export const voiceModel = () => process.env.AI_VOICE_MODEL || "";

// Запасные модели на случай, когда основная отказала (AI_FALLBACK_MODELS через запятую, например auto/best-chat,auto/pro-fast).
export const fallbackModels = () => (process.env.AI_FALLBACK_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);

/**
 * Ответ модели. Цепочка попыток: быстрая модель (если задана) → основная → запасные из AI_FALLBACK_MODELS. Отказ, который лечится другой
 * моделью (перегрузка, «нет инструментов», 403/404/429/5xx шлюза), не доходит до человека: берётся следующая. Ошибка бросается, только если
 * не вышло ни у одной; время всей цепочки ограничено, чтобы не держать запрос минутами.
 */
export async function complete(system: string, msgs: Msg[], tools: ToolDef[], opts: { model?: string } = {}): Promise<Reply> {
    const p = aiProvider();
    if (!p) throw new ProviderError("AI is not configured on this site");
    // Ключ и модель могут быть внесены в кабинете администратора платформы (lib/ai/config.ts) — они важнее переменных сервера
    const ov = await aiOverrides();
    const primary: Endpoint = ov?.apiUrl && ov.apiKey ? { url: trim(ov.apiUrl), key: ov.apiKey } : primaryEndpoint();
    const gateway = gatewayEndpoint();
    const direct = primary.url !== gateway.url || primary.key !== gateway.key; // чат идёт мимо шлюза — шлюз становится запасным путём
    const run = (model: string | undefined, timeoutMs: number, ep: Endpoint) => (p === "anthropic" ? anthropic(system, msgs, tools, model, timeoutMs) : openai(system, msgs, tools, model, timeoutMs, ep));
    const chain: { model: string | undefined; ep: Endpoint }[] = [];
    const add = (model: string | undefined, ep: Endpoint) => { if (!chain.some((c) => c.model === model && c.ep.url === ep.url)) chain.push({ model, ep }); };
    // быстрая модель голоса — модель шлюза; прямому провайдеру (DeepSeek) её имя неизвестно
    if (!direct) add(opts.model, primary);
    add(ov?.model || undefined, primary);
    for (const m of ov?.fallbacks.length ? ov.fallbacks : fallbackModels()) add(m, direct ? gateway : primary);
    const started = Date.now();
    let last: unknown;
    for (let i = 0; i < chain.length; i++) {
        const left = 58_000 - (Date.now() - started);
        if (left < 6000) break;
        try {
            return await run(chain[i].model, Math.min(i === 0 ? 40_000 : 25_000, left), chain[i].ep);
        } catch (e) {
            last = e;
            if (!retryable(e)) throw e;
            console.warn(`[ai] model ${chain[i].model ?? "default"} failed (${e instanceof Error ? e.message : e}); ${i + 1 < chain.length ? "trying the next one" : "no more models"}`);
            await new Promise((r) => setTimeout(r, 250));
        }
    }
    throw last instanceof Error ? last : new ProviderError("The AI provider is not available");
}

// ── одноразовое распознавание изображения (чек/квитанция) — без истории, без инструментов, просто system+картинка+текст → text ──
export interface ImageInput { mimeType: string; base64: string }

async function openaiVision(system: string, prompt: string, image: ImageInput): Promise<string> {
    const j = await post<{ choices?: { message?: { content?: string | null } }[] }>(
        `${openaiBase()}/chat/completions`,
        { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        {
            model: aiModel("openai"),
            max_tokens: 1000,
            messages: [
                { role: "system", content: system },
                { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }] },
            ],
        }
    );
    return j.choices?.[0]?.message?.content ?? "";
}

async function anthropicVision(system: string, prompt: string, image: ImageInput): Promise<string> {
    const j = await post<{ content?: { type: string; text?: string }[] }>(
        `${trim(process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1")}/messages`,
        { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
        {
            model: aiModel("anthropic"),
            max_tokens: 1000,
            system,
            messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } }, { type: "text", text: prompt }] }],
            tools: [],
        }
    );
    return (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
}

export async function completeVision(system: string, prompt: string, image: ImageInput): Promise<string> {
    const p = aiProvider();
    if (!p) throw new ProviderError("AI is not configured on this site");
    return p === "anthropic" ? anthropicVision(system, prompt, image) : openaiVision(system, prompt, image);
}

// ── Распознавание речи (диктовка и голосовое управление) ────────────────────────────────────────────
// У Anthropic нет распознавания аудио, поэтому серверное распознавание работает на ключе OpenAI/шлюза даже когда
// сам разговор идёт на Claude. Два пути, пробуются по очереди:
//  1. облачный — OpenAI (OPENAI_API_KEY): whisper-1, для узбекского gpt-4o-transcribe. Модель меняется AI_VOICE_STT_MODEL.
//  2. локальный Whisper (TRANSCRIBE_API_URL, speaches) — запасной: бесплатный и закрытый от внешнего мира, но на
//     процессоре без AVX разбирает 4 секунды речи 12–25 секунд, для разговора в реальном времени он слишком медленный.
//     STT_LOCAL_FIRST=1 ставит его первым (если у сервера есть GPU или современный процессор).
// Браузерное распознавание (SpeechRecognition) ключей не требует вовсе — сервер нужен остальным браузерам.
export const sttConfigured = () => !!process.env.OPENAI_API_KEY || !!process.env.TRANSCRIBE_API_URL || !!process.env.ELEVENLABS_API_KEY;
// Модель локального Whisper — HF-имя (speaches/faster-whisper): Systran/faster-whisper-small
export const sttModel = () => process.env.AI_TRANSCRIBE_MODEL || "whisper-1";
export const cloudSttModel = () => plainModel(process.env.AI_VOICE_STT_MODEL, "whisper-1", /^(whisper-1|gpt-4o)/);

// Расширение для имени файла: провайдеру оно помогает понять формат записи
const AUDIO_EXT: Record<string, string> = {
    "audio/webm": "webm", "video/webm": "webm", "audio/ogg": "ogg", "audio/opus": "ogg", "application/ogg": "ogg", "audio/mp4": "mp4", "video/mp4": "mp4",
    "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
};

// Whisper на тишине и шуме «досочиняет» фразы из субтитров своих обучающих видео. Такие ответы голосовое
// управление отбрасывает, иначе шум в офисе превращался бы в команды.
const PHANTOM = [
    /субтитры\s+(сделал|создал|подготовил|делал)/i, /редактор\s+субтитров/i, /корректор\s+[а-яё.]+/i, /продолжение\s+следует/i,
    /спасибо\s+за\s+(просмотр|внимание)/i, /до\s+новых\s+встреч/i, /подписывайтесь\s+на\s+канал/i, /дякую\s+за\s+перегляд/i,
    /субтитри\s+(зробив|створив)/i, /thanks?\s+for\s+watching/i, /thank\s+you\s+for\s+watching/i, /subtitles?\s+by/i,
    /untertitel(ung)?\s+(von|der|im\s+auftrag)/i, /vielen\s+dank\s+f(ü|u)r\s+(ihre|eure|die)\s+aufmerksamkeit/i, /amara\.org/i,
];
export function isPhantomTranscript(text: string): boolean {
    const t = String(text ?? "").trim();
    if (!t || t.replace(/[\s.,!?…\-–—]/g, "").length < 2) return true;
    // подсказка узбекского распознавания (UZ_STT_PROMPT) на тишине может вернуться как «речь»: любой её кусок — не фраза пользователя
    // (короткий кусок — настоящая команда вроде «Salom, Ayris» или «hisob-fakturalarni ko‘rsat», поэтому порог длинный)
    if (t.length >= 60 && UZ_STT_PROMPT.toLowerCase().includes(t.toLowerCase().replace(/[.!?]+$/, ""))) return true;
    return PHANTOM.some((re) => re.test(t));
}

interface SttTarget { url: string; key?: string; model: string; kind?: "openai" | "elevenlabs" }

// Узбекский: общая модель Whisper ошибается в окончаниях и в словах CRM. Три приёма (docs/UZ_VOICE.md):
//  • модель получше — gpt-4o-transcribe у самого OpenAI (имя можно задать AI_VOICE_STT_MODEL_UZ);
//  • подсказка со словарём CRM латиницей — распознаватель выбирает «hisob-faktura», а не созвучное слово;
//  • необязательный ElevenLabs Scribe (ELEVENLABS_API_KEY) — отдельная модель с узбекским, ставится первой, если ключ задан.
export const UZ_STT_PROMPT = "Salom, Ayris. Ayris, Айрис. Salom Ayris. Firmspace CRM. mijoz, mijozlar, hisob-faktura, hisob-fakturalar, buyurtma, shartnoma, taklif, vazifa, bitim, to‘lov, ombor, mahsulot, xodim, hisobot, soliq, QQS, so‘m, bank, kassa. Ayris, to‘lanmagan hisob-fakturalarni ko‘rsat. Yangi vazifa yarat. Buyurtmalarni och.";
const uzCloudModel = () => plainModel(process.env.AI_VOICE_STT_MODEL_UZ, "gpt-4o-transcribe", /^(whisper-1|gpt-4o)/);

function sttTargets(language?: string): SttTarget[] {
    const targets: SttTarget[] = [];
    const cloudKey = process.env.OPENAI_API_KEY;
    if (language === "uz" && process.env.ELEVENLABS_API_KEY) targets.push({ url: "https://api.elevenlabs.io/v1", key: process.env.ELEVENLABS_API_KEY, model: process.env.ELEVENLABS_STT_MODEL || "scribe_v1", kind: "elevenlabs" });
    if (cloudKey) targets.push({ url: openaiBase(), key: cloudKey, model: language === "uz" ? uzCloudModel() : cloudSttModel() });
    if (process.env.TRANSCRIBE_API_URL) targets.push({ url: trim(process.env.TRANSCRIBE_API_URL), key: process.env.TRANSCRIBE_API_KEY || undefined, model: sttModel() });
    return process.env.STT_LOCAL_FIRST === "1" && !targets.some((t) => t.kind === "elevenlabs") ? targets.reverse() : targets;
}

async function transcribeOnce(t: SttTarget, bytes: Buffer, type: string, language?: string): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type }), `voice.${AUDIO_EXT[type] ?? "webm"}`);
    if (t.kind === "elevenlabs") {
        // ElevenLabs Scribe: POST /v1/speech-to-text, ключ в xi-api-key, язык — трёхбуквенный код (uzb)
        form.append("model_id", t.model);
        form.append("language_code", language === "uz" ? "uzb" : language || "");
        form.append("tag_audio_events", "false");
        const r = await fetchProvider(`${t.url}/speech-to-text`, { method: "POST", headers: { "xi-api-key": t.key ?? "" }, body: form }, 55000);
        const j = (await r.json().catch(() => null)) as { text?: string; detail?: unknown } | null;
        if (!r.ok || !j) {
            console.error("transcribe error (elevenlabs)", r.status);
            throw new ProviderError(r.status === 401 ? "The speech provider rejected the API key" : `The speech provider returned an error (${r.status})`);
        }
        return String(j.text ?? "").trim();
    }
    form.append("model", t.model);
    // Язык записи подсказываем, но не настаиваем: whisper и так определит по речи.
    // gpt-4o-transcribe код «uz» не принимает («Language code 'uz' is not recognized») — для него язык называем в подсказке, а не параметром.
    const noCode = language === "uz" && /^gpt-4o/.test(t.model);
    if (language && !noCode) form.append("language", language);
    if (language === "uz") { form.append("prompt", (noCode ? "The audio is in Uzbek (Latin script). " : "") + UZ_STT_PROMPT); form.append("temperature", "0"); }
    let res = await fetchProvider(`${t.url}/audio/transcriptions`, { method: "POST", headers: t.key ? { Authorization: `Bearer ${t.key}` } : {}, body: form }, 55000);
    // Провайдер не знает код языка (400 «Language code … is not recognized»): повторяем без параметра языка — распознавание определит его само
    if (res.status === 400 && language && !noCode) {
        const peek = (await res.clone().json().catch(() => null)) as { error?: { message?: string } } | null;
        if (/language/i.test(peek?.error?.message ?? "")) {
            form.delete("language");
            res = await fetchProvider(`${t.url}/audio/transcriptions`, { method: "POST", headers: t.key ? { Authorization: `Bearer ${t.key}` } : {}, body: form }, 55000);
        }
    }
    const json = (await res.json().catch(() => null)) as ({ text?: string; error?: { message?: string } } & Record<string, unknown>) | null;
    if (!res.ok || !json) {
        console.error("transcribe error", res.status, json?.error?.message);
        throw new ProviderError(res.status === 401 ? "The AI provider rejected the API key" : res.status === 429 ? "The AI provider is busy or out of quota. Try again later." : `The AI provider returned an error (${res.status})`);
    }
    return String(json.text ?? "").trim();
}

export async function transcribeAudio(bytes: Buffer, mime: string, language?: string): Promise<string> {
    const targets = sttTargets(language);
    if (!targets.length) throw new ProviderError("Speech recognition is not configured on this site");
    const type = (mime || "audio/webm").split(";")[0];
    let lastError: unknown;
    for (const t of targets) {
        try {
            return await transcribeOnce(t, bytes, type, language);
        } catch (e) {
            lastError = e; // пробуем следующий путь: облако упало — выручает локальный Whisper
        }
    }
    throw lastError instanceof Error ? lastError : new ProviderError("Speech recognition failed");
}
