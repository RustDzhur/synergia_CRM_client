"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdAutoAwesome, MdCheckCircle, MdClose, MdErrorOutline, MdSearch } from "react-icons/md";
import { AiAction, AiMessage, useAiStore } from "@/app/store/useAiStore";
import { stripLocale } from "@/app/utils/locale";
import Modal from "../Main/shared/Modal";
import Markdown from "./markdown";

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
	const fields = Object.entries(action.args).filter(([k, v]) => k !== "id" && v !== "" && v !== undefined);
	const shown = (k: string, v: unknown) => (typeof v === "boolean" ? t(v ? "yes" : "no") : String(v).replace("T", " "));
	const done = action.state === "done";

	return (
		<div className={`mt-10 rounded-16 border p-16 ${done ? "border-[#BFE6C8] bg-[#F3FBF5]" : action.state === "failed" ? "border-[#F3C5C5] bg-[#FFF6F6]" : "border-[#D6E6FA] bg-[#F5F9FF]"} ${action.state === "cancelled" ? "opacity-[0.6]" : ""}`}>
			<p className="flex items-center gap-8 text-16 font-medium text-[#334A74]">
				<MdAutoAwesome size={18} className="shrink-0 text-primaryColor" aria-hidden />
				{t(`act_${action.tool}`)}{action.target ? `: ${action.target}` : ""}
			</p>
			<dl className="mt-10 grid gap-x-12 gap-y-6 text-14 md:grid-cols-[auto_minmax(0,1fr)]">
				{fields.map(([k, v]) => (
					<React.Fragment key={k}>
						<dt className="text-[#999999]">{t(`f_${k}`)}</dt>
						<dd className="min-w-0 break-words text-[#4D4D4D]">
							{editable.includes(k) && action.state === "pending" ? (
								k === "body" ? (
									<textarea rows={6} value={edits[k] ?? String(v)} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} className="w-full resize-y rounded-8 border border-[#E6E6E6] bg-white px-10 py-8 text-14 outline-none focus:border-[#5EA8F5]" />
								) : (
									<input value={edits[k] ?? String(v)} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} className="w-full rounded-8 border border-[#E6E6E6] bg-white px-10 py-6 text-14 outline-none focus:border-[#5EA8F5]" />
								)
							) : (
								<span className="whitespace-pre-wrap">{shown(k, v)}</span>
							)}
						</dd>
					</React.Fragment>
				))}
			</dl>
			{action.state === "pending" || action.state === "running" ? (
				<div className="mt-14 flex gap-10">
					<button type="button" disabled={action.state === "running"} onClick={() => confirm(message.id, action.id, { ...action.args, ...edits })} className="rounded-8 bg-primaryColor px-20 py-8 text-16 font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-[0.5]">
						{t(action.tool === "send_email" ? "send" : "confirm")}
					</button>
					<button type="button" disabled={action.state === "running"} onClick={() => cancel(message.id, action.id)} className="rounded-8 border border-[#E6E6E6] bg-white px-16 py-8 text-16 text-[#666666] transition-colors hover:bg-gray disabled:opacity-[0.5]">{t("cancel")}</button>
				</div>
			) : (
				<p className={`mt-12 flex flex-wrap items-center gap-8 text-14 ${done ? "text-[#0A8A2E]" : action.state === "failed" ? "text-danger" : "text-[#999999]"}`}>
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

function Bubble({ m }: { m: AiMessage }) {
	const t = useTranslations("ai");
	if (m.role === "user") return <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-16 bg-primaryColor px-16 py-10 text-16 text-white">{m.text}</div>;
	return (
		<div className="max-w-[95%] break-words text-16 text-[#4D4D4D]">
			{!!m.steps?.length && (
				<p className="mb-6 flex flex-wrap gap-6">
					{m.steps.map((s) => <span key={s} className="flex items-center gap-[4px] rounded-8 bg-[#F5F7FC] px-10 py-[2px] text-12 text-[#999999]"><MdSearch size={12} aria-hidden />{t(`step_${s}`)}</span>)}
				</p>
			)}
			{m.error ? <p className="flex items-start gap-8 text-danger"><MdErrorOutline size={20} className="mt-[2px] shrink-0" aria-hidden />{m.text}</p> : <Markdown text={m.text} />}
			{m.actions?.map((a) => <ActionCard key={a.id} message={m} action={a} />)}
		</div>
	);
}

// Firmspace AI (Ctrl/⌘ + K): помощник, который ищет в данных CRM и готовит действия. Ничего не меняет без нажатия «Подтвердить».
export default function AiAssistant() {
	const t = useTranslations("ai");
	const locale = useLocale();
	const pathname = usePathname();
	const { open, messages, busy, status, draft, setDraft, show, hide, reset, send } = useAiStore();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const [recent, setRecent] = useState<string[]>([]);

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

	return (
		<Modal open={open} onClose={hide} align="top" label={t("title")} zIndex={90} className="mt-[6vh] w-full max-w-[720px]">
			<div className="flex max-h-[84vh] flex-col overflow-hidden rounded-16 bg-white shadow-heroImage">
				<header className="flex items-center gap-10 border-b border-[#F0F0F0] px-20 py-14">
					<MdAutoAwesome size={22} className="text-primaryColor" aria-hidden />
					<h2 className="whitespace-nowrap text-18 font-medium text-[#334A74]">{t("title")}</h2>
					{status?.configured && <span className="ml-auto hidden text-12 text-[#999999] md:inline">{t("remaining", { n: status.remaining })}</span>}
					<button type="button" onClick={reset} disabled={empty} className={`${status?.configured ? "max-md:ml-auto" : "ml-auto"} whitespace-nowrap text-14 text-[#999999] transition-colors hover:text-primaryColor disabled:opacity-[0.4]`}>{t("newChat")}</button>
					<button type="button" onClick={hide} aria-label={t("close")} className="text-[#999999] transition-colors hover:text-black"><MdClose size={22} /></button>
				</header>

				<div className="min-h-[160px] flex-1 overflow-y-auto px-20 py-16">
					{blocked ? (
						<p className="rounded-16 bg-[#F5F7FC] p-20 text-16 text-[#666666]">{t("notConfigured")}</p>
					) : empty ? (
						<div>
							<p className="mb-12 text-16 text-[#666666]">{t("intro")}</p>
							{status && !status.canWrite && <p className="mb-12 text-14 text-[#999999]">{t("readOnly")}</p>}
							<ul className="flex flex-col gap-8">
								{suggestions.map((s) => (
									<li key={s.key}>
										<button type="button" onClick={() => pick(t(s.key), s.send)} className="w-full rounded-8 border border-[#E6E6E6] px-14 py-10 text-left text-16 text-[#4D4D4D] transition-colors hover:border-[#5EA8F5] hover:bg-[#F5F9FF]">{t(s.key)}</button>
									</li>
								))}
							</ul>
							{recent.length > 0 && (
								<>
									<p className="mb-6 mt-20 text-12 uppercase tracking-[0.5px] text-[#999999]">{t("recent")}</p>
									<ul className="flex flex-col gap-[4px]">
										{recent.map((r) => <li key={r}><button type="button" onClick={() => pick(r, false)} className="w-full truncate text-left text-14 text-[#666666] hover:text-primaryColor">↺ {r}</button></li>)}
									</ul>
								</>
							)}
						</div>
					) : (
						<div className="flex flex-col gap-16">
							{messages.map((m) => <Bubble key={m.id} m={m} />)}
							{busy && <p className="animate-pulse text-14 text-[#999999]">{t("thinking")}</p>}
							<div ref={endRef} />
						</div>
					)}
				</div>

				<form onSubmit={(e) => { e.preventDefault(); submit(); }} className="border-t border-[#F0F0F0] px-20 py-14">
					<div className="flex items-end gap-10">
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
							className="min-h-[50px] flex-1 resize-none rounded-[12px] border border-[#E6E6E6] px-16 py-10 text-16 text-[#4D4D4D] outline-none transition-colors placeholder:text-[#CCCCCC] focus:border-[#5EA8F5] disabled:bg-[#F5F7FC]"
						/>
						<button type="submit" disabled={!draft.trim() || busy || blocked} className="h-[50px] rounded-8 bg-primaryColor px-20 text-16 font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-[0.4]">{t("ask")}</button>
					</div>
					<p className="mt-8 text-12 text-[#B3B3B3]">{t("disclaimer")}</p>
				</form>
			</div>
		</Modal>
	);
}
