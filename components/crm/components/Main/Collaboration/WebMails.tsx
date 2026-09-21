"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { MdAlarm, MdClose, MdEditNote, MdMoveToInbox, MdOutlineCheckCircleOutline, MdRefresh, MdStar, MdStarBorder } from "react-icons/md";
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
	{ id: "imap", label: "IMAP", logo: <span className="font-serif text-18 tracking-[1px] text-[#666666]">IMAP</span> },
];

const VIEWS: { key: MailView; icon: IconType }[] = [
	{ key: "inbox", icon: MdMoveToInbox },
	{ key: "starred", icon: MdStar },
	{ key: "snoozed", icon: MdAlarm },
	{ key: "sent", icon: MdOutlineCheckCircleOutline },
	{ key: "draft", icon: MdEditNote },
];

function inView(m: MailDTO, view: MailView) {
	if (view === "starred") return m.starred;
	if (view === "snoozed") return m.snoozed;
	if (view === "inbox") return m.folder === "inbox" && !m.snoozed;
	return m.folder === view;
}

const LABELS: Record<MailProviderId, string> = { gmail: "Google Mail", outlook: "Outlook", yahoo: "Yahoo", icloud: "iCloud", office365: "Office 365", imap: "IMAP" };
const EMPTY_DRAFT = { id: "", to: "", subject: "", body: "" };
const inputClass = "h-50 rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] px-16 text-16 shadow-custom outline-none focus:border-[#5EA8F5]";

