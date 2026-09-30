import { create } from "zustand";
import type { Role } from "@/lib/access";
import type { FeatureKey } from "@/config/plans";
import { ORG_KEY, apiCall } from "./crmApi";

// features — разделы, доступные фирме по тарифу (плюс то, что выдал администратор платформы вручную).
// Меню и страницы показывают только их; чего нет — то закрыто и на сервере.
export interface Org { id: string; name: string; role: Role; plan: string; modules: string[]; features: Partial<Record<FeatureKey, boolean>>; blocked: boolean; personal: boolean; activities?: string[] }

interface OrgStore {
    orgs: Org[];
    activeId: string;
    loaded: boolean;
    load: () => Promise<void>;
    switchOrg: (id: string) => void;
    create: (name: string) => Promise<{ ok: boolean; message: string }>;
    rename: (name: string) => Promise<{ ok: boolean; message: string }>;
    // Мастер видов деятельности (ТЗ §18): по списку разделы показываются или скрываются
    saveActivities: (activities: string[]) => Promise<{ ok: boolean; message: string }>;
}

export const useOrgStore = create<OrgStore>()((set, get) => ({
    orgs: [],
    activeId: "",
    loaded: false,

    load: async () => {
        const res = await apiCall<{ orgs: Org[]; activeId: string }>("/api/orgs");
        if (!res.ok || !res.data) return void set({ loaded: true });
        set({ orgs: res.data.orgs, activeId: res.data.activeId, loaded: true });
        // сервер мог вернуть личную фирму вместо запрошенной (доступ отозван) — запоминаем то, что реально активно
        try { localStorage.setItem(ORG_KEY, res.data.activeId); } catch { /* приватный режим */ }
    },

    // Данные всех разделов привязаны к фирме, поэтому после переключения страница загружается заново
    switchOrg: (id) => {
        try { localStorage.setItem(ORG_KEY, id); } catch { /* приватный режим */ }
        window.location.reload();
    },

    create: async (name) => {
        const res = await apiCall<{ id: string }>("/api/orgs", "POST", { name });
        if (res.ok && res.data) get().switchOrg(res.data.id);
        return { ok: res.ok, message: res.message };
    },

    rename: async (name) => {
        const id = get().activeId;
        const res = await apiCall<{ name: string }>(`/api/orgs/${id}`, "PATCH", { name });
        if (res.ok && res.data) set({ orgs: get().orgs.map((o) => (o.id === id ? { ...o, name: res.data!.name } : o)) });
        return { ok: res.ok, message: res.message };
    },

    saveActivities: async (activities) => {
        const id = get().activeId;
        const res = await apiCall<{ activities: string[] }>(`/api/orgs/${id}`, "PATCH", { activities });
        if (res.ok && res.data) set({ orgs: get().orgs.map((o) => (o.id === id ? { ...o, activities: res.data!.activities } : o)) });
        return { ok: res.ok, message: res.message };
    },
}));

export const useActiveOrg = () => useOrgStore((s) => s.orgs.find((o) => o.id === s.activeId) ?? null);

// Доступен ли раздел в текущей фирме. Пока список фирм не загружен, ничего не прячем — иначе при первом
// рендере мигало бы пустое меню, а сервер всё равно не отдаст данные закрытого раздела.
export const useFeature = (key: FeatureKey) => {
    const org = useActiveOrg();
    const loaded = useOrgStore((s) => s.loaded);
    if (!org || !loaded) return true;
    return org.features?.[key] !== false;
};
