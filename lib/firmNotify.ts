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


// ── Отдельный бот Айрис ──
// Бот уведомлений (выше) только присылает рабочие сообщения команде. Айрис — другой бот, со своей аватаркой и своим токеном:
// с ним человек разговаривает (текстом и голосовыми), а Айрис делает дела в CRM и отвечает. Хранится рядом, в notify.iris;
// токен шифруется так же, как токен бота уведомлений. Слушается только сохранённый чат, действия идут с правами того,
// кто подключил бота (controlUser).
export interface IrisBot { botToken: string; chatId: string; enabled: boolean; controlUser: string; offset: number }

export async function irisBot(org: string): Promise<IrisBot> {
    const doc = await prisma.organization.findUnique({ where: { id: org }, select: { notify: true } }).catch(() => null);
    const iris = ((doc?.notify as any) ?? {}).iris ?? {};
    const secrets = iris.botToken ? decryptJSON<{ botToken?: string }>(iris.botToken) : {};
    return { botToken: String(secrets.botToken ?? ""), chatId: String(iris.chatId ?? ""), enabled: iris.enabled === true, controlUser: String(iris.controlUser ?? ""), offset: Number(iris.offset) || 0 };
}

/** Сохраняет часть настроек бота Айрис; пустой/не заданный токен оставляет прежний. */
export async function setIrisBot(org: string, patch: Partial<Omit<IrisBot, "botToken">> & { botToken?: string }): Promise<void> {
    const doc = await prisma.organization.findUnique({ where: { id: org }, select: { notify: true } });
    const prev = (doc?.notify as any) ?? {};
    const cur = prev.iris ?? {};
    const { botToken, ...rest } = patch;
    const next = { ...cur, ...rest, ...(botToken ? { botToken: encryptJSON({ botToken: botToken.trim() }) } : {}) };
    await prisma.organization.update({ where: { id: org }, data: { notify: { ...prev, iris: next } as any } });
}

export async function clearIrisBot(org: string): Promise<void> {
    const doc = await prisma.organization.findUnique({ where: { id: org }, select: { notify: true } });
    const prev = (doc?.notify as any) ?? {};
    const { iris: _gone, control: _old, controlUser: _old2, ...rest } = prev;
    await prisma.organization.update({ where: { id: org }, data: { notify: rest as any } });
}
