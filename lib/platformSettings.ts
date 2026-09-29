import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { connectDB } from "@/lib/mongodb";
import PlatformSettings from "@/models/PlatformSettings";

// Приложение Meta — одно на платформу: через него любая фирма подключает свою страницу Facebook
// или номер WhatsApp, и своего приложения у клиента нет. Поэтому ключи хранятся здесь, а не у фирмы.
// Переменные окружения остаются запасным путём: так это уже настроено для рекламных кабинетов,
// и на сервере, где они заданы, настройка из кабинета не нужна.

const KEY = "metaApp";

// Боты платформы в Telegram. Их два, и они не должны мешать друг другу: один присылает только
// отчёты об ошибках, второй — рабочие уведомления (посетитель написал в чат, оставил контакт,
// пришло письмо). Раньше бот был один, и контакты с сайта падали в тот же чат, где ошибки.
// У каждого — своя настройка в админке и свои переменные окружения на случай, когда настройки нет.
export interface TelegramBot { botToken: string; chatId: string }

const BOTS = {
    error: { key: "errorBot", envToken: "TELEGRAM_BOT_TOKEN", envChat: "TELEGRAM_ERROR_CHAT_ID" },
    notify: { key: "notifyBot", envToken: "TELEGRAM_NOTIFY_BOT_TOKEN", envChat: "TELEGRAM_NOTIFY_CHAT_ID" },
} as const;

export type BotKind = keyof typeof BOTS;

// Бот для отчётов об ошибках: свой отдельный бот платформы (не бот фирмы для переписки с клиентами).
// Чат ищется сам — бот получает сообщение, мы забираем его через getUpdates и запоминаем чат,
// поэтому искать числовой id вручную не нужно.
export async function telegramBot(kind: BotKind): Promise<TelegramBot> {
    const cfg = BOTS[kind];
    const fromEnv = { botToken: process.env[cfg.envToken] ?? "", chatId: process.env[cfg.envChat] ?? "" };
    // Настройка из кабинета важнее переменных окружения: там чат находится сам, а в переменных легко
    // ошибиться — например, вписать id бота, которому Telegram писать не разрешает.
    const doc = await connectDB().then(() => PlatformSettings.findOne({ key: cfg.key })).catch(() => null);
    if (!doc) return fromEnv;
    const secrets = doc.secrets ? decryptJSON<{ botToken?: string }>(doc.secrets) : {};
    return { botToken: String(secrets.botToken || fromEnv.botToken), chatId: String(doc.value || fromEnv.chatId) };
}

/** Сохраняет бота и чат. Пустой токен оставляет прежний: его не показываем и не переписываем зря. */
export async function setTelegramBot(kind: BotKind, botToken: string, chatId: string): Promise<void> {
    await connectDB();
    await PlatformSettings.updateOne(
        { key: BOTS[kind].key },
        { $set: { value: chatId.trim(), ...(botToken.trim() ? { secrets: encryptJSON({ botToken: botToken.trim() }) } : {}) } },
        { upsert: true }
    );
}

// Значения пришли из переменных окружения (в кабинете ничего не сохранено): интерфейс показывает это
// отдельной пометкой, потому что переписать их из админки нельзя
export const botConfiguredFromEnv = (kind: BotKind) =>
    !!(process.env[BOTS[kind].envToken] && process.env[BOTS[kind].envChat]);

export const errorBot = () => telegramBot("error");
export const setErrorBot = (botToken: string, chatId: string) => setTelegramBot("error", botToken, chatId);
export const notifyBot = () => telegramBot("notify");
export const setNotifyBot = (botToken: string, chatId: string) => setTelegramBot("notify", botToken, chatId);

export interface MetaApp { appId: string; appSecret: string }

export async function metaApp(): Promise<MetaApp> {
    const fromEnv = { appId: process.env.META_APP_ID ?? "", appSecret: process.env.META_APP_SECRET ?? "" };
    if (fromEnv.appId && fromEnv.appSecret) return fromEnv;
    const doc = await connectDB().then(() => PlatformSettings.findOne({ key: KEY })).catch(() => null);
    if (!doc) return fromEnv;
    const secrets = doc.secrets ? decryptJSON<{ appSecret?: string }>(doc.secrets) : {};
    return { appId: String(doc.value || fromEnv.appId), appSecret: String(secrets.appSecret || fromEnv.appSecret) };
}

/** Сохраняет ключи приложения. Пустой секрет оставляет прежний: его не показываем и не переписываем зря. */
export async function setMetaApp(appId: string, appSecret: string): Promise<void> {
    await connectDB();
    await PlatformSettings.updateOne(
        { key: KEY },
        { $set: { value: appId.trim(), ...(appSecret.trim() ? { secrets: encryptJSON({ appSecret: appSecret.trim() }) } : {}) } },
        { upsert: true }
    );
}
