"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { TbAlarm, TbCircleCheck, TbInbox, TbNote, TbRefresh, TbStar, TbStarFilled, TbX } from "react-icons/tb";
import { SiGmail, SiIcloud, SiMicrosoftoffice, SiMicrosoftoutlook } from "react-icons/si";
import { apiCall } from "@/app/store/crmApi";
import type { MailAccountDTO, MailDTO, MailProviderId } from "@/app/types/integrations";
import { localeTag } from "@/app/utils/dateHelpers";
import { usePolling } from "@/app/utils/usePolling";
import Checkbox from "../shared/Checkbox";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import SearchBox from "../shared/SearchBox";
import { formatChatDate } from "./format";
import AiQuickAsk from "../../AiAssistant/AiQuickAsk";
import MailConnectDialog from "./MailConnectDialog";

type MailView = "inbox" | "starred" | "snoozed" | "sent" | "draft";
interface Provider { id: MailProviderId; label: string; logo: React.ReactNode }

const YAHOO = <span className="text-[34px] font-extrabold italic leading-none tracking-[-2px] text-[#6001D2]">yahoo!</span>;
const PROVIDERS: Provider[] = [
	{ id: "outlook", label: "Outlook", logo: <SiMicrosoftoutlook size={42} color="#0072C6" /> },
	{ id: "gmail", label: "Google Mail", logo: <SiGmail size={42} color="#EA4335" /> },
	{ id: "yahoo", label: "Yahoo", logo: YAHOO },
	{ id: "icloud", label: "iCloud", logo: <SiIcloud size={42} color="#3D9EEE" /> },
	{ id: "office365", label: "Office 365", logo: <SiMicrosoftoffice size={42} color="#D83B01" /> },
	{ id: "icloud", label: "iCloud", logo: <SiIcloud size={42} color="#3D9EEE" /> },
	{ id: "yahoo", label: "Yahoo", logo: YAHOO },
	{ id: "imap", label: "IMAP", logo: <span className="font-serif text-14 tracking-[1px] text-[#8c948b]">IMAP</span> },
];

const VIEWS: { key: MailView; icon: IconType }[] = [
	{ key: "inbox", icon: TbInbox },
	{ key: "starred", icon: TbStar },
	{ key: "snoozed", icon: TbAlarm },
	{ key: "sent", icon: TbCircleCheck },
	{ key: "draft", icon: TbNote },
];

function inView(m: MailDTO, view: MailView) {
	if (view === "starred") return m.starred;
	if (view === "snoozed") return m.snoozed;
	if (view === "inbox") return m.folder === "inbox" && !m.snoozed;
	return m.folder === view;
}

const LABELS: Record<MailProviderId, string> = { gmail: "Google Mail", outlook: "Outlook", yahoo: "Yahoo", icloud: "iCloud", office365: "Office 365", imap: "IMAP" };
const EMPTY_DRAFT = { id: "", to: "", subject: "", body: "" };
const inputClass = "fs-field h-40 w-full px-12 text-13 outline-none";

