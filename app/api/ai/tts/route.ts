import { NextResponse } from "next/server";
// Серверный TTS через omniroute (OpenAI TTS) — естественный голос, как в GPT
export const runtime = "nodejs";
export async function POST(req: Request) {
    try {
        const { text, voice = "shimmer" } = await req.json();
        if (!text || typeof text !== "string") return NextResponse.json({ message: "text required" }, { status: 400 });
        const apiUrl = process.env.OPENAI_API_URL || "http://omniroute:20128/v1";
        const apiKey = process.env.OPENAI_API_KEY || "";
        const res = await fetch(`${apiUrl}/audio/speech`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model: "tts-1", input: text.slice(0, 4000), voice, response_format: "mp3" }),
        });
        if (!res.ok) return NextResponse.json({ message: "tts failed" }, { status: 502 });
        const audio = await res.arrayBuffer();
        return new NextResponse(Buffer.from(audio), {
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600" },
        });
    } catch (e) {
        return NextResponse.json({ message: "tts error" }, { status: 500 });
    }
}
