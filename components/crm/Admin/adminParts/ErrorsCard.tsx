"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { apiCall } from "@/store/crmApi";
import { inputClass } from "./model";

// Бот платформы в Telegram: отчёты об ошибках (kind="error") или рабочие уведомления (kind="notify").
// Пишем боту любое сообщение, нажимаем «Найти чат» — числовой id искать не нужно, а после сохранения
// уходит проверочное сообщение тем же путём, что и настоящие.
export default function ErrorsCard() {
	const t = useTranslations("admin");
	const [errToken, setErrToken] = useState("");
	const [errChat, setErrChat] = useState("");
	const [errName, setErrName] = useState("");
	const [errHasToken, setErrHasToken] = useState(false);
	const [errFromEnv, setErrFromEnv] = useState(false);
	const [errBusy, setErrBusy] = useState(false);
	const [journal, setJournal] = useState<Array<{ at: string; source: string; kind: string; title: string; explanation: string; where: string }>>([]);
	const [showJournal, setShowJournal] = useState(false);

	const loadErrors = useCallback(async () => {
		const res = await apiCall<{ hasToken: boolean; chatId: string; fromEnv: boolean }>("/api/admin/settings/errors");
		if (!res.data) return;
		setErrHasToken(res.data.hasToken);
		setErrChat(res.data.chatId);
		setErrFromEnv(res.data.fromEnv);
	}, []);
	useEffect(() => { void loadErrors(); }, [loadErrors]);
	const loadJournal = useCallback(async () => {
		const res = await apiCall<typeof journal>("/api/admin/errors");
		if (res.data) setJournal(res.data);
	}, []);
	useEffect(() => { if (showJournal) void loadJournal(); }, [showJournal, loadJournal]);

	// Проверка всей цепочки: по одной тестовой ошибке из браузера, сервера, базы и контейнера — каждая проходит объяснение и уходит в Telegram
	async function testChain() {
		setErrBusy(true);
		const res = await apiCall<{ sent: number; total: number }>("/api/admin/errors", "POST", { action: "test" });
		setErrBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		toast.success(t("errChainSent", { sent: res.data.sent, total: res.data.total }));
		if (showJournal) void loadJournal();
	}

	async function findErrorChat() {
		setErrBusy(true);
		const res = await apiCall<{ chatId: string; name: string }>("/api/admin/settings/errors", "POST", { action: "find-chat", botToken: errToken.trim() });
		setErrBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setErrChat(res.data.chatId);
		setErrName(res.data.name);
		toast.success(`${t("errFound")}: ${res.data.name}`);
	}

	async function saveErrors() {
		setErrBusy(true);
		const res = await apiCall("/api/admin/settings/errors", "POST", { action: "save", botToken: errToken.trim(), chatId: errChat });
		setErrBusy(false);
		if (!res.ok) return void toast.error(res.message);
		setErrToken("");
		toast.success(t("saved"));
		loadErrors();
	}

	// Проверка отчётов: сообщение уходит тем же путём, что и настоящие — иначе непонятно, работает ли настройка
	async function testErrors() {
		setErrBusy(true);
		const res = await apiCall("/api/admin/settings/errors", "POST", { action: "test" });
		setErrBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("errSent"));
	}

	return (
		<div className="fs-card mb-24 p-16">
			<div className="flex flex-wrap items-center justify-between gap-12">
				<div><p className="text-14 font-medium text-[#f1f4ee]">{t("errTitle")}</p><p className="text-12 text-[#8c948b]">{t("errHelp")}</p></div>
				<div className="flex items-center gap-10">
					{errFromEnv && <span className="fs-chip h-24 px-10 text-10">{t("metaFromEnv")}</span>}
					{/* Проверка нужна в обоих случаях: значения могли задать давно, и надо видеть, что они рабочие */}
					<button type="button" onClick={testErrors} disabled={errBusy} className="fs-btn fs-btn-ghost h-34 disabled:opacity-60">{t("errTest")}</button>
					<button type="button" onClick={testChain} disabled={errBusy} className="fs-btn fs-btn-ghost h-34 disabled:opacity-60">{t("errChain")}</button>
					{!errFromEnv && (
						<button type="button" onClick={saveErrors} disabled={errBusy || !errChat} className="fs-btn fs-btn-primary h-36 disabled:opacity-60">{errBusy ? "…" : t("errSave")}</button>
					)}
				</div>
			</div>
			{/* Поля показываем всегда: настройка из кабинета важнее переменных окружения, а в переменных
			    легко ошибиться — например, вписать id бота, которому Telegram писать не разрешает */}
			<div className="mt-12 flex flex-wrap items-end gap-12">
				<label className="flex flex-col gap-6">
					<span className="text-11 text-[#8c948b]">{t("errToken")}</span>
					<input value={errToken} onChange={(e) => setErrToken(e.target.value)} type="password" autoComplete="off" maxLength={120} placeholder={errHasToken ? t("metaKeepSecret") : "123456:ABC…"} className={inputClass} />
				</label>
				<button type="button" onClick={findErrorChat} disabled={errBusy} className="fs-btn fs-btn-ghost h-34 disabled:opacity-60">{t("errFindChat")}</button>
				{errChat && (
					<span className="text-12 text-[#8c948b]">
						{t("errChat")}: <span className="text-[#f1f4ee]">{errName || errChat}</span>
					</span>
				)}
			</div>
			{!errHasToken && !errFromEnv && <p role="alert" className="mt-10 rounded-10 bg-[rgba(244,161,0,0.10)] px-12 py-8 text-12 text-[#F4A100]">{t("errNoToken")}</p>}
			{errFromEnv && <p className="mt-8 text-11 text-[#8c948b]">{t("errFromEnvHelp")}</p>}
			{/* Журнал: что бот уже поймал и как объяснил — видно, что цепочка работает, даже если сообщение в Telegram пропустили */}
			<button type="button" onClick={() => setShowJournal((v) => !v)} aria-expanded={showJournal} className="mt-12 text-12 text-[#c6ff4d] hover:underline">{t("errJournal")}</button>
			{showJournal && (
				<ul className="mt-8 flex max-h-[360px] flex-col gap-6 overflow-y-auto fs-scroll">
					{journal.length === 0 && <li className="text-12 text-[#8c948b]">{t("errJournalEmpty")}</li>}
					{journal.map((j, i) => (
						<li key={`${j.at}-${i}`} className="rounded-10 border border-inkLine px-12 py-8 text-12">
							<p className="text-[#f1f4ee]"><span className="mr-6 text-[#8c948b]">{j.at.slice(5, 16).replace("T", " ")}</span>{j.kind ? `${j.kind}: ` : ""}{j.title}</p>
							{j.explanation && <p className="mt-2 text-[#c6ff4d]">{j.explanation}</p>}
							{j.where && <p className="mt-2 text-[#8c948b]">{j.where}</p>}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
