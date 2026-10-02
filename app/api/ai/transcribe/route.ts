import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { aiConfigured, isPhantomTranscript, sttConfigured, transcribeAudio } from "@/lib/ai/provider";
import { rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ai/transcribe — распознавание записи микрофона для диктовки в окне ассистента.
// Тело — multipart/form-data: file (запись), language (de|en|ua, необязательно).
//
// Это второй путь диктовки: если браузер умеет SpeechRecognition (Chrome, Edge, Android), запись
// распознаётся прямо в браузере и сюда не попадает вовсе — ни ключей, ни затрат. Сервер нужен
// остальным браузерам (Firefox, Safari) и работает на ключе OpenAI — у Anthropic распознавания
// аудио нет. Дневную квоту ассистента транскрипция не расходует: она тратится на сам вопрос.

// Предел тела запроса Vercel — 4,5 МБ; запись минуты в Opus весит меньше мегабайта, так что
// 4 МБ — это заведомо длинный монолог, который лучше разбить на части
const MAX_BYTES = 4 * 1024 * 1024;
const OK_MIME = new Set(["audio/webm", "video/webm", "audio/ogg", "audio/mp4", "video/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/x-m4a", "audio/m4a"]);
// Интерфейс говорит на de/en/ua, распознаватель ждёт ISO-639-1 — украинская локаль это uk
const STT_LANG: Record<string, string> = { de: "de", en: "en", ua: "uk", uk: "uk", ru: "ru" };

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!aiConfigured()) return NextResponse.json({ message: "AI is not set up on this site yet", code: "not_configured" }, { status: 503 });
    if (!sttConfigured()) return NextResponse.json({ message: "Server speech recognition is not configured on this site", code: "stt_not_configured" }, { status: 503 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob) || !file.size) return badRequest("file is required");
    if (file.size > MAX_BYTES) return badRequest("The recording is too long — keep dictation under a minute");
    const mime = (file.type || "audio/webm").split(";")[0];
    if (!OK_MIME.has(mime)) return badRequest("Unsupported audio format");
    // ru нет среди языков интерфейса (de/en/ua), но говорят по-русски, и голосовое управление передаёт его явно
    const language = STT_LANG[String(form?.get("language") ?? "")] ?? "";
    // Каждая фраза голосового управления — отдельный запрос; лимит страхует от зациклившегося клиента
    if (rateLimited(`stt:${user.userId}`, 120, 60_000)) return NextResponse.json({ message: "Too many recognition requests", code: "rate_limited" }, { status: 429 });

    try {
        const text = await transcribeAudio(Buffer.from(await file.arrayBuffer()), mime, language);
        // «Субтитры сделал…», «Спасибо за просмотр» и подобное Whisper выдаёт на тишине и шуме — это не речь
        return NextResponse.json({ text: isPhantomTranscript(text) ? "" : text });
    } catch (e) {
        return failure(e);
    }
}
