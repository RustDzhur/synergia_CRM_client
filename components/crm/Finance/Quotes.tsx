"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbDownload, TbLink, TbPlus } from "react-icons/tb";
import { LineItem, useFinanceStore } from "@/store/useFinanceStore";
import { defaultRateFor } from "@/lib/finance/tax";
import { STATUS_COLORS } from "@/utils/statusColors";
import { localeTag } from "@/utils/dateHelpers";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { downloadDocumentPdf } from "./download";
import { apiCall } from "@/store/crmApi";
import DocumentTemplateButton from "./DocumentTemplateButton";
import { money } from "./format";
import { emptyItem, useDefaultTaxRate } from "./lineItems";

const STATUS_COLOR: Record<string, string> = {
	draft: STATUS_COLORS.neutral, sent: STATUS_COLORS.info, accepted: STATUS_COLORS.success,
	declined: STATUS_COLORS.danger, expired: STATUS_COLORS.stale,
};
export interface QuotePrefill { dealId: string; customerName: string; contact?: string; company?: string }

// Коммерческое предложение (Angebot): черновик → отправлено → клиент принял/отклонил. Принятое предложение можно одним
// нажатием превратить в заказ (те же строки переходят в Order) — дальше оно идёт обычным путём заказ → счёт.
export default function Quotes({ onOpenOrder, prefill }: { onOpenOrder: (id: string) => void; prefill?: QuotePrefill | null }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { quotes, products, loadQuotes, loadProducts, createQuote, updateQuote, sendQuote, decideQuote, quoteToOrder, settings } = useFinanceStore();
	const defaultTaxRate = defaultRateFor(settings ?? {});
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [items, setItems] = useState<LineItem[]>([emptyItem(defaultTaxRate)]);
	const [busy, setBusy] = useState<string | null>(null);
	const [dealLink, setDealLink] = useState<{ deal?: string; contact?: string; company?: string }>({});
	const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set());
	// Окно «введите адрес»: открывается, когда у клиента нет сохранённого e-mail (сервер отвечает no_recipient)
	const toggleHistory = (id: string) => setHistoryOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

	useEffect(() => { loadQuotes(); loadProducts(); }, [loadQuotes, loadProducts]);
	useDefaultTaxRate(settings, setItems);

	// пришли из карточки сделки (CRM → Deal → "Create Quote") — открываем форму сразу заполненной и со связью на сделку
	useEffect(() => {
		if (!prefill) return;
		setCustomerName(prefill.customerName);
		setDealLink({ deal: prefill.dealId, contact: prefill.contact, company: prefill.company });
		setOpen(true);
	}, [prefill]);

	// Ссылка на предложение для клиента: он отмечает нужные позиции и принимает — в CRM остаётся
	// принятое предложение с выбранными позициями, а менеджер получает уведомление
	async function share(id: string) {
		const res = await apiCall<{ url: string }>(`/api/quotes/${id}/share`);
		if (!res.ok || !res.data) return void toast.error(res.message);
		try {
			await navigator.clipboard.writeText(res.data.url);
			toast.success(t("shareCopied"));
		} catch {
			toast.success(res.data.url, { duration: 8000 });
		}
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createQuote({ customerName: customerName.trim(), items: cleanItems, currency: settings?.currency || "EUR", ...dealLink } as any);
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setItems([emptyItem(defaultTaxRate)]); setDealLink({});
	}
	async function send(id: string) {
		setBusy(id);
		const r = await sendQuote(id);
		setBusy(null);
		if (r.ok) return toast.success(t("sentTo", { email: r.sentTo }));
		// адреса у клиента нет — сервер объясняет это в message, показываем как есть
		toast.error(r.message);
	}
	async function downloadPdf(id: string, number: string) {
		void downloadDocumentPdf("quotes", id, number, locale); // причину отказа показывает сам хелпер
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
			<div className="mb-16 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newQuote")}
				</button>
			</div>
			{quotes.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{quotes.map((q) => (
						<li key={q.id} className="fs-card p-14 md:p-18">
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex flex-wrap items-center gap-8 text-14 font-semibold text-[#f1f4ee]">
										{q.number}
										<span className="fs-chip h-22 gap-6 px-8 text-10">
											<span className="h-6 w-6 rounded-50" style={{ background: STATUS_COLOR[q.status] }} />
											{t(`qstatus_${q.status}`)}
										</span>
										{q.version > 1 && (
											<button type="button" onClick={() => toggleHistory(q.id)} className="fs-chip h-22 px-8 text-10 transition-colors hover:border-[rgba(255,255,255,0.20)] hover:text-[#f1f4ee]">
												v{q.version} · {t("history")}
											</button>
										)}
									</p>
									<p className="mt-[4px] text-12 text-[#8c948b]">{q.customerName} · {t("validUntil")}: {q.validUntil}</p>
								</div>
								<p className="text-15 font-semibold text-[#f1f4ee]">{money(q.totals.gross, q.currency, locale)}</p>
							</div>
							{historyOpen.has(q.id) && q.versions.length > 0 && (
								<ul className="mt-10 flex flex-col gap-6 rounded-10 border border-inkLineSoft bg-[rgba(255,255,255,0.02)] p-10">
									{[...q.versions].reverse().map((v) => (
										<li key={v.version} className="flex items-center justify-between text-11 text-[#9AA396]">
											<span>v{v.version} · {v.customerName} · {new Date(v.savedAt).toLocaleString(localeTag(locale))}</span>
											<span className="font-medium text-[#8c948b]">{money(v.totals.gross, v.currency, locale)}</span>
										</li>
									))}
								</ul>
							)}
							<div className="mt-12 flex flex-wrap items-center gap-8">
								{q.status === "draft" && <button type="button" disabled={busy === q.id} onClick={() => send(q.id)} className="fs-btn fs-btn-primary h-34 disabled:opacity-[0.5]">{t("send")}</button>}
								{/* Ссылка для клиента: он сам отметит нужные позиции и примет предложение */}
								<button type="button" onClick={() => void share(q.id)} className="fs-btn fs-btn-ghost h-34" title={t("shareHint")}>
									<TbLink size={15} /> {t("share")}
								</button>
								<button type="button" onClick={() => downloadPdf(q.id, q.number)} className="fs-btn fs-btn-ghost h-34">
									<TbDownload size={15} /> {t("downloadPdf")}
								</button>
								<DocumentTemplateButton kind="quotes" id={q.id} number={q.number} template={q.template} onSave={updateQuote} />
								{q.status === "sent" && (
									<>
										<button type="button" disabled={busy === q.id} onClick={() => decide(q.id, true)} className="fs-btn fs-btn-ghost h-34 border-[rgba(198,255,77,0.4)] text-[#c6ff4d] disabled:opacity-[0.5]">{t("markAccepted")}</button>
										<button type="button" disabled={busy === q.id} onClick={() => decide(q.id, false)} className="fs-btn fs-btn-ghost h-34 border-[rgba(235,87,87,0.35)] text-danger disabled:opacity-[0.5]">{t("markDeclined")}</button>
									</>
								)}
								{q.status === "accepted" && !q.order && (
									<button type="button" disabled={busy === q.id} onClick={() => toOrder(q.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">{t("makeOrder")}</button>
								)}
								{q.order && <button type="button" onClick={() => onOpenOrder(q.order)} className="fs-link">{t("viewOrder")}</button>}
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => { setOpen(false); setDealLink({}); }} label={t("newQuote")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("newQuote")}</h2>
					{dealLink.deal && <p className="mb-14 rounded-10 border border-inkLineSoft bg-[rgba(255,255,255,0.02)] px-12 py-8 text-12 text-[#8c948b]">{t("linkedToDeal")}</p>}
					<div className="mb-16">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => { setOpen(false); setDealLink({}); }} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
