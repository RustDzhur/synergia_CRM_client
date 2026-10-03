"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";

// Бот фирмы для рабочих уведомлений в Telegram: посетитель написал в чат на сайте, оставил контакт,
// прислал файл, пришло письмо. Бот у каждой фирмы СВОЙ — уведомления о клиентах одной фирмы не
// попадают ни другой фирме, ни владельцу платформы (у него свой бот, только для ошибок приложения).
//
// Настройка та же, что у бота ошибок в админке: вставить токен от @BotFather, написать боту любое
// сообщение, нажать «Найти чат» — числовой id искать не нужно (app/api/notify-settings).
export default function NotifyBotCard() {
	const t = useTranslations("settings");
	const [token, setToken] = useState("");
	const [chat, setChat] = useState("");
	const [name, setName] = useState("");
	const [hasToken, setHasToken] = useState(false);
	const [control, setControl] = useState(false); // управление Айрис через этого бота
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const res = await apiCall<{ hasToken: boolean; chatId: string; control?: boolean }>("/api/notify-settings");
		if (!res.data) return;
		setHasToken(res.data.hasToken);
		setChat(res.data.chatId);
		setControl(res.data.control === true);
	}, []);
	useEffect(() => { void load(); }, [load]);

	async function findChat() {
		setBusy(true);
		const res = await apiCall<{ chatId: string; name: string }>("/api/notify-settings", "POST", { action: "find-chat", botToken: token.trim() });
		setBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setChat(res.data.chatId);
		setName(res.data.name);
		toast.success(`${t("notifyFound")}: ${res.data.name}`);
	}

	async function save() {
		setBusy(true);
		const res = await apiCall("/api/notify-settings", "POST", { action: "save", botToken: token.trim(), chatId: chat });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setToken("");
		toast.success(t("intSaved"));
		load();
	}

	// Отключить уведомления: токен и чат стираются, сообщения о клиентах остаются только в кабинете
	async function clear() {
		setBusy(true);
		const res = await apiCall("/api/notify-settings", "POST", { action: "clear" });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setToken("");
		setName("");
		setChat("");
		toast.success(t("intSaved"));
		load();
	}

	// Проверка идёт тем же путём, что и настоящие уведомления — иначе непонятно, работает ли настройка
	async function test() {
		setBusy(true);
		const res = await apiCall("/api/notify-settings", "POST", { action: "test" });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("notifySent"));
	}

	// Управление Айрис из Telegram: бот начинает принимать команды от этого чата и выполнять их с вашими правами
	async function toggleControl(enabled: boolean) {
		setBusy(true);
		const res = await apiCall("/api/notify-settings", "POST", { action: "control", enabled });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setControl(enabled);
		toast.success(t(enabled ? "controlOn" : "controlOff"));
	}

	const input = "fs-field h-40 w-full px-12 text-13 outline-none";

	return (
		<div className="fs-card mb-20 p-16">
			<div className="flex flex-wrap items-start justify-between gap-12">
				<div className="min-w-0">
					<p className="text-14 font-medium text-[#f1f4ee]">{t("notifyTitle")}</p>
					<p className="mt-4 max-w-[720px] text-12 leading-[1.5] text-[#8c948b]">{t("notifyHelp")}</p>
				</div>
				<div className="flex items-center gap-10">
					<button type="button" onClick={test} disabled={busy || !chat} className="fs-btn fs-btn-ghost h-34 disabled:opacity-60">{t("notifyTest")}</button>
					{chat && <button type="button" onClick={clear} disabled={busy} className="fs-btn fs-btn-ghost h-34 text-[#F4A100] disabled:opacity-60">{t("notifyClear")}</button>}
					<button type="button" onClick={save} disabled={busy || !chat} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{busy ? "…" : t("intSave")}</button>
				</div>
			</div>
			<div className="mt-12 flex flex-wrap items-end gap-12">
				<label className="flex min-w-[240px] flex-1 flex-col gap-6">
					<span className="text-11 text-[#8c948b]">{t("notifyToken")}</span>
					<input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" maxLength={120} placeholder={hasToken ? t("intKeepSecret") : "123456:ABC…"} className={input} />
				</label>
				<button type="button" onClick={findChat} disabled={busy} className="fs-btn fs-btn-ghost h-40 disabled:opacity-60">{t("notifyFind")}</button>
				{chat && (
					<span className="pb-10 text-12 text-[#8c948b]">
						{t("notifyChat")}: <span className="text-[#f1f4ee]">{name || chat}</span>
					</span>
				)}
			</div>
			{/* Управление Айрис: писать боту «открой последний счёт», «подтверди заказы» — Айрис делает это в CRM и отвечает в чат */}
			{chat && hasToken && (
				<label className="mt-14 flex cursor-pointer items-start gap-10 rounded-10 border border-inkLine p-12">
					<input type="checkbox" checked={control} disabled={busy} onChange={(e) => void toggleControl(e.target.checked)} className="mt-[2px] h-16 w-16 shrink-0 accent-[#c6ff4d]" />
					<span className="min-w-0">
						<span className="block text-13 font-medium text-[#f1f4ee]">{t("controlTitle")}</span>
						<span className="mt-[2px] block text-12 leading-[1.5] text-[#8c948b]">{t("controlHelp")}</span>
					</span>
				</label>
			)}
		</div>
	);
}
