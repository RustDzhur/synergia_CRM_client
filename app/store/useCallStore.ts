import { create } from "zustand";
import type { CallDTO, IntegrationDTO } from "@/app/types/integrations";
import { apiCall } from "./crmApi";
import { createSipEngine, type SipCreds } from "./phone/sipEngine";
import { createTwilioEngine } from "./phone/twilioEngine";
import type { EndInfo, LinkStatus, PhoneEngine, PhoneProvider } from "./phone/types";

// Софтфон. Провайдер выбирается в Settings → Integration (Twilio или любой SIP-провайдер); если подключены оба,
// в звонилке можно переключаться. Все звонки попадают в журнал CRM: у Twilio их пишет сервер (вебхук),
// у SIP — браузер после завершения звонка (POST /api/calls).
export type CallState = "off" | "idle" | "dialing" | "incoming" | "active";

interface CallStore {
    state: CallState;
    peer: string; // номер собеседника
    muted: boolean;
    startedAt: number | null;
    error: string;
    link: LinkStatus; // регистрация у провайдера
    providers: PhoneProvider[];
    provider: PhoneProvider | null;
    dialerOpen: boolean;
    number: string; // набираемый номер
    history: CallDTO[];
    init: () => Promise<void>;
    destroy: () => void;
    selectProvider: (integrationId: string) => Promise<void>;
    startCall: (number?: string) => Promise<void>;
    answer: () => void;
    decline: () => void;
    hangup: () => void;
    toggleMute: () => void;
    sendDigit: (digit: string) => void;
    openDialer: (number?: string) => void;
    closeDialer: () => void;
    setNumber: (number: string) => void;
    loadHistory: () => Promise<void>;
}

const CHOICE_KEY = "crm.phone.provider";
let tokenErrorShown = false; // про неверные ключи сообщаем один раз за сессию, а не на каждой странице

// Объекты движков не сериализуются и на рендер не влияют — держим их вне состояния
let engine: PhoneEngine | null = null;
let initializing: Promise<void> | null = null;
let generation = 0; // номер запуска: устаревший запуск (провайдер сменили посреди регистрации) свои результаты выбрасывает

interface Live { id: string; direction: "in" | "out"; peer: string; answeredAt: number | null }
let live: Live | null = null;

const reset = { state: "idle" as CallState, peer: "", muted: false, startedAt: null, error: "" };
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
const readChoice = () => { try { return localStorage.getItem(CHOICE_KEY) ?? ""; } catch { return ""; } };
const saveChoice = (id: string) => { try { localStorage.setItem(CHOICE_KEY, id); } catch { /* приватный режим */ } };

