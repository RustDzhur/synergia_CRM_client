"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdDownload, MdContentCopy, MdReceiptLong } from "react-icons/md";
import { LineItem, useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { downloadDocumentPdf } from "./download";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#B3B3B3", sent: "#5EA8F5", paid: "#0A8A2E", overdue: "#EB5757", cancelled: "#999999" };
const EMPTY_ITEM: LineItem = { description: "", qty: 1, unitPrice: 0, taxRate: 0 };

// Счета: по заказу (тогда попадает сюда автоматически) или сами по себе — например разовая услуга без отдельного заказа.
// Номер — последовательный (RE-2026-1, RE-2026-2…), выдаётся один раз и не переиспользуется. Кредит-ноты (kind
// "credit_note") живут в этом же списке — это отдельный юридический документ, а не правка счёта.
export default function Invoices({ openId }: { openId?: string | null }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { invoices, products, loadInvoices, loadProducts, createInvoice, sendInvoice, payInvoice, duplicateInvoice, issueCreditNote, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
	const [busy, setBusy] = useState<string | null>(null);
	const [creditTarget, setCreditTarget] = useState<string | null>(null);
	const [creditNotes, setCreditNotes] = useState("");
	// Окно «введите адрес»: открывается, когда у клиента нет сохранённого e-mail (сервер отвечает no_recipient)
	const [mailFor, setMailFor] = useState<string | null>(null);
	const [mailTo, setMailTo] = useState("");
	const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

	useEffect(() => { loadInvoices(); loadProducts(); }, [loadInvoices, loadProducts]);
	useEffect(() => {
		if (openId && rowRefs.current[openId]) rowRefs.current[openId]?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [openId, invoices]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createInvoice({ customerName: customerName.trim(), items: cleanItems, currency: settings?.currency || "EUR" });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setItems([{ ...EMPTY_ITEM }]);
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
			<div className="mb-20 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
					<MdAdd size={20} /> {t("newInvoice")}
				</button>
			</div>
			{invoices.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-12">
					{invoices.map((inv) => (
						<li key={inv.id} ref={(el) => { rowRefs.current[inv.id] = el; }} className={`rounded-16 bg-white p-16 shadow-heroImage transition-shadow md:p-20 ${openId === inv.id ? "ring-[2px] ring-[#5EA8F5]" : ""}`}>
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex items-center gap-10 text-16 font-semibold text-[#333333]">
										{inv.number}
										{inv.kind === "credit_note" && <span className="rounded-4 bg-[#F0F0F0] px-8 py-2 text-12 font-medium text-[#666666]">{t("creditNote")}</span>}
										<span className="rounded-4 px-8 py-2 text-12 font-medium text-white" style={{ background: STATUS_COLOR[inv.status] }}>{t(`istatus_${inv.status}`)}</span>
										{inv.reminderCount > 0 && <span className="rounded-4 bg-[#FFF3E0] px-8 py-2 text-12 font-medium text-[#B36B00]">{t("remindersSent", { count: inv.reminderCount })}</span>}
									</p>
									<p className="mt-[4px] text-14 text-[#666666]">{inv.customerName} · {t("colDate")}: {inv.issueDate}{inv.dueDate ? ` · ${t("dueDate")}: ${inv.dueDate}` : ""}</p>
								</div>
								<p className="text-18 font-semibold text-[#333333]">{money(inv.totals.gross, inv.currency, locale)}</p>
							</div>
							<div className="mt-14 flex flex-wrap items-center gap-10">
								{inv.status === "draft" && <button type="button" disabled={busy === inv.id} onClick={() => send(inv.id)} className="rounded-8 bg-primaryColor px-16 py-8 text-14 font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("send")}</button>}
								{inv.kind === "invoice" && (inv.status === "sent" || inv.status === "overdue") && <button type="button" disabled={busy === inv.id} onClick={() => pay(inv.id)} className="rounded-8 border border-[#0A8A2E] px-16 py-8 text-14 font-medium text-[#0A8A2E] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("markPaid")}</button>}
								{inv.status === "paid" && <span className="text-14 text-[#0A8A2E]">{t("paidOn", { date: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString(locale) : "" })}</span>}
								{inv.kind === "invoice" && ["sent", "paid", "overdue"].includes(inv.status) && (
									<button type="button" disabled={busy === inv.id} onClick={() => setCreditTarget(inv.id)} className="flex items-center gap-6 rounded-8 border border-[#E6E6E6] px-16 py-8 text-14 font-medium text-[#666666] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">
										<MdReceiptLong size={16} /> {t("issueCreditNote")}
									</button>
								)}
								{inv.kind === "invoice" && (
									<button type="button" disabled={busy === inv.id} onClick={() => duplicate(inv.id)} className="flex items-center gap-6 rounded-8 border border-[#E6E6E6] px-16 py-8 text-14 font-medium text-[#666666] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">
										<MdContentCopy size={16} /> {t("duplicate")}
									</button>
								)}
								<button type="button" onClick={() => downloadPdf(inv.id, inv.number)} className="flex items-center gap-6 rounded-8 border border-[#E6E6E6] px-16 py-8 text-14 font-medium text-[#666666] transition-opacity hover:opacity-80">
									<MdDownload size={16} /> {t("downloadPdf")}
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newInvoice")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{t("newInvoice")}</h2>
					<div className="mb-16">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setOpen(false)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<Modal open={!!mailFor} onClose={() => setMailFor(null)} label={t("sendTitle")} className="w-full max-w-[520px]">
				<form onSubmit={submitMail} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-10 text-20 font-medium text-black">{t("sendTitle")}</h2>
					<p className="mb-16 text-14 text-[#999999]">{t("sendHint")}</p>
					<FormField label={t("email")} type="email" value={mailTo} onChange={(e) => setMailTo(e.target.value)} maxLength={200} autoFocus />
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setMailFor(null)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" disabled={busy === mailFor} className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80 disabled:opacity-60">{t("send")}</button>
					</div>
				</form>
			</Modal>

			<Modal open={!!creditTarget} onClose={() => setCreditTarget(null)} label={t("issueCreditNote")} className="w-full max-w-[520px]">
				<form onSubmit={submitCreditNote} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-10 text-20 font-medium text-black">{t("issueCreditNote")}</h2>
					<p className="mb-16 text-14 text-[#999999]">{t("creditNoteHint")}</p>
					<FormField label={t("notes")} value={creditNotes} onChange={(e) => setCreditNotes(e.target.value)} maxLength={2000} />
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setCreditTarget(null)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" disabled={busy === creditTarget} className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80 disabled:opacity-60">{t("save")}</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
