"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

// Подключение WhatsApp «в три клика» через окно Meta (Embedded Signup): клиенту не нужно ни приложение
// в Meta for Developers, ни App Secret, ни Verify Token — он входит в Facebook и выбирает свой
// аккаунт WhatsApp Business прямо в окне. Ключи приложения платформы на сервере, клиенту не видны.
//
// Порядок шагов ровно такой, как в документации Meta: FB.init → FB.login с config_id и
// response_type=code → окно присылает сообщение WA_EMBEDDED_SIGNUP с номером и аккаунтом →
// код уходит на наш сервер (он живёт 30 секунд) и меняется на бизнес-токен клиента.

interface Platform { appId: string; configId: string; version: string; ready: boolean }

declare global {
    interface Window {
        FB?: {
            init: (opts: Record<string, unknown>) => void;
            login: (cb: (r: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
        };
        fbAsyncInit?: () => void;
    }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(appId: string, version: string): Promise<void> {
    if (window.FB) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise<void>((resolve, reject) => {
        window.fbAsyncInit = () => {
            window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version });
            resolve();
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        script.onerror = () => {
            sdkPromise = null;
            reject(new Error("Facebook SDK did not load"));
        };
        document.body.appendChild(script);
    });
    return sdkPromise;
}

export default function MetaEmbeddedButton({ channel, onConnected }: { channel: "whatsapp"; onConnected: () => void }) {
    const t = useTranslations("settings");
    const [platform, setPlatform] = useState<Platform | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void apiCall<Platform>(`/api/${channel}/embedded`).then((res) => {
            if (res.ok && res.data) setPlatform(res.data);
        });
    }, [channel]);

    // Ждём сообщение окна Meta с номером и аккаунтом: без phone_number_id подключение не завершить
    const waitForSignupData = useCallback(() => {
        return new Promise<{ phoneNumberId?: string; wabaId?: string; pageId?: string }>((resolve) => {
            const timer = window.setTimeout(() => { window.removeEventListener("message", onMessage); resolve({}); }, 5 * 60 * 1000);
            function onMessage(event: MessageEvent) {
                if (!String(event.origin).endsWith("facebook.com")) return;
                let payload: { type?: string; event?: string; data?: Record<string, unknown> } | null = null;
                try { payload = JSON.parse(String(event.data)); } catch { return; }
                if (payload?.type !== "WA_EMBEDDED_SIGNUP") return;
                const event_ = String(payload.event ?? "");
                if (event_.startsWith("FINISH")) {
                    window.clearTimeout(timer);
                    window.removeEventListener("message", onMessage);
                    resolve({
                        phoneNumberId: String(payload.data?.phone_number_id ?? ""),
                        wabaId: String(payload.data?.waba_id ?? ""),
                        pageId: String(payload.data?.page_id ?? ""),
                    });
                }
                if (event_ === "CANCEL") {
                    window.clearTimeout(timer);
                    window.removeEventListener("message", onMessage);
                    resolve({});
                }
            }
            window.addEventListener("message", onMessage);
        });
    }, []);

    async function start() {
        if (!platform?.ready || busy) return;
        setBusy(true);
        try {
            await loadSdk(platform.appId, platform.version);
            const signup = waitForSignupData();
            const response = await new Promise<{ authResponse?: { code?: string } }>((resolve) => {
                window.FB?.login((r) => resolve(r), {
                    config_id: platform.configId,
                    response_type: "code",
                    override_default_response_type: true,
                    extras: { setup: {} },
                });
            });
            const code = response.authResponse?.code ?? "";
            if (!code) throw new Error(t("metaNoCode"));
            const ids = await signup;
            const res = await apiCall<{ name: string; warning?: string }>(`/api/${channel}/embedded`, "POST", { code, ...ids });
            if (!res.ok) throw new Error(res.message);
            toast.success(res.data?.warning ? `${t("metaConnected", { name: res.data.name })} — ${res.data.warning}` : t("metaConnected", { name: res.data?.name ?? "" }));
            onConnected();
        } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t("metaFailed"));
        } finally {
            setBusy(false);
        }
    }

    if (!platform) return null;
    if (!platform.ready) {
        return <p className="text-12 text-[#F4A100]">{t("metaNotReady")}</p>;
    }
    return (
        <button type="button" onClick={start} disabled={busy} className="fs-btn fs-btn-primary h-38 disabled:opacity-60">
            {busy ? t("metaConnecting") : t("metaConnectButton")}
        </button>
    );
}
