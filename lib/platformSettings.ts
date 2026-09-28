import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { connectDB } from "@/lib/mongodb";
import PlatformSettings from "@/models/PlatformSettings";

// Приложение Meta — одно на платформу: через него любая фирма подключает свою страницу Facebook
// или номер WhatsApp, и своего приложения у клиента нет. Поэтому ключи хранятся здесь, а не у фирмы.
// Переменные окружения остаются запасным путём: так это уже настроено для рекламных кабинетов,
// и на сервере, где они заданы, настройка из кабинета не нужна.

const KEY = "metaApp";

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
