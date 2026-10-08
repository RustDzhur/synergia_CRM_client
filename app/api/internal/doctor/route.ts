import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { aiConfigured, aiProvider, complete, sttConfigured, transcribeAudio } from "@/lib/ai/provider";
import { aiOverrides } from "@/lib/ai/config";
import { synthesize } from "@/lib/ai/tts";
import { safeEqual } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/internal/doctor — сквозная проверка голоса и ИИ ТЕМ ЖЕ кодом, что работает у пользователей (с настройками из кабинета администратора и .env):
// чат (какая модель и какой адрес реально ответили), распознавание речи, озвучка. Нужен ключ в заголовке x-doctor-key — он считается из JWT_SECRET
// внутри контейнера (его читает deploy/vps/doctor.sh), снаружи без доступа к серверу его не получить. Ключи и значения переменных в ответ не попадают.
const doctorKey = () => createHash("sha256").update(`doctor:${process.env.JWT_SECRET ?? ""}`).digest("hex").slice(0, 32);

type Step = { ok: boolean; ms: number; note: string };
const run = async (fn: () => Promise<string>): Promise<Step> => {
    const t0 = Date.now();
    try { return { ok: true, ms: Date.now() - t0, note: await fn() }; }
    catch (e) { return { ok: false, ms: Date.now() - t0, note: (e instanceof Error ? e.message : String(e)).slice(0, 300) }; }
};

export async function GET(req: Request) {
    const key = req.headers.get("x-doctor-key") ?? "";
    if (!process.env.JWT_SECRET || !safeEqual(key, doctorKey())) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const ov = await aiOverrides().catch(() => null);
    const info = {
        provider: aiProvider(),
        configured: aiConfigured(),
        cabinetOverride: ov ? { apiUrl: ov.apiUrl || "(нет)", model: ov.model || "(нет)", fallbacks: ov.fallbacks.length, voiceModel: ov.voiceModel || "(нет)" } : null,
        sttConfigured: sttConfigured(),
    };
    const chat = await run(async () => {
        const r = await complete("Reply with one short word.", [{ role: "user", text: "Say: ok" }], []);
        return `ответ: «${r.text.slice(0, 40)}»`;
    });
    const voiceChat = await run(async () => {
        const r = await complete("Reply with one short word.", [{ role: "user", text: "Say: ok" }], [], { model: process.env.AI_VOICE_MODEL || ov?.voiceModel || undefined });
        return `ответ: «${r.text.slice(0, 40)}»`;
    });
    // тишина (0,3 с, 16 кГц) — проверяет только, что запрос доходит до распознавателя и тот отвечает; текста в ответе не ждём
    const wav = (() => { const n = 4800, b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); return b; })();
    const stt = await run(async () => { await transcribeAudio(wav, "audio/wav", "uz"); return "запрос принят"; });
    const tts = await run(async () => { const r = await synthesize("Salom", { lang: "uz" }); return `${r.provider}, ${r.audio.length} байт`; });
    return NextResponse.json({ info, chat, voiceChat, stt, tts });
}
