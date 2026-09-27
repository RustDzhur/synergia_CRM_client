import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { findByToken, secretsOf } from "@/lib/integrations";
import { markMessageFailed, recordMessage } from "@/lib/channels";
import { parseWhatsAppWebhook, verifyWhatsAppChallenge, verifyWhatsAppSignature } from "@/lib/channels/whatsapp";

export const dynamic = "force-dynamic";

// GET — проверка адреса при настройке вебхука в кабинете Meta (verify token виден в окне интеграции)
export async function GET(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("whatsapp", params.token);
    if (!integration) return new Response("Not found", { status: 404 });
    const challenge = verifyWhatsAppChallenge(new URL(req.url).searchParams, integration.config.verifyToken);
    if (challenge === null) return new Response("Forbidden", { status: 403 });
    return new Response(challenge, { status: 200 });
}

// POST — сообщения собеседников и отчёты о доставке наших сообщений; тело подписано секретом приложения (X-Hub-Signature-256)
export async function POST(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("whatsapp", params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const raw = await req.text();
    if (!verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"), secretsOf(integration).appSecret)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: "Bad request" }, { status: 400 }); }
    const { messages, statuses } = parseWhatsAppWebhook(body);
    for (const message of messages) await recordMessage(integration, message);
    // недоставленное сообщение помечаем в беседе: Meta сообщает об этом отдельным событием
    for (const s of statuses) if (s.status === "failed") await markMessageFailed(integration, s.id, s.error);
    return NextResponse.json({ ok: true });
}
