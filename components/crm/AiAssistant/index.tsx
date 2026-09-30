"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAutoAwesome, MdCheckCircle, MdClose, MdErrorOutline, MdSearch } from "react-icons/md";
import { TbMicrophone, TbPlayerStop, TbVolume, TbVolumeOff } from "react-icons/tb";
import { AiAction, AiMessage, useAiStore } from "@/store/useAiStore";
import { stripLocale } from "@/utils/locale";
import Modal from "../shared/Modal";
import Markdown from "./markdown";
import { dictationSupported, recorderSupported, ttsSupported, useSpeechOutput, useVoiceInput } from "./voice";

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
	const shown = (v: unknown) => (typeof v === "boolean" ? t(v ? "yes" : "no") : String(v).replace("T", " "));
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
	const { open, messages, busy, status, draft, setDraft, hide, reset, send } = useAiStore();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const [recent, setRecent] = useState<string[]>([]);
	// Возможности голоса — только после монтирования: SpeechRecognition и speechSynthesis живут
	// в window и в разметке сервера их нет (иначе разошлась бы гидратация)
	const [voice, setVoice] = useState({ dictation: false, recorder: false, tts: false });
	useEffect(() => { setVoice({ dictation: dictationSupported(), recorder: recorderSupported(), tts: ttsSupported() }); }, []);
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
	useEffect(() => {
		if (!open || !autoSpeak || !voice.tts) return;
		const last = messages[messages.length - 1];
		if (last?.role === "assistant" && !last.error && last.id !== spokenRef.current) {
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
		rememberRecent(value);
		send(value, { locale, page: stripLocale(pathname) });
	}
	function pick(text: string, sendNow: boolean) {
		if (sendNow) submit(text); else { setDraft(text); inputRef.current?.focus(); }
	}

	const blocked = status?.configured === false;
	const empty = messages.length === 0;
	// Закрытие окна останавливает и чтение, и запись — микрофон не должен остаться включённым
	const close = () => { stopSpeak(); micStop(); hide(); };

	return (
		<Modal open={open} onClose={close} align="top" label={t("title")} zIndex={90} className="mt-[6vh] w-full max-w-[720px]">
			<div className="fs-popover flex max-h-[84vh] flex-col overflow-hidden">
				<header className="flex items-center gap-10 border-b border-inkLine px-16 py-12">
					<MdAutoAwesome size={22} className="text-primaryColor" aria-hidden />
					<h2 className="whitespace-nowrap text-18 font-medium text-[#334A74]">{t("title")}</h2>
					{status?.configured && <span className="ml-auto hidden text-11 text-[#8c948b] md:inline">{t("remaining", { n: status.remaining })}</span>}
					{/* Автоозвучка ответов: браузерный синтез речи, ключей не требует */}
					{voice.tts && !blocked && (
						<button
							type="button"
							onClick={toggleAutoSpeak}
							aria-pressed={autoSpeak}
							aria-label={t("autoSpeak")}
							title={t("autoSpeak")}
							className={`${status?.configured ? "" : "ml-auto"} flex h-30 items-center gap-6 rounded-8 border px-10 text-11 transition-colors ${autoSpeak ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#c6ff4d]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
							{autoSpeak ? <TbVolume size={14} aria-hidden /> : <TbVolumeOff size={14} aria-hidden />}
							<span className="max-md:hidden">{t("autoSpeak")}</span>
						</button>
					)}
					<button type="button" onClick={reset} disabled={empty} className={`${status?.configured || (voice.tts && !blocked) ? "max-md:ml-auto" : "ml-auto"} whitespace-nowrap text-12 text-[#8c948b] transition-colors hover:text-[#c6ff4d] disabled:opacity-[0.4]`}>{t("newChat")}</button>
					<button type="button" onClick={close} aria-label={t("close")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]"><MdClose size={18} /></button>
				</header>

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
	);
}
