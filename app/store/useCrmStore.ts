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
    reorderStages: (fromIndex: number, toIndex: number) => Promise<void>;

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

    // перенос целого столбца влево/вправо: сразу меняем порядок локально (анимацию рисует dnd),
    // затем сохраняем на сервере; при ошибке перезагружаем данные
    reorderStages: async (fromIndex, toIndex) => {
        const sorted = [...get().stages].sort((a, b) => a.order - b.order);
        const [moved] = sorted.splice(fromIndex, 1);
        if (!moved) return;
        sorted.splice(toIndex, 0, moved);
        const reordered = sorted.map((s, i) => ({ ...s, order: i }));
        set({ stages: reordered });

        const res = await fetch("/api/stages/reorder", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ ids: reordered.map((s) => s._id) }),
        });
        if (!res.ok) await get().fetchAll();
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

    // Вызывается при завершении drag&drop карточки. Раньше менялся order только у самой карточки,
    // а у соседей оставался прежним — порядок «ломался» (одинаковые order). Теперь order
    // пересчитывается 0..n-1 в столбце-приёмнике и (если столбец сменился) в столбце-источнике.
    // Локально обновляем сразу (плавность), на сервер отправляем только изменившиеся карточки.
    moveDeal: async (dealId, toStageId, toIndex) => {
        const before = get().deals;
        const moving = before.find((d) => d._id === dealId);
        if (!moving) return;

        const lane = (stageId: string) =>
            before
                .filter((d) => d.stage === stageId && d._id !== dealId)
                .sort((a, b) => a.order - b.order);

        const target = lane(toStageId);
        target.splice(toIndex, 0, { ...moving, stage: toStageId });

        const changes = new Map<string, { stage: string; order: number }>();
        target.forEach((d, i) => changes.set(d._id, { stage: toStageId, order: i }));
        if (moving.stage !== toStageId) {
            lane(moving.stage).forEach((d, i) => changes.set(d._id, { stage: moving.stage, order: i }));
        }

        set({ deals: before.map((d) => (changes.has(d._id) ? { ...d, ...changes.get(d._id)! } : d)) });

        const original = new Map(before.map((d) => [d._id, d]));
        await Promise.all(
            Array.from(changes.entries())
                .filter(([id, c]) => original.get(id)!.stage !== c.stage || original.get(id)!.order !== c.order)
                .map(([id, c]) =>
                    fetch(`/api/deals/${id}`, {
                        method: "PATCH",
                        headers: authHeaders(),
                        body: JSON.stringify(c),
                    })
                )
        );
    },

    deleteDeal: async (id) => {
        const res = await fetch(`/api/deals/${id}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) set({ deals: get().deals.filter((d) => d._id !== id) });
    },
}));