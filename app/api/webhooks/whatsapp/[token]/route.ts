import { NextResponse } from "next/server";
import { findByToken, secretsOf, verifyTokenOf } from "@/lib/integrations";
import { markMessageFailed, recordMessage } from "@/lib/channels";
import { WaIncoming, WaStatus, parseWhatsAppWebhookByNumber, verifyWhatsAppChallenge, verifyWhatsAppSignature } from "@/lib/channels/whatsapp";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Старый адрес вебхука — с маркером отдельной фирмы. Оставлен для установок, настроенных до появления
// общего адреса (/api/webhooks/whatsapp/app): в Meta адрес вебхука один на приложение, и переставить
// его можно не сразу. Фирму определяем по номеру из события, а маркер в адресе — только запасной путь.

// GET — проверка адреса при настройке вебхука в кабинете Meta (verify token виден в окне интеграции)
export async function GET(req: Request, { params }: { params: { token: string } }) {
    const integration = await findByToken("whatsapp", params.token);
    if (!integration) return new Response("Not found", { status: 404 });
    const challenge = verifyWhatsAppChallenge(new URL(req.url).searchParams, verifyTokenOf(integration));
    if (challenge === null) return new Response("Forbidden", { status: 403 });
    return new Response(challenge, { status: 200 });
}

// POST — сообщения собеседников и отчёты о доставке наших сообщений; тело подписано секретом приложения (X-Hub-Signature-256)
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const integration = await findByToken("whatsapp", params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const raw = await req.text();
    if (!verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"), secretsOf(integration).appSecret)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: "Bad request" }, { status: 400 }); }

    // Событие разбираем по номерам: если Meta прислала его сюда, а номер принадлежит другой фирме,
    // сообщение всё равно попадёт своему кабинету
    const groups = parseWhatsAppWebhookByNumber(body);
    let fallback: { messages: WaIncoming[]; statuses: WaStatus[] } = { messages: [], statuses: [] };
    for (const [phoneNumberId, group] of Array.from(groups.entries())) {
        // номер телефона лежит в Json-конфиге, поэтому ищем среди подключённых ящиков WhatsApp в JS
        const target = phoneNumberId
            ? (await prisma.integration.findMany({ where: { type: "whatsapp", status: "connected" } })).find((d) => String((d.config as any)?.phoneNumberId ?? "") === phoneNumberId) ?? null
            : null;
        const doc = target ?? integration;
        if (!phoneNumberId) fallback = group;
        for (const message of group.messages) await recordMessage(doc, message);
        for (const s of group.statuses) if (s.status === "failed") await markMessageFailed(doc, s.id, s.error);
    }
    // Событие без номера (например, отчёты о доставке старых сообщений) — отдаём фирме из адреса
    for (const message of fallback.messages) await recordMessage(integration, message);
    for (const s of fallback.statuses) if (s.status === "failed") await markMessageFailed(integration, s.id, s.error);
    return NextResponse.json({ ok: true });
}
