import { create } from "zustand";
import type { IntegrationDTO, IntegrationType } from "@/app/types/integrations";
import { apiCall } from "./crmApi";

interface Result { ok: boolean; message: string; warning: string }

interface IntegrationsStore {
    items: IntegrationDTO[];
    loaded: boolean;
    load: () => Promise<void>;
    connect: (type: IntegrationType, data: Record<string, string>) => Promise<Result>;
    patch: (id: string, body: Record<string, string>) => Promise<Result>;
    remove: (id: string) => Promise<boolean>;
}

const replace = (list: IntegrationDTO[], next: IntegrationDTO) =>
    list.some((i) => i.id === next.id) ? list.map((i) => (i.id === next.id ? next : i)) : [...list, next];

export const useIntegrationsStore = create<IntegrationsStore>()((set, get) => ({
    items: [],
    loaded: false,

    load: async () => {
        const res = await apiCall<IntegrationDTO[]>("/api/integrations");
        if (res.ok && res.data) set({ items: res.data, loaded: true });
        else set({ loaded: true });
    },

    connect: async (type, data) => {
        const res = await apiCall<{ integration: IntegrationDTO; warning: string }>("/api/integrations", "POST", { type, ...data });
        if (!res.ok || !res.data) return { ok: false, message: res.message, warning: "" };
        set({ items: replace(get().items, res.data.integration) });
        return { ok: true, message: "", warning: res.data.warning };
    },

    patch: async (id, body) => {
        const res = await apiCall<IntegrationDTO>(`/api/integrations/${id}`, "PATCH", body);
        if (!res.ok || !res.data) return { ok: false, message: res.message, warning: "" };
        set({ items: replace(get().items, res.data) });
        return { ok: true, message: "", warning: res.data.status === "error" ? res.data.error : "" };
    },

    remove: async (id) => {
        const res = await apiCall(`/api/integrations/${id}`, "DELETE");
        if (res.ok) set({ items: get().items.filter((i) => i.id !== id) });
        return res.ok;
    },
}));
