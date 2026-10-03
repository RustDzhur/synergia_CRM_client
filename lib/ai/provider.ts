import { ProviderError, fetchProvider } from "@/lib/http";

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
    if (wanted === "openai" && process.env.OPENAI_API_KEY) return "openai";
    if (wanted === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.ANTHROPIC_API_KEY) return "anthropic";
    if (process.env.OPENAI_API_KEY) return "openai";
    return null;
}
export const aiConfigured = () => !!aiProvider();
// Модели меняются — имя всегда можно задать переменной AI_MODEL
export const aiModel = (p: ProviderId) => process.env.AI_MODEL || (p === "anthropic" ? "claude-sonnet-5" : "gpt-4.1-mini");

const trim = (s: string) => s.replace(/\/+$/, "");

async function post<T>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
    const res = await fetchProvider(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }, 55000);
    const json = (await res.json().catch(() => null)) as ({ error?: { message?: string } | string } & T) | null;
    if (!res.ok || !json) {
        const detail = typeof json?.error === "string" ? json.error : json?.error?.message;
        console.error("AI provider error", res.status, detail);
        throw new ProviderError(res.status === 401 ? "The AI provider rejected the API key" : res.status === 429 ? "The AI provider is busy or out of quota. Try again later." : `The AI provider returned an error (${res.status})`);
    }
    return json;
}

// ── OpenAI ──
async function openai(system: string, msgs: Msg[], tools: ToolDef[], model = aiModel("openai")): Promise<Reply> {
    const messages: unknown[] = [{ role: "system", content: system }];
    for (const m of msgs) {
        if (m.role === "user") messages.push({ role: "user", content: m.text });
        else if (m.role === "assistant") messages.push({ role: "assistant", content: m.text || null, ...(m.calls?.length ? { tool_calls: m.calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } : {}) });
        else messages.push({ role: "tool", tool_call_id: m.callId, content: m.content });
    }
    const j = await post<{ choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }>(
        `${trim(process.env.OPENAI_API_URL || "https://api.openai.com/v1")}/chat/completions`,
        { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        // Ограничение сверху обязательно: шлюз (OmniRoute/OpenRouter) без него считает
        // бюджет на максимум модели (~65k токенов) и отказывает при малом балансе (402).
        { model, max_tokens: 2000, messages, tools: tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) }
    );
    const msg = j.choices?.[0]?.message;
    if (!msg) throw new ProviderError("The AI provider returned an empty answer");
    return { text: msg.content ?? "", calls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: parseArgs(c.function.arguments) })) };
}

// ── Anthropic ──
async function anthropic(system: string, msgs: Msg[], tools: ToolDef[], model = aiModel("anthropic")): Promise<Reply> {
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
        { model, max_tokens: 2000, system, messages, tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) }
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

export async function complete(system: string, msgs: Msg[], tools: ToolDef[], opts: { model?: string } = {}): Promise<Reply> {
    const p = aiProvider();
    if (!p) throw new ProviderError("AI is not configured on this site");
    const run = (model?: string) => (p === "anthropic" ? anthropic(system, msgs, tools, model) : openai(system, msgs, tools, model));
    if (!opts.model) return run();
    try {
        return await run(opts.model);
    } catch (e) {
        console.error("fast model failed, falling back", e instanceof Error ? e.message : e);
        return run();
    }
}

// ── одноразовое распознавание изображения (чек/квитанция) — без истории, без инструментов, просто system+картинка+текст → text ──
export interface ImageInput { mimeType: string; base64: string }

async function openaiVision(system: string, prompt: string, image: ImageInput): Promise<string> {
    const j = await post<{ choices?: { message?: { content?: string | null } }[] }>(
        `${trim(process.env.OPENAI_API_URL || "https://api.openai.com/v1")}/chat/completions`,
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
//  1. облачный — тот же шлюз/OpenAI, что и для ответов (OPENAI_API_URL + OPENAI_API_KEY). На шлюзе omniroute это
//     openrouter/openai/whisper-large-v3-turbo: ≈1 секунда на фразу, русский/украинский/немецкий определяются сами,
//     цена ≈ 0,00003 $ за фразу. Модель меняется AI_VOICE_STT_MODEL.
//  2. локальный Whisper (TRANSCRIBE_API_URL, speaches) — запасной: бесплатный и закрытый от внешнего мира, но на
//     процессоре без AVX разбирает 4 секунды речи 12–25 секунд, для разговора в реальном времени он слишком медленный.
//     STT_LOCAL_FIRST=1 ставит его первым (если у сервера есть GPU или современный процессор).
// Браузерное распознавание (SpeechRecognition) ключей не требует вовсе — сервер нужен остальным браузерам.
export const sttConfigured = () => !!process.env.OPENAI_API_KEY || !!process.env.TRANSCRIBE_API_URL;
// Модель локального Whisper — HF-имя (speaches/faster-whisper): Systran/faster-whisper-small
export const sttModel = () => process.env.AI_TRANSCRIBE_MODEL || "whisper-1";
// На шлюзе (не api.openai.com) нужны полные имена моделей, у самого OpenAI — короткие
const onGateway = () => { const u = process.env.OPENAI_API_URL; return !!u && !/api\.openai\.com/.test(u); };
export const cloudSttModel = () => process.env.AI_VOICE_STT_MODEL || (onGateway() ? "openrouter/openai/whisper-large-v3-turbo" : "whisper-1");

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
    return PHANTOM.some((re) => re.test(t));
}

interface SttTarget { url: string; key?: string; model: string }

function sttTargets(): SttTarget[] {
    const targets: SttTarget[] = [];
    const cloudKey = process.env.OPENAI_API_KEY;
    if (cloudKey) targets.push({ url: trim(process.env.OPENAI_API_URL || "https://api.openai.com/v1"), key: cloudKey, model: cloudSttModel() });
    if (process.env.TRANSCRIBE_API_URL) targets.push({ url: trim(process.env.TRANSCRIBE_API_URL), key: process.env.TRANSCRIBE_API_KEY || undefined, model: sttModel() });
    return process.env.STT_LOCAL_FIRST === "1" ? targets.reverse() : targets;
}

async function transcribeOnce(t: SttTarget, bytes: Buffer, type: string, language?: string): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type }), `voice.${AUDIO_EXT[type] ?? "webm"}`);
    form.append("model", t.model);
    // Язык записи подсказываем, но не настаиваем: whisper и так определит по речи
    if (language) form.append("language", language);
    const res = await fetchProvider(`${t.url}/audio/transcriptions`, { method: "POST", headers: t.key ? { Authorization: `Bearer ${t.key}` } : {}, body: form }, 55000);
    const json = (await res.json().catch(() => null)) as ({ text?: string; error?: { message?: string } } & Record<string, unknown>) | null;
    if (!res.ok || !json) {
        console.error("transcribe error", res.status, json?.error?.message);
        throw new ProviderError(res.status === 401 ? "The AI provider rejected the API key" : res.status === 429 ? "The AI provider is busy or out of quota. Try again later." : `The AI provider returned an error (${res.status})`);
    }
    return String(json.text ?? "").trim();
}

export async function transcribeAudio(bytes: Buffer, mime: string, language?: string): Promise<string> {
    const targets = sttTargets();
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
