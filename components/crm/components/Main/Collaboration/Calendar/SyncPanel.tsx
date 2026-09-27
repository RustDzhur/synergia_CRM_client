"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCalendarShare, TbChevronDown, TbRefresh, TbX } from "react-icons/tb";
import { apiCall } from "@/app/store/crmApi";
import Modal from "../../shared/Modal";

// Подключение внешних календарей: Google (обычный вход через Google) и iCloud (Apple ID и пароль
// приложения — у Apple нет OAuth для календарей). События переносятся в календарь фирмы и дальше
// живут как обычные события: их видно в сетке, по ним работают напоминания.
//
// С Google связь двусторонняя: события, созданные в CRM, записываются в выбранный календарь Google,
// а правки и удаления уходят туда же. iCloud — только чтение: Apple не даёт писать без пароля
// приложения на каждое действие.

interface CalendarEntry { id: string; name: string; enabled: boolean }
interface SourceState {
    connected: boolean;
    error?: string;
    email?: string;
    appleId?: string;
    lastSyncAt?: string;
    calendars: CalendarEntry[];
    available?: boolean;
    /** выдано ли соединению право изменять события (у старых подключений его нет) */
    write?: boolean;
    /** id календаря Google, в который записываются события, созданные в CRM */
    target?: string;
}
interface State { google: SourceState; icloud: SourceState }

