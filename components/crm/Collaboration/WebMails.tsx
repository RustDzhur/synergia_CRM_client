"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbRefresh, TbX } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import type { MailAccountDTO, MailDTO, MailProviderId } from "@/types/integrations";
import { usePolling } from "@/utils/usePolling";
import ConfirmDialog from "../shared/ConfirmDialog";
import SearchBox from "../shared/SearchBox";
import MailConnectDialog from "./MailConnectDialog";
import ComposeModal from "./webMailParts/ComposeModal";
import FolderNav from "./webMailParts/FolderNav";
import MailTable from "./webMailParts/MailTable";
import ProviderGrid from "./webMailParts/ProviderGrid";
import ReadModal from "./webMailParts/ReadModal";
import { EMPTY_DRAFT, inView, LABELS, MailView } from "./webMailParts/model";

// Web Mails (/crm/collaboration/web-mails): подключение ящика (Gmail / Outlook через OAuth или пароль приложения, Yahoo, iCloud, любой IMAP),
// затем ящик — Inbox / Starred / Snoozed / Sent / Draft. Письма загружаются с почтового сервера (сервер CRM ходит по IMAP или API провайдера),
// новые подтягиваются раз в минуту и по кнопке «обновить». Звезда, «отложить» и удаление действуют только в CRM, на почтовом сервере письма остаются.
export default function WebMails() {
	const t = useTranslations("collab");
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
		// один раз при заходе: после replace параметр из адреса исчезает, повторный запуск показал бы тост заново
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
				<ProviderGrid onPick={setConnectFor} />
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
				<FolderNav view={view} unreadInbox={unreadInbox} onChange={(v) => { setView(v); setSelected([]); }} />

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
						<p role="alert" className="mb-16 rounded-10 border border-[rgba(235,87,87,0.25)] bg-[rgba(235,87,87,0.08)] p-12 text-12 text-danger [overflow-wrap:anywhere]">{t("mailAccountError", { message: active.error })}</p>
					)}
					{/* Ящик подключён, но провайдер не дал права на отправку: письма приходят, а уйти не могут */}
					{active.status !== "error" && !active.canSend && (
						<p role="alert" className="mb-16 rounded-10 border border-[rgba(244,161,0,0.3)] bg-[rgba(244,161,0,0.08)] p-12 text-12 text-[#F4A100] [overflow-wrap:anywhere]">{t("mailNoSendScope")}</p>
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

					<MailTable
						rows={rows}
						view={view}
						selected={selected}
						syncing={syncing}
						onSelect={setSelected}
						onToggle={toggle}
						onStar={(m) => patch([m.id], { starred: !m.starred })}
						onOpen={openMail}
					/>
				</section>
			</div>

			<ComposeModal open={composeOpen} draft={draft} sending={sending} onChange={setDraft} onClose={() => setComposeOpen(false)} onSave={saveMail} />
			<ReadModal mail={reading} onClose={() => setReading(null)} />

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
