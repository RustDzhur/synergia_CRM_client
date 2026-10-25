import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { findByToken, secretsOf, verifyTokenOf } from "@/lib/integrations";
import { recordMessage } from "@/lib/channels";
import { instagramUserName, parseInstagramBody } from "@/lib/channels/instagram";
import { verifyMetaSignature } from "@/lib/channels/messenger";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";

// GET — проверка вебхука при настройке в кабинете Meta (hub.verify_token из настроек интеграции).
// Instagram подтверждает адрес так же, как Messenger и WhatsApp: hub.mode, hub.verify_token, hub.challenge.
export async function GET(req: Request, { params }: { params: { token: string } }) {
    const integration = await findByToken("instagram", params.token);
    if (!integration) return new Response("Not found", { status: 404 });
    const q = new URL(req.url).searchParams;
    if (q.get("hub.mode") === "subscribe" && safeEqual(q.get("hub.verify_token") ?? "", verifyTokenOf(integration))) {
        return new Response(q.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
}

// POST — события Instagram Direct; тело подписано секретом приложения (X-Hub-Signature-256), как у Messenger
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const integration = await findByToken("instagram", params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const secrets = secretsOf(integration);

    const raw = await req.text();
    if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secrets.appSecret)) {
        // Meta события доставляет, но подпись не сходится: почти всегда это сменившийся секрет приложения,
        // который в CRM не обновили. Без сообщения об этом переписка просто пропадала бы без следа.
        void reportError(new Error("Instagram: подпись события не сходится — секрет приложения в CRM отличается от того, что в Meta"), { where: "вебхук Instagram", org: String(integration.owner) });
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: "Bad request" }, { status: 400 }); }
    for (const event of parseInstagramBody(body)) {
        try {
            // Username в Instagram приходит не всегда: без него беседа подписывается понятной заглушкой
            const name = (await instagramUserName(secrets.pageAccessToken, event.externalId)) || `Instagram ${event.externalId.slice(-4)}`;
            await recordMessage(integration, { ...event, name });
        } catch (e) {
            // Сбой на одном сообщении не должен терять остальные — и не должен остаться незамеченным
            void reportError(e, { where: "обработка сообщения Instagram", org: String(integration.owner), detail: { от_кого: event.externalId } });
        }
    }
    return NextResponse.json({ ok: true });
}
