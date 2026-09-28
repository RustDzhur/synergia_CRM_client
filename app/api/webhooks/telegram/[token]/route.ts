import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { safeEqual } from "@/lib/crypto";
import { findByToken, secretsOf } from "@/lib/integrations";
import { recordMessage } from "@/lib/channels";
import { parseTelegramUpdate, sendTelegram } from "@/lib/channels/telegram";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";

// Вебхук Telegram: адрес знает только бот, плюс секрет в заголовке X-Telegram-Bot-Api-Secret-Token
export async function POST(req: Request, { params }: { params: { token: string } }) {
    await connectDB();
    const integration = await findByToken("telegram", params.token);
    if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (!safeEqual(secret, secretsOf(integration).webhookSecret)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const message = parseTelegramUpdate(await req.json().catch(() => ({})));
    // Команда /errors привязывает этот чат для отчётов об ошибках приложения (lib/reportError.ts).
    // Её отправляет человек сам, поэтому чужая переписка адресом отчётов стать не может.
    if (message && /^\/errors(?:@\w+)?\s*$/i.test(message.text.trim())) {
        integration.config = { ...(integration.config ?? {}), errorChatId: message.externalId };
        integration.markModified("config");
        await integration.save();
        // Сразу отправляем проверочное сообщение тем же путём, что и настоящие отчёты: человек видит
        // и что адрес принят, и как выглядит отчёт. Иначе пришлось бы ждать первой настоящей поломки,
        // чтобы понять, работает ли настройка.
        await reportError(new Error("Проверка отчётов: бот может писать в этот чат, отчёты об ошибках настроены."), { where: "проверка" });
        return NextResponse.json({ ok: true });
    }
    if (message && /^\/errors_off(?:@\w+)?\s*$/i.test(message.text.trim())) {
        integration.config = { ...(integration.config ?? {}), errorChatId: "" };
        integration.markModified("config");
        await integration.save();
        await sendTelegram(secretsOf(integration).botToken, message.externalId, "Отчёты об ошибках больше не приходят в этот чат.");
        return NextResponse.json({ ok: true });
    }
    if (message) await recordMessage(integration, message);
    return NextResponse.json({ ok: true });
}
