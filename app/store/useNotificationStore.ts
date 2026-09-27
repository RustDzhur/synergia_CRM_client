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
    /** false — сервер отметку не подтвердил (интерфейс вернулся к настоящему состоянию) */
    markRead: (ids: string[]) => Promise<boolean>;
    markAll: () => Promise<boolean>;
    takeFresh: () => Notif[];
}

// «Объявляем» (тост, полоса, сигнал) только свежие непрочитанные уведомления (до 90 с) и по одному разу: при открытии страницы
// старые не всплывают, а созданное секунду назад — покажется независимо от того, какой опрос успел раньше.
const announced = new Set<string>();
const FRESH_MS = 90_000;

// Отмечено прочитанным в этой вкладке, но сервер мог ещё не подтвердить: опрос (раз в 30 с) идёт независимо от клика
// «прочитано», и если его ответ придёт раньше, чем завершится POST /notifications/read, он принесёт ещё старые данные
// и отменит отметку в интерфейсе. Помним такие id и считаем их прочитанными, пока сервер не пришлёт того же.
const readLocally = new Set<string>();

// До какого момента ответам опроса верим: запрос, отправленный раньше завершения отметки «прочитано», посчитан
// по состоянию до неё, и его число непрочитанных уже устарело. Пока отметка в пути — счётчик из опроса не принимаем.
const MARKING = Number.MAX_SAFE_INTEGER;
let countsTrustedFrom = 0;

export const useNotificationStore = create<NotificationStore>()((set, get) => {
    // Отправляет отметку на сервер и берёт из ответа настоящее число непрочитанных (в списке приходят только последние
    // 50 уведомлений, а непрочитанные могут быть старше — на клиенте их не сосчитать). Если сервер отметку не подтвердил,
    // возвращаем всё как было и перечитываем состояние: показать правду лучше, чем «обнулённый» счётчик.
    const confirm = async (body: { ids?: string[]; all?: true }, revertIds: string[]) => {
        countsTrustedFrom = MARKING;
        const res = await apiCall<{ unread: number }>("/api/notifications/read", "POST", body);
        countsTrustedFrom = Date.now();
        if (res.ok && typeof res.data?.unread === "number") {
            set({ unread: res.data.unread });
            return true;
        }
        revertIds.forEach((id) => readLocally.delete(id));
        await get().load();
        return false;
    };

    return {
        items: [],
        unread: 0,
        open: false,
        fresh: [],

        load: async () => {
            const startedAt = Date.now();
            // no-store: иначе браузер может отдать список из кэша вместе со старым числом непрочитанных
            const res = await apiCall<{ items: Notif[]; unread: number }>("/api/notifications", "GET", undefined, { cache: "no-store" });
            if (!res.ok || !res.data) return;
            const fresh = res.data.items.filter((n) => !n.read && !announced.has(n.id) && Date.now() - new Date(n.at).getTime() < FRESH_MS);
            fresh.forEach((n) => announced.add(n.id));
            const items = res.data.items.map((n) => (readLocally.has(n.id) ? { ...n, read: true } : n));
            // число непрочитанных — всегда серверное; но ответ, посчитанный до отметки «прочитано», оставляем без внимания
            const unread = startedAt < countsTrustedFrom ? get().unread : res.data.unread;
            set({ items, unread, fresh: [...get().fresh, ...fresh] });
        },

        toggle: () => set((s) => ({ open: !s.open })),
        close: () => set({ open: false }),

        markRead: async (ids) => {
            if (!ids.length) return true;
            ids.forEach((id) => readLocally.add(id));
            set((s) => ({ items: s.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)), unread: Math.max(0, s.unread - s.items.filter((n) => ids.includes(n.id) && !n.read).length) }));
            return confirm({ ids }, ids);
        },
        markAll: async () => {
            const ids = get().items.map((n) => n.id);
            ids.forEach((id) => readLocally.add(id));
            set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unread: 0 }));
            return confirm({ all: true }, ids);
        },

        takeFresh: () => {
            const f = get().fresh;
            if (f.length) set({ fresh: [] });
            return f;
        },
    };
});
