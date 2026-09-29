import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { metaApp, whatsappVerifyToken } from "@/lib/platformSettings";
import { reportError } from "@/lib/reportError";
import { markMessageFailed, recordMessage } from "@/lib/channels";
import { secretsOf } from "@/lib/integrations";
import { parseWhatsAppWebhookByNumber, verifyWhatsAppChallenge, verifyWhatsAppSignature } from "@/lib/channels/whatsapp";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// Вебхук WhatsApp уровня приложения Meta: адрес один на всю платформу, поэтому фирма определяется
// не адресом, а номером из самого события (`phone_number_id`). Так сообщения не уедут другой фирме,
// если кабинет Meta переставил адрес на чужой, и новому кабинету не нужно ждать своей очереди.

async function integrationFor(phoneNumberId: string) {
    if (!phoneNumberId) return null;
    return Integration.findOne({ type: "whatsapp", status: "connected", "config.phoneNumberId": phoneNumberId });
}

// GET — проверка адреса при настройке вебхука в кабинете Meta
export async function GET(req: Request) {
    await connectDB();
    const query = new URL(req.url).searchParams;
    const expected = await whatsappVerifyToken();
    let challenge = verifyWhatsAppChallenge(query, expected);
    // Запасной путь: адрес мог быть настроен раньше, с маркером конкретной фирмы
    if (challenge === null) {
        const token = query.get("hub.verify_token") ?? "";
        const doc = token ? await Integration.findOne({ type: "whatsapp", "config.verifyToken": token }) : null;
        if (doc) challenge = query.get("hub.challenge") ?? "";
    }
    if (challenge === null) return new Response("Forbidden", { status: 403 });
    return new Response(challenge, { status: 200 });
}

// POST — события WhatsApp: сообщения собеседников и отчёты о доставке
export async function POST(req: Request) {
    await connectDB();
    const raw = await req.text();

    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ message: "Bad request" }, { status: 400 }); }
    const groups = parseWhatsAppWebhookByNumber(body);
    if (!groups.size) return NextResponse.json({ ok: true });

    // Подпись проверяем секретом приложения: он один на платформу, у всех фирм тот же
    const { appSecret } = await metaApp();
    if (appSecret && !verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    for (const [phoneNumberId, group] of Array.from(groups.entries()) as [string, { messages: { externalId: string; name?: string; text: string; messageId?: string }[]; statuses: { id: string; status: string; error: string }[] }][]) {
        const integration = await integrationFor(phoneNumberId);
        if (!integration) {
            // Номер не привязан ни к одному кабинету: без этой записи было бы непонятно, почему
            // сообщение человеку в CRM не пришло
            if (group.messages.length) void reportError(new Error(`WhatsApp: номер ${phoneNumberId || "(без номера)"} не привязан ни к одному кабинету`), { where: "входящее сообщение WhatsApp" });
            continue;
        }
        // Секрет фирмы важнее: он совпадает с платформенным, но проверяем им, если он есть
        const own = String(secretsOf(integration).appSecret ?? "");
        if (own && own !== appSecret && !verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"), own)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        for (const message of group.messages) await recordMessage(integration, message);
        for (const s of group.statuses) if (s.status === "failed") await markMessageFailed(integration, s.id, s.error);
    }
    return NextResponse.json({ ok: true });
}
