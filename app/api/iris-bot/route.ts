import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { deleteWebhook, getMe, getUpdates, sendTelegram } from "@/lib/channels/telegram";
import { clearIrisBot, firmNotifyBot, irisBot, setIrisBot } from "@/lib/firmNotify";

export const dynamic = "force-dynamic";

// Отдельный бот Айрис в Telegram (со своей аватаркой и токеном): с ним разговаривают текстом и голосовыми, Айрис выполняет
// просьбы в CRM и отвечает. Это НЕ бот уведомлений (/api/notify-settings): тот лишь присылает рабочие сообщения команде.
//
// GET  — что настроено
// POST — { action }: "find-chat" (найти свой чат по сообщению боту), "save" (проверить и включить), "clear" (отключить)
// Менять может только владелец или администратор: бот выполняет действия в CRM с правами того, кто его подключил.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        const bot = await irisBot(user.id);
        let username = "";
        if (bot.botToken) username = await getMe(bot.botToken).then((m) => m.username).catch(() => "");
        return NextResponse.json({ hasToken: !!bot.botToken, chatId: bot.chatId, enabled: bot.enabled, username });
    } catch (e) {
        return serverError(e);
    }
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (user.role !== "owner" && user.role !== "admin") return NextResponse.json({ message: "Only the owner or an administrator can change this", code: "forbidden" }, { status: 403 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(b.action ?? "");
    const botToken = String(b.botToken ?? "").trim();
    const chatId = String(b.chatId ?? "").trim();
    try {
        const current = await irisBot(user.id);
        const token = botToken || current.botToken;

        if (action === "find-chat") {
            if (!token) return badRequest("Вставьте токен бота Айрис от @BotFather");
            const updates = await getUpdates(token, 0);
            const chats = (updates ?? []).map((u) => u.message?.chat).filter((c): c is NonNullable<typeof c> => !!c && c.type === "private");
            const last = chats[chats.length - 1];
            if (!last) return badRequest("Боту Айрис ещё не писали: откройте его в Telegram, нажмите Start или отправьте любое сообщение и повторите");
            const name = [last.first_name, last.last_name].filter(Boolean).join(" ") || last.username || String(last.id);
            return NextResponse.json({ chatId: String(last.id), name });
        }

        if (action === "save") {
            if (!token) return badRequest("Вставьте токен бота Айрис от @BotFather");
            if (!chatId) return badRequest("Чат не найден: напишите боту Айрис сообщение и нажмите «Найти чат»");
            // Бот Айрис должен быть другим ботом, не тем, что присылает уведомления: иначе сообщения команде и разговор с Айрис смешались бы
            const notify = await firmNotifyBot(user.id);
            if (notify.botToken && notify.botToken === token) return badRequest("Это тот же бот, что присылает уведомления. Создайте для Айрис отдельного бота у @BotFather");
            let me: { username: string };
            try {
                me = await getMe(token);
                await deleteWebhook(token).catch(() => undefined); // для бота Айрис сообщения забирает сам сервер
                await sendTelegram(token, chatId, "Привет! Я Айрис. Пишите мне (текстом или голосовым), что сделать в CRM — выполню и отвечу здесь. /help — подсказка.");
            } catch (e) {
                return badRequest(`Telegram отказал: ${e instanceof Error ? e.message : "неизвестная ошибка"}`);
            }
            await setIrisBot(user.id, { botToken: botToken || undefined, chatId, enabled: true, controlUser: user.userId, offset: 0 });
            return NextResponse.json({ ok: true, username: me.username });
        }

        if (action === "clear") {
            await clearIrisBot(user.id);
            return NextResponse.json({ ok: true });
        }

        return badRequest("Unknown action");
    } catch (e) {
        return serverError(e);
    }
}
