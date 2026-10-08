import { fetchProvider, ProviderError } from "@/lib/http";

// Серверная озвучка Айрис — естественный голос вместо роботизированного синтеза браузера.
//
// Цепочка провайдеров (первый ответивший побеждает):
//  1. TTS_API_URL — OpenAI-совместимый /v1/audio/speech. На своём сервере это контейнер `tts`
//     (deploy/docker-compose.tts.yml, нейронные голоса Microsoft Edge), по умолчанию http://tts:5050/v1;
//     подойдёт и настоящий OpenAI (tts-1 / gpt-4o-mini-tts): TTS_API_URL=https://api.openai.com/v1,
//     TTS_API_KEY=…, голоса задаются TTS_VOICE_<ЯЗЫК>_F / _M.
//  2. TTS_FALLBACK_URL — запасной Piper внутри speaches (http://speaches:8000/v1): голос проще,
//     зато работает без интернета. Модели ставятся один раз: POST /v1/models/<id>.
//  3. Если не ответил никто — 503, и клиент читает ответ синтезом речи браузера.
//
// Сервис Microsoft Edge неофициальный и иногда отдаёт «No audio received» — поэтому одна быстрая
// повторная попытка и запасной голос, а не сразу сообщение об ошибке.

export type VoiceLang = "ru" | "uk" | "de" | "en" | "uz";
export type VoiceGender = "f" | "m";

// Нейронные голоса по умолчанию: родные голоса каждого языка. Меняются переменными окружения.
const MULTI: Record<VoiceGender, string> = { f: "en-US-AvaMultilingualNeural", m: "en-US-AndrewMultilingualNeural" };
const DEFAULT_VOICES: Record<VoiceLang, Record<VoiceGender, string>> = {
    // Мультиязычные голоса (Ava, Andrew) звучат живее родных ru/uk-голосов и читают все четыре языка одним тембром —
    // как голос ChatGPT; выбор владельца 02.10.2026. Родные при желании: TTS_VOICE_RU_F=ru-RU-SvetlanaNeural и т.д.
    ru: MULTI, uk: MULTI, de: MULTI, en: MULTI,
    // Узбекский: родные нейронные голоса Microsoft (мультиязычные Ava/Andrew узбекский не читают). Меняются TTS_VOICE_UZ_F / TTS_VOICE_UZ_M.
    uz: { f: "uz-UZ-MadinaNeural", m: "uz-UZ-SardorNeural" },
};

// Piper (speaches): модель на язык и пол. Голоса у Piper по одному на модель, мужских для uk/de немного.
const PIPER_MODELS: Record<VoiceLang, Record<VoiceGender, string>> = {
    ru: { f: "speaches-ai/piper-ru_RU-irina-medium", m: "speaches-ai/piper-ru_RU-dmitri-medium" },
    uk: { f: "speaches-ai/piper-uk_UA-ukrainian_tts-medium", m: "speaches-ai/piper-uk_UA-ukrainian_tts-medium" },
    de: { f: "speaches-ai/piper-de_DE-ramona-low", m: "speaches-ai/piper-de_DE-thorsten-medium" },
    en: { f: "speaches-ai/piper-en_US-amy-medium", m: "speaches-ai/piper-en_US-lessac-medium" },
    uz: { f: "", m: "" }, // у Piper узбекского голоса нет: запасного пути для uz нет, клиент читает голосом браузера
};

const trim = (s: string) => s.replace(/\/+$/, "");
const primaryUrl = () => trim(process.env.TTS_API_URL || "http://tts:5050/v1");
const fallbackUrl = () => trim(process.env.TTS_FALLBACK_URL ?? "http://speaches:8000/v1");

// Настоящий OpenAI (gpt-4o-mini-tts — голос ChatGPT): те же голоса на всех языках, язык берётся из текста.
// Включается сам, когда TTS_API_URL указывает на api.openai.com, или явно TTS_PROVIDER=openai.
const isOpenAi = () => process.env.TTS_PROVIDER === "openai" || /api\.openai\.com/.test(primaryUrl());
const OPENAI_VOICES: Record<VoiceGender, string> = { f: "coral", m: "onyx" };
const OPENAI_STYLE = "Speak like a warm, friendly, natural human assistant: relaxed pace, lively intonation, short natural pauses between sentences. Pronounce the text in its own language with a native accent.";

export const voiceFor = (lang: VoiceLang, gender: VoiceGender): string =>
    process.env[`TTS_VOICE_${lang.toUpperCase()}_${gender.toUpperCase()}`] || (isOpenAi() ? OPENAI_VOICES[gender] : DEFAULT_VOICES[lang][gender]);

