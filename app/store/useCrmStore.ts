import { create } from "zustand";

export interface Stage {
    _id: string;
    name: string;
    order: number;
}

export interface Deal {
    _id: string;
    stage: string; // id стадии
    clientName: string;
    order: number;
}

interface CrmStore {
    stages: Stage[];
    deals: Deal[];
    isLoading: boolean;
    fetchAll: () => Promise<void>;

    addStage: (name: string) => Promise<void>;
    renameStage: (id: string, name: string) => Promise<void>;
    deleteStage: (id: string) => Promise<void>;

    addDeal: (stageId: string, clientName: string) => Promise<void>;
    moveDeal: (dealId: string, toStageId: string, toOrder: number) => Promise<void>;
    deleteDeal: (id: string) => Promise<void>;
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
    };
}

export const useCrmStore = create<CrmStore>((set, get) => ({
    stages: [],
    deals: [],
    isLoading: false,

    fetchAll: async () => {
        set({ isLoading: true });
        const [stagesRes, dealsRes] = await Promise.all([
            fetch("/api/stages", { headers: authHeaders() }),
            fetch("/api/deals", { headers: authHeaders() }),
        ]);
        const stages = stagesRes.ok ? await stagesRes.json() : [];
        const deals = dealsRes.ok ? await dealsRes.json() : [];
        set({ stages, deals, isLoading: false });
    },

    addStage: async (name) => {
        const res = await fetch("/api/stages", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ name }),
        });
        if (res.ok) {
            const stage = await res.json();
            set({ stages: [...get().stages, stage] });
        }
    },

    renameStage: async (id, name) => {
        const res = await fetch(`/api/stages/${id}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ name }),
        });
        if (res.ok) {
            const updated = await res.json();
            set({ stages: get().stages.map((s) => (s._id === id ? updated : s)) });
        }
    },

    deleteStage: async (id) => {
        const res = await fetch(`/api/stages/${id}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) {
            set({
                stages: get().stages.filter((s) => s._id !== id),
                deals: get().deals.filter((d) => d.stage !== id), // сервер тоже удалил их сделки — синхронизируем локально
            });
        }
    },

    addDeal: async (stageId, clientName) => {
        const res = await fetch("/api/deals", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ stage: stageId, clientName }),
        });
        if (res.ok) {
            const deal = await res.json();
            set({ deals: [...get().deals, deal] });
        }
    },

    // вызывается при завершении drag&drop — сразу обновляем локально (для плавности UI),
    // и отправляем PATCH на сервер, чтобы сохранить новую стадию/порядок
    moveDeal: async (dealId, toStageId, toOrder) => {
        set({
            deals: get().deals.map((d) =>
                d._id === dealId ? { ...d, stage: toStageId, order: toOrder } : d
            ),
        });
        await fetch(`/api/deals/${dealId}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({ stage: toStageId, order: toOrder }),
        });
    },

    deleteDeal: async (id) => {
        const res = await fetch(`/api/deals/${id}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) set({ deals: get().deals.filter((d) => d._id !== id) });
    },
}));