import { create } from "zustand";
import type { Activity } from "@/types/crm";
import { api, apiCall, addActivityRequest, removeActivityRequest, NewActivity } from "./crmApi";

export interface Stage {
    _id: string;
    name: string;
    order: number;
    color?: string; // "#RRGGBB"; пусто — цвет по порядковому номеру
}

export interface Deal {
    _id: string;
    stage: string; // id стадии
    clientName: string; // название сделки («Name» / «New Task»)
    order: number;
    contactName?: string;
    companyName?: string;
    contact?: string | null; // id реального контакта, если выбран из подсказки (не просто вписан текстом)
    company?: string | null; // id реальной компании, аналогично
    startDate?: string; // "YYYY-MM-DD"
    endDate?: string;
    dealType?: string;
    responsible?: string;
    availableToAll?: boolean;
    utm?: string;
    recurring?: string;
    // разделы карточки, убранные кнопкой «Удалить раздел» («more», «recurring»): их данные очищены,
    // сами блоки не показываются, пока их не вернут кнопкой «Добавить раздел»
    hiddenSections?: string[];
    // время выигрыша: карточку вытянули за последний этап воронки; пусто — сделка ещё в работе
    wonAt?: string | null;
    // источник заявки: "" — завели вручную, иначе код площадки (prom, rozetka, horoshop, olx)
    source?: string;
    externalId?: string;
    activities?: Activity[];
    createdAt?: string;
    updatedAt?: string;
}

export type NewDeal = Pick<Deal, "clientName" | "contactName" | "companyName" | "contact" | "company" | "startDate" | "endDate">;
// won — команда серверу: true ставит отметку о выигрыше, false снимает (в самом Deal хранится wonAt)
export type DealUpdate = Partial<Omit<Deal, "_id" | "activities" | "createdAt" | "updatedAt">> & { won?: boolean };

interface CrmStore {
    stages: Stage[];
    deals: Deal[];
    isLoading: boolean;
    fetchAll: () => Promise<void>;
    refresh: () => Promise<void>;

    addStage: (name: string) => Promise<void>;
    updateStage: (id: string, data: Partial<Pick<Stage, "name" | "color">>) => Promise<void>;
    deleteStage: (id: string) => Promise<void>;
    reorderStages: (fromIndex: number, toIndex: number) => Promise<void>;

    addDeal: (stageId: string, data: NewDeal) => Promise<Deal | null>;
    updateDeal: (id: string, data: DealUpdate) => Promise<Deal | null>;
    moveDeal: (dealId: string, toStageId: string, toOrder: number) => Promise<void>;
    // Выигрыш/возврат сделки: карточку вытянули за последний этап воронки
    setWon: (dealId: string, won: boolean) => Promise<void>;
    deleteDeal: (id: string) => Promise<void>;

    addActivity: (dealId: string, activity: NewActivity) => Promise<void>;
    removeActivity: (dealId: string, activityId: string) => Promise<void>;
    // Каналы связи сделки: state — можно ли отправить сейчас (ready или причина), connected — подключён
    // ли канал у фирмы вообще (по нему интерфейс решает, показывать ли вкладку)
    loadChannels: (dealId: string) => Promise<Record<string, { state: string; connected: boolean }>>;
    // Отправка SMS, WhatsApp, Viber, Telegram или письма из карточки сделки: null — ушло, иначе причина отказа
    sendChannel: (dealId: string, channel: string, text: string, locale?: string) => Promise<string | null>;
}

