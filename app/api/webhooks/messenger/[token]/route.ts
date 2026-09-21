import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { safeEqual } from "@/lib/crypto";
import { findByToken, secretsOf } from "@/lib/integrations";
import { recordMessage } from "@/lib/channels";
import { messengerUserName, parseMessengerBody, verifyMetaSignature } from "@/lib/channels/messenger";

export const dynamic = "force-dynamic";

// GET — проверка вебхука при настройке в кабинете Meta (hub.verify_token из настроек интеграции)
export async function GET(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("messenger", params.token);
    if (!integration) return new Response("Not found", { status: 404 });
    const q = new URL(req.url).searchParams;
    if (q.get("hub.mode") === "subscribe" && safeEqual(q.get("hub.verify_token") ?? "", integration.config.verifyToken)) {
        return new Response(q.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
}

// POST — события страницы; тело подписано секретом приложения (X-Hub-Signature-256)
export async function POST(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("messenger", params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const secrets = secretsOf(integration);

    const raw = await req.text();
    if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secrets.appSecret)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: "Bad request" }, { status: 400 }); }
    for (const event of parseMessengerBody(body)) {
        const name = (await messengerUserName(secrets.pageAccessToken, event.externalId)) || `Messenger ${event.externalId.slice(-4)}`;
        await recordMessage(integration, { ...event, name });
    }
    return NextResponse.json({ ok: true });
}
