"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAutoAwesome, MdCheckCircle, MdClose, MdErrorOutline, MdGraphicEq, MdSearch } from "react-icons/md";
import { TbMicrophone, TbPlayerStop, TbVolume, TbVolumeOff } from "react-icons/tb";
import { AiAction, AiDownload, AiMessage, AiNav, useAiStore } from "@/store/useAiStore";
import { stripLocale } from "@/utils/locale";
import Modal from "../shared/Modal";
import Markdown from "./markdown";
import VoiceOrb from "./VoiceOrb";
import VoiceHud, { ORB_BY_PHASE, formatActionValue } from "./VoiceHud";
import { configureSpeech, stopSpeech } from "./speech";
import { useVoiceAgent } from "./useVoiceAgent";
import { downloadDocumentPdf, fetchDocumentPdfBlob } from "../Finance/download";
import { dictationSupported, recorderSupported, spokenAnswer, ttsSupported, useSpeechOutput, useVoiceInput } from "./voice";

const AUTO_SPEAK_KEY = "ai.autospeak";

const RECENT_KEY = "ai.recent";
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 4); } catch { return []; } };
const rememberRecent = (text: string) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([text, ...readRecent().filter((r) => r !== text)].slice(0, 4))); } catch { /* приватный режим */ } };

// Подсказки: {ключ перевода, нужен ли доступ к инструменту, отправлять сразу или дать дописать}
const SUGGESTIONS: { key: string; tool: string; send: boolean }[] = [
	{ key: "s_stale", tool: "find_stale_contacts", send: true },
	{ key: "s_today", tool: "list_tasks", send: true },
	{ key: "s_overdue", tool: "list_tasks", send: true },
	{ key: "s_summary", tool: "get_contact", send: false },
	{ key: "s_task", tool: "create_task", send: false },
	{ key: "s_reply", tool: "search_mail", send: true },
	{ key: "s_employees", tool: "list_employees", send: true },
];

const EDITABLE: Record<string, string[]> = { send_email: ["to", "subject", "body"] };

function ActionCard({ message, action }: { message: AiMessage; action: AiAction }) {
	const t = useTranslations("ai");
	const router = useRouter();
	const locale = useLocale();
	const { confirm, cancel, hide } = useAiStore();
	const [edits, setEdits] = useState<Record<string, string>>({});
	const editable = EDITABLE[action.tool] ?? [];
	const fields = Object.entries(action.args).filter(([k, v]) => k !== "id" && !k.endsWith("_id") && v !== "" && v !== undefined);
	const shown = (v: unknown) => (typeof v === "boolean" ? t(v ? "yes" : "no") : formatActionValue(v));
	const done = action.state === "done";

	return (
		<div className={`mt-10 rounded-12 border p-14 ${done ? "border-[rgba(198,255,77,0.28)] bg-[rgba(198,255,77,0.06)]" : action.state === "failed" ? "border-[rgba(235,87,87,0.30)] bg-[rgba(235,87,87,0.07)]" : "border-inkLine bg-[rgba(255,255,255,0.02)]"} ${action.state === "cancelled" ? "opacity-[0.6]" : ""}`}>
			<p className="flex items-center gap-8 text-16 font-medium text-[#334A74]">
				<MdAutoAwesome size={18} className="shrink-0 text-primaryColor" aria-hidden />
				{t(`act_${action.tool}`)}{action.target ? `: ${action.target}` : ""}
			</p>
			<dl className="mt-10 grid gap-x-12 gap-y-6 text-14 md:grid-cols-[auto_minmax(0,1fr)]">
				{fields.map(([k, v]) => (
					<React.Fragment key={k}>
						<dt className="text-[#8c948b]">{t(`f_${k}`)}</dt>
						<dd className="min-w-0 break-words text-[#cfd4cb]">
							{editable.includes(k) && action.state === "pending" ? (
								k === "body" ? (
									<textarea rows={6} value={edits[k] ?? String(v)} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} className="fs-field w-full resize-y px-10 py-8 text-13 outline-none" />
								) : (
									<input value={edits[k] ?? String(v)} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} className="fs-field w-full px-10 py-6 text-13 outline-none" />
								)
							) : (
								<span className="whitespace-pre-wrap">{shown(v)}</span>
							)}
						</dd>
					</React.Fragment>
				))}
			</dl>
			{action.state === "pending" || action.state === "running" ? (
				<div className="mt-14 flex gap-10">
					<button type="button" disabled={action.state === "running"} onClick={() => confirm(message.id, action.id, { ...action.args, ...edits })} className="fs-btn fs-btn-primary h-34 disabled:cursor-default disabled:opacity-[0.5]">
						{t(action.tool === "send_email" ? "send" : "confirm")}
					</button>
					<button type="button" disabled={action.state === "running"} onClick={() => cancel(message.id, action.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">{t("cancel")}</button>
				</div>
			) : (
				<p className={`mt-12 flex flex-wrap items-center gap-8 text-14 ${done ? "text-[#0A8A2E]" : action.state === "failed" ? "text-danger" : "text-[#8c948b]"}`}>
					{done && <MdCheckCircle size={18} aria-hidden />}
					{action.state === "failed" && <MdErrorOutline size={18} aria-hidden />}
					{done ? t(`done_${action.tool}`, action.params ?? {}) : action.state === "failed" ? action.message : t("cancelled")}
					{done && action.link && (
						<button type="button" onClick={() => { hide(); router.push(`/${locale}${action.link}`); }} className="font-medium text-primaryColor hover:underline">{t("open")}</button>
					)}
				</p>
			)}
		</div>
	);
}