export default function SyncPanel() {
    const t = useTranslations("collab");
    const locale = useLocale(); // с ней человек вернётся со страницы согласия на свою языковую версию календаря
    const params = useSearchParams();
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<State | null>(null);
    const [busy, setBusy] = useState("");
    const [notice, setNotice] = useState("");
    const [appleId, setAppleId] = useState("");
    const [applePass, setApplePass] = useState("");

    const load = useCallback(async () => {
        const res = await apiCall<State>("/api/calendar", "GET", undefined, { cache: "no-store" });
        if (res.ok && res.data) setState(res.data);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Возврат от Google: колбэк приводит сюда с ?gcal=connected|denied
    useEffect(() => {
        const status = params?.get("gcal");
        if (!status) return;
        if (status === "connected") { toast.success(t("calConnected")); load(); }
        else if (status === "denied") setNotice(t("calDenied"));
    }, [params, t, load]);

    async function act(action: string, body: Record<string, unknown> = {}, label = action) {
        setBusy(label);
        setNotice("");
        const res = await apiCall<{ url?: string }>("/api/calendar", "POST", { action, ...body });
        setBusy("");
        if (!res.ok) { setNotice(res.message); return null; }
        return res.data;
    }

    // Уходим на страницу согласия Google в текущем окне: обратно возвращает браузер, по адресу из state
    async function connectGoogle() {
        const data = await act("google-start", { locale }, "google");
        if (data?.url) window.location.href = data.url;
    }

    async function connectIcloud(e: React.FormEvent) {
        e.preventDefault();
        const data = await act("icloud-connect", { appleId, password: applePass }, "icloud");
        if (data) { setApplePass(""); toast.success(t("calConnected")); load(); }
    }

    async function syncNow() {
        const data = await act("sync", {}, "sync");
        if (data) { toast.success(t("calSynced")); load(); }
    }

    async function toggleCalendar(source: "google" | "icloud", id: string, enabled: boolean) {
        const source_state = source === "google" ? state?.google : state?.icloud;
        const ids = (source_state?.calendars ?? []).map((c) => (c.id === id ? { ...c, enabled } : c)).filter((c) => c.enabled).map((c) => c.id);
        await act("calendars", { source, ids }, `${source}:${id}`);
        load();
    }

    const src = (key: "google" | "icloud") => state?.[key];
    const row = "fs-popover-row flex w-full items-center gap-10 rounded-8 px-12 py-8 text-left text-13 transition-colors";

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`fs-btn fs-btn-ghost h-34 ${src("google")?.connected || src("icloud")?.connected ? "border-inkAccentLine text-[#c6ff4d]" : ""}`}>
                <TbCalendarShare size={15} />
                {t("calButton")}
            </button>

            <Modal open={open} onClose={() => setOpen(false)} label={t("calTitle")} className="w-full max-w-[520px]">
                <div className="fs-popover fs-scroll max-h-[85vh] overflow-y-auto p-20">
                    <header className="mb-16 flex items-center justify-between gap-12">
                        <h2 className="text-16 font-semibold text-[#f1f4ee]">{t("calTitle")}</h2>
                        <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]">
                            <TbX size={18} />
                        </button>
                    </header>
                    <p className="mb-16 text-12 text-[#8c948b]">{t("calHint")}</p>

                    {/* Google */}
                    <section className="fs-card mb-12 p-14">
                        <div className="flex items-center justify-between gap-12">
                            <span className="text-14 font-medium text-[#f1f4ee]">Google Calendar</span>
                            {src("google")?.connected ? (
                                <span className="fs-chip h-22 px-8 text-10 text-[#c6ff4d]">{src("google")?.email || t("calConnectedShort")}</span>
                            ) : (
                                <button type="button" disabled={busy === "google" || src("google")?.available === false} onClick={connectGoogle} className="fs-btn fs-btn-primary h-34 disabled:opacity-[0.5]">
                                    {t("calConnect")}
                                </button>
                            )}
                        </div>
                        {src("google")?.error && <p className="mt-8 text-12 text-[#F4A100]">{src("google")?.error}</p>}
                        {/* Старое подключение выдано только на чтение: без повторного согласия события
                            из CRM не попадут в Google, и человек должен узнать об этом здесь, а не по факту */}
                        {src("google")?.connected && !src("google")?.write && (
                            <p className="mt-8 flex flex-wrap items-center gap-x-8 text-12 text-[#F4A100]">
                                {t("calReadOnly")}
                                <button type="button" onClick={connectGoogle} className="text-12 text-[#c6ff4d] transition-opacity hover:opacity-80">
                                    {t("calReconnect")}
                                </button>
                            </p>
                        )}
                        {src("google")?.connected && (
                            <>
                                <ul className="mt-10 flex flex-col gap-2">
                                    {(src("google")?.calendars ?? []).map((c) => (
                                        <li key={c.id} className={row}>
                                            <input type="checkbox" checked={c.enabled} onChange={(e) => toggleCalendar("google", c.id, e.target.checked)} className="h-[15px] w-[15px] accent-[#c6ff4d]" />
                                            <span className="truncate">{c.name}</span>
                                        </li>
                                    ))}
                                    {(src("google")?.calendars ?? []).length === 0 && (
                                        <li>
                                            <button type="button" onClick={async () => { await act("refresh-google-calendars", {}, "refresh"); load(); }} className="text-12 text-[#c6ff4d]">
                                                {t("calLoadList")}
                                            </button>
                                        </li>
                                    )}
                                </ul>
                                {/* Куда записывать события, созданные в CRM: по умолчанию основной календарь */}
                                <label className="relative mt-12 flex items-center gap-8 text-12 text-[#8c948b]">
                                    {t("calTarget")}:
                                    <select
                                        value={src("google")?.target ?? ""}
                                        onChange={async (e) => { await act("target", { id: e.target.value }, "target"); load(); }}
                                        className="min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-24 text-12 text-[#f1f4ee] outline-none focus:text-[#c6ff4d]">
                                        <option value="">{t("calTargetPrimary")}</option>
                                        {(src("google")?.calendars ?? []).map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <TbChevronDown size={16} className="pointer-events-none -ml-24" />
                                </label>
                                <div className="mt-10 flex items-center gap-12">
                                    <button type="button" onClick={syncNow} disabled={busy === "sync"} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">
                                        <TbRefresh size={14} className={busy === "sync" ? "animate-spin" : ""} /> {t("calSyncNow")}
                                    </button>
                                    <button type="button" onClick={async () => { await act("disconnect"); load(); }} className="text-12 text-[#9AA396] transition-colors hover:text-danger">
                                        {t("calDisconnect")}
                                    </button>
                                </div>
                            </>
                        )}
                    </section>

                    {/* iCloud */}
                    <section className="fs-card p-14">
                        <div className="flex items-center justify-between gap-12">
                            <span className="text-14 font-medium text-[#f1f4ee]">iCloud Kalender</span>
                            {src("icloud")?.connected && <span className="fs-chip h-22 px-8 text-10 text-[#c6ff4d]">{src("icloud")?.appleId}</span>}
                        </div>
                        {src("icloud")?.error && <p className="mt-8 text-12 text-[#F4A100]">{src("icloud")?.error}</p>}

                        {!src("icloud")?.connected ? (
                            <form onSubmit={connectIcloud} className="mt-10 flex flex-col gap-8">
                                {/* Apple не даёт OAuth для календарей: нужен пароль приложения, созданный в учётной записи Apple */}
                                <p className="text-11 text-[#9AA396]">{t("calAppleHint")}</p>
                                <input value={appleId} onChange={(e) => setAppleId(e.target.value)} placeholder={t("calAppleId")} className="fs-field h-38 w-full px-12 text-13 outline-none" required />
                                <input value={applePass} onChange={(e) => setApplePass(e.target.value)} placeholder={t("calApplePass")} type="password" className="fs-field h-38 w-full px-12 text-13 outline-none" required />
                                <button type="submit" disabled={busy === "icloud"} className="fs-btn fs-btn-primary h-38 self-start disabled:opacity-[0.5]">
                                    {busy === "icloud" ? t("calConnecting") : t("calConnect")}
                                </button>
                            </form>
                        ) : (
                            <>
                                <ul className="mt-10 flex flex-col gap-2">
                                    {(src("icloud")?.calendars ?? []).map((c) => (
                                        <li key={c.id} className={row}>
                                            <input type="checkbox" checked={c.enabled} onChange={(e) => toggleCalendar("icloud", c.id, e.target.checked)} className="h-[15px] w-[15px] accent-[#c6ff4d]" />
                                            <span className="truncate">{c.name}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-10 flex items-center gap-12">
                                    <button type="button" onClick={syncNow} disabled={busy === "sync"} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">
                                        <TbRefresh size={14} className={busy === "sync" ? "animate-spin" : ""} /> {t("calSyncNow")}
                                    </button>
                                    <button type="button" onClick={async () => { await act("icloud-disconnect"); load(); }} className="text-12 text-[#9AA396] transition-colors hover:text-danger">
                                        {t("calDisconnect")}
                                    </button>
                                </div>
                            </>
                        )}
                    </section>

                    {notice && <p className="mt-12 text-12 text-[#F4A100]">{notice}</p>}
                </div>
            </Modal>
        </>
    );
}
