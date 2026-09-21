import { create } from "zustand";
import type { Call, Device } from "@twilio/voice-sdk";
import { apiCall } from "./crmApi";

// Софтфон: звонки из браузера через Twilio Voice SDK. Устройство создаётся, только если в Settings → Integration
// подключён Twilio (сервер отдаёт токен). Входящие звонки на подключённый номер приходят сюда же.
export type CallState = "off" | "idle" | "dialing" | "incoming" | "active";

interface CallStore {
    state: CallState;
    peer: string; // номер собеседника
    muted: boolean;
    startedAt: number | null;
    error: string;
    init: () => Promise<void>;
    destroy: () => void;
    startCall: (number: string) => Promise<void>;
    answer: () => void;
    decline: () => void;
    hangup: () => void;
    toggleMute: () => void;
}

// Коды ошибок Voice SDK: токен/ключи отклонены Twilio и микрофон недоступен. Пользователю показываем понятный текст (см. Softphone).
const TOKEN_ERRORS = [20101, 20104, 20151, 31204, 31205];
const MIC_ERRORS = [31201, 31208];
let tokenErrorShown = false; // про неверные ключи сообщаем один раз за сессию, а не на каждой странице

// Объекты SDK не сериализуются и на рендер не влияют — держим их вне состояния
let device: Device | null = null;
let call: Call | null = null;
let initializing: Promise<void> | null = null;

const reset = { state: "idle" as CallState, peer: "", muted: false, startedAt: null, error: "" };

export const useCallStore = create<CallStore>()((set, get) => {
    function attach(c: Call, peer: string) {
        call = c;
        c.on("accept", () => set({ state: "active", startedAt: Date.now(), peer }));
        const finish = () => { if (call === c) { call = null; set({ ...reset, state: device ? "idle" : "off" }); } };
        c.on("disconnect", finish);
        c.on("cancel", finish);
        c.on("reject", finish);
        c.on("error", (e: { message?: string; code?: number }) => { finish(); set({ error: MIC_ERRORS.includes(e?.code ?? 0) ? "mic" : e?.message ?? "Call failed" }); });
    }

    async function fetchToken() {
        const res = await apiCall<{ token: string }>("/api/twilio/token");
        return res.ok && res.data ? res.data.token : null;
    }

    async function setup() {
        if (device) return;
        const token = await fetchToken();
        if (!token) return set({ state: "off" }); // Twilio не подключён
        const { Device, Call } = await import("@twilio/voice-sdk");
        const d = new Device(token, { codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU], closeProtection: true });
        d.on("incoming", (incoming: Call) => {
            if (call) return void incoming.reject(); // уже идёт разговор
            const from = incoming.parameters.From ?? "";
            attach(incoming, from);
            set({ state: "incoming", peer: from, error: "" });
        });
        d.on("tokenWillExpire", async () => {
            const fresh = await fetchToken();
            if (fresh) d.updateToken(fresh);
        });
        d.on("error", (e: { message?: string; code?: number }) => {
            const code = e?.code ?? 0;
            if (TOKEN_ERRORS.includes(code)) {
                d.destroy();
                if (device === d) device = null;
                const show = !tokenErrorShown;
                tokenErrorShown = true;
                return set({ ...reset, state: "off", error: show ? "token" : "" });
            }
            set({ error: MIC_ERRORS.includes(code) ? "mic" : e?.message ?? "Phone error" });
        });
        await d.register();
        device = d;
        set({ state: "idle" });
    }

    return {
        ...reset,
        state: "off",

        init: () => {
            initializing = initializing ?? setup().catch(() => set({ state: "off" })).finally(() => { initializing = null; });
            return initializing;
        },

        destroy: () => {
            call?.disconnect();
            device?.destroy();
            device = null;
            call = null;
            set({ ...reset, state: "off" });
        },

        startCall: async (number) => {
            if (!device) return set({ error: "Phone is not connected" });
            if (get().state !== "idle") return;
            set({ state: "dialing", peer: number, error: "" });
            try {
                attach(await device.connect({ params: { To: number } }), number);
            } catch (e) {
                set({ ...reset, state: "idle", error: MIC_ERRORS.includes((e as { code?: number })?.code ?? 0) ? "mic" : (e as Error)?.message ?? "Call failed" });
            }
        },

        answer: () => call?.accept(),
        decline: () => call?.reject(),
        hangup: () => call?.disconnect(),
        toggleMute: () => {
            if (!call) return;
            const muted = !get().muted;
            call.mute(muted);
            set({ muted });
        },
    };
});
