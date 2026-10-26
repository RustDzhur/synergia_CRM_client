"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { FaTiktok, FaYoutube } from "react-icons/fa";
import { apiCall } from "@/store/crmApi";

interface YoutubeStatus {
    configured: boolean;
    connected: boolean;
    channelId: string;
    channelTitle: string;
    connectedAt: string;
    status: string;
    error: string;
    redirectUri: string;
    scopes: string;
    missing: string[];
    quota: { unitsPerUpload: number; dailyUnits: number; uploadsPerDay: number };
}

interface TiktokStatus {
    configured: boolean;
    connected: boolean;
    clientKey: string;
    displayName: string;
    openId: string;
    connectedAt: string;
    status: string;
    error: string;
    redirectUri: string;
    scopes: string;
    mode: "inbox" | "direct";
    missing: string[];
    maxVideoBytes: number;
    reviewRequired: boolean;
}

interface SocialSettings {
    youtube: YoutubeStatus;
    tiktok: TiktokStatus;
    queue: { counts: { queued: number; published: number; failed: number; total: number } };
}

interface TestResponse {
    ok: boolean;
    mock: boolean;
    platform: string;
    url?: string;
    publishId?: string;
    privacyStatus?: string;
    message?: string;
    note?: string;
}

const DEFAULT_TEST_VIDEO = "public/social/test.mp4";
const CARD = "rounded-12 border border-inkLine p-12";
const LABEL = "flex flex-col gap-6 text-11 text-[#9aa7c9]";
const FIELD = "fs-field h-36 w-full px-10 text-12 outline-none";