function Bubble({ m, ttsOn, speakingId, onSpeak, onStopSpeak }: { m: AiMessage; ttsOn: boolean; speakingId: string | null; onSpeak: (id: string, text: string) => void; onStopSpeak: () => void }) {
	const t = useTranslations("ai");
	if (m.role === "user") return <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-14 bg-[rgba(198,255,77,0.14)] px-14 py-10 text-13 text-[#f1f4ee]">{m.text}</div>;
	const speaking = speakingId === m.id;
	return (
		<div className="max-w-[95%] break-words text-13 text-[#cfd4cb]">
			{!!m.steps?.length && (
				<p className="mb-6 flex flex-wrap gap-6">
					{m.steps.map((s) => <span key={s} className="flex items-center gap-[4px] rounded-8 border border-inkLine px-10 py-[2px] text-11 text-[#8c948b]"><MdSearch size={12} aria-hidden />{t(`step_${s}`)}</span>)}
				</p>
			)}
			{m.error ? <p className="flex items-start gap-8 text-danger"><MdErrorOutline size={20} className="mt-[2px] shrink-0" aria-hidden />{m.text}</p> : <Markdown text={m.text} />}
			{/* Озвучка — браузерный синтез речи, ключей не требует; ошибки ассистента не читаем */}
			{ttsOn && !m.error && (
				<button
					type="button"
					onClick={() => (speaking ? onStopSpeak() : onSpeak(m.id, m.text))}
					aria-label={speaking ? t("stopSpeak") : t("speak")}
					title={speaking ? t("stopSpeak") : t("speak")}
					className={`mt-6 flex items-center gap-6 text-11 transition-colors ${speaking ? "text-[#c6ff4d]" : "text-[#8c948b] hover:text-[#f1f4ee]"}`}>
					{speaking ? <TbPlayerStop size={13} aria-hidden /> : <TbVolume size={13} aria-hidden />}
					{speaking ? t("stopSpeak") : t("speak")}
				</button>
			)}
			{m.actions?.map((a) => <ActionCard key={a.id} message={m} action={a} />)}
		</div>
	);
}

// Firmspace AI (Ctrl/⌘ + K): помощник, который ищет в данных CRM и готовит действия. Ничего не меняет без нажатия «Подтвердить».
export default function AiAssistant() {
	const t = useTranslations("ai");
	const locale = useLocale();
	const pathname = usePathname();
	const router = useRouter();
	const { open, messages, busy, status, draft, setDraft, show, hide, reset, send, confirm, loadStatus } = useAiStore();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const [recent, setRecent] = useState<string[]>([]);
	const [pdfView, setPdfView] = useState<{ url: string; title: string } | null>(null); // PDF, открытый голосом/чатом («покажи заказ»)
	const closePdf = () => setPdfView((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
	// Возможности голоса — только после монтирования: SpeechRecognition и speechSynthesis живут
	// в window и в разметке сервера их нет (иначе разошлась бы гидратация)
	const [voice, setVoice] = useState({ dictation: false, recorder: false, tts: false });
	// Портал в шапку ищет слот по id — на сервере и до гидратации document недоступен
	const [ready, setReady] = useState(false);
	useEffect(() => { setVoice({ dictation: dictationSupported(), recorder: recorderSupported(), tts: ttsSupported() }); setReady(true); }, []);
	const micAvailable = voice.dictation || (voice.recorder && !!status?.stt);
	const { state: micState, start: micStart, stop: micStop } = useVoiceInput({
		locale,
		serverStt: !!status?.stt,
		onText: (text) => setDraft(text),
		onError: (code) => toast.error(t(code)),
	});
	// Озвучка ответов: кнопка у каждого ответа, автоозвучка — переключатель в шапке
	const { speak, stop: stopSpeak, speakingId } = useSpeechOutput(locale);
	const [autoSpeak, setAutoSpeak] = useState(false);
	useEffect(() => { try { setAutoSpeak(localStorage.getItem(AUTO_SPEAK_KEY) === "1"); } catch { /* приватный режим */ } }, []);
	function toggleAutoSpeak() {
		setAutoSpeak((v) => {
			const next = !v;
			if (!next) stopSpeak();
			try { localStorage.setItem(AUTO_SPEAK_KEY, next ? "1" : "0"); } catch { /* приватный режим */ }
			return next;
		});
	}
	const spokenRef = useRef<string | null>(null);

	// ── Голосовое управление (Айрис): слушает на любой странице, пока включено шаром в шапке ─────────────
	// Всё устроено в useVoiceAgent: имя «Айрис» → команда → ответ вслух → переход по страницам; изменения данных
	// по-прежнему требуют подтверждения (голосом «да»/«нет» или кнопкой в панели внизу экрана).
	const blocked = status?.configured === false;
	const empty = messages.length === 0;
	const agent = useVoiceAgent({
		locale,
		page: stripLocale(pathname),
		blocked,
		onError: (code) => toast.error(t(code)),
	});
	useEffect(() => { void loadStatus(); }, [loadStatus]);
	useEffect(() => { if (status) configureSpeech({ server: status.tts !== false }); }, [status]);

	// Ассистент открыл страницу (инструмент navigate): тот же адрес — сообщаем самой странице (бухгалтерия переключает
	// вкладку и фильтр без перезагрузки), другой — переходим. Окно чата закрываем, чтобы человек видел страницу.
	useEffect(() => {
		const onGo = (e: Event) => {
			const nav = (e as CustomEvent<AiNav>).detail;
			if (!nav?.link) return;
			const [path, search = ""] = nav.link.split("?");
			useAiStore.getState().hide();
			const same = stripLocale(window.location.pathname) === path;
			// Бухгалтерия на этой же странице переключает вкладку/фильтр сама (событие); остальное — обычный переход
			// по адресу (вкладки CRM, карточка сделки ?deal=… читают адрес). Уже здесь и без параметров — оставляем как есть.
			if (same && path === "/crm/finance") window.dispatchEvent(new CustomEvent("iris:navigate", { detail: { search } }));
			else if (!(same && !search)) router.push(`/${locale}${nav.link}`);
		};
		window.addEventListener("iris:go", onGo);
		return () => window.removeEventListener("iris:go", onGo);
	}, [locale, router]);

	// Ассистент сохраняет документ (download_document): PDF качается браузером с вашей авторизацией, как по кнопке «PDF»
	useEffect(() => {
		const onDownload = (e: Event) => {
			const d = (e as CustomEvent<AiDownload>).detail;
			if (!d?.id) return;
			if (d.mode === "open") {
				// Просмотр показываем прямо на странице: window.open после запроса (не по клику) браузер блокирует как всплывающее
				// окно, и файл вместо просмотра скачивался. Окно с PDF внутри страницы блокировать нечем.
				void fetchDocumentPdfBlob(d.kind, d.id, locale).then((blob) => {
					if (!blob) return void toast.error(t("downloadFailed"));
					setPdfView((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(blob), title: d.number }; });
				});
				return;
			}
			void downloadDocumentPdf(d.kind, d.id, d.number, locale).then((ok) => { if (!ok) toast.error(t("downloadFailed")); });
		};
		window.addEventListener("iris:download", onDownload);
		return () => window.removeEventListener("iris:download", onDownload);
	}, [locale, t]);

	useEffect(() => {
		if (!open || !autoSpeak || !voice.tts) return;
		const last = messages[messages.length - 1];
		// ответы на голосовые команды озвучивает голосовое управление, не автоозвучка чата
		if (last?.role === "assistant" && !last.error && !last.voice && last.id !== spokenRef.current) {
			spokenRef.current = last.id;
			speak(last.id, last.text);
		}
	}, [messages, open, autoSpeak, voice.tts, speak]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				if (useAiStore.getState().open) useAiStore.getState().hide(); else useAiStore.getState().show();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		if (open) { setRecent(readRecent()); setTimeout(() => inputRef.current?.focus(), 50); }
	}, [open]);
	useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

	const allowed = useMemo(() => new Set(status?.tools.map((x) => x.name) ?? []), [status]);
	const suggestions = SUGGESTIONS.filter((s) => !status || allowed.has(s.tool));

	function submit(text = draft) {
		const value = text.trim();
		if (!value || busy || status?.configured === false) return;
		// Остались карточки, ждущие нажатия: при включённом «без подтверждения» достаточно написать «отправляй» / «да» —
		// подтверждаем их сами, ассистента для этого не вызываем
		const last = [...messages].reverse().find((m) => m.role === "assistant");
		const waiting = last?.actions?.filter((a) => a.state === "pending") ?? [];
		if (agent.autoApprove && last && waiting.length && spokenAnswer(value) === "yes") {
			setDraft("");
			void Promise.all(waiting.map((a) => confirm(last.id, a.id)));
			return;
		}
		rememberRecent(value);
		send(value, { locale, page: stripLocale(pathname), auto: agent.autoApprove });
	}
	function pick(text: string, sendNow: boolean) {
		if (sendNow) submit(text); else { setDraft(text); inputRef.current?.focus(); }
	}

	// Закрытие окна останавливает чтение и диктовку; голосовое управление (если включено) продолжает слушать
	const close = () => { stopSpeak(); micStop(); hide(); };

	// Шар в шапке — переключатель голосового управления: один клик, и Айрис слушает на любой странице
	// («Привет, Айрис, открой бухгалтерию…»). Живёт в шапке кабинета (слот в Header), а не плавающим углом:
	// там его накрывала кнопка звонилки. Переносим через портал, чтобы вся логика осталась в этом компоненте.
	function toggleAgent() {
		if (blocked) return void show(); // ассистент не настроен — окно объяснит, что делать
		if (!agent.supported) {
			toast.error(t("agentUnsupported"));
			return void show();
		}
		agent.toggle();
	}

	const orbSlot = ready && typeof document !== "undefined" ? document.getElementById("ai-orb-slot") : null;

	return (
		<>
		{orbSlot && createPortal(
			<button
				type="button"
				onClick={toggleAgent}
				aria-pressed={agent.enabled}
				aria-label={agent.enabled ? t("agentOn") : t("agentOff")}
				title={agent.enabled ? t("agentOn") : t("agentOff")}
				className="relative rounded-full transition-transform duration-200 hover:scale-105"
			>
				<VoiceOrb size={38} state={ORB_BY_PHASE[agent.phase]} />
				{/* зелёная точка — микрофон включён, Айрис слушает */}
				{agent.enabled && <span aria-hidden className="absolute bottom-0 right-0 h-10 w-10 rounded-50 border-2 border-[#0a0d0a] bg-[#c6ff4d]" />}
			</button>,
			orbSlot
		)}
		{!open && <VoiceHud agent={agent} onOpenChat={() => show()} />}
		{/* Просмотр PDF прямо в странице: открывается по команде «открой/покажи документ», закрывается крестиком или Esc */}
		<Modal open={!!pdfView} onClose={closePdf} align="top" label={pdfView?.title ?? "PDF"} zIndex={95} className="mt-[3vh] w-full max-w-[960px]">
			<div className="fs-popover flex h-[92vh] flex-col overflow-hidden">
				<header className="flex items-center gap-12 border-b border-inkLine px-16 py-10">
					<h2 className="min-w-0 flex-1 truncate text-15 font-medium text-[#f1f4ee]">{pdfView?.title}</h2>
					{pdfView && <a href={pdfView.url} download={`${pdfView.title}.pdf`} className="fs-btn fs-btn-ghost h-30 px-12 text-12">{t("pdfDownload")}</a>}
					<button type="button" onClick={closePdf} aria-label={t("close")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]"><MdClose size={18} /></button>
				</header>
				{pdfView && <iframe src={pdfView.url} title={pdfView.title} className="min-h-0 flex-1 bg-white" />}
			</div>
		</Modal>
		<Modal open={open} onClose={close} align="top" label={t("title")} zIndex={90} className="mt-[6vh] w-full max-w-[720px]">
			<div className="fs-popover flex max-h-[84vh] flex-col overflow-hidden">
				<header className="flex items-center gap-10 border-b border-inkLine px-16 py-12">
					<MdAutoAwesome size={22} className="text-primaryColor" aria-hidden />
					<h2 className="whitespace-nowrap text-18 font-medium text-[#334A74]">{t("title")}</h2>
					{status?.configured && <span className="ml-auto hidden text-11 text-[#8c948b] md:inline">{t("remaining", { n: status.remaining })}</span>}
					{/* Голосовое управление: слушает на любой странице, имя «Айрис» → команда → ответ вслух */}
					{agent.supported && !blocked && (
						<button
							type="button"
							onClick={() => agent.toggle()}
							aria-pressed={agent.enabled}
							aria-label={agent.enabled ? t("agentOn") : t("agentOff")}
							title={agent.enabled ? t("agentOn") : t("agentOff")}
							className={`${status?.configured ? "" : "ml-auto"} flex h-30 items-center gap-6 rounded-8 border px-10 text-11 transition-colors ${agent.enabled ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
							<MdGraphicEq size={15} aria-hidden />
							<span className="max-md:hidden">{t("agentTitle")}</span>
						</button>
					)}
					{/* Без подтверждения: изменения выполняются сразу (удаление и чужой текст из писем — по-прежнему с вопросом) */}
					{!blocked && (
						<button
							type="button"
							onClick={() => agent.setAutoApprove(!agent.autoApprove)}
							aria-pressed={agent.autoApprove}
							title={t("agentAutoHint")}
							className={`flex h-30 items-center gap-6 rounded-8 border px-10 text-11 transition-colors ${agent.autoApprove ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
							<span>{t("agentAuto")}</span>
						</button>
					)}
					{/* Автоозвучка ответов: браузерный синтез речи, ключей не требует */}
					{voice.tts && !blocked && (
						<button
							type="button"
							onClick={toggleAutoSpeak}
							aria-pressed={autoSpeak}
							aria-label={t("autoSpeak")}
							title={t("autoSpeak")}
							className={`${status?.configured || (voice.tts && voice.dictation) ? "" : "ml-auto"} flex h-30 items-center gap-6 rounded-8 border px-10 text-11 transition-colors ${autoSpeak ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
							{autoSpeak ? <TbVolume size={14} aria-hidden /> : <TbVolumeOff size={14} aria-hidden />}
							<span className="max-md:hidden">{t("autoSpeak")}</span>
						</button>
					)}
					<button type="button" onClick={reset} disabled={empty} className={`${status?.configured || (voice.tts && !blocked) ? "max-md:ml-auto" : "ml-auto"} whitespace-nowrap text-12 text-[#8c948b] transition-colors hover:text-[#c6ff4d] disabled:opacity-[0.4]`}>{t("newChat")}</button>
					<button type="button" onClick={close} aria-label={t("close")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]"><MdClose size={18} /></button>
				</header>

				{/* Голосовое управление включено: коротко показываем, что Айрис слышит и делает */}
				{agent.enabled && !blocked && (
					<div className="flex items-center gap-12 border-b border-inkLine bg-[rgba(198,255,77,0.05)] px-16 py-10">
						<button type="button" onClick={() => stopSpeech()} aria-label={t("stopSpeak")} title={t("stopSpeak")} className="relative shrink-0 rounded-full">
							<VoiceOrb size={36} state={ORB_BY_PHASE[agent.phase]} />
						</button>
						<div className="min-w-0 flex-1">
							<p className="text-13 text-[#f1f4ee]">{agent.phase === "sleeping" ? t("agentSleeping") : t(`voice_${agent.phase === "off" ? "listening" : agent.phase}`)}</p>
							<p className="truncate text-12 text-[#8c948b]">{agent.caption || (agent.pending.length ? t("agentSay") : "\u00A0")}</p>
						</div>
						<button type="button" onClick={() => agent.setEnabled(false, false)} className="fs-link shrink-0 text-12">{t("voiceExit")}</button>
					</div>
				)}

				<div className="min-h-[160px] flex-1 overflow-y-auto px-20 py-16">
					{blocked ? (
						<p className="fs-card p-18 text-13 text-[#8c948b]">{t("notConfigured")}</p>
					) : empty ? (
						<div>
							<p className="mb-12 text-13 text-[#cfd4cb]">{t("intro")}</p>
							{status && !status.canWrite && <p className="mb-12 text-12 text-[#8c948b]">{t("readOnly")}</p>}
							<ul className="flex flex-col gap-8">
								{suggestions.map((s) => (
									<li key={s.key}>
										<button type="button" onClick={() => pick(t(s.key), s.send)} className="w-full rounded-10 border border-inkLine px-14 py-10 text-left text-13 text-[#cfd4cb] transition-colors hover:border-[rgba(198,255,77,0.5)] hover:bg-[rgba(198,255,77,0.06)]">{t(s.key)}</button>
									</li>
								))}
							</ul>
							{recent.length > 0 && (
								<>
									<p className="fs-eyebrow mb-6 mt-20 text-[#8C948B]">{t("recent")}</p>
									<ul className="flex flex-col gap-[4px]">
										{recent.map((r) => <li key={r}><button type="button" onClick={() => pick(r, false)} className="w-full truncate text-left text-12 text-[#8c948b] transition-colors hover:text-[#c6ff4d]">↺ {r}</button></li>)}
									</ul>
								</>
							)}
						</div>
					) : (
						<div className="flex flex-col gap-16">
							{messages.map((m) => <Bubble key={m.id} m={m} ttsOn={voice.tts} speakingId={speakingId} onSpeak={speak} onStopSpeak={stopSpeak} />)}
							{busy && <p className="animate-pulse text-12 text-[#8c948b]">{t("thinking")}</p>}
							<div ref={endRef} />
						</div>
					)}
				</div>

				<form onSubmit={(e) => { e.preventDefault(); submit(); }} className="border-t border-inkLine px-16 py-12">
					<div className="flex items-end gap-10">
						{/* Диктовка: браузерная (без ключей) или серверная (ключ OpenAI, см. /api/ai/transcribe).
						    Текст попадает в поле, отправка — вручную: голос ничего не подтверждает сам */}
						{micAvailable && !blocked && (
							<button
								type="button"
								onClick={() => (micState === "idle" ? void micStart(draft) : micStop())}
								aria-label={micState === "idle" ? t("mic") : micState === "listening" ? t("micStop") : t("micTranscribing")}
								title={micState === "idle" ? t("mic") : micState === "listening" ? t("micStop") : t("micTranscribing")}
								className={`fs-btn h-50 w-50 shrink-0 ${micState === "listening" ? "animate-pulse border-[rgba(235,87,87,0.55)] bg-[rgba(235,87,87,0.14)] text-danger" : "fs-btn-ghost"} ${micState === "transcribing" ? "fs-btn-ghost" : ""}`}>
								{micState === "listening" ? <TbPlayerStop size={16} aria-hidden /> : <TbMicrophone size={16} className={micState === "transcribing" ? "animate-pulse" : ""} aria-hidden />}
							</button>
						)}
						<textarea
							ref={inputRef}
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
							rows={2}
							maxLength={2000}
							disabled={blocked}
							placeholder={t("placeholder")}
							aria-label={t("placeholder")}
							className="fs-field min-h-50 flex-1 resize-none px-14 py-10 text-13 outline-none transition-colors"
						/>
						<button type="submit" disabled={!draft.trim() || busy || blocked} className="fs-btn fs-btn-primary h-50 shrink-0 disabled:cursor-default disabled:opacity-[0.4]">{t("ask")}</button>
					</div>
					<p className="mt-8 text-12 text-[#B3B3B3]">
						{micState === "listening" ? t("micListening") : micState === "transcribing" ? t("micTranscribing") : t("disclaimer")}
					</p>
				</form>
			</div>
		</Modal>
		</>
	);
}
