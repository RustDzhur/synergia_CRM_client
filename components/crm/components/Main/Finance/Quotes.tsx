"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdDownload } from "react-icons/md";
import { LineItem, useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { downloadDocumentPdf } from "./download";
import DocumentTemplateButton from "./DocumentTemplateButton";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#B3B3B3", sent: "#5EA8F5", accepted: "#0A8A2E", declined: "#EB5757", expired: "#999999" };
const EMPTY_ITEM: LineItem = { description: "", qty: 1, unitPrice: 0, taxRate: 0 };

export interface QuotePrefill { dealId: string; customerName: string; contact?: string; company?: string }

// Коммерческое предложение (Angebot): черновик → отправлено → клиент принял/отклонил. Принятое предложение можно одним
// нажатием превратить в заказ (те же строки переходят в Order) — дальше оно идёт обычным путём заказ → счёт.
export default function Quotes({ onOpenOrder, prefill }: { onOpenOrder: (id: string) => void; prefill?: QuotePrefill | null }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { quotes, products, loadQuotes, loadProducts, createQuote, updateQuote, sendQuote, decideQuote, quoteToOrder, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
	const [busy, setBusy] = useState<string | null>(null);
	const [dealLink, setDealLink] = useState<{ deal?: string; contact?: string; company?: string }>({});
	const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set());
	// Окно «введите адрес»: открывается, когда у клиента нет сохранённого e-mail (сервер отвечает no_recipient)
	const [mailFor, setMailFor] = useState<string | null>(null);
	const [mailTo, setMailTo] = useState("");
	const toggleHistory = (id: string) => setHistoryOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

	useEffect(() => { loadQuotes(); loadProducts(); }, [loadQuotes, loadProducts]);

	// пришли из карточки сделки (CRM → Deal → "Create Quote") — открываем форму сразу заполненной и со связью на сделку
	useEffect(() => {
		if (!prefill) return;
		setCustomerName(prefill.customerName);
		setDealLink({ deal: prefill.dealId, contact: prefill.contact, company: prefill.company });
		setOpen(true);
	}, [prefill]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createQuote({ customerName: customerName.trim(), items: cleanItems, currency: settings?.currency || "EUR", ...dealLink } as any);
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setItems([{ ...EMPTY_ITEM }]); setDealLink({});
	}
	async function send(id: string, to?: string) {
		setBusy(id);
		const r = await sendQuote(id, to);
		setBusy(null);
		if (r.ok) return toast.success(t("sentTo", { email: r.sentTo }));
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
	async function downloadPdf(id: string, number: string) {
		if (!(await downloadDocumentPdf("quotes", id, number, locale))) toast.error(t("pdfFailed"));
	}
	async function decide(id: string, accepted: boolean) { setBusy(id); const err = await decideQuote(id, accepted); setBusy(null); if (err) toast.error(err); }
	async function toOrder(id: string) {
		setBusy(id);
		const err = await quoteToOrder(id);
		setBusy(null);
		if (err) return toast.error(err);
		toast.success(t("orderCreated"));
	}

	return (
		<div>
			<div className="mb-20 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
					<MdAdd size={20} /> {t("newQuote")}
				</button>
			</div>
			{quotes.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-12">
					{quotes.map((q) => (
						<li key={q.id} className="rounded-16 bg-white p-16 shadow-heroImage md:p-20">
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex items-center gap-10 text-16 font-semibold text-[#333333]">
										{q.number}
										<span className="rounded-4 px-8 py-2 text-12 font-medium text-white" style={{ background: STATUS_COLOR[q.status] }}>{t(`qstatus_${q.status}`)}</span>
										{q.version > 1 && (
											<button type="button" onClick={() => toggleHistory(q.id)} className="rounded-4 border border-[#E6E6E6] px-8 py-2 text-12 font-medium text-[#999999] hover:text-primaryColor">
												v{q.version} · {t("history")}
											</button>
										)}
									</p>
									<p className="mt-[4px] text-14 text-[#666666]">{q.customerName} · {t("validUntil")}: {q.validUntil}</p>
								</div>
								<p className="text-18 font-semibold text-[#333333]">{money(q.totals.gross, q.currency, locale)}</p>
							</div>
							{historyOpen.has(q.id) && q.versions.length > 0 && (
								<ul className="mt-10 flex flex-col gap-6 rounded-8 bg-[#F5F7FC] p-10">
									{[...q.versions].reverse().map((v) => (
										<li key={v.version} className="flex items-center justify-between text-12 text-[#999999]">
											<span>v{v.version} · {v.customerName} · {new Date(v.savedAt).toLocaleString(locale === "ua" ? "uk" : locale)}</span>
											<span className="font-medium text-[#666666]">{money(v.totals.gross, v.currency, locale)}</span>
										</li>
									))}
								</ul>
							)}
							<div className="mt-14 flex flex-wrap items-center gap-10">
								{q.status === "draft" && <button type="button" disabled={busy === q.id} onClick={() => send(q.id)} className="rounded-8 bg-primaryColor px-16 py-8 text-14 font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("send")}</button>}
								<button type="button" onClick={() => downloadPdf(q.id, q.number)} className="flex items-center gap-6 rounded-8 border border-[#E6E6E6] px-16 py-8 text-14 font-medium text-[#666666] transition-opacity hover:opacity-80">
									<MdDownload size={16} /> {t("downloadPdf")}
								</button>
								<DocumentTemplateButton kind="quotes" id={q.id} number={q.number} template={q.template} onSave={updateQuote} />
								{q.status === "sent" && (
									<>
										<button type="button" disabled={busy === q.id} onClick={() => decide(q.id, true)} className="rounded-8 border border-[#0A8A2E] px-16 py-8 text-14 font-medium text-[#0A8A2E] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("markAccepted")}</button>
										<button type="button" disabled={busy === q.id} onClick={() => decide(q.id, false)} className="rounded-8 border border-danger px-16 py-8 text-14 font-medium text-danger transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("markDeclined")}</button>
									</>
								)}
								{q.status === "accepted" && !q.order && (
									<button type="button" disabled={busy === q.id} onClick={() => toOrder(q.id)} className="rounded-8 border border-[#5EA8F5] px-16 py-8 text-14 font-medium text-primaryColor transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("makeOrder")}</button>
								)}
								{q.order && <button type="button" onClick={() => onOpenOrder(q.order)} className="text-14 font-medium text-primaryColor hover:underline">{t("viewOrder")}</button>}
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => { setOpen(false); setDealLink({}); }} label={t("newQuote")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{t("newQuote")}</h2>
					{dealLink.deal && <p className="mb-16 rounded-8 bg-[#F5F7FC] px-12 py-8 text-14 text-[#666666]">{t("linkedToDeal")}</p>}
					<div className="mb-16">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => { setOpen(false); setDealLink({}); }} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80">{t("save")}</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