// Настройки → Интеграции: публикация платформы в YouTube и TikTok.
// Карточка видна только владельцу платформы (маршрут /api/social/settings закрыт для остальных).
// Кнопка подключения — обычный редирект на OAuth провайдера; «Опубликовать тест» по умолчанию
// не публикует ничего публично: YouTube — private/unlisted, TikTok — черновик (inbox).
export default function SocialPublishCard() {
    const t = useTranslations("settings");
    const locale = useLocale();
    const params = useSearchParams();
    const [data, setData] = useState<SocialSettings | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [testPath, setTestPath] = useState(DEFAULT_TEST_VIDEO);
    const [testPrivacy, setTestPrivacy] = useState<"private" | "unlisted">("private");
    const [testResults, setTestResults] = useState<Record<string, string>>({});
    const [editTiktok, setEditTiktok] = useState(false);
    const [clientKey, setClientKey] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [redirectUri, setRedirectUri] = useState("");
    const [scopes, setScopes] = useState("");
    const [mode, setMode] = useState<"inbox" | "direct">("inbox");

    const load = useCallback(async () => {
        const res = await apiCall<SocialSettings>("/api/social/settings");
        if (!res.ok || !res.data) {
            setData(null);
            return;
        }
        setData(res.data);
    }, []);

    useEffect(() => { void load(); }, [load]);

    // Возврат из OAuth: /crm/settings/integration?youtube=connected|error или ?tiktok=…
    useEffect(() => {
        const youtube = params?.get("youtube");
        const tiktok = params?.get("tiktok");
        if (!youtube && !tiktok) return;
        const message = params?.get("message") ?? "";
        window.history.replaceState(null, "", window.location.pathname);
        if (youtube === "connected") toast.success(t("socialYoutubeConnectedToast"));
        else if (tiktok === "connected") toast.success(t("socialTiktokConnectedToast"));
        else toast.error(message || t("socialFailed"));
        void load();
    }, [params, t, load]);

    // Поля ключей приложения TikTok заполняем из сервера (секрет не приходит — его не показываем).
    useEffect(() => {
        if (!data) return;
        setClientKey(data.tiktok.clientKey);
        setRedirectUri(data.tiktok.redirectUri);
        setScopes(data.tiktok.scopes);
        setMode(data.tiktok.mode);
    }, [data]);

    async function connect(platform: "youtube" | "tiktok") {
        setBusy(`connect-${platform}`);
        const res = await apiCall<{ url: string }>(`/api/social/oauth/${platform}`, "POST", { locale });
        setBusy(null);
        if (!res.ok || !res.data?.url) return void toast.error(res.message || t("socialFailed"));
        window.location.href = res.data.url;
    }

    async function disconnect(platform: "youtube" | "tiktok") {
        const name = t(platform === "youtube" ? "socialYoutube" : "socialTiktok");
        if (!window.confirm(t("socialDisconnectAsk", { name }))) return;
        setBusy(`disconnect-${platform}`);
        const res = await apiCall<SocialSettings>(`/api/social/settings?platform=${platform}`, "DELETE");
        setBusy(null);
        if (!res.ok || !res.data) return void toast.error(res.message || t("socialFailed"));
        setData(res.data);
        toast.success(t("socialDisconnectedToast", { name }));
    }

    async function saveTikTok() {
        setBusy("save-tiktok");
        const res = await apiCall<SocialSettings>("/api/social/settings", "PUT", {
            platform: "tiktok",
            clientKey: clientKey.trim(),
            clientSecret: clientSecret.trim(),
            redirectUri: redirectUri.trim(),
            scopes: scopes.trim(),
            mode,
        });
        setBusy(null);
        if (!res.ok || !res.data) return void toast.error(res.message || t("socialFailed"));
        setData(res.data);
        setClientSecret("");
        setEditTiktok(false);
        toast.success(t("socialSaved"));
    }

    async function runTest(platform: "youtube" | "tiktok") {
        setBusy(`test-${platform}`);
        const res = await apiCall<TestResponse>("/api/social/test", "POST", {
            platform,
            videoPath: testPath.trim(),
            privacyStatus: platform === "youtube" ? testPrivacy : undefined,
        });
        setBusy(null);
        if (!res.ok || !res.data) {
            setTestResults((prev) => ({ ...prev, [platform]: res.message || t("socialFailed") }));
            return void toast.error(res.message || t("socialFailed"));
        }
        const result = res.data;
        const text = result.mock
            ? result.message || t("socialTestMock")
            : `${t("socialTestUploaded")}${result.url ? `: ${result.url}` : result.publishId ? `: ${result.publishId}` : ""}`;
        setTestResults((prev) => ({ ...prev, [platform]: text }));
        toast.success(result.mock ? t("socialTestMock") : t("socialTestUploaded"));
        if (!result.mock) void load();
    }

    if (!data) return null;

    const youtube = data.youtube;
    const tiktok = data.tiktok;
    const providerStatus = (connected: boolean, configured: boolean) =>
        connected ? t("socialConnected") : configured ? t("socialNotConnected") : t("socialNotConfigured");
    const statusColor = (connected: boolean, configured: boolean) => (connected ? "text-[#7c93ff]" : configured ? "text-[#9AA7C9]" : "text-[#F4A100]");

    function header(Icon: IconType, name: string, status: string, color: string) {
        return (
            <div className="flex items-center justify-between gap-10">
                <span className="flex items-center gap-8 text-13 font-medium text-[#edf2ff]"><Icon size={18} className={color} />{name}</span>
                <span className={`text-11 ${color}`}>{status}</span>
            </div>
        );
    }

    function testRow(platform: "youtube" | "tiktok") {
        return (
            <div className="mt-10 border-t border-inkLine pt-10">
                <label className={LABEL}>
                    <span>{t("socialTestVideo")}</span>
                    <input value={testPath} onChange={(e) => setTestPath(e.target.value)} maxLength={300} className={FIELD} />
                </label>
                <div className="mt-8 flex flex-wrap items-center gap-8">
                    {platform === "youtube" && (
                        <select value={testPrivacy} onChange={(e) => setTestPrivacy(e.target.value === "unlisted" ? "unlisted" : "private")} className="fs-field h-36 px-8 text-12 outline-none">
                            <option value="private">{t("socialPrivacyPrivate")}</option>
                            <option value="unlisted">{t("socialPrivacyUnlisted")}</option>
                        </select>
                    )}
                    <button
                        type="button"
                        onClick={() => void runTest(platform)}
                        disabled={busy === `test-${platform}`}
                        className="fs-btn fs-btn-ghost h-36 px-12 text-12 disabled:opacity-60">
                        {busy === `test-${platform}` ? t("socialTesting") : t("socialTest")}
                    </button>
                </div>
                {testResults[platform] && <p className="mt-8 break-all text-11 text-[#9aa7c9]">{testResults[platform]}</p>}
            </div>
        );
    }

    return (
        <div className="fs-card mb-20 p-16">
            <p className="text-14 font-medium text-[#edf2ff]">{t("socialPublishTitle")}</p>
            <p className="mt-4 max-w-[820px] text-12 leading-[1.5] text-[#9aa7c9]">{t("socialPublishHelp")}</p>

            <div className="mt-14 grid gap-12 lg:grid-cols-2">
                {/* YouTube: переиспользует Google OAuth-клиент платформы, отдельный redirect URI не нужен */}
                <div className={CARD}>
                    {header(FaYoutube, t("socialYoutube"), providerStatus(youtube.connected, youtube.configured), statusColor(youtube.connected, youtube.configured))}
                    <p className="mt-6 text-11 leading-[1.45] text-[#9aa7c9]">{t("socialYoutubeDesc")}</p>
                    {youtube.connected && (
                        <p className="mt-8 text-11 text-[#cfd4cb]">
                            {t("socialYoutubeChannel", { name: youtube.channelTitle || youtube.channelId || "—" })}
                        </p>
                    )}
                    {youtube.error && <p className="mt-8 text-11 text-danger">{youtube.error}</p>}
                    {youtube.missing.length > 0 && <p className="mt-8 text-11 text-[#F4A100]">{t("socialMissing", { names: youtube.missing.join(", ") })}</p>}
                    <div className="mt-10 flex flex-wrap gap-8">
                        <button type="button" onClick={() => void connect("youtube")} disabled={!youtube.configured || busy === "connect-youtube"} className="fs-btn fs-btn-primary h-36 px-12 text-12 disabled:opacity-60">
                            {youtube.connected ? t("socialReconnect") : t("socialConnectYoutube")}
                        </button>
                        {youtube.connected && (
                            <button type="button" onClick={() => void disconnect("youtube")} disabled={busy === "disconnect-youtube"} className="fs-btn fs-btn-ghost h-36 px-12 text-12 text-[#F4A100] disabled:opacity-60">
                                {t("intDisconnect")}
                            </button>
                        )}
                    </div>
                    <p className="mt-8 text-11 text-[#9aa7c9]">{t("socialYoutubeQuota", { units: youtube.quota.unitsPerUpload, daily: youtube.quota.dailyUnits, uploads: youtube.quota.uploadsPerDay })}</p>
                    <p className="mt-6 break-all text-11 text-[#9aa7c9]">{t("socialRedirect")}: <code className="text-[#cfd4cb]">{youtube.redirectUri}</code></p>
                    <p className="mt-4 text-11 text-[#9aa7c9]">{t("socialTestNote")}</p>
                    {testRow("youtube")}
                </div>

                {/* TikTok: ключи приложения берутся из platformsettings/tiktok и шифруются на сервере */}
                <div className={CARD}>
                    {header(FaTiktok, t("socialTiktok"), providerStatus(tiktok.connected, tiktok.configured), statusColor(tiktok.connected, tiktok.configured))}
                    <p className="mt-6 text-11 leading-[1.45] text-[#9aa7c9]">{t("socialTiktokDesc")}</p>
                    {tiktok.connected && (
                        <p className="mt-8 text-11 text-[#cfd4cb]">{t("socialTiktokAccount", { name: tiktok.displayName || tiktok.openId || "—" })}</p>
                    )}
                    {tiktok.error && <p className="mt-8 text-11 text-danger">{tiktok.error}</p>}
                    {tiktok.missing.length > 0 && <p className="mt-8 text-11 text-[#F4A100]">{t("socialMissing", { names: tiktok.missing.join(", ") })}</p>}
                    <p className="mt-8 text-11 text-[#9aa7c9]">{t("socialTiktokReviewHint")}</p>
                    <div className="mt-10 flex flex-wrap gap-8">
                        <button type="button" onClick={() => void connect("tiktok")} disabled={!tiktok.configured || busy === "connect-tiktok"} className="fs-btn fs-btn-primary h-36 px-12 text-12 disabled:opacity-60">
                            {tiktok.connected ? t("socialReconnect") : t("socialConnectTiktok")}
                        </button>
                        {tiktok.connected && (
                            <button type="button" onClick={() => void disconnect("tiktok")} disabled={busy === "disconnect-tiktok"} className="fs-btn fs-btn-ghost h-36 px-12 text-12 text-[#F4A100] disabled:opacity-60">
                                {t("intDisconnect")}
                            </button>
                        )}
                        {tiktok.configured && !editTiktok && (
                            <button type="button" onClick={() => setEditTiktok(true)} className="fs-btn fs-btn-ghost h-36 px-12 text-12">
                                {t("socialEditCredentials")}
                            </button>
                        )}
                    </div>
                    <p className="mt-8 break-all text-11 text-[#9aa7c9]">{t("socialRedirect")}: <code className="text-[#cfd4cb]">{tiktok.redirectUri}</code></p>

                    {(!tiktok.configured || editTiktok) && (
                        <div className="mt-10 rounded-10 border border-inkLine p-10">
                            <p className="text-11 font-medium text-[#edf2ff]">{t("socialTiktokApp")}</p>
                            <div className="mt-8 grid gap-8">
                                <label className={LABEL}>
                                    <span>{t("socialClientKey")}</span>
                                    <input value={clientKey} onChange={(e) => setClientKey(e.target.value)} maxLength={200} className={FIELD} autoComplete="off" />
                                </label>
                                <label className={LABEL}>
                                    <span>{t("socialClientSecret")}</span>
                                    <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} type="password" maxLength={400} className={FIELD} autoComplete="new-password" placeholder={tiktok.configured ? t("intKeepSecret") : ""} />
                                </label>
                                <label className={LABEL}>
                                    <span>{t("socialRedirect")}</span>
                                    <input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} maxLength={300} className={FIELD} />
                                </label>
                                <label className={LABEL}>
                                    <span>{t("socialScopes")}</span>
                                    <input value={scopes} onChange={(e) => setScopes(e.target.value)} maxLength={300} className={FIELD} />
                                </label>
                                <label className={LABEL}>
                                    <span>{t("socialMode")}</span>
                                    <select value={mode} onChange={(e) => setMode(e.target.value === "direct" ? "direct" : "inbox")} className="fs-field h-36 px-8 text-12 outline-none">
                                        <option value="inbox">{t("socialModeInbox")}</option>
                                        <option value="direct">{t("socialModeDirect")}</option>
                                    </select>
                                </label>
                                <p className="text-11 text-[#9aa7c9]">{t("socialModeHint")}</p>
                                <div className="flex gap-8">
                                    <button type="button" onClick={() => void saveTikTok()} disabled={busy === "save-tiktok"} className="fs-btn fs-btn-primary h-36 px-12 text-12 disabled:opacity-60">
                                        {busy === "save-tiktok" ? "…" : t("socialSaveCredentials")}
                                    </button>
                                    {editTiktok && (
                                        <button type="button" onClick={() => setEditTiktok(false)} className="fs-btn fs-btn-ghost h-36 px-12 text-12">
                                            {t("intClose")}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {testRow("tiktok")}
                </div>
            </div>
        </div>
    );
}
