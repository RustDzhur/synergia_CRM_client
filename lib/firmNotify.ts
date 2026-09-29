import { decryptJSON, encryptJSON } from "@/lib/crypto";
import Organization from "@/models/Organization";

// Бот фирмы для рабочих уведомлений в Telegram: посетитель написал в чат на сайте, оставил контакт,
// прислал файл, пришло письмо на почту фирмы. Бот у каждой фирмы свой — уведомления о клиентах одной
// фирмы не должны попадать ни к другой фирме, ни владельцу платформы. Платформенный бот (админка,
// «Отчёты об ошибках») остаётся только для поломок самого приложения.
//
// Настраивается в кабинете: Настройки → Интеграции → «Уведомления команде». Чат находится так же,
// как у бота ошибок: пишем боту любое сообщение и забираем его через getUpdates (lib/channels/telegram).

export interface FirmNotifyBot { botToken: string; chatId: string }

export async function firmNotifyBot(org: string): Promise<FirmNotifyBot> {
    const doc = await Organization.findById(org).select("notify").lean<{ notify?: { botToken?: string; chatId?: string } }>().catch(() => null);
    const raw = doc?.notify?.botToken ?? "";
    const secrets = raw ? decryptJSON<{ botToken?: string }>(raw) : {};
    return { botToken: String(secrets.botToken ?? ""), chatId: String(doc?.notify?.chatId ?? "") };
}

/** Сохраняет бота фирмы. Пустой токен оставляет прежний: его не показываем и не переписываем зря. */
export async function setFirmNotifyBot(org: string, botToken: string, chatId: string): Promise<void> {
    const set: Record<string, string> = { "notify.chatId": chatId.trim() };
    if (botToken.trim()) set["notify.botToken"] = encryptJSON({ botToken: botToken.trim() });
    await Organization.updateOne({ _id: org }, { $set: set });
}