export const useCrmStore = create<CrmStore>((set, get) => {
    const replaceDeal = (deal: Deal) =>
        set({ deals: get().deals.map((d) => (d._id === deal._id ? deal : d)) });

    return {
        stages: [],
        deals: [],
        isLoading: false,

        // Тихое обновление (без индикатора загрузки): после действий ассистента доска должна обновиться на глазах, без мигания
        refresh: async () => {
            const [stages, deals] = await Promise.all([api<Stage[]>("/api/stages"), api<Deal[]>("/api/deals")]);
            if (stages && deals) set({ stages, deals });
        },

        fetchAll: async () => {
            set({ isLoading: true });
            const [stages, deals] = await Promise.all([
                api<Stage[]>("/api/stages"),
                api<Deal[]>("/api/deals"),
            ]);
            set({ stages: stages ?? [], deals: deals ?? [], isLoading: false });
        },

        addStage: async (name) => {
            const stage = await api<Stage>("/api/stages", "POST", { name });
            if (stage) set({ stages: [...get().stages, stage] });
        },

        // название и/или цвет: сначала меняем локально (мгновенный отклик), при ошибке откатываем
        updateStage: async (id, data) => {
            const before = get().stages;
            set({ stages: before.map((s) => (s._id === id ? { ...s, ...data } : s)) });
            const updated = await api<Stage>(`/api/stages/${id}`, "PATCH", data);
            if (updated) set({ stages: get().stages.map((s) => (s._id === id ? updated : s)) });
            else set({ stages: before });
        },

        deleteStage: async (id) => {
            const res = await api<{ ok: boolean }>(`/api/stages/${id}`, "DELETE");
            if (res) {
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

            const res = await api<{ ok: boolean }>("/api/stages/reorder", "POST", { ids: reordered.map((s) => s._id) });
            if (!res) await get().fetchAll();
        },

        addDeal: async (stageId, data) => {
            const deal = await api<Deal>("/api/deals", "POST", { stage: stageId, ...data });
            if (deal) set({ deals: [...get().deals, deal] });
            return deal;
        },

        updateDeal: async (id, data) => {
            const deal = await api<Deal>(`/api/deals/${id}`, "PATCH", data);
            if (deal) replaceDeal(deal);
            return deal;
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
            const saved = await Promise.all(
                Array.from(changes.entries())
                    .filter(([id, c]) => original.get(id)!.stage !== c.stage || original.get(id)!.order !== c.order)
                    .map(([id, c]) => api<Deal>(`/api/deals/${id}`, "PATCH", c))
            );
            // сервер дописал в ленту сделки запись о смене стадии — подтягиваем свежие документы
            saved.forEach((deal) => deal && replaceDeal(deal));
        },

        // Карточку вытянули за последний этап воронки: сделка выиграна. Переносим её в последний этап
        // (место в конце) и ставим отметку времени — по ней карточка помечается как выигранная.
        setWon: async (dealId, won) => {
            const deal = get().deals.find((d) => d._id === dealId);
            if (!deal) return;
            const last = [...get().stages].sort((a, b) => a.order - b.order).at(-1);
            const patch: DealUpdate = { won };
            if (won && last && deal.stage !== last._id) {
                patch.stage = last._id;
                patch.order = get().deals.filter((d) => d.stage === last._id && d._id !== dealId).length;
            }
            const saved = await api<Deal>(`/api/deals/${dealId}`, "PATCH", patch);
            if (saved) replaceDeal(saved);
        },

        deleteDeal: async (id) => {
            const res = await api<{ ok: boolean }>(`/api/deals/${id}`, "DELETE");
            if (res) set({ deals: get().deals.filter((d) => d._id !== id) });
        },

        addActivity: async (dealId, activity) => {
            const deal = await addActivityRequest<Deal>("deals", dealId, activity);
            if (deal) replaceDeal(deal);
        },

        loadChannels: async (dealId) => {
            const channels = await api<Record<string, { state: string; connected: boolean }>>(`/api/deals/${dealId}/channels`);
            return channels ?? {};
        },

        sendChannel: async (dealId, channel, text, locale) => {
            // локаль нужна письму: к нему прикладывается документ сделки на языке интерфейса
            const res = await apiCall<Deal>(`/api/deals/${dealId}/channels`, "POST", { channel, text, locale });
            if (res.ok && res.data) {
                replaceDeal(res.data);
                return null;
            }
            // 409 — канал недоступен: у отказа свой код (no_provider, no_conversation…), по нему
            // интерфейс подставляет понятный текст вместо английского сообщения сервера
            return res.status === 409 ? res.code || "unavailable" : res.message || "failed";
        },

        removeActivity: async (dealId, activityId) => {
            const deal = await removeActivityRequest<Deal>("deals", dealId, activityId);
            if (deal) replaceDeal(deal);
        },
    };
});