// Звонок мог сорваться на середине: MIC — микрофон, иначе показываем текст движка как есть
export const useCallStore = create<CallStore>()((set, get) => {
    async function report(provider: PhoneProvider | null, l: Live, info: EndInfo) {
        if (!provider || provider.type !== "sip") return; // Twilio пишет свой журнал сам
        const duration = l.answeredAt ? Math.round((Date.now() - l.answeredAt) / 1000) : 0;
        const status = info.answered ? "completed" : l.direction === "in" ? "missed" : info.reason === "busy" ? "busy" : info.reason === "failed" ? "failed" : "no-answer";
        const body = { integrationId: provider.integrationId, callId: l.id, direction: l.direction, peer: l.peer, status, duration };
        let res = await apiCall("/api/calls", "POST", body);
        if (!res.ok) res = await apiCall("/api/calls", "POST", body); // одна повторная попытка при сбое сети
    }

    function handlers(provider: PhoneProvider, gen: number) {
        const current = () => gen === generation;
        return {
            link: (link: LinkStatus) => { if (current()) set({ link }); },
            incoming: (peer: string) => {
                if (!current()) return;
                live = { id: newId(), direction: "in" as const, peer, answeredAt: null };
                set({ state: "incoming", peer, error: "" });
            },
            connected: () => {
                if (!current()) return;
                if (live) live.answeredAt = Date.now();
                set({ state: "active", startedAt: Date.now() });
            },
            ended: (info: EndInfo) => {
                if (!current()) return;
                const l = live;
                live = null;
                set({ ...reset, state: "idle" });
                if (l) void report(provider, l, info).then(() => get().loadHistory());
                // журнал Twilio пишет вебхук — даём ему секунду и обновляем список
                if (provider.type === "twilio") setTimeout(() => void get().loadHistory(), 2500);
            },
            error: (code: string) => {
                if (!current()) return;
                if (code === "token") {
                    const show = !tokenErrorShown;
                    tokenErrorShown = true;
                    return set({ ...reset, state: "off", error: show ? "token" : "" });
                }
                set({ error: code });
            },
        };
    }

    async function loadProviders(): Promise<PhoneProvider[]> {
        const res = await apiCall<IntegrationDTO[]>("/api/integrations");
        if (!res.ok || !res.data) return [];
        return res.data
            .filter((i) => (i.type === "twilio" || i.type === "sip") && i.status === "connected")
            .map((i) => ({ integrationId: i.id, type: i.type as "twilio" | "sip", name: i.name }));
    }

    async function launch(provider: PhoneProvider) {
        const gen = ++generation;
        engine?.stop();
        engine = null;
        set({ ...reset, state: "off", provider, link: "connecting" });
        const h = handlers(provider, gen);
        let next: PhoneEngine;
        if (provider.type === "twilio") next = createTwilioEngine(h);
        else {
            const res = await apiCall<SipCreds & { integrationId: string }>("/api/sip/credentials");
            if (gen !== generation) return;
            if (!res.ok || !res.data) return void set({ state: "off", link: "offline" });
            next = createSipEngine(res.data, h);
        }
        engine = next;
        try {
            await next.start();
            if (gen === generation) set({ state: "idle", link: "ready" });
        } catch (e) {
            if (gen !== generation) return;
            engine = null;
            set({ state: "off", link: "offline", error: provider.type === "sip" ? (e as Error)?.message || "SIP connection failed" : "" });
        }
    }

    async function setup() {
        const providers = await loadProviders();
        set({ providers });
        if (!providers.length) {
            generation++;
            engine?.stop();
            engine = null;
            return set({ ...reset, state: "off", provider: null, link: "offline" });
        }
        const chosen = providers.find((p) => p.integrationId === readChoice()) ?? providers[0];
        await launch(chosen);
        void get().loadHistory();
    }

    return {
        ...reset,
        state: "off",
        link: "offline",
        providers: [],
        provider: null,
        dialerOpen: false,
        number: "",
        history: [],

        init: () => {
            initializing = initializing ?? setup().catch(() => set({ state: "off" })).finally(() => { initializing = null; });
            return initializing;
        },

        destroy: () => {
            generation++;
            engine?.stop();
            engine = null;
            live = null;
            set({ ...reset, state: "off", provider: null, providers: [], link: "offline" });
        },

        selectProvider: async (integrationId) => {
            const p = get().providers.find((x) => x.integrationId === integrationId);
            if (!p || get().state === "dialing" || get().state === "active") return;
            saveChoice(integrationId);
            await launch(p);
        },

        startCall: async (raw) => {
            const number = (raw ?? get().number).trim();
            if (!engine) return set({ error: "Phone is not connected" });
            if (get().state !== "idle" || !number) return;
            live = { id: newId(), direction: "out", peer: number, answeredAt: null };
            set({ state: "dialing", peer: number, error: "", dialerOpen: true });
            try {
                await engine.dial(number);
            } catch (e) {
                live = null;
                set({ ...reset, state: "idle", error: (e as Error)?.message ?? "Call failed" });
            }
        },

        answer: () => engine?.answer(),
        decline: () => engine?.decline(),
        hangup: () => engine?.hangup(),

        toggleMute: () => {
            if (get().state !== "active") return;
            const muted = !get().muted;
            engine?.mute(muted);
            set({ muted });
        },

        sendDigit: (digit) => {
            if (get().state === "active") engine?.dtmf(digit);
            else if (get().state === "idle" || get().state === "off") set({ number: (get().number + digit).slice(0, 32) });
        },

        openDialer: (number) => set({ dialerOpen: true, ...(number !== undefined ? { number } : {}) }),
        closeDialer: () => set({ dialerOpen: false }),
        setNumber: (number) => set({ number: number.slice(0, 32) }),

        loadHistory: async () => {
            const res = await apiCall<CallDTO[]>("/api/calls");
            if (res.ok && res.data) set({ history: res.data });
        },
    };
});
