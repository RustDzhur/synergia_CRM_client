import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { rateLimited } from "@/lib/rateLimit";
import { synthesize } from "@/lib/ai/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/ai/tts — { text, lang?, gender?, speed? } → audio/mpeg. Озвучка ответов Айрис естественным голосом
// (см. lib/ai/tts.ts: нейронный голос → запасной Piper). Только для вошедших пользователей: это платный/ресурсный
// сервис, открытый адрес был бы бесплатной озвучкой для всего интернета. Лимит — защита от зацикленного клиента:
// речь режется на предложения, так что обычный разговор укладывается в десяток запросов в минуту.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (rateLimited(`tts:${user.userId}`, 90, 60_000)) return NextResponse.json({ message: "Too many speech requests", code: "rate_limited" }, { status: 429 });

    const b = await req.json().catch(() => null);
    const text = typeof b?.text === "string" ? b.text.trim() : "";
    if (!text) return badRequest("text is required");
    if (text.length > 1500) return badRequest("text is too long");

    try {
        const out = await synthesize(text, {
            lang: typeof b.lang === "string" ? b.lang : undefined,
            gender: b.gender === "m" ? "m" : "f",
            speed: typeof b.speed === "number" ? b.speed : undefined,
        });
        return new Response(new Uint8Array(out.audio), {
            headers: { "Content-Type": out.contentType, "Cache-Control": "private, max-age=600", "X-TTS-Provider": out.provider },
        });
    } catch {
        // 503: клиент по этому коду переходит на синтез речи браузера и какое-то время не обращается сюда
        return NextResponse.json({ message: "Speech synthesis is unavailable", code: "tts_unavailable" }, { status: 503 });
    }
}
