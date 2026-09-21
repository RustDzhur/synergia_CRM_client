import Notification from "@/models/Notification";

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
