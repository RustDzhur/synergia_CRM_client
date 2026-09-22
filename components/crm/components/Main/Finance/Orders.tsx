"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdReceiptLong } from "react-icons/md";
import { LineItem, useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#B3B3B3", confirmed: "#5EA8F5", fulfilled: "#F4A100", invoiced: "#8A6FE8", closed: "#0A8A2E", cancelled: "#EB5757" };
const NEXT: Record<string, string | null> = { draft: "confirmed", confirmed: "fulfilled", fulfilled: null, invoiced: null, closed: null, cancelled: null };
const EMPTY_ITEM: LineItem = { description: "", qty: 1, unitPrice: 0, taxRate: 0 };

// Заказы — сердце раздела: «оформили контракт → создали заказ → выполнили (списывается склад) → выставили счёт».
// Каждая смена статуса — событие автоматизации (order_created/order_status), от него можно завести уведомление, задачу
// или сдвинуть сделку по воронке — это настраивается в Automation, не зашито здесь намертво.
export default function Orders({ onOpenInvoice }: { onOpenInvoice: (id: string) => void }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { orders, products, loadOrders, loadProducts, createOrder, updateOrder, invoiceOrder, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [responsible, setResponsible] = useState("");
	const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => { loadOrders(); loadProducts(); }, [loadOrders, loadProducts]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createOrder({ customerName: customerName.trim(), responsible: responsible.trim(), items: cleanItems, currency: settings?.currency || "EUR" });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setResponsible(""); setItems([{ ...EMPTY_ITEM }]);
	}

	async function advance(id: string, status: string) {
		setBusy(id);
		const err = await updateOrder(id, { status: status as any });
		setBusy(null);
		if (err) toast.error(err);
	}
	async function toInvoice(id: string) {
		setBusy(id);
		const err = await invoiceOrder(id);
		setBusy(null);
		if (err) return toast.error(err);
		toast.success(t("invoiceCreated"));
	}

	return (
		<div>
			<div className="mb-20 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
					<MdAdd size={20} /> {t("newOrder")}
				</button>
			</div>
			{orders.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-12">
					{orders.map((o) => (
						<li key={o.id} className="rounded-16 bg-white p-16 shadow-heroImage md:p-20">
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex items-center gap-10 text-16 font-semibold text-[#333333]">
										{o.number}
										<span className="rounded-4 px-8 py-2 text-12 font-medium text-white" style={{ background: STATUS_COLOR[o.status] }}>{t(`status_${o.status}`)}</span>
									</p>
									<p className="mt-[4px] text-14 text-[#666666]">{o.customerName}{o.responsible ? ` · ${o.responsible}` : ""}</p>
								</div>
								<p className="text-18 font-semibold text-[#333333]">{money(o.totals.gross, o.currency, locale)}</p>
							</div>
							<div className="mt-14 flex flex-wrap items-center gap-10">
								{NEXT[o.status] && (
									<button type="button" disabled={busy === o.id} onClick={() => advance(o.id, NEXT[o.status] as string)} className="rounded-8 bg-primaryColor px-16 py-8 text-14 font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-[0.5]">
										{t(`advance_${NEXT[o.status]}`)}
									</button>
								)}
								{["confirmed", "fulfilled"].includes(o.status) && !o.invoice && (
									<button type="button" disabled={busy === o.id} onClick={() => toInvoice(o.id)} className="flex items-center gap-6 rounded-8 border border-[#5EA8F5] px-16 py-8 text-14 font-medium text-primaryColor transition-opacity hover:opacity-80 disabled:opacity-[0.5]">
										<MdReceiptLong size={16} /> {t("makeInvoice")}
									</button>
								)}
								{o.invoice && (
									<button type="button" onClick={() => onOpenInvoice(o.invoice)} className="text-14 font-medium text-primaryColor hover:underline">{t("viewInvoice")}</button>
								)}
								{o.status === "draft" && (
									<button type="button" disabled={busy === o.id} onClick={() => advance(o.id, "cancelled")} className="text-14 text-[#999999] hover:text-danger">{t("cancel")}</button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newOrder")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{t("newOrder")}</h2>
					<div className="mb-16 grid grid-cols-1 gap-14 md:grid-cols-2">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
						<FormField label={t("responsible")} value={responsible} onChange={(e) => setResponsible(e.target.value)} maxLength={120} />
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
