import { sendTelegram } from "@/lib/channels/telegram";
import { errorBot, notifyBot } from "@/lib/platformSettings";

// Уведомление команде в Telegram: посетитель написал в чат на сайте, оставил контакт, прислал файл,
// поставил оценку — и то же самое для Viber, Telegram, WhatsApp, SMS и почты (см. lib/channels).
//
// Идёт отдельному боту уведомлений: у ошибок свой бот, и смешивать их нельзя — в чате с ошибками
// рабочие сообщения теряются, а в рабочем чате шумят падения. Пока второй бот не настроен,
// уведомления идут боту ошибок — так ничего не пропадёт до настройки.
export async function notifyTeamTelegram(text: string): Promise<void> {
    try {
        let bot = await notifyBot();
        if (!bot.botToken || !bot.chatId) bot = await errorBot();
        if (!bot.botToken || !bot.chatId) return;
        await sendTelegram(bot.botToken, bot.chatId, text);
    } catch {
        // уведомление не должно мешать основному действию
    }
}
