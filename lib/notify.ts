import { prisma } from "@/lib/prisma";

export interface NotifyInput {
    type: string;
    params?: Record<string, string | number>;
    link?: string;
    key?: string; // повтор с тем же key игнорируется
    user?: string; // только этому участнику
}

// Создаёт уведомление фирме. Ошибки не пробрасываем: уведомление не должно ломать основное действие.
export async function notify(org: string, n: NotifyInput) {
    try {
        // Повтор с тем же ключом игнорируется: раньше это держал уникальный индекс (org+key) в Mongo
        if (n.key) {
            const existing = await prisma.notification.findFirst({ where: { org, key: n.key }, select: { id: true } });
            if (existing) return false;
        }
        await prisma.notification.create({ data: { org, user: n.user, type: n.type, params: (n.params ?? {}) as any, link: n.link ?? "", key: n.key } });
        return true;
    } catch (e) {
        console.error("notify failed", e);
        return false;
    }
}

// Уведомляет участников фирмы, кроме автора действия (свои же сообщения не уведомляют). only — ограничить получателей.
export async function notifyMembers(org: string, n: Omit<NotifyInput, "user">, opts: { except?: string; only?: string[] } = {}) {
    try {
        const members = await prisma.membership.findMany({ where: { org }, select: { user: true } });
        const ids = members.map((m) => String(m.user)).filter((id) => id !== opts.except && (!opts.only || opts.only.includes(id)));
        await Promise.all(ids.map((user) => notify(org, { ...n, user, key: n.key ? `${n.key}:${user}` : undefined })));
    } catch (e) {
        console.error("notifyMembers failed", e);
    }
}

// Кто видит уведомление: вся фирма (поле user пусто) и адресованные лично этому участнику.
export function visibleTo(org: string, userId: string) {
    return { org, OR: [{ user: null }, { user: userId }] };
}

// То же самое плюс «я ещё не читал» — для подсчёта непрочитанных.
export const unreadFor = (org: string, userId: string) => ({ org, OR: [{ user: null }, { user: userId }], NOT: { readBy: { has: userId } } });
