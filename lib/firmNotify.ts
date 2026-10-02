import { decryptJSON, encryptJSON } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

// Бот фирмы для рабочих уведомлений в Telegram: посетитель написал в чат на сайте, оставил контакт,
// прислал файл, пришло письмо на почту фирмы. Бот у каждой фирмы свой — уведомления о клиентах одной
// фирмы не должны попадать ни к другой фирме, ни владельцу платформы.
//
// Настраивается в кабинете: Настройки → Интеграции → «Уведомления команде».

export interface FirmNotifyBot { botToken: string; chatId: string }

export async function firmNotifyBot(org: string): Promise<FirmNotifyBot> {
    const doc = await prisma.organization.findUnique({ where: { id: org }, select: { notify: true } }).catch(() => null);
    const notify = (doc?.notify as any) ?? {};
    const raw = notify.botToken ?? "";
    const secrets = raw ? decryptJSON<{ botToken?: string }>(raw) : {};
    return { botToken: String(secrets.botToken ?? ""), chatId: String(notify.chatId ?? "") };
}

/** Сохраняет бота фирмы. Пустой токен оставляет прежний: его не показываем и не переписываем зря. */
export async function setFirmNotifyBot(org: string, botToken: string, chatId: string): Promise<void> {
    const doc = await prisma.organization.findUnique({ where: { id: org }, select: { notify: true } });
    const prev = (doc?.notify as any) ?? {};
    const next = { ...prev, chatId: chatId.trim(), ...(botToken.trim() ? { botToken: encryptJSON({ botToken: botToken.trim() }) } : {}) };
    await prisma.organization.update({ where: { id: org }, data: { notify: next as any } });
}