// Web Mails (/crm/collaboration/web-mails): подключение ящика (Gmail / Outlook через OAuth или пароль приложения, Yahoo, iCloud, любой IMAP),
// затем ящик — Inbox / Starred / Snoozed / Sent / Draft. Письма загружаются с почтового сервера (сервер CRM ходит по IMAP или API провайдера),
// новые подтягиваются раз в минуту и по кнопке «обновить». Звезда, «отложить» и удаление действуют только в CRM, на почтовом сервере письма остаются.
export default function WebMails() {
	const t = useTranslations("collab");
	const tAi = useTranslations("ai");
	const locale = useLocale();
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const [accounts, setAccounts] = useState<MailAccountDTO[]>([]);
	const [oauth, setOauth] = useState({ google: false, microsoft: false });
	const [loaded, setLoaded] = useState(false);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [connectFor, setConnectFor] = useState<MailProviderId | null>(null);
	const [mails, setMails] = useState<MailDTO[]>([]);
	const [syncing, setSyncing] = useState(false);
	const syncingRef = useRef(false);
	const selectNewest = useRef(params.get("mail") === "connected"); // вернулись со страницы входа Google/Microsoft — показываем новый ящик

	const [view, setView] = useState<MailView>("inbox");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [composeOpen, setComposeOpen] = useState(false);
	const [draft, setDraft] = useState(EMPTY_DRAFT);
	const [sending, setSending] = useState(false);
	const [reading, setReading] = useState<MailDTO | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [confirmDisconnect, setConfirmDisconnect] = useState(false);

	const active = accounts.find((a) => a.id === activeId) ?? accounts[0] ?? null;
	const accountId = active?.id ?? null;

	const loadAccounts = useCallback(async () => {
		const res = await apiCall<{ accounts: MailAccountDTO[]; oauth: { google: boolean; microsoft: boolean } }>("/api/mail/accounts");
		if (res.ok && res.data) {
			setAccounts(res.data.accounts);
			setOauth(res.data.oauth);
			if (selectNewest.current && res.data.accounts.length) {
				selectNewest.current = false;
				setActiveId(res.data.accounts[res.data.accounts.length - 1].id);
			}
		}
		setLoaded(true);
	}, []);
	useEffect(() => { loadAccounts(); }, [loadAccounts]);

	// возврат со страницы входа Google/Microsoft: ?mail=connected|denied|error
	useEffect(() => {
		const status = params.get("mail");
		if (!status) return;
		if (status === "connected") toast.success(t("mailConnectedOk"));
		else if (status === "denied") toast(t("mailOauthDenied"));
		else toast.error(t("mailOauthFailed", { message: params.get("message") ?? "" }));
		router.replace(pathname);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadMails = useCallback(async () => {
		if (!accountId) return setMails([]);
		const q = query.trim();
		const res = await apiCall<MailDTO[]>(`/api/mail/messages?account=${accountId}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
		if (res.ok && res.data) setMails(res.data);
	}, [accountId, query]);

	// быстрый показ из базы при смене ящика и (с небольшой задержкой) при вводе в поиск
	useEffect(() => {
		const id = setTimeout(loadMails, query ? 300 : 0);
		return () => clearTimeout(id);
	}, [loadMails, query]);

	const sync = useCallback(async (manual: boolean) => {
		if (!accountId || syncingRef.current) return;
		syncingRef.current = true;
		setSyncing(true);
		const res = await apiCall<{ added: number; leads?: number; account: MailAccountDTO }>(`/api/mail/accounts/${accountId}/sync`, "POST");
		syncingRef.current = false;
		setSyncing(false);
		if (res.ok && res.data) {
			setAccounts((list) => list.map((a) => (a.id === accountId ? res.data!.account : a)));
			if (res.data.added > 0 || manual) loadMails();
			if (res.data.leads) toast.success(t("mailLeadsCreated", { count: res.data.leads }));
		} else {
			setAccounts((list) => list.map((a) => (a.id === accountId ? { ...a, status: "error", error: res.message } : a)));
			if (manual) toast.error(res.message);
		}
	}, [accountId, loadMails, t]);
	usePolling(() => sync(false), 60_000, accountId !== null);

	// «Создавать лиды из новых писем» — настройка ящика
	async function toggleAutoLeads(value: boolean) {
		if (!active) return;
		setAccounts((list) => list.map((a) => (a.id === active.id ? { ...a, autoLeads: value } : a)));
		const res = await apiCall(`/api/mail/accounts/${active.id}`, "PATCH", { autoLeads: value });
		if (!res.ok) {
			setAccounts((list) => list.map((a) => (a.id === active.id ? { ...a, autoLeads: !value } : a)));
			toast.error(res.message);
		}
	}

	const rows = mails.filter((m) => inView(m, view));
	const allChecked = rows.length > 0 && rows.every((m) => selected.includes(m.id));
	const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
	const unreadInbox = mails.filter((m) => m.folder === "inbox" && !m.snoozed && !m.read).length;

	async function patch(ids: string[], change: Partial<Pick<MailDTO, "starred" | "snoozed" | "read">>) {
		setMails((list) => list.map((m) => (ids.includes(m.id) ? { ...m, ...change } : m)));
		const res = await apiCall("/api/mail/messages", "PATCH", { ids, patch: change });
		if (!res.ok) loadMails();
	}

	async function removeMails() {
		const ids = selected;
		setConfirmDelete(false);
		setSelected([]);
		setMails((list) => list.filter((m) => !ids.includes(m.id)));
		const res = await apiCall("/api/mail/messages", "DELETE", { ids });
		if (!res.ok) loadMails();
	}

	async function openMail(m: MailDTO) {
		const res = await apiCall<MailDTO>(`/api/mail/messages/${m.id}`);
		if (!res.ok || !res.data) return void toast.error(res.message);
		if (m.folder === "draft") {
			setDraft({ id: m.id, to: res.data.to, subject: res.data.subject, body: res.data.body });
			return setComposeOpen(true);
		}
		setReading(res.data);
		setMails((list) => list.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
	}

	async function saveMail(asDraft: boolean) {
		if (!accountId || sending) return;
		if (!asDraft && !/^\S+@\S+\.\S+$/.test(draft.to.trim().split(/[,;]/)[0].trim())) return void toast.error(t("mailToInvalid"));
		setSending(true);
		const res = await apiCall("/api/mail/send", "POST", { accountId, to: draft.to, subject: draft.subject, body: draft.body, draft: asDraft, draftId: draft.id || undefined });
		setSending(false);
		if (!res.ok) return void toast.error(res.message || t("mailSendFailed"));
		toast.success(asDraft ? t("mailDraftSaved") : t("mailSent"));
		setDraft(EMPTY_DRAFT);
		setComposeOpen(false);
		setView(asDraft ? "draft" : "sent");
		loadMails();
	}

	async function disconnect() {
		if (!active) return;
		setConfirmDisconnect(false);
		const res = await apiCall(`/api/mail/accounts/${active.id}`, "DELETE");
		if (!res.ok) return void toast.error(res.message);
		setAccounts((list) => list.filter((a) => a.id !== active.id));
		setActiveId(null);
		setMails([]);
		setSelected([]);
	}

	function connected(account: MailAccountDTO) {
		setConnectFor(null);
		setAdding(false);
		setAccounts((list) => [...list.filter((a) => a.id !== account.id), account]);
		setActiveId(account.id);
		toast.success(t("mailConnected", { name: account.email }));
	}

	// ── выбор почтового сервиса ────────────────────────────────────────────────
	if (loaded && (accounts.length === 0 || adding)) {
		return (
			<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
				{adding && (
					<button type="button" onClick={() => setAdding(false)} className="mb-16 text-12 text-[#c6ff4d] transition-opacity hover:opacity-80">← {t("back")}</button>
				)}
				<ul className="grid grid-cols-2 gap-16 md:grid-cols-4 md:gap-20">
					{PROVIDERS.map((p, i) => (
						<li key={i}>
							<button
								type="button"
								onClick={() => setConnectFor(p.id)}
								className="fs-card flex h-[124px] w-full flex-col items-center justify-center gap-12 transition-transform duration-200 hover:-translate-y-2 md:h-[92px] md:gap-6 lg:h-[112px] lg:gap-10">
								<span className="flex h-[52px] items-center md:h-[36px] md:scale-[0.65] lg:h-[52px] lg:scale-90">{p.logo}</span>
								<span className="text-13 text-[#8c948b] lg:text-14">{p.label}</span>
							</button>
						</li>
					))}
				</ul>
				<MailConnectDialog provider={connectFor} oauth={oauth} onClose={() => setConnectFor(null)} onConnected={connected} />
			</div>
		);
	}
	if (!loaded || !active) return <div className="p-30 text-center text-13 text-[#8c948b]">…</div>;

	// ── почтовый ящик ────────────────────────────────────────────────
	const barButton = "text-13 font-semibold transition-opacity hover:opacity-80";
	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<div className="flex flex-col gap-20 lg:flex-row">
				<nav aria-label={t("mailFolders")} className="fs-card w-full shrink-0 self-start p-8 md:w-auto md:min-w-[166px] md:max-w-[280px]">
					<ul>
						{VIEWS.map(({ key, icon: Icon }, i) => (
							<li key={key} className={i > 0 ? "border-t border-inkLineSoft" : ""}>
								<button
									type="button"
									onClick={() => { setView(key); setSelected([]); }}
									aria-current={view === key ? "page" : undefined}
									className={`flex h-44 w-full items-center gap-10 rounded-8 px-12 text-left text-13 font-medium transition-colors duration-200 ${view === key ? "bg-[rgba(198,255,77,0.08)] text-[#c6ff4d]" : "text-[#8c948b] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#f1f4ee]"}`}>
									<Icon size={20} className="shrink-0" />
									<span className="flex-1 truncate">{t(`folder_${key}`)}</span>
									{key === "inbox" && unreadInbox > 0 && <span className="text-11 text-[#8C948B]">{unreadInbox}</span>}
								</button>
							</li>
						))}
					</ul>
				</nav>

				<section className="min-w-0 flex-1">
					<div className="mb-16 flex flex-wrap items-center gap-x-12 gap-y-6 text-12 text-[#8c948b]">
						{t("mailAccount")}:
						{accounts.length > 1 ? (
							<select value={active.id} onChange={(e) => { setActiveId(e.target.value); setSelected([]); }} aria-label={t("mailAccount")} className="fs-field h-34 max-w-[240px] px-10 text-12 font-medium">
								{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
							</select>
						) : (
							<span className="font-medium text-[#f1f4ee]">{active.email} <span className="font-normal text-[#8C948B]">({LABELS[active.provider]})</span></span>
						)}
						<button type="button" onClick={() => sync(true)} disabled={syncing} aria-label={t("mailRefresh")} title={t("mailRefresh")} className="flex items-center text-[#c6ff4d] transition-opacity hover:opacity-80 disabled:opacity-60">
							<TbRefresh size={17} className={syncing ? "animate-spin" : ""} />
						</button>
						<button type="button" onClick={() => setAdding(true)} className="text-[#c6ff4d] transition-opacity hover:opacity-80">{t("mailAddAccount")}</button>
						<button type="button" onClick={() => setConfirmDisconnect(true)} className="flex items-center gap-2 text-[#c6ff4d] transition-opacity hover:opacity-80">
							<TbX size={14} /> {t("mailDisconnect")}
						</button>
						<label className="flex cursor-pointer items-center gap-6" title={t("mailAutoLeadsHint")}>
							<input type="checkbox" checked={active.autoLeads} onChange={(e) => toggleAutoLeads(e.target.checked)} className="h-[15px] w-[15px] cursor-pointer accent-[#c6ff4d]" />
							{t("mailAutoLeads")}
						</label>
					</div>
					{active.status === "error" && (
						<p role="alert" className="mb-16 rounded-10 border border-[rgba(235,87,87,0.25)] bg-[rgba(235,87,87,0.08)] p-12 text-12 text-danger">{t("mailAccountError", { message: active.error })}</p>
					)}
					<div className="mb-20 flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
						<SearchBox value={query} onChange={setQuery} placeholder={t("filterSearchMail")} className="w-full md:w-[250px] lg:w-[350px]" />
						<div className="flex items-center gap-16">
							{selected.length > 0 && (
								<>
									<button type="button" onClick={() => { patch(selected, { starred: true }); setSelected([]); }} className={`${barButton} text-[#8c948b]`}>{t("markStar")}</button>
									<button type="button" onClick={() => { patch(selected, { snoozed: view !== "snoozed" }); setSelected([]); }} className={`${barButton} text-[#8c948b]`}>
										{view === "snoozed" ? t("unsnooze") : t("snooze")}
									</button>
									<button type="button" onClick={() => setConfirmDelete(true)} className={`${barButton} text-danger`}>{t("delete")} ({selected.length})</button>
								</>
							)}
							<button
								type="button"
								onClick={() => { setDraft(EMPTY_DRAFT); setComposeOpen(true); }}
								className="fs-btn fs-btn-primary h-40 w-full md:w-auto">
								{t("newEmail")}
							</button>
						</div>
					</div>

					<div className="fs-card min-h-[280px] overflow-x-auto">
						<table className="fs-table min-w-[480px] table-fixed">
							<thead>
								<tr>
									<th className="w-[46px] pl-16"><Checkbox checked={allChecked} onChange={(v) => setSelected(v ? rows.map((m) => m.id) : [])} label={t("selectAll")} /></th>
									<th className="px-10 text-center">{t("mailName")}</th>
									<th className="w-[230px] px-10 text-center">{t("mailDate")}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((m) => (
									<tr key={m.id} className={`h-[52px] animate-fade-in transition-colors duration-150 ${selected.includes(m.id) ? "bg-[rgba(198,255,77,0.06)]" : ""}`}>
										<td className="pl-16"><Checkbox checked={selected.includes(m.id)} onChange={() => toggle(m.id)} label={t("selectRow")} /></td>
										<td className="px-10">
											<div className="flex items-center gap-10">
												<button type="button" aria-pressed={m.starred} aria-label={t("markStar")} onClick={() => patch([m.id], { starred: !m.starred })} className={`shrink-0 transition-colors ${m.starred ? "text-[#f4b942]" : "text-[#8C948B] hover:text-[#8c948b]"}`}>
													{m.starred ? <TbStarFilled size={18} /> : <TbStar size={18} />}
												</button>
												<button type="button" onClick={() => openMail(m)} className={`min-w-0 flex-1 truncate text-left text-13 transition-colors hover:text-[#c6ff4d] ${m.read ? "text-[#8c948b]" : "font-semibold text-[#f1f4ee]"}`}>
													<span className="font-medium">{view === "sent" || view === "draft" ? m.to || "—" : m.from}</span>
													<span className={m.read ? "text-[#8C948B]" : "text-[#8c948b]"}> — {m.subject || t("noSubject")}</span>
												</button>
											</div>
										</td>
										<td className="truncate px-10 text-center text-11 text-[#8c948b]">{formatChatDate(m.at, locale)}</td>
									</tr>
								))}
							</tbody>
						</table>
						{rows.length === 0 && <p className="py-40 text-center text-13 text-[#8c948b]">{syncing ? t("mailSyncing") : t("mailEmpty")}</p>}
					</div>
				</section>
			</div>

			<Modal open={composeOpen} onClose={() => setComposeOpen(false)} label={t("newEmail")} className="w-full max-w-[600px]">
				<form onSubmit={(e) => { e.preventDefault(); saveMail(false); }} className="fs-popover p-24">
					<h2 className="mb-20 text-16 font-semibold text-[#f1f4ee]">{t("newEmail")}</h2>
					<div className="flex flex-col gap-12">
						<input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder={t("mailTo")} aria-label={t("mailTo")} maxLength={300} className={inputClass} />
						<input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder={t("mailSubject")} aria-label={t("mailSubject")} maxLength={200} className={inputClass} />
						<textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder={t("mailBody")} aria-label={t("mailBody")} rows={7} maxLength={5000} className="fs-field h-auto resize-none p-12 text-13 outline-none" />
					</div>
					<div className="mt-20 flex flex-wrap justify-end gap-10">
						<button type="button" onClick={() => setComposeOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="button" disabled={sending} onClick={() => saveMail(true)} className="fs-btn fs-btn-ghost h-40 disabled:opacity-50">{t("saveDraft")}</button>
						<button type="submit" disabled={sending} className="fs-btn fs-btn-primary h-40 disabled:opacity-50">{sending ? "…" : t("send")}</button>
					</div>
				</form>
			</Modal>

			<Modal open={reading !== null} onClose={() => setReading(null)} label={reading?.subject} className="w-full max-w-[600px]">
				<div className="fs-popover p-24">
					<div className="mb-6 flex items-start justify-between gap-16">
						<h2 className="break-words text-16 font-semibold text-[#f1f4ee]">{reading?.subject || t("noSubject")}</h2>
						<div className="flex shrink-0 items-center gap-12 pt-[4px]">
							{reading && (
								<AiQuickAsk
									prompt={tAi("analyzeMailPrompt", { subject: reading.subject || t("noSubject"), from: reading.from })}
									requiredTool="search_mail"
									label={tAi("analyzeMail")}
								/>
							)}
							<button type="button" onClick={() => setReading(null)} aria-label={t("close")} className="text-[#8c948b] transition-colors hover:text-[#f1f4ee]"><TbX size={18} /></button>
						</div>
					</div>
					<p className="mb-20 break-words text-12 text-[#8C948B]">
						{reading?.from} → {reading?.to} · {reading ? new Date(reading.at).toLocaleString(localeTag(locale)) : ""}
					</p>
					<p className="whitespace-pre-wrap break-words text-13 text-[#f1f4ee]">{reading?.body}</p>
				</div>
			</Modal>

			<ConfirmDialog
				open={confirmDelete}
				title={t("delete")}
				text={t("confirmDeleteMails", { count: selected.length })}
				onCancel={() => setConfirmDelete(false)}
				onConfirm={removeMails}
			/>
			<ConfirmDialog
				open={confirmDisconnect}
				title={t("mailDisconnect")}
				text={t("mailDisconnectConfirm", { email: active.email })}
				confirmLabel={t("mailDisconnect")}
				onCancel={() => setConfirmDisconnect(false)}
				onConfirm={disconnect}
			/>
			<MailConnectDialog provider={connectFor} oauth={oauth} onClose={() => setConnectFor(null)} onConnected={connected} />
		</div>
	);
}
