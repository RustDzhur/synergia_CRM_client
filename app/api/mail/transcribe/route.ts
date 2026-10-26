import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { sttConfigured, transcribeAudio } from "@/lib/ai/provider";
import { rateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/mail/transcribe — диктовка в окне написания письма.
// Тело — multipart/form-data: file (запись MediaRecorder), language (de|en|ua|uk|uz|ru, необязательно),
// duration (секунды записи, необязательно). Распознавание — то же, что у ассистента (lib/ai/provider.ts):
// облачный Whisper по OPENAI_API_KEY, а если его нет — локальный speaches (TRANSCRIBE_API_URL).
// Ответ: { text }. Пустой text — речь не распознана (тишина/шум), это не ошибка.

// 8 МБ: две минуты Opus/AAC весят 1–2 МБ, запас нужен браузерам, которые не сжимают запись.
// Длительность проверяем и на клиенте (авто-стоп 2 минуты), и здесь, если он её прислал.
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SECONDS = 120;
const OK_MIME = new Set(["audio/webm", "video/webm", "audio/ogg", "application/ogg", "audio/opus", "audio/mp4", "video/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/x-m4a", "audio/m4a"]);
const STT_LANG: Record<string, string> = { de: "de", en: "en", ua: "uk", uk: "uk", ru: "ru", uz: "uz" };

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    // Серверная диктовка не настроена — интерфейс скажет об этом человеческим текстом
    if (!sttConfigured()) return NextResponse.json({ message: "Speech recognition is not configured on this site", code: "stt_not_configured" }, { status: 503 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob) || !file.size) return badRequest("file is required");
    if (file.size > MAX_BYTES) return badRequest("The recording is too big — keep dictation under two minutes");
    const duration = Number(form?.get("duration") ?? 0);
    if (Number.isFinite(duration) && duration > MAX_SECONDS + 5) return badRequest("The recording is too long — keep dictation under two minutes");
    const mime = (file.type || "audio/webm").split(";")[0].trim();
    if (!OK_MIME.has(mime)) return badRequest("Unsupported audio format");
    const language = STT_LANG[String(form?.get("language") ?? "")] ?? "";
    // Страховка от зациклившегося клиента: живая диктовка — это единицы запросов в минуту
    if (rateLimited(`mail-stt:${user.userId}`, 30, 60_000)) return NextResponse.json({ message: "Too many recognition requests", code: "rate_limited" }, { status: 429 });

    try {
        const text = await transcribeAudio(Buffer.from(await file.arrayBuffer()), mime, language);
        return NextResponse.json({ text });
    } catch (e) {
        return failure(e);
    }
}