/** Определяет язык фразы по алфавиту и характерным словам; hint — язык, который пользователь выбрал сам. */
export function detectLang(text: string, hint?: string): VoiceLang {
    const s = String(text ?? "");
    const letters = s.replace(/[^\p{L}]/gu, "");
    const cyr = (letters.match(/[Ѐ-ӿ]/g) ?? []).length;
    if (cyr > letters.length * 0.4) {
        // і, ї, є, ґ есть только в украинском; ы, э, ъ — только в русском
        if (/[іїєґ]/i.test(s) && !/[ыэъ]/i.test(s)) return "uk";
        if (/[ыэъ]/i.test(s)) return "ru";
        return hint === "uk" ? "uk" : "ru";
    }
    // узбекская латиница: oʻ/gʻ — однозначный признак; иначе решает язык, выбранный человеком
    if (/[oOgG][ʻʼ'’`]/.test(s) || hint === "uz") return "uz";
    if (/[äöüß]/i.test(s) || /\b(und|der|die|das|nicht|ich|bitte|rechnung|rechnungen|ist|sind|haben|für|mit|ein|eine|offen|heute)\b/i.test(s)) return "de";
    return hint === "de" ? "de" : "en";
}

/** Текст, пригодный для чтения вслух: без разметки, ссылок, эмодзи; цифры и суммы оставляем как есть. */
export function speechText(raw: string): string {
    return String(raw ?? "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/^\s*[-*•]\s+/gm, "")
        .replace(/^\s*\d+[.)]\s+/gm, "")
        .replace(/[*_#>|~]/g, " ")
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// ── небольшой кэш готовых фраз: «Слушаю», «Готово» и подтверждения не нужно синтезировать заново ──
const CACHE_MAX = 60;
const CACHE_BYTES = 12 * 1024 * 1024;
const cache = new Map<string, Buffer>();
let cacheBytes = 0;
const cacheGet = (k: string) => {
    const v = cache.get(k);
    if (v) { cache.delete(k); cache.set(k, v); } // свежие — в конец
    return v;
};
const cachePut = (k: string, v: Buffer) => {
    if (v.length > 400_000) return;
    cache.set(k, v);
    cacheBytes += v.length;
    while (cache.size > CACHE_MAX || cacheBytes > CACHE_BYTES) {
        const oldest = cache.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        cacheBytes -= cache.get(oldest)?.length ?? 0;
        cache.delete(oldest);
    }
};

async function requestSpeech(base: string, body: Record<string, unknown>, key?: string): Promise<Buffer> {
    const res = await fetchProvider(`${base}/audio/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify(body),
    }, 20000);
    const buf = Buffer.from(await res.arrayBuffer());
    // Ответ-ошибка тоже приходит как тело (JSON) — отличаем по статусу и по тому, что это не аудио
    if (!res.ok || buf.length < 400 || buf[0] === 0x7b /* "{" */) throw new ProviderError(`TTS provider returned ${res.status}`);
    return buf;
}

export interface SpeechResult { audio: Buffer; contentType: string; provider: "neural" | "piper" | "cache" }

/** Озвучивает фразу. Бросает ProviderError, если не смог ни один провайдер — тогда клиент читает сам. */
export async function synthesize(rawText: string, opts: { lang?: string; gender?: VoiceGender; speed?: number } = {}): Promise<SpeechResult> {
    const text = speechText(rawText).slice(0, 900);
    if (!text) throw new ProviderError("Nothing to say");
    const lang = detectLang(text, opts.lang);
    const gender: VoiceGender = opts.gender === "m" ? "m" : "f";
    const speed = Math.min(1.3, Math.max(0.8, opts.speed ?? 1.05));
    const voice = voiceFor(lang, gender);
    const cacheKey = `${voice}|${speed}|${text}`;
    const hit = cacheGet(cacheKey);
    if (hit) return { audio: hit, contentType: "audio/mpeg", provider: "cache" };

    const key = process.env.TTS_API_KEY || undefined;
    const openai = isOpenAi();
    const model = process.env.TTS_MODEL || (openai ? "gpt-4o-mini-tts" : "tts-1");
    // 1 + 1 повторная попытка к основному голосу: Edge иногда отвечает «No audio received» на ровном месте
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const audio = await requestSpeech(primaryUrl(), { model, input: text, voice, speed, response_format: "mp3", ...(openai && /gpt-4o/.test(model) ? { instructions: OPENAI_STYLE } : {}) }, key);
            cachePut(cacheKey, audio);
            return { audio, contentType: "audio/mpeg", provider: "neural" };
        } catch (e) {
            if (attempt === 1) console.error("tts primary failed", e instanceof Error ? e.message : e);
        }
    }

    const fb = fallbackUrl();
    if (fb && PIPER_MODELS[lang][gender]) {
        try {
            const audio = await requestSpeech(fb, { model: PIPER_MODELS[lang][gender], input: text, voice: "piper", speed, response_format: "mp3" });
            return { audio, contentType: "audio/mpeg", provider: "piper" };
        } catch (e) {
            console.error("tts fallback failed", e instanceof Error ? e.message : e);
        }
    }
    throw new ProviderError("Speech synthesis is unavailable");
}
