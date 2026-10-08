"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCopy, TbDownload, TbEye, TbPlus, TbReceipt } from "react-icons/tb";
import { LineItem, useFinanceStore } from "@/store/useFinanceStore";
import { useContactStore } from "@/store/useContactStore";
import { useCompaniesStore } from "@/store/useCompaniesStore";
import { useMarket } from "@/store/useMarket";
import { apiCall } from "@/store/crmApi";
import { defaultRateFor } from "@/lib/finance/tax";
import { STATUS_COLORS } from "@/utils/statusColors";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import SuggestInput, { type SuggestOption } from "../shared/SuggestInput";
import LineItemsEditor from "./LineItemsEditor";
import { downloadDocumentPdf, viewDocumentPdf } from "./download";
import DocumentTemplateButton from "./DocumentTemplateButton";
import PaymentLinkDialog from "./invoicesParts/PaymentLinkDialog";
import SendDialog from "./SendDialog";
import { localeTag } from "@/utils/dateHelpers";
import { money } from "./format";
import { emptyItem, useDefaultTaxRate } from "./lineItems";

const STATUS_COLOR: Record<string, string> = {
	draft: STATUS_COLORS.neutral, sent: STATUS_COLORS.info, paid: STATUS_COLORS.success,
	overdue: STATUS_COLORS.danger, cancelled: STATUS_COLORS.stale,
};
// Счета: по заказу (тогда попадает сюда автоматически) или сами по себе — например разовая услуга без отдельного заказа.
// Номер — последовательный (RE-2026-1, RE-2026-2…), выдаётся один раз и не переиспользуется. Кредит-ноты (kind
// "credit_note") живут в этом же списке — это отдельный юридический документ, а не правка счёта.
// Предзаполнение из карточки сделки: клиент, привязка к сделке и контакту/фирме — счёт,
// созданный из карточки, сразу виден в ней же
// Фильтры списка; тот же набор знает серверный инструмент navigate (lib/ai/tools.ts)
export const INVOICE_FILTERS = ["unpaid", "overdue", "draft", "sent", "paid", "all"] as const;
export interface InvoicePrefill { dealId: string; customerName: string; contact?: string; company?: string }

