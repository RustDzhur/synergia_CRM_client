import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { getUpdates, sendTelegram } from "@/lib/channels/telegram";
import { firmNotifyBot, setFirmNotifyBot } from "@/lib/firmNotify";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

// Бот фирмы для рабочих уведомлений в Telegram: посетитель написал в чат на сайте, оставил контакт,
// прислал файл, пришло письмо. Свой у каждой фирмы — уведомления о клиентах одной фирмы не должны
// попадать ни другой фирме, ни владельцу платформы (у того свой бот, только для ошибок приложения).
//
// GET  — что настроено сейчас
// POST — { action }: "find-chat" (найти чат по сообщению боту), "save", "test" (проверочное сообщение)
//
// Менять может только владелец или администратор фирмы: токен бота — это доступ к переписке фирмы.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        const bot = await firmNotifyBot(user.id);
        return NextResponse.json({ hasToken: !!bot.botToken, chatId: bot.chatId });
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
        if (action === "find-chat") {
            // Токен в поле или уже сохранённый: искать чат можно до сохранения — так его и находят
            const current = await firmNotifyBot(user.id);
            const token = botToken || current.botToken;
            if (!token) return badRequest("Вставьте токен бота от @BotFather");
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
            if (!chatId) return badRequest("Чат не найден: напишите боту сообщение и нажмите «Найти чат»");
            // Сначала проверяем, потом сохраняем: иначе неверный токен записался бы, а уведомления
            // после этого молча не уходили бы (отправка глотает сбои, чтобы не ломать приём сообщений).
            const current = await firmNotifyBot(user.id);
            const token = botToken || current.botToken;
            if (!token) return badRequest("Вставьте токен бота от @BotFather");
            try {
                await sendTelegram(token, chatId, `🟢 Проверка уведомлений: бот фирмы «${user.orgName}» на связи.\n\nвремя: ${new Date().toISOString()}`);
            } catch (e) {
                return badRequest(`Telegram отказал: ${e instanceof Error ? e.message : "неизвестная ошибка"}`);
            }
            await setFirmNotifyBot(user.id, token === current.botToken ? "" : botToken, chatId);
            return NextResponse.json({ ok: true });
        }

        // «сбросить»: отключает уведомления — токен и чат стираются
        if (action === "clear") {
            await setFirmNotifyBot(user.id, "", "");
            await Organization.updateOne({ _id: user.id }, { $set: { "notify.botToken": "", "notify.chatId": "" } });
            return NextResponse.json({ ok: true });
        }

        if (action === "test") {
            const bot = await firmNotifyBot(user.id);
            if (!bot.botToken || !bot.chatId) return badRequest("Бот не настроен");
            try {
                await sendTelegram(bot.botToken, bot.chatId, `🟢 Проверка уведомлений: бот фирмы «${user.orgName}» на связи.\n\nвремя: ${new Date().toISOString()}`);
            } catch (e) {
                return badRequest(`Telegram отказал: ${e instanceof Error ? e.message : "неизвестная ошибка"}`);
            }
            return NextResponse.json({ ok: true });
        }

        return badRequest("Unknown action");
    } catch (e) {
        return serverError(e);
    }
}
