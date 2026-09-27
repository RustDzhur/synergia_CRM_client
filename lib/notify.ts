import { Types } from "mongoose";
import Notification from "@/models/Notification";
import Membership from "@/models/Membership";

export interface NotifyInput {
    type: string;
    params?: Record<string, string | number>;
    link?: string;
    key?: string; // повтор с тем же key игнорируется
    user?: string; // только этому участнику
}

// Создаёт уведомление фирме. Ошибки не пробрасываем: уведомление не должно ломать основное действие (приём письма, звонка…).
export async function notify(org: string, n: NotifyInput) {
    try {
        await Notification.create({ org, user: n.user, type: n.type, params: n.params ?? {}, link: n.link ?? "", key: n.key });
        return true;
    } catch (e) {
        if ((e as { code?: number }).code !== 11000) console.error("notify failed", e);
        return false;
    }
}

// Уведомляет участников фирмы, кроме автора действия (свои же сообщения не уведомляют). only — ограничить получателей.
export async function notifyMembers(org: string, n: Omit<NotifyInput, "user">, opts: { except?: string; only?: string[] } = {}) {
    try {
        const members = await Membership.find({ org }).select("user").lean();
        const ids = members.map((m) => String(m.user)).filter((id) => id !== opts.except && (!opts.only || opts.only.includes(id)));
        await Promise.all(ids.map((user) => notify(org, { ...n, user, key: n.key ? `${n.key}:${user}` : undefined })));
    } catch (e) {
        console.error("notifyMembers failed", e);
    }
}

// Кто видит уведомление: вся фирма (поле user пусто) и адресованные лично этому участнику.
// Один и тот же фильтр нужен списку (GET /api/notifications) и отметке «прочитано» (POST /api/notifications/read):
// если они разойдутся, число непрочитанных и сама отметка перестанут совпадать и счётчик «залипнет».
export function visibleTo(org: string, userId: string) {
    return {
        org: new Types.ObjectId(org),
        $or: [{ user: { $exists: false } }, { user: null }, { user: new Types.ObjectId(userId) }],
    };
}

// То же самое плюс «я ещё не читал» — для подсчёта непрочитанных.
export const unreadFor = (org: string, userId: string) => ({ ...visibleTo(org, userId), readBy: { $ne: new Types.ObjectId(userId) } });
