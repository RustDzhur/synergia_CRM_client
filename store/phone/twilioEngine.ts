import type { Call, Device } from "@twilio/voice-sdk";
import { apiCall } from "../crmApi";
import type { EngineHandlers, PhoneEngine } from "./types";

// Коды ошибок Voice SDK: токен/ключи отклонены Twilio и микрофон недоступен
const TOKEN_ERRORS = [20101, 20104, 20151, 31204, 31205];
const MIC_ERRORS = [31201, 31208];

async function fetchToken() {
    const res = await apiCall<{ token: string }>("/api/twilio/token");
    return res.ok && res.data ? res.data.token : null;
}

// Звонки из браузера через Twilio Voice SDK. Итог звонка в журнал пишет сервер (вебхук Twilio), здесь этого не делаем.
export function createTwilioEngine(h: EngineHandlers): PhoneEngine {
    let device: Device | null = null;
    let call: Call | null = null;
    let stopped = false;

    function attach(c: Call) {
        call = c;
        let answered = false;
        c.on("accept", () => { answered = true; h.connected(); });
        const finish = (reason?: "canceled") => {
            if (call !== c) return;
            call = null;
            h.ended({ answered, reason });
        };
        c.on("disconnect", () => finish());
        c.on("cancel", () => finish());
        c.on("reject", () => finish());
        c.on("error", (e: { message?: string; code?: number }) => {
            finish();
            h.error(MIC_ERRORS.includes(e?.code ?? 0) ? "mic" : e?.message ?? "Call failed");
        });
    }

    return {
        async start() {
            const token = await fetchToken();
            if (!token) throw new Error("Twilio is not connected");
            h.link("connecting");
            const { Device, Call } = await import("@twilio/voice-sdk");
            if (stopped) return;
            const d = new Device(token, { codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU], closeProtection: true });
            d.on("incoming", (incoming: Call) => {
                if (call) return void incoming.reject(); // уже идёт разговор
                attach(incoming);
                h.incoming(incoming.parameters.From ?? "");
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
                    h.link("offline");
                    return h.error("token");
                }
                h.error(MIC_ERRORS.includes(code) ? "mic" : e?.message ?? "Phone error");
            });
            await d.register();
            device = d;
            h.link("ready");
        },

        stop() {
            stopped = true;
            call?.disconnect();
            device?.destroy();
            device = null;
            call = null;
        },

        async dial(number) {
            if (!device) throw new Error("Phone is not connected");
            try {
                attach(await device.connect({ params: { To: number } }));
            } catch (e) {
                h.error(MIC_ERRORS.includes((e as { code?: number })?.code ?? 0) ? "mic" : (e as Error)?.message ?? "Call failed");
                h.ended({ answered: false, reason: "failed" });
            }
        },

        answer: () => call?.accept(),
        decline: () => call?.reject(),
        hangup: () => call?.disconnect(),
        mute: (on) => call?.mute(on),
        dtmf: (digit) => call?.sendDigits(digit),
    };
}
