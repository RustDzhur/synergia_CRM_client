import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";

// Токены провайдеров (Twilio, Telegram, пароли почты) в базе хранятся только зашифрованными: AES-256-GCM.
// Ключ берётся из ENCRYPTION_KEY, а если его нет — из JWT_SECRET. Смена ключа делает старые записи нечитаемыми:
// подключения придётся ввести заново.
function key() {
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) throw new Error("ENCRYPTION_KEY or JWT_SECRET is not set");
    return createHash("sha256").update(secret).digest();
}

export function encryptJSON(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptJSON<T>(payload: string): T {
    const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")) as T;
}

export const randomToken = (bytes = 18) => randomBytes(bytes).toString("hex");

// Сравнение секретов за постоянное время (подписи вебхуков, verify-токены)
export function safeEqual(a: string, b: string) {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}
