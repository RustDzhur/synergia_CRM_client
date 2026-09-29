import { sendTelegram } from "@/lib/channels/telegram";
import { firmNotifyBot } from "@/lib/firmNotify";

// Уведомление команде в Telegram о входящем: посетитель написал в чат на сайте, оставил контакт,
// прислал файл, поставил оценку — и то же самое для Viber, Telegram, WhatsApp, SMS и почты.
//
// Бот у каждой фирмы СВОЙ (Настройки → Интеграции → «Уведомления команде»): уведомления о клиентах
// одной фирмы не должны попадать ни другой фирме, ни владельцу платформы. Если фирма бота не
// настроила — молча выходим: уведомление всё равно создано в кабинете (lib/notify.ts), а чужой бот
// здесь не годится как запасной. Сбой отправки не должен ломать приём сообщения.
export async function notifyTeamTelegram(org: string, text: string): Promise<void> {
    try {
        const bot = await firmNotifyBot(org);
        if (!bot.botToken || !bot.chatId) return;
        await sendTelegram(bot.botToken, bot.chatId, text);
    } catch {
        // уведомление не должно мешать основному действию
    }
}
