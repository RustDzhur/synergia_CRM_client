import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { safeEqual } from "@/lib/crypto";
import { findByToken, secretsOf } from "@/lib/integrations";
import { recordMessage } from "@/lib/channels";
import { parseTelegramUpdate } from "@/lib/channels/telegram";

export const dynamic = "force-dynamic";

// Вебхук Telegram: адрес знает только бот, плюс секрет в заголовке X-Telegram-Bot-Api-Secret-Token
export async function POST(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("telegram", params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!safeEqual(secret, secretsOf(integration).webhookSecret)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const message = parseTelegramUpdate(await req.json().catch(() => ({})));
    if (message) await recordMessage(integration, message);
    return NextResponse.json({ ok: true });
}