// Web Mails (/crm/collaboration/web-mails): подключение ящика (Gmail / Outlook через OAuth или пароль приложения, Yahoo, iCloud, любой IMAP),
// затем ящик — Inbox / Starred / Snoozed / Sent / Draft. Письма загружаются с почтового сервера (сервер CRM ходит по IMAP или API провайдера),
// новые подтягиваются раз в минуту и по кнопке «обновить». Звезда, «отложить» и удаление действуют только в CRM, на почтовом сервере письма остаются.
export default function WebMails() {
	const t = useTranslations("collab");
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
			<div className="p-16 md:p-30">
				{adding && (
					<button type="button" onClick={() => setAdding(false)} className="mb-16 text-14 text-primaryColor transition-opacity hover:opacity-80">← {t("back")}</button>
				)}
				<ul className="grid grid-cols-2 gap-16 md:grid-cols-4 md:gap-20">
					{PROVIDERS.map((p, i) => (
						<li key={i}>
							<button
								type="button"
								onClick={() => setConnectFor(p.id)}
								className="flex h-[150px] w-full flex-col items-center justify-center gap-16 rounded-8 bg-white shadow-heroImage transition-transform duration-200 hover:-translate-y-2 md:h-[100px] md:gap-6 lg:h-[125px] lg:gap-10">
								<span className="flex h-[60px] items-center md:h-[40px] md:scale-[0.7] lg:h-[60px] lg:scale-100">{p.logo}</span>
								<span className="text-16 text-[#999999] lg:text-18">{p.label}</span>
							</button>
						</li>
					))}
				</ul>
				<MailConnectDialog provider={connectFor} oauth={oauth} onClose={() => setConnectFor(null)} onConnected={connected} />
			</div>
		);
	}
	if (!loaded || !active) return <div className="p-30 text-center text-16 text-[#999999]">…</div>;

	// ── почтовый ящик ────────────────────────────────────────────────
	const barButton = "text-16 font-semibold transition-opacity hover:opacity-80";
	return (
		<div className="p-16 md:p-30">
			<div className="flex flex-col gap-30 lg:flex-row">
				<nav aria-label={t("mailFolders")} className="w-full shrink-0 self-start rounded-16 bg-white px-20 shadow-heroImage md:w-auto md:min-w-[166px] md:max-w-[280px]">
					<ul>
						{VIEWS.map(({ key, icon: Icon }, i) => (
							<li key={key} className={i > 0 ? "border-t border-[#E6E6E6]" : ""}>
								<button
									type="button"
									onClick={() => { setView(key); setSelected([]); }}
									aria-current={view === key ? "page" : undefined}
									className={`flex h-[70px] w-full items-center gap-12 text-left text-16 font-medium transition-colors duration-200 md:text-18 ${view === key ? "text-primaryColor" : "text-iconColor hover:text-[#808080]"}`}>
									<Icon size={28} className="shrink-0" />
									<span className="flex-1 truncate">{t(`folder_${key}`)}</span>
									{key === "inbox" && unreadInbox > 0 && <span className="text-14 text-[#B3B3B3]">{unreadInbox}</span>}
								</button>
							</li>
						))}
					</ul>
				</nav>

				<section className="min-w-0 flex-1">
					<div className="mb-16 flex flex-wrap items-center gap-x-12 gap-y-6 text-14 text-[#999999]">
						{t("mailAccount")}:
						{accounts.length > 1 ? (
							<select value={active.id} onChange={(e) => { setActiveId(e.target.value); setSelected([]); }} aria-label={t("mailAccount")} className="max-w-[240px] rounded-4 border border-[#E6E6E6] bg-white px-6 py-2 font-medium text-[#666666]">
								{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
							</select>
						) : (
							<span className="font-medium text-[#666666]">{active.email} <span className="font-normal text-[#B3B3B3]">({LABELS[active.provider]})</span></span>
						)}
						<button type="button" onClick={() => sync(true)} disabled={syncing} aria-label={t("mailRefresh")} title={t("mailRefresh")} className="flex items-center text-primaryColor transition-opacity hover:opacity-80 disabled:opacity-60">
							<MdRefresh size={20} className={syncing ? "animate-spin" : ""} />
						</button>
						<button type="button" onClick={() => setAdding(true)} className="text-primaryColor transition-opacity hover:opacity-80">{t("mailAddAccount")}</button>
						<button type="button" onClick={() => setConfirmDisconnect(true)} className="flex items-center gap-2 text-primaryColor transition-opacity hover:opacity-80">
							<MdClose size={16} /> {t("mailDisconnect")}
						</button>
						<label className="flex cursor-pointer items-center gap-6" title={t("mailAutoLeadsHint")}>
							<input type="checkbox" checked={active.autoLeads} onChange={(e) => toggleAutoLeads(e.target.checked)} className="h-[16px] w-[16px] cursor-pointer accent-[#5EA8F5]" />
							{t("mailAutoLeads")}
						</label>
					</div>
					{active.status === "error" && (
						<p role="alert" className="mb-16 rounded-8 bg-[#FFF1F1] p-12 text-14 text-danger">{t("mailAccountError", { message: active.error })}</p>
					)}
					<div className="mb-30 flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
						<SearchBox value={query} onChange={setQuery} placeholder={t("filterSearchMail")} className="w-full md:w-[250px] lg:w-[350px]" />
						<div className="flex items-center gap-20">
							{selected.length > 0 && (
								<>
									<button type="button" onClick={() => { patch(selected, { starred: true }); setSelected([]); }} className={`${barButton} text-[#999999]`}>{t("markStar")}</button>
									<button type="button" onClick={() => { patch(selected, { snoozed: view !== "snoozed" }); setSelected([]); }} className={`${barButton} text-[#999999]`}>
										{view === "snoozed" ? t("unsnooze") : t("snooze")}
									</button>
									<button type="button" onClick={() => setConfirmDelete(true)} className={`${barButton} text-danger`}>{t("delete")} ({selected.length})</button>
								</>
							)}
							<button
								type="button"
								onClick={() => { setDraft(EMPTY_DRAFT); setComposeOpen(true); }}
								className="h-[50px] w-full rounded-4 bg-primaryColor px-30 text-16 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 md:w-auto md:text-18">
								{t("newEmail")}
							</button>
						</div>
					</div>

					<div className="min-h-[280px] overflow-x-auto rounded-16 bg-white shadow-heroImage">
						<table className="w-full min-w-[480px] table-fixed border-collapse">
							<thead>
								<tr className="bg-[#FAFCFF]">
									<th className="w-[46px] py-16 pl-16 text-left"><Checkbox checked={allChecked} onChange={(v) => setSelected(v ? rows.map((m) => m.id) : [])} label={t("selectAll")} /></th>
									<th className="border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] md:text-18">{t("mailName")}</th>
									<th className="w-[230px] border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] md:text-18">{t("mailDate")}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((m) => (
									<tr key={m.id} className={`h-[60px] animate-fade-in border-b border-[#F0F0F0] transition-colors duration-150 hover:bg-[#F7F9FF] ${selected.includes(m.id) ? "bg-[#F5F9FF]" : ""}`}>
										<td className="pl-16"><Checkbox checked={selected.includes(m.id)} onChange={() => toggle(m.id)} label={t("selectRow")} /></td>
										<td className="px-10">
											<div className="flex items-center gap-10">
												<button type="button" aria-pressed={m.starred} aria-label={t("markStar")} onClick={() => patch([m.id], { starred: !m.starred })} className={`shrink-0 transition-colors ${m.starred ? "text-[#F4A100]" : "text-[#D9D9D9] hover:text-[#B3B3B3]"}`}>
													{m.starred ? <MdStar size={22} /> : <MdStarBorder size={22} />}
												</button>
												<button type="button" onClick={() => openMail(m)} className={`min-w-0 flex-1 truncate text-left text-16 transition-colors hover:text-primaryColor md:text-18 ${m.read ? "text-[#666666]" : "font-semibold text-[#333333]"}`}>
													<span className="font-medium">{view === "sent" || view === "draft" ? m.to || "—" : m.from}</span>
													<span className={m.read ? "text-[#999999]" : "text-[#666666]"}> — {m.subject || t("noSubject")}</span>
												</button>
											</div>
										</td>
										<td className="truncate px-10 text-center text-14 text-[#999999] md:text-16">{formatChatDate(m.at, locale)}</td>
									</tr>
								))}
							</tbody>
						</table>
						{rows.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{syncing ? t("mailSyncing") : t("mailEmpty")}</p>}
					</div>
				</section>
			</div>

			<Modal open={composeOpen} onClose={() => setComposeOpen(false)} label={t("newEmail")} className="w-full max-w-[600px]">
				<form onSubmit={(e) => { e.preventDefault(); saveMail(false); }} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-20 text-24 font-medium text-black">{t("newEmail")}</h2>
					<div className="flex flex-col gap-16">
						<input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder={t("mailTo")} aria-label={t("mailTo")} maxLength={300} className={inputClass} />
						<input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder={t("mailSubject")} aria-label={t("mailSubject")} maxLength={200} className={inputClass} />
						<textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder={t("mailBody")} aria-label={t("mailBody")} rows={7} maxLength={5000} className="resize-none rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] p-16 text-16 shadow-custom outline-none focus:border-[#5EA8F5]" />
					</div>
					<div className="mt-24 flex flex-wrap justify-end gap-12">
						<button type="button" onClick={() => setComposeOpen(false)} className="h-50 px-16 text-16 font-medium text-[#999999] transition-colors hover:text-black">{t("cancel")}</button>
						<button type="button" disabled={sending} onClick={() => saveMail(true)} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray disabled:opacity-50">{t("saveDraft")}</button>
						<button type="submit" disabled={sending} className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80 disabled:opacity-50">{sending ? "…" : t("send")}</button>
					</div>
				</form>
			</Modal>

			<Modal open={reading !== null} onClose={() => setReading(null)} label={reading?.subject} className="w-full max-w-[600px]">
				<div className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<button type="button" onClick={() => setReading(null)} aria-label={t("close")} className="absolute right-16 top-16 text-iconColor transition-colors hover:text-black"><MdClose size={24} /></button>
					<h2 className="mb-6 break-words pr-30 text-24 font-medium text-black">{reading?.subject || t("noSubject")}</h2>
					<p className="mb-20 break-words text-14 text-[#999999]">
						{reading?.from} → {reading?.to} · {reading ? new Date(reading.at).toLocaleString(localeTag(locale)) : ""}
					</p>
					<p className="whitespace-pre-wrap break-words text-16 text-[#666666]">{reading?.body}</p>
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
