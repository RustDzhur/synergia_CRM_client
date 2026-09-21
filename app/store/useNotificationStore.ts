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
        set({ items: res.data.items, unread: res.data.unread, fresh: [...get().fresh, ...fresh] });
    },

    toggle: () => set((s) => ({ open: !s.open })),
    close: () => set({ open: false }),

    markRead: async (ids) => {
        if (!ids.length) return;
        set((s) => ({ items: s.items.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)), unread: Math.max(0, s.unread - s.items.filter((n) => ids.includes(n.id) && !n.read).length) }));
        await apiCall("/api/notifications/read", "POST", { ids });
    },
    markAll: async () => {
        set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unread: 0 }));
        await apiCall("/api/notifications/read", "POST", { all: true });
    },

    takeFresh: () => {
        const f = get().fresh;
        if (f.length) set({ fresh: [] });
        return f;
    },
}));
