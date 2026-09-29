import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, serverError } from "@/lib/api";
import { getUpdates, sendTelegram } from "@/lib/channels/telegram";
import { type BotKind, botConfiguredFromEnv, setTelegramBot, telegramBot } from "@/lib/platformSettings";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";

// Два бота платформы настраиваются одинаково: администратор вставляет токен от @BotFather, пишет боту
// любое сообщение, и мы сами находим чат через getUpdates — числовой id искать не нужно.
//   error  — отчёты об ошибках (падения запросов, исключения в браузере, отказы провайдеров, неудачный деплой)
//   notify — рабочие уведомления (посетитель написал или оставил контакт, пришло письмо)
// Вид бота приходит в параметре kind; по умолчанию — бот ошибок.
// Только для администратора платформы.

const kindOf = (value: unknown): BotKind => (value === "notify" ? "notify" : "error");
// Проверочное сообщение: у каждого бота своя подпись, чтобы в чате было понятно, что именно проверяли
const testText = (kind: BotKind) =>
    kind === "notify"
        ? `🟢 Проверка уведомлений: бот на связи, рабочие уведомления настроены.\n\nвремя: ${new Date().toISOString()}`
        : `🔴 Проверка отчётов: бот на связи, отчёты об ошибках настроены.\n\nвремя: ${new Date().toISOString()}`;

export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const kind = kindOf(new URL(req.url).searchParams.get("kind"));
    try {
        const bot = await telegramBot(kind);
        return NextResponse.json({
            hasToken: !!bot.botToken,
            chatId: bot.chatId,
            // из переменных окружения значения берутся, только пока в кабинете ничего не сохранено
            fromEnv: botConfiguredFromEnv(kind) && !bot.chatId,
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
    const kind = kindOf(b.kind);
    const botToken = String(b.botToken ?? "").trim();
    const chatId = String(b.chatId ?? "").trim();
    try {
        // «проверить»: сообщение уходит тем же путём, что и настоящие. Текст со временем — чтобы проверку
        // можно было повторять: одинаковые сообщения придерживаются (lib/reportError.ts).
        if (action === "test") {
            const bot = await telegramBot(kind);
            if (!bot.botToken || !bot.chatId) return badRequest("Бот не настроен");
            // Отправляем напрямую и про саму отправку сообщаем как есть: рабочие пути глотают сбой
            // (они не должны ломать запрос), поэтому «отправлено» на слово было бы неправдой
            try {
                await sendTelegram(bot.botToken, bot.chatId, testText(kind));
            } catch (e) {
                return badRequest(`Telegram отказал: ${e instanceof Error ? e.message : "неизвестная ошибка"}`);
            }
            return NextResponse.json({ ok: true });
        }

        // «найти чат»: забираем последнее сообщение, отправленное боту, и запоминаем, откуда оно
        if (action === "find-chat") {
            const current = await telegramBot(kind);
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
            await setTelegramBot(kind, botToken, chatId);
            // Проверочное сообщение уходит тем же путём, что и настоящие: иначе непонятно, работает ли настройка
            if (kind === "notify") await notifyTeamTelegram(testText("notify"));
            else await reportError(new Error("Проверка отчётов: бот на связи, отчёты об ошибках настроены."), { where: "проверка" });
            return NextResponse.json({ ok: true });
        }

        return badRequest("Unknown action");
    } catch (e) {
        return serverError(e);
    }
}
