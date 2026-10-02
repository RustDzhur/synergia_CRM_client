import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { connectWhatsAppEmbedded } from "@/lib/channels/connect";
import { metaApp } from "@/lib/platformSettings";
import { GRAPH_VERSION } from "@/lib/meta";

export const dynamic = "force-dynamic";

// GET — что нужно окну подключения: App ID и id конфигурации «Facebook Login for Business».
// Секрет приложения фирме не отдаём: он остаётся на сервере, поэтому клиенту не нужен свой
// профиль в Meta for Developers — достаточно войти в Facebook и выбрать свой аккаунт WhatsApp.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const app = await metaApp();
    return NextResponse.json({ appId: app.appId, configId: app.configId, version: GRAPH_VERSION, ready: !!(app.appId && app.configId) });
}

// POST — { code, phoneNumberId, wabaId }: результат окна Embedded Signup. Обмен кода на бизнес-токен
// живёт 30 секунд, поэтому клиент отправляет его сразу, как только окно закрылось.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = String(b.code ?? "").trim();
    const phoneNumberId = String(b.phoneNumberId ?? "").trim();
    const wabaId = String(b.wabaId ?? "").trim();
    if (!code) return badRequest("Meta не вернула код подключения");
    try {
            const result = await connectWhatsAppEmbedded(user.id, { code, phoneNumberId, wabaId }, appOrigin(req));
        return NextResponse.json(result);
    } catch (e) {
        return failure(e);
    }
}
