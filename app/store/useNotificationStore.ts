import { create } from "zustand";
import { apiCall } from "./crmApi";

export interface Notif { id: string; type: string; params: Record<string, string | number>; link: string; at: string; read: boolean }

interface NotificationStore {
    items: Notif[];
    unread: number;
    open: boolean;
    fresh: Notif[]; // появились с прошлого опроса и ещё не показаны (тост, верхняя полоса, системное уведомление)
    load: () => Promise<void>;
    toggle: () => void;
    close: () => void;
    markRead: (ids: string[]) => Promise<void>;
    markAll: () => Promise<void>;
    takeFresh: () => Notif[];
}

// «Объявляем» (тост, полоса, сигнал) только свежие непрочитанные уведомления (до 90 с) и по одному разу: при открытии страницы
// старые не всплывают, а созданное секунду назад — покажется независимо от того, какой опрос успел раньше.
const announced = new Set<string>();
const FRESH_MS = 90_000;

// Отмечено прочитанным в этой вкладке, но сервер мог ещё не подтвердить: опрос (раз в 30 с) идёт независимо от клика
// «прочитано», и если его ответ придёт раньше, чем завершится POST /notifications/read, он принесёт ещё старые данные
// и отменит отметку в интерфейсе. Помним такие id и принудительно считаем их прочитанными, пока опрос не увидит того же
// с сервера — после этого id можно забыть, но хранить их до конца сессии тоже безопасно (список отметок краткий).
const readLocally = new Set<string>();

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
    items: [],
    unread: 0,
    open: false,
    fresh: [],

    load: async () => {
        const res = await apiCall<{ items: Notif[]; unread: number }>("/api/notifications");
        if (!res.ok || !res.data) return;
        const fresh = res.data.items.filter((n) => !n.read && !announced.has(n.id) && Date.now() - new Date(n.at).getTime() < FRESH_MS);
        fresh.forEach((n) => announced.add(n.id));
        // сколько из непрочитанных (по мнению сервера) уже отмечены прочитанными здесь же, но ответ ещё не пришёл
        const stillCatchingUp = res.data.items.filter((n) => !n.read && readLocally.has(n.id)).length;
        const items = res.data.items.map((n) => (readLocally.has(n.id) ? { ...n, read: true } : n));
        set({ items, unread: Math.max(0, res.data.unread - stillCatchingUp), fresh: [...get().fresh, ...fresh] });
    },

    toggle: () => set((s) => ({ open: !s.open })),
    close: () => set({ open: false }),

    markRead: async (ids) => {
        if (!ids.length) return;
        ids.forEach((id) => readLocally.add(id));
        set((s) => ({ items: s.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)), unread: Math.max(0, s.unread - s.items.filter((n) => ids.includes(n.id) && !n.read).length) }));
        await apiCall("/api/notifications/read", "POST", { ids });
    },
    markAll: async () => {
        get().items.forEach((n) => readLocally.add(n.id));
        set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unread: 0 }));
        await apiCall("/api/notifications/read", "POST", { all: true });
    },

    takeFresh: () => {
        const f = get().fresh;
        if (f.length) set({ fresh: [] });
        return f;
    },
}));
