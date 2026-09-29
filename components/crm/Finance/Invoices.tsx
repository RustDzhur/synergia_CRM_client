"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCopy, TbDownload, TbPlus, TbReceipt } from "react-icons/tb";
import { LineItem, useFinanceStore } from "@/store/useFinanceStore";
import { defaultRateFor } from "@/lib/finance/tax";
import { STATUS_COLORS } from "@/utils/statusColors";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { downloadDocumentPdf } from "./download";
import DocumentTemplateButton from "./DocumentTemplateButton";
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
export default function Invoices({ openId }: { openId?: string | null }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { invoices, products, loadInvoices, loadProducts, createInvoice, updateInvoice, sendInvoice, payInvoice, duplicateInvoice, issueCreditNote, settings } = useFinanceStore();
	const defaultTaxRate = defaultRateFor(settings ?? {});
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [supplyDate, setSupplyDate] = useState(""); // Leistungsdatum, §14 Abs. 4 Nr. 6 UStG — печатается на счёте
	const [items, setItems] = useState<LineItem[]>([emptyItem(defaultTaxRate)]);
	const [busy, setBusy] = useState<string | null>(null);
	const [creditTarget, setCreditTarget] = useState<string | null>(null);
	const [creditNotes, setCreditNotes] = useState("");
	// Окно «введите адрес»: открывается, когда у клиента нет сохранённого e-mail (сервер отвечает no_recipient)
	const [mailFor, setMailFor] = useState<string | null>(null);
	const [mailTo, setMailTo] = useState("");
	const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

	useEffect(() => { loadInvoices(); loadProducts(); }, [loadInvoices, loadProducts]);
	useDefaultTaxRate(settings, setItems);
	useEffect(() => {
		if (openId && rowRefs.current[openId]) rowRefs.current[openId]?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [openId, invoices]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createInvoice({ customerName: customerName.trim(), items: cleanItems, currency: settings?.currency || "EUR", supplyDate: supplyDate || undefined });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setSupplyDate(""); setItems([emptyItem(defaultTaxRate)]);
	}
	async function send(id: string, to?: string) {
		setBusy(id);
		const r = await sendInvoice(id, to);
		setBusy(null);
		if (r.ok) return toast.success(t("sentTo", { email: r.sentTo }));
		// адреса нет — спрашиваем его в окне; если адрес ввели неверно, показываем текст ошибки сервера
		if (r.code === "no_recipient") { if (to) toast.error(r.message); setMailFor(id); setMailTo(to ?? ""); return; }
		toast.error(r.message);
	}
	async function submitMail(e: React.FormEvent) {
		e.preventDefault();
		if (!mailFor) return;
		const to = mailTo.trim();
		if (!to) return toast.error(t("emailRequired"));
		const id = mailFor;
		setMailFor(null);
		await send(id, to);
	}
	async function pay(id: string) { setBusy(id); const err = await payInvoice(id); setBusy(null); if (err) toast.error(err); else toast.success(t("markedPaid")); }
	async function duplicate(id: string) { setBusy(id); const err = await duplicateInvoice(id); setBusy(null); if (err) toast.error(err); else toast.success(t("invoiceDuplicated")); }
	async function downloadPdf(id: string, number: string) {
		if (!(await downloadDocumentPdf("invoices", id, number, locale))) toast.error(t("pdfFailed"));
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
				<button type="button" onClick={() => setOpen(true)} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newInvoice")}
				</button>
			</div>
			{invoices.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{invoices.map((inv) => (
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
									<p className="mt-[4px] text-12 text-[#8c948b]">{inv.customerName} · {t("colDate")}: {inv.issueDate}{inv.dueDate ? ` · ${t("dueDate")}: ${inv.dueDate}` : ""}</p>
								</div>
								<p className="text-15 font-semibold text-[#f1f4ee]">{money(inv.totals.gross, inv.currency, locale)}</p>
							</div>
							<div className="mt-12 flex flex-wrap items-center gap-8">
								{inv.status === "draft" && <button type="button" disabled={busy === inv.id} onClick={() => send(inv.id)} className="fs-btn fs-btn-primary h-34 disabled:opacity-[0.5]">{t("send")}</button>}
								{inv.kind === "invoice" && (inv.status === "sent" || inv.status === "overdue") && <button type="button" disabled={busy === inv.id} onClick={() => pay(inv.id)} className="fs-btn fs-btn-ghost h-34 border-[rgba(198,255,77,0.4)] text-[#c6ff4d] disabled:opacity-[0.5]">{t("markPaid")}</button>}
								{inv.status === "paid" && <span className="text-12 text-[#c6ff4d]">{t("paidOn", { date: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString(locale) : "" })}</span>}
								{inv.kind === "invoice" && ["sent", "paid", "overdue"].includes(inv.status) && (
									<button type="button" disabled={busy === inv.id} onClick={() => setCreditTarget(inv.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">
										<TbReceipt size={15} /> {t("issueCreditNote")}
									</button>
								)}
								{inv.kind === "invoice" && (
									<button type="button" disabled={busy === inv.id} onClick={() => duplicate(inv.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">
										<TbCopy size={15} /> {t("duplicate")}
									</button>
								)}
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
					<div className="mb-16">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
					</div>
					{/* Leistungsdatum рядом с датами документа: без него немецкий счёт (§14 Abs. 4 Nr. 6 UStG) неполный */}
					<div className="mb-16 md:max-w-[calc(50%-6px)]">
						<FormField label={t("supplyDate")} type="date" value={supplyDate} onChange={(e) => setSupplyDate(e.target.value)} />
						<p className="mt-[4px] text-11 text-[#9AA396]">{t("supplyDateHint")}</p>
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<Modal open={!!mailFor} onClose={() => setMailFor(null)} label={t("sendTitle")} className="w-full max-w-[520px]">
				<form onSubmit={submitMail} className="fs-popover p-20 md:p-24">
					<h2 className="mb-8 text-16 font-semibold text-[#f1f4ee]">{t("sendTitle")}</h2>
					<p className="mb-16 text-12 text-[#8c948b]">{t("sendHint")}</p>
					<FormField label={t("email")} type="email" value={mailTo} onChange={(e) => setMailTo(e.target.value)} maxLength={200} autoFocus />
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setMailFor(null)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy === mailFor} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("send")}</button>
					</div>
				</form>
			</Modal>

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