export default function Invoices({ openId, prefill, preset, onPrefillDone }: { openId?: string | null; prefill?: InvoicePrefill | null; preset?: { filter: string; n: number } | null; onPrefillDone?: () => void }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { invoices, products, loadInvoices, loadProducts, createInvoice, updateInvoice, sendInvoice, payInvoice, duplicateInvoice, issueCreditNote, settings } = useFinanceStore();
	const defaultTaxRate = defaultRateFor(settings ?? {});
	const { market, loaded: marketLoaded } = useMarket();
	const { contacts, fetchContacts } = useContactStore();
	const { companies, fetchCompanies } = useCompaniesStore();
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	// Привязка счёта к записи CRM: сделка (из карточки) и контакт/фирма (из подсказок клиента)
	const [clientLink, setClientLink] = useState<{ deal?: string; contact?: string; company?: string }>({});
	const [supplyDate, setSupplyDate] = useState(""); // Leistungsdatum, §14 Abs. 4 Nr. 6 UStG — печатается на счёте
	// ВЭД: условие поставки и номер декларации — для экспортных счетов (ТЗ §12)
	const [incoterms, setIncoterms] = useState("");
	const [customs, setCustoms] = useState("");
	const [items, setItems] = useState<LineItem[]>([emptyItem(defaultTaxRate)]);
	const [busy, setBusy] = useState<string | null>(null);
	const [creditTarget, setCreditTarget] = useState<string | null>(null);
	// Ссылка на оплату: окно открывается из строки счёта, там же выбирают кассу и чат клиента
	const [payFor, setPayFor] = useState<string | null>(null);
	const [creditNotes, setCreditNotes] = useState("");
	// Окно «введите адрес»: открывается, когда у клиента нет сохранённого e-mail (сервер отвечает no_recipient)
	// Окно отправки: адресат и ящик, с которого уйдёт письмо
	const [sendFor, setSendFor] = useState<{ id: string } | null>(null);
	const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});
	// Фильтр списка: «Не оплачены» — отправленные и просроченные, то есть счета, по которым ещё ждём деньги
	const [filter, setFilter] = useState<string>("all");
	useEffect(() => { if (preset) setFilter(preset.filter); }, [preset]);
	const todayStr = new Date().toISOString().slice(0, 10);
	const isLate = (inv: { status: string; dueDate?: string }) => inv.status === "overdue" || (inv.status === "sent" && !!inv.dueDate && inv.dueDate < todayStr);
	const matches = (inv: { kind?: string; status: string; dueDate?: string }, f: string) =>
		f === "all" ? true
		: f === "unpaid" ? inv.kind !== "credit_note" && ["sent", "overdue"].includes(inv.status)
		: f === "overdue" ? inv.kind !== "credit_note" && isLate(inv)
		: inv.status === f;
	const shownInvoices = invoices.filter((inv) => matches(inv, filter));

	useEffect(() => { loadInvoices(); loadProducts(); }, [loadInvoices, loadProducts]);
	useDefaultTaxRate(settings, setItems);
	useEffect(() => {
		if (openId && rowRefs.current[openId]) rowRefs.current[openId]?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [openId, invoices]);
	// пришли из карточки сделки: подставляем клиента и сразу открываем форму нового счёта.
	// Предзаполнение одноразовое — иначе при каждом возврате на вкладку окно открывалось бы снова;
	// сама связь сохраняется в clientLink, иначе после сброса предзаполнения счёт терял привязку к сделке
	useEffect(() => {
		if (!prefill) return;
		setCustomerName(prefill.customerName);
		setClientLink({ deal: prefill.dealId, contact: prefill.contact, company: prefill.company });
		setOpen(true);
		onPrefillDone?.();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [prefill]);

	// Подсказки клиента — из CRM (контакты и фирмы); грузим при открытии формы
	useEffect(() => {
		if (!open) return;
		if (contacts.length === 0) fetchContacts();
		if (companies.length === 0) fetchCompanies();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const clientOptions = useMemo<SuggestOption[]>(() => {
		const q = customerName.trim().toLowerCase();
		const fromContacts = contacts
			.filter((c) => !q || [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: `c:${c._id}`, title: c.name, lines: [c.phone ?? "", c.email ?? ""] }));
		const fromCompanies = companies
			.filter((c) => !q || c.name.toLowerCase().includes(q))
			.map((c) => ({ key: `k:${c._id}`, title: c.name, lines: [c.email ?? ""] }));
		return [...fromContacts, ...fromCompanies];
	}, [contacts, companies, customerName]);

	function openNew() {
		// новый счёт начинается с чистого листа: клиент, строки и связь прошлого счёта не переносятся
		setCustomerName("");
		setClientLink({});
		setOpen(true);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createInvoice({
			customerName: customerName.trim(), items: cleanItems, currency: settings?.currency || "EUR", supplyDate: supplyDate || undefined, incoterms: incoterms || undefined, customsDeclaration: customs || undefined,
			// привязка к сделке и клиенту: счёт из карточки виден в ней же, а выбранный из CRM клиент —
			// в своей карточке контакта/фирмы
			...clientLink,
		});
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setSupplyDate(""); setItems([emptyItem(defaultTaxRate)]);
	}
	// Отправка открывает окно: адресат и ЯЩИК ОТПРАВКИ — письмо должно уходить с ящика фирмы,
	// а не с первого подключённого (личного), как было раньше (SendDialog)

	// Номер исходного счёта кредит-ноты: кредит-нота хранит его id (creditFor), а в строке нужен номер —
	// «Кредит-нота до рахунку РАХ-2026-7» объясняет, что это за документ
	function sourceNumberOf(inv: { creditFor?: string }): string {
		if (!inv.creditFor) return "";
		return invoices.find((x) => x.id === inv.creditFor)?.number ?? "";
	}

	// Чек ПРРО без сохранённой ссылки: дотягиваем её у Checkbox и открываем — оттуда чек скачивают и печатают
	async function fetchFiscalLink(id: string) {
		setBusy(id);
		const res = await apiCall<{ url: string }>(`/api/invoices/${id}/fiscal`, "POST", { action: "receipt-link" });
		setBusy(null);
		if (!res.ok || !res.data?.url) return void toast.error(res.message || t("fiscalLinkFailed"));
		window.open(res.data.url, "_blank", "noopener");
		void loadInvoices();
	}

	// Черновик можно поправить: дата оказания услуги (обязательна для немецкого счёта) и удаление ненужного черновика
	async function saveSupplyDate(id: string, value: string) {
		const err = await updateInvoice(id, { supplyDate: value });
		if (err) toast.error(err); else toast.success(t("saved"));
	}
	async function deleteDraft(id: string) {
		if (!window.confirm(t("deleteDraftAsk"))) return;
		setBusy(id);
		const res = await apiCall(`/api/invoices/${id}`, "DELETE");
		setBusy(null);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("deleted"));
		void loadInvoices();
	}
	async function pay(id: string) { setBusy(id); const err = await payInvoice(id); setBusy(null); if (err) toast.error(err); else toast.success(t("markedPaid")); }
	// Фискальный чек ПРРО: при включённой автофискализации он пробивается сам при оплате, кнопка —
	// для ручного случая и для повтора после неудачи (ошибка хранится в самом счёте)
	async function fiscal(id: string) {
		setBusy(id);
		const res = await apiCall<{ fiscal?: { code?: string }; message?: string }>(`/api/invoices/${id}/fiscal`, "POST");
		setBusy(null);
		if (res.ok) return void (toast.success(t("fiscalIssued")), loadInvoices());
		toast.error(t("fiscalError", { message: res.message }));
		if (res.status === 502) loadInvoices();
	}
	async function duplicate(id: string) { setBusy(id); const err = await duplicateInvoice(id); setBusy(null); if (err) toast.error(err); else toast.success(t("invoiceDuplicated")); }
	async function downloadPdf(id: string, number: string) {
		void downloadDocumentPdf("invoices", id, number, locale);
	}
	async function viewPdf(id: string, number: string) {
		void viewDocumentPdf("invoices", id, number, locale);
	}
	async function submitCreditNote(e: React.FormEvent) {
		e.preventDefault();
		if (!creditTarget) return;
		setBusy(creditTarget);
		const err = await issueCreditNote(creditTarget, creditNotes.trim() ? { notes: creditNotes.trim() } : undefined);
		setBusy(null);
		if (err) return toast.error(err);
		toast.success(t("creditNoteIssued"));
		setCreditTarget(null); setCreditNotes("");
	}

	return (
		<div>
			<div className="mb-16 flex justify-end">
				<button type="button" onClick={openNew} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newInvoice")}
				</button>
			</div>
			{invoices.length > 0 && (
				<div className="mb-14 flex flex-wrap gap-8" role="group" aria-label={t("filterLabel")}>
					{(["all", "unpaid", "overdue", "draft", "paid"] as const).map((f) => (
						<button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
							className={`fs-chip h-30 cursor-pointer px-12 text-12 transition-colors ${filter === f ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "text-[#cfd4cb] hover:text-[#f1f4ee]"}`}>
							{f === "all" ? t("filterAll") : f === "unpaid" ? t("filterUnpaid") : t(`istatus_${f}`)} · {invoices.filter((inv) => matches(inv, f)).length}
						</button>
					))}
				</div>
			)}
			{invoices.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : shownInvoices.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("filterEmpty")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{shownInvoices.map((inv) => (
						<li key={inv.id} ref={(el) => { rowRefs.current[inv.id] = el; }} className={`fs-card p-14 transition-shadow md:p-18 ${openId === inv.id ? "ring-[1.5px] ring-inkAccentLine" : ""}`}>
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex flex-wrap items-center gap-8 text-14 font-semibold text-[#f1f4ee]">
										{inv.number}
										{inv.kind === "credit_note" && <span className="fs-chip h-22 px-8 text-10">{t("creditNote")}</span>}
										<span className="fs-chip h-22 gap-6 px-8 text-10">
											<span className="h-6 w-6 rounded-50" style={{ background: STATUS_COLOR[inv.status] }} />
											{t(`istatus_${inv.status}`)}
										</span>
										{/* Частичная оплата: счёт ещё не закрыт, но деньги уже приходили */}
										{inv.status !== "paid" && (inv.paidAmount ?? 0) > 0 && (
											<span className="fs-chip h-22 px-8 text-10 text-[#F4A100]">{t("partiallyPaid", { amount: money(inv.paidAmount ?? 0, inv.currency, localeTag(locale)) })}</span>
										)}
										{(inv.dunningLevel ?? 0) > 0 && (
											// ступень манаведения рядом со статусом: 4 — «letzte Mahnung», дальше только правовая стадия
											<span className={`fs-chip h-22 px-8 text-10 ${(inv.dunningLevel ?? 0) >= 4 ? "border-[rgba(235,87,87,0.35)] text-[#EB5757]" : "border-[rgba(244,161,0,0.35)] text-[#f4a100]"}`}>
												{t(`level_${Math.min(4, inv.dunningLevel ?? 0)}`)}
											</span>
										)}
										{inv.reminderCount > 0 && <span className="fs-chip h-22 border-[rgba(244,161,0,0.35)] px-8 text-10 text-[#f4a100]">{t("remindersSent", { count: inv.reminderCount })}</span>}
									</p>
									<p className="mt-[4px] text-12 text-[#8c948b]">
										{/* Кредит-нота без ссылки на исходный счёт непонятна — показываем, что она исправляет */}
										{inv.kind === "credit_note" && sourceNumberOf(inv) ? `${t("creditFor")} ${sourceNumberOf(inv)} · ` : ""}
										{inv.customerName} · {t("colDate")}: {inv.issueDate}{inv.dueDate ? ` · ${t("dueDate")}: ${inv.dueDate}` : ""}
									</p>
								</div>
								<p className="text-15 font-semibold text-[#f1f4ee]">{money(inv.totals.gross, inv.currency, locale)}</p>
							</div>
							<div className="mt-12 flex flex-wrap items-center gap-8">
								{inv.status === "draft" && <button type="button" onClick={() => setSendFor({ id: inv.id })} className="fs-btn fs-btn-primary h-34">{t("send")}</button>}
								{inv.status === "draft" && inv.kind === "invoice" && (
									<label className="flex items-center gap-6 text-12 text-[#8c948b]">
										{t("supplyDateShort")}
										<input type="date" defaultValue={inv.supplyDate || inv.issueDate} onBlur={(e) => e.target.value && e.target.value !== (inv.supplyDate || inv.issueDate) && void saveSupplyDate(inv.id, e.target.value)} className="fs-field h-34 px-8 text-12" />
									</label>
								)}
								{inv.kind === "invoice" && (inv.status === "draft" || inv.status === "sent" || inv.status === "overdue") && <button type="button" disabled={busy === inv.id} onClick={() => pay(inv.id)} className="fs-btn fs-btn-ghost h-34 border-[rgba(198,255,77,0.4)] text-[#c6ff4d] disabled:opacity-[0.5]">{t("markPaid")}</button>}
								{inv.status === "paid" && <span className="text-12 text-[#c6ff4d]">{t("paidOn", { date: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString(locale) : "" })}</span>}
								{inv.kind === "invoice" && ["sent", "paid", "overdue"].includes(inv.status) && (
									<button type="button" disabled={busy === inv.id} onClick={() => setCreditTarget(inv.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">
										<TbReceipt size={15} /> {t("issueCreditNote")}
									</button>
								)}
								{inv.status === "draft" && <button type="button" disabled={busy === inv.id} onClick={() => void deleteDraft(inv.id)} className="fs-btn fs-btn-ghost h-34 text-[#EB5757] disabled:opacity-[0.5]">{t("deleteDraft")}</button>}
								{inv.kind === "invoice" && (
									<button type="button" disabled={busy === inv.id} onClick={() => duplicate(inv.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">
										<TbCopy size={15} /> {t("duplicate")}
									</button>
								)}
								{marketLoaded && market === "UA" && (
								<>
								{/* ПРРО: чек видно в строке счёта — номер кликабелен (открыть/скачать/распечатать),
								    ошибка показана рядом; без сохранённой ссылки её можно дотянуть у Checkbox */}
								{inv.fiscal?.code ? (
									inv.fiscal.url ? (
										<a href={inv.fiscal.url} target="_blank" rel="noopener noreferrer" className="fs-btn fs-btn-ghost h-34" title={t("fiscalOpenHint")}>{t("fiscalChip", { code: inv.fiscal.code })}</a>
									) : (
										<button type="button" disabled={busy === inv.id} onClick={() => void fetchFiscalLink(inv.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-50" title={t("fiscalIssued")}>
											{t("fiscalChip", { code: inv.fiscal.code })} · {t("fiscalReceiptLink")}
										</button>
									)
								) : (
									<button type="button" disabled={busy === inv.id} onClick={() => void fiscal(inv.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]" title={inv.fiscal?.error || undefined}>
										<TbReceipt size={15} /> {t("fiscalIssue")}
									</button>
								)}
								</>
								)}
								{/* Ссылка на оплату: клиент платит сам, счёт закрывается вебхуком кассы */}
								{inv.kind === "invoice" && inv.status !== "paid" && inv.status !== "cancelled" && (
									<button type="button" onClick={() => setPayFor(inv.id)} className="fs-btn fs-btn-ghost h-34 border-[rgba(198,255,77,0.4)] text-[#c6ff4d]">
										{inv.payLink ? t("payLinkReady") : t("payLink")}
									</button>
								)}
								<button type="button" onClick={() => viewPdf(inv.id, inv.number)} className="fs-btn fs-btn-ghost h-34">
									<TbEye size={15} /> {t("viewPdf")}
								</button>
								<button type="button" onClick={() => downloadPdf(inv.id, inv.number)} className="fs-btn fs-btn-ghost h-34">
									<TbDownload size={15} /> {t("downloadPdf")}
								</button>
								<DocumentTemplateButton kind="invoices" id={inv.id} number={inv.number} template={inv.template} onSave={updateInvoice} />
							</div>
							{/* История манаведения: что и когда ушло по этому счёту (её пишет lib/finance/dunning.ts в dunningLog) */}
							{inv.dunningLog?.length ? (
								<div className="mt-12 border-t border-inkLineSoft pt-10">
									<p className="fs-eyebrow">{t("dunningHistory")}</p>
									<ul className="mt-8 flex flex-col gap-6">
										{inv.dunningLog.map((e, i) => (
											<li key={i} className="flex flex-wrap items-baseline gap-x-10 text-12">
												<span className="text-[#cfd4cb]">{t(`level_${Math.min(4, e.level)}`)}</span>
												<span className="text-[#8c948b]">{e.sentAt ? new Date(e.sentAt).toLocaleDateString(locale) : ""}</span>
												<span className="text-[#8c948b]">{e.fee > 0 ? money(e.fee, inv.currency, locale) : "—"}</span>
											</li>
										))}
									</ul>
								</div>
							) : null}
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newInvoice")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("newInvoice")}</h2>
					{/* Клиент подтягивается из CRM (контакты и фирмы): контакт, заведённый в CRM, находится сразу */}
					<div className="mb-16">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("customer")}</span>
						<SuggestInput
							value={customerName}
							onChange={(v) => { setCustomerName(v); setClientLink((l) => ({ deal: l.deal })); }}
							onPick={(o) => {
								const [kind, id] = o.key.split(":");
								setCustomerName(o.title);
								setClientLink((l) => ({ deal: l.deal, ...(kind === "k" ? { company: id } : { contact: id }) }));
							}}
							options={clientOptions}
							placeholder={t("contractClientPlaceholder")}
							showSearchIcon
						/>
						{(clientLink.contact || clientLink.company) && <span className="mt-6 block text-11 text-[#9AA396]">{t("contractClientLinked")}</span>}
					</div>
					{/* Leistungsdatum — обязательный реквизит именно немецкого счёта (§14 Abs. 4 Nr. 6 UStG);
					    украинскому рахунку он не нужен, и подсказка про немецкий закон там только путала.
					    Инкотермс и номер декларации — ВЭД, они применимы обеим странам */}
					<div className="mb-16 md:max-w-[calc(50%-6px)]">
						{marketLoaded && market === "DE" && (
							<>
								<FormField label={t("supplyDate")} type="date" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} />
								<p className="mt-[4px] text-11 text-[#9AA396]">{t("supplyDateHint")}</p>
							</>
						)}
						<FormField label={t("invIncoterms")} value={incoterms} onChange={(e) => setIncoterms(e.target.value.toUpperCase())} maxLength={10} placeholder="FCA / DAP" />
						<FormField label={t("invCustoms")} value={customs} onChange={(e) => setCustoms(e.target.value)} maxLength={60} />
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>

			{payFor && (
				<PaymentLinkDialog
					invoiceId={payFor}
					open={payFor !== null}
					onClose={() => setPayFor(null)}
					onCreated={() => void loadInvoices()}
				/>
			)}

			<SendDialog
				open={!!sendFor}
				onClose={() => setSendFor(null)}
				onSubmit={(o) => sendInvoice(sendFor?.id ?? "", o.to || undefined, o.accountId || undefined)}
			/>

			<Modal open={!!creditTarget} onClose={() => setCreditTarget(null)} label={t("issueCreditNote")} className="w-full max-w-[520px]">
				<form onSubmit={submitCreditNote} className="fs-popover p-20 md:p-24">
					<h2 className="mb-8 text-16 font-semibold text-[#f1f4ee]">{t("issueCreditNote")}</h2>
					<p className="mb-16 text-12 text-[#8c948b]">{t("creditNoteHint")}</p>
					<FormField label={t("notes")} value={creditNotes} onChange={(e) => setCreditNotes(e.target.value)} maxLength={2000} />
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setCreditTarget(null)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy === creditTarget} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("save")}</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
