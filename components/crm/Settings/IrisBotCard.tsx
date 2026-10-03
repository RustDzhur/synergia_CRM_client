"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

// Отдельный бот Айрис в Telegram: у него своя аватарка и свой токен (создаётся у @BotFather), НЕ тот бот, что присылает
// уведомления. Человек открывает профиль Айрис в Telegram и пишет или наговаривает голосом — она делает дела в CRM и
// отвечает в чат. Принимается только сохранённый чат; действия идут с правами того, кто подключил (app/api/iris-bot).
export default function IrisBotCard() {
	const t = useTranslations("settings");
	const [token, setToken] = useState("");
	const [chat, setChat] = useState("");
	const [name, setName] = useState("");
	const [hasToken, setHasToken] = useState(false);
	const [enabled, setEnabled] = useState(false);
	const [username, setUsername] = useState("");
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const res = await apiCall<{ hasToken: boolean; chatId: string; enabled: boolean; username: string }>("/api/iris-bot");
		if (!res.data) return;
		setHasToken(res.data.hasToken);
		setChat(res.data.chatId);
		setEnabled(res.data.enabled);
		setUsername(res.data.username);
	}, []);
	useEffect(() => { void load(); }, [load]);

	async function findChat() {
		setBusy(true);
		const res = await apiCall<{ chatId: string; name: string }>("/api/iris-bot", "POST", { action: "find-chat", botToken: token.trim() });
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setChat(res.data.chatId);
		setName(res.data.name);
		toast.success(`${t("notifyFound")}: ${res.data.name}`);
	}

	async function save() {
		setBusy(true);
		const res = await apiCall("/api/iris-bot", "POST", { action: "save", botToken: token.trim(), chatId: chat });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setToken("");
		toast.success(t("irisOn"));
		load();
	}

	async function clear() {
		setBusy(true);
		const res = await apiCall("/api/iris-bot", "POST", { action: "clear" });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setToken(""); setName(""); setChat(""); setEnabled(false); setUsername(""); setHasToken(false);
		toast.success(t("irisOff"));
	}

	const input = "fs-field h-40 w-full px-12 text-13 outline-none";

	return (
		<div className="fs-card mb-20 p-16">
			<div className="flex flex-wrap items-start justify-between gap-12">
				<div className="min-w-0">
					<p className="text-14 font-medium text-[#f1f4ee]">
						{t("irisTitle")}
						{enabled && <span className="ml-10 rounded-8 border border-[rgba(198,255,77,0.4)] px-8 py-[2px] text-11 font-normal text-[#c6ff4d]">{username ? `@${username}` : t("irisActive")}</span>}
					</p>
					<p className="mt-4 max-w-[720px] text-12 leading-[1.5] text-[#8c948b]">{t("irisHelp")}</p>
				</div>
				<div className="flex items-center gap-10">
					{hasToken && <button type="button" onClick={clear} disabled={busy} className="fs-btn fs-btn-ghost h-34 text-[#F4A100] disabled:opacity-60">{t("notifyClear")}</button>}
					<button type="button" onClick={save} disabled={busy || !chat || (!token && !hasToken)} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{busy ? "…" : t("irisConnect")}</button>
				</div>
			</div>
			<div className="mt-12 flex flex-wrap items-end gap-12">
				<label className="flex min-w-[240px] flex-1 flex-col gap-6">
					<span className="text-11 text-[#8c948b]">{t("irisToken")}</span>
					<input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" maxLength={120} placeholder={hasToken ? t("intKeepSecret") : "123456:ABC…"} className={input} />
				</label>
				<button type="button" onClick={findChat} disabled={busy || (!token && !hasToken)} className="fs-btn fs-btn-ghost h-40 disabled:opacity-60">{t("notifyFind")}</button>
				{chat && (
					<span className="pb-10 text-12 text-[#8c948b]">
						{t("notifyChat")}: <span className="text-[#f1f4ee]">{name || chat}</span>
					</span>
				)}
			</div>
		</div>
	);
}
