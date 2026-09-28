import { sendTelegram } from "@/lib/channels/telegram";
import { errorBot } from "@/lib/platformSettings";

// Уведомление команде в Telegram: посетитель написал в чат на сайте, оставил контакт или поставил оценку.
// Идёт в тот же чат, что и отчёты об ошибках, — он задаётся в админке. Отдельного «рабочего» бота у платформы
// нет, а заводить второго ради этих сообщений — лишние настройки. Если чат не задан, молча выходим:
// уведомление не должно ломать приём сообщения.
export async function notifyTeamTelegram(text: string): Promise<void> {
    try {
        const bot = await errorBot();
        if (!bot.botToken || !bot.chatId) return;
        await sendTelegram(bot.botToken, bot.chatId, text);
    } catch {
        // уведомление не должно мешать основному действию
    }
}
