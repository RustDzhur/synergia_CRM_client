"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd } from "react-icons/md";
import { LineItem, useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#B3B3B3", sent: "#5EA8F5", accepted: "#0A8A2E", declined: "#EB5757", expired: "#999999" };
const EMPTY_ITEM: LineItem = { description: "", qty: 1, unitPrice: 0, taxRate: 0 };

// Коммерческое предложение (Angebot): черновик → отправлено → клиент принял/отклонил. Принятое предложение можно одним
// нажатием превратить в заказ (те же строки переходят в Order) — дальше оно идёт обычным путём заказ → счёт.
export default function Quotes({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { quotes, products, loadQuotes, loadProducts, createQuote, sendQuote, decideQuote, quoteToOrder, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => { loadQuotes(); loadProducts(); }, [loadQuotes, loadProducts]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createQuote({ customerName: customerName.trim(), items: cleanItems, currency: settings?.currency || "EUR" });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setItems([{ ...EMPTY_ITEM }]);
	}
	async function send(id: string) { setBusy(id); const err = await sendQuote(id); setBusy(null); if (err) toast.error(err); }
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
									</p>
									<p className="mt-[4px] text-14 text-[#666666]">{q.customerName} · {t("validUntil")}: {q.validUntil}</p>
								</div>
								<p className="text-18 font-semibold text-[#333333]">{money(q.totals.gross, q.currency, locale)}</p>
							</div>
							<div className="mt-14 flex flex-wrap items-center gap-10">
								{q.status === "draft" && <button type="button" disabled={busy === q.id} onClick={() => send(q.id)} className="rounded-8 bg-primaryColor px-16 py-8 text-14 font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("send")}</button>}
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

			<Modal open={open} onClose={() => setOpen(false)} label={t("newQuote")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{t("newQuote")}</h2>
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
		</div>
	);
}
