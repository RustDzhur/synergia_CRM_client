"use client";
import React, { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import { MdAlarm, MdClose, MdEditNote, MdMoveToInbox, MdOutlineCheckCircleOutline, MdSnooze, MdStar, MdStarBorder } from "react-icons/md";
import { SiGmail, SiIcloud, SiMicrosoftoffice, SiMicrosoftoutlook } from "react-icons/si";
import { Mail, MailProvider, MailView, useCollabHydration, useCollabStore } from "@/app/store/useCollabStore";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import { localeTag } from "@/app/utils/dateHelpers";
import Checkbox from "../shared/Checkbox";
import ConfirmDialog from "../shared/ConfirmDialog";
import Modal from "../shared/Modal";
import SearchBox from "../shared/SearchBox";
import { formatChatDate } from "./format";

interface Provider { id: MailProvider; label: string; logo: React.ReactNode }

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

function inView(m: Mail, view: MailView) {
	if (view === "starred") return m.starred;
	if (view === "snoozed") return m.snoozed;
	if (view === "inbox") return m.folder === "inbox" && !m.snoozed;
	return m.folder === view;
}

// Web Mails (/crm/collaboration/web-mails): выбор почтового сервиса, затем ящик — Inbox / Starred / Snoozed / Sent / Draft.
// Реального подключения к почтовым серверам пока нет: письма тестовые, «отправка» кладёт письмо в Sent.
export default function WebMails() {
	const t = useTranslations("collab");
	const locale = useLocale();
	useCollabHydration();
	const { mails, mailProvider, setMailProvider, addMail, patchMails, deleteMails } = useCollabStore();
	const user = useCurrentUserStore((s) => s.user);

	const [view, setView] = useState<MailView>("inbox");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [composeOpen, setComposeOpen] = useState(false);
	const [draft, setDraft] = useState({ to: "", subject: "", body: "" });
	const [reading, setReading] = useState<Mail | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return mails
			.filter((m) => inView(m, view) && (!q || [m.from, m.to, m.subject, m.body].some((v) => v.toLowerCase().includes(q))))
			.sort((a, b) => (a.at < b.at ? 1 : -1));
	}, [mails, view, query]);

	const allChecked = rows.length > 0 && rows.every((m) => selected.includes(m.id));
	const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
	const providerLabel = PROVIDERS.find((p) => p.id === mailProvider)?.label;

	function saveMail(folder: "sent" | "draft") {
		if (folder === "sent" && !/^\S+@\S+\.\S+$/.test(draft.to.trim())) return void toast.error(t("mailToInvalid"));
		addMail({
			folder,
			from: user?.email ?? "me",
			to: draft.to.trim(),
			subject: draft.subject.trim() || t("noSubject"),
			body: draft.body,
		});
		toast.success(folder === "sent" ? t("mailSent") : t("mailDraftSaved"));
		setDraft({ to: "", subject: "", body: "" });
		setComposeOpen(false);
		setView(folder);
	}

	// ── выбор провайдера ────────────────────────────────────────────────
	if (!mailProvider) {
		return (
			<div className="p-16 md:p-30">
				<ul className="grid grid-cols-2 gap-16 md:grid-cols-4 md:gap-20">
					{PROVIDERS.map((p, i) => (
						<li key={i}>
							<button
								type="button"
								onClick={() => { setMailProvider(p.id); toast(t("mailConnected", { name: p.label })); }}
								title={t("mailDemo")}
								className="flex h-[150px] w-full flex-col items-center justify-center gap-16 rounded-8 bg-white shadow-heroImage transition-transform duration-200 hover:-translate-y-2 md:h-[100px] md:gap-6 lg:h-[125px] lg:gap-10">
								<span className="flex h-[60px] items-center md:h-[40px] md:scale-[0.7] lg:h-[60px] lg:scale-100">{p.logo}</span>
								<span className="text-16 text-[#999999] lg:text-18">{p.label}</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		);
	}

	// ── почтовый ящик ────────────────────────────────────────────────
	const barButton = "text-16 font-semibold transition-opacity hover:opacity-80";
	return (
		<div className="p-16 md:p-30">
			<div className="flex flex-col gap-30 lg:flex-row">
				<nav aria-label={t("mailFolders")} className="w-full shrink-0 self-start rounded-16 bg-white px-20 shadow-heroImage md:w-auto md:min-w-[166px] md:max-w-[280px]">
					<ul>
						{VIEWS.map(({ key, icon: Icon }, i) => {
							const count = mails.filter((m) => inView(m, key)).length;
							return (
								<li key={key} className={i > 0 ? "border-t border-[#E6E6E6]" : ""}>
									<button
										type="button"
										onClick={() => { setView(key); setSelected([]); }}
										aria-current={view === key ? "page" : undefined}
										className={`flex h-[70px] w-full items-center gap-12 text-left text-16 font-medium transition-colors duration-200 md:text-18 ${view === key ? "text-primaryColor" : "text-iconColor hover:text-[#808080]"}`}>
										<Icon size={28} className="shrink-0" />
										<span className="flex-1 truncate">{t(`folder_${key}`)}</span>
										{key === "inbox" && count > 0 && <span className="text-14 text-[#B3B3B3]">{count}</span>}
									</button>
								</li>
							);
						})}
					</ul>
				</nav>

				<section className="min-w-0 flex-1">
					<div className="mb-16 flex items-center gap-8 text-14 text-[#999999]">
						{t("mailAccount")}: <span className="font-medium text-[#666666]">{providerLabel}</span>
						<button type="button" onClick={() => setMailProvider(null)} className="ml-8 flex items-center gap-2 text-primaryColor transition-opacity hover:opacity-80">
							<MdClose size={16} /> {t("mailDisconnect")}
						</button>
					</div>
					<div className="mb-30 flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
						<SearchBox value={query} onChange={setQuery} placeholder={t("filterSearchMail")} className="w-full md:w-[250px] lg:w-[350px]" />
						<div className="flex items-center gap-20">
							{selected.length > 0 && (
								<>
									<button type="button" onClick={() => { patchMails(selected, { starred: true }); setSelected([]); }} className={`${barButton} text-[#999999]`}>{t("markStar")}</button>
									<button type="button" onClick={() => { patchMails(selected, { snoozed: view !== "snoozed" }); setSelected([]); }} className={`${barButton} text-[#999999]`}>
										{view === "snoozed" ? t("unsnooze") : t("snooze")}
									</button>
									<button type="button" onClick={() => setConfirmDelete(true)} className={`${barButton} text-danger`}>{t("delete")} ({selected.length})</button>
								</>
							)}
							<button
								type="button"
								onClick={() => setComposeOpen(true)}
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
												<button type="button" aria-pressed={m.starred} aria-label={t("markStar")} onClick={() => patchMails([m.id], { starred: !m.starred })} className={`shrink-0 transition-colors ${m.starred ? "text-[#F4A100]" : "text-[#D9D9D9] hover:text-[#B3B3B3]"}`}>
													{m.starred ? <MdStar size={22} /> : <MdStarBorder size={22} />}
												</button>
												<button type="button" onClick={() => setReading(m)} className="min-w-0 flex-1 truncate text-left text-16 text-[#666666] transition-colors hover:text-primaryColor md:text-18">
													<span className="font-medium">{view === "sent" || view === "draft" ? m.to || "—" : m.from}</span>
													<span className="text-[#999999]"> — {m.subject}</span>
												</button>
											</div>
										</td>
										<td className="truncate px-10 text-center text-14 text-[#999999] md:text-16">{formatChatDate(m.at, locale)}</td>
									</tr>
								))}
							</tbody>
						</table>
						{rows.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{t("mailEmpty")}</p>}
					</div>
				</section>
			</div>

			<Modal open={composeOpen} onClose={() => setComposeOpen(false)} label={t("newEmail")} className="w-full max-w-[600px]">
				<form onSubmit={(e) => { e.preventDefault(); saveMail("sent"); }} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-20 text-24 font-medium text-black">{t("newEmail")}</h2>
					<div className="flex flex-col gap-16">
						<input value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder={t("mailTo")} aria-label={t("mailTo")} maxLength={200} className="h-50 rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] px-16 text-16 shadow-custom outline-none focus:border-[#5EA8F5]" />
						<input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder={t("mailSubject")} aria-label={t("mailSubject")} maxLength={200} className="h-50 rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] px-16 text-16 shadow-custom outline-none focus:border-[#5EA8F5]" />
						<textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder={t("mailBody")} aria-label={t("mailBody")} rows={7} maxLength={5000} className="resize-none rounded-8 border border-[#E6E6E6] bg-[#FBFBFB] p-16 text-16 shadow-custom outline-none focus:border-[#5EA8F5]" />
					</div>
					<div className="mt-24 flex flex-wrap justify-end gap-12">
						<button type="button" onClick={() => setComposeOpen(false)} className="h-50 px-16 text-16 font-medium text-[#999999] transition-colors hover:text-black">{t("cancel")}</button>
						<button type="button" onClick={() => saveMail("draft")} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">{t("saveDraft")}</button>
						<button type="submit" className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80">{t("send")}</button>
					</div>
				</form>
			</Modal>

			<Modal open={reading !== null} onClose={() => setReading(null)} label={reading?.subject} className="w-full max-w-[600px]">
				<div className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<button type="button" onClick={() => setReading(null)} aria-label={t("close")} className="absolute right-16 top-16 text-iconColor transition-colors hover:text-black"><MdClose size={24} /></button>
					<h2 className="mb-6 pr-30 text-24 font-medium text-black">{reading?.subject}</h2>
					<p className="mb-20 text-14 text-[#999999]">
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
				onConfirm={() => { setConfirmDelete(false); deleteMails(selected); setSelected([]); }}
			/>
		</div>
	);
}
