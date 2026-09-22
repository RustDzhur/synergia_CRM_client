"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd } from "react-icons/md";
import { LineItem, useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#B3B3B3", sent: "#5EA8F5", paid: "#0A8A2E", overdue: "#EB5757", cancelled: "#999999" };
const EMPTY_ITEM: LineItem = { description: "", qty: 1, unitPrice: 0, taxRate: 0 };

// Счета: по заказу (тогда попадает сюда автоматически) или сами по себе — например разовая услуга без отдельного заказа.
// Номер — последовательный (RE-2026-1, RE-2026-2…), выдаётся один раз и не переиспользуется.
export default function Invoices({ openId }: { openId?: string | null }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { invoices, products, loadInvoices, loadProducts, createInvoice, sendInvoice, payInvoice, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
	const [busy, setBusy] = useState<string | null>(null);
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
	async function send(id: string) { setBusy(id); const err = await sendInvoice(id); setBusy(null); if (err) toast.error(err); }
	async function pay(id: string) { setBusy(id); const err = await payInvoice(id); setBusy(null); if (err) toast.error(err); else toast.success(t("markedPaid")); }

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
										<span className="rounded-4 px-8 py-2 text-12 font-medium text-white" style={{ background: STATUS_COLOR[inv.status] }}>{t(`istatus_${inv.status}`)}</span>
									</p>
									<p className="mt-[4px] text-14 text-[#666666]">{inv.customerName} · {t("colDate")}: {inv.issueDate}{inv.dueDate ? ` · ${t("dueDate")}: ${inv.dueDate}` : ""}</p>
								</div>
								<p className="text-18 font-semibold text-[#333333]">{money(inv.totals.gross, inv.currency, locale)}</p>
							</div>
							<div className="mt-14 flex flex-wrap items-center gap-10">
								{inv.status === "draft" && <button type="button" disabled={busy === inv.id} onClick={() => send(inv.id)} className="rounded-8 bg-primaryColor px-16 py-8 text-14 font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("send")}</button>}
								{(inv.status === "sent" || inv.status === "overdue") && <button type="button" disabled={busy === inv.id} onClick={() => pay(inv.id)} className="rounded-8 border border-[#0A8A2E] px-16 py-8 text-14 font-medium text-[#0A8A2E] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("markPaid")}</button>}
								{inv.status === "paid" && <span className="text-14 text-[#0A8A2E]">{t("paidOn", { date: inv.paidAt ? new Date(inv.paidAt).toLocaleDateString(locale) : "" })}</span>}
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
		</div>
	);
}
