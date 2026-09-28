import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, serverError } from "@/lib/api";
import { getUpdates, sendTelegram } from "@/lib/channels/telegram";
import { errorBot, setErrorBot } from "@/lib/platformSettings";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";

// Бот для отчётов об ошибках: свой отдельный бот платформы. Администратор вставляет токен бота от
// BotFather, пишет этому боту любое сообщение, и мы сами находим чат через getUpdates — числовой id
// искать не нужно. После сохранения отправляем проверочное сообщение тем же путём, что и настоящие отчёты.
// Только для администратора платформы.

export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    try {
        const bot = await errorBot();
        return NextResponse.json({
            hasToken: !!bot.botToken,
            chatId: bot.chatId,
            fromEnv: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ERROR_CHAT_ID),
        });
    } catch (e) {
        return serverError(e);
    }
}

export async function POST(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(b.action ?? "");
    const botToken = String(b.botToken ?? "").trim();
    const chatId = String(b.chatId ?? "").trim();
    try {
        // «проверить»: отправляет проверочное сообщение тем же путём, что и настоящие отчёты.
        // Текст с временем — чтобы проверку можно было повторять: одинаковые сообщения придерживаются.
        if (action === "test") {
            const bot = await errorBot();
            if (!bot.botToken || !bot.chatId) return badRequest("Бот отчётов не настроен");
            // Отправляем напрямую и про саму отправку сообщаем как есть: отчёты об ошибках глотают сбой
            // (они не должны ломать запрос), поэтому «отправлено» на слово было бы неправдой
            try {
                await sendTelegram(bot.botToken, bot.chatId, `🔴 Проверка отчётов: бот на связи, отчёты об ошибках настроены.\n\nвремя: ${new Date().toISOString()}`);
            } catch (e) {
                return badRequest(`Telegram отказал: ${e instanceof Error ? e.message : "неизвестная ошибка"}`);
            }
            return NextResponse.json({ ok: true });
        }

        // «найти чат»: забираем последнее сообщение, отправленное боту, и запоминаем, откуда оно
        if (action === "find-chat") {
            const current = await errorBot();
            const token = botToken || current.botToken;
            if (!token) return badRequest("Сначала вставьте токен бота от @BotFather");
            const updates = await getUpdates(token, 0);
            const chats = (updates ?? [])
                .map((u) => u.message?.chat)
                .filter((c): c is NonNullable<typeof c> => !!c && c.type === "private");
            const last = chats[chats.length - 1];
            if (!last) return badRequest("Боту ещё не писали: отправьте ему любое сообщение в Telegram и повторите");
            const name = [last.first_name, last.last_name].filter(Boolean).join(" ") || last.username || String(last.id);
            return NextResponse.json({ chatId: String(last.id), name });
        }

        if (action === "save") {
            if (!chatId) return badRequest("Не найден чат: напишите боту сообщение и нажмите «Найти чат»");
            await setErrorBot(botToken, chatId);
            // проверочное сообщение уходит тем же путём, что и настоящие отчёты: иначе непонятно, работает ли
            await reportError(new Error("Проверка отчётов: бот на связи, отчёты об ошибках настроены."), { where: "проверка" });
            return NextResponse.json({ ok: true });
        }

        return badRequest("Unknown action");
    } catch (e) {
        return serverError(e);
    }
}
