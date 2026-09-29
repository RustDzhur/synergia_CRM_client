"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
	TbDownload,
	TbPlus,
	TbReceipt,
	TbTruckDelivery,
} from "react-icons/tb";
import { LineItem, useFinanceStore } from "@/store/useFinanceStore";
import { defaultRateFor } from "@/lib/finance/tax";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { downloadDeliveryNote, downloadDocumentPdf } from "./download";
import DocumentTemplateButton from "./DocumentTemplateButton";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#8c948b", confirmed: "#5EA8F5", fulfilled: "#f4a100", invoiced: "#8a6fe8", closed: "#c6ff4d", cancelled: "#eb5757" };
const NEXT: Record<string, string | null> = { draft: "confirmed", confirmed: "fulfilled", fulfilled: null, invoiced: null, closed: null, cancelled: null };
// Пустая строка заказа: не жёсткий 0, а ставка фирмы по умолчанию (lib/finance/tax.ts) — страна из настроек или 0 у освобождённых
const emptyItem = (taxRate: number): LineItem => ({ description: "", qty: 1, unitPrice: 0, taxRate });

// Заказы — сердце раздела: «оформили контракт → создали заказ → выполнили (списывается склад) → выставили счёт».
// Каждая смена статуса — событие автоматизации (order_created/order_status), от него можно завести уведомление, задачу
// или сдвинуть сделку по воронке — это настраивается в Automation, не зашито здесь намертво.
export default function Orders({ onOpenInvoice, openId }: { onOpenInvoice: (id: string) => void; openId?: string | null }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { orders, products, loadOrders, loadProducts, createOrder, updateOrder, invoiceOrder, settings } = useFinanceStore();
	const defaultTaxRate = defaultRateFor(settings ?? {});
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [responsible, setResponsible] = useState("");
	const [items, setItems] = useState<LineItem[]>([emptyItem(defaultTaxRate)]);
	const [busy, setBusy] = useState<string | null>(null);
	const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

	useEffect(() => { loadOrders(); loadProducts(); }, [loadOrders, loadProducts]);
	// Настройки бухгалтерии приходят асинхронно (их грузит раздел Finance): нетронутую первую строку досеиваем
	// ставкой фирмы, когда они загрузятся, — иначе заказ, открытый сразу по ссылке, уходил бы с нулевым налогом
	useEffect(() => {
		if (!settings) return;
		setItems((cur) => cur.map((it) => (!it.description && !it.product && !it.unitPrice ? { ...it, taxRate: defaultRateFor(settings) } : it)));
	}, [settings]);
	useEffect(() => {
		if (openId && rowRefs.current[openId]) rowRefs.current[openId]?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, [openId, orders]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createOrder({ customerName: customerName.trim(), responsible: responsible.trim(), items: cleanItems, currency: settings?.currency || "EUR" });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setResponsible(""); setItems([emptyItem(defaultTaxRate)]);
	}

	// Накладную можно выписать по любому неотменённому заказу: она подтверждает передачу товара,
	// а не оплату, поэтому доступна и до счёта.
	async function downloadDelivery(id: string, number: string, noteNumber: string) {
		if (!(await downloadDeliveryNote(id, noteNumber, locale))) toast.error(t("pdfFailed"));
	}

	async function downloadOrderPdf(id: string, number: string) {
		if (!(await downloadDocumentPdf("orders", id, number, locale))) toast.error(t("pdfFailed"));
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
			<div className="mb-16 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newOrder")}
				</button>
			</div>
			{orders.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{orders.map((o) => (
						<li key={o.id} ref={(el) => { rowRefs.current[o.id] = el; }} className={`fs-card p-14 transition-shadow md:p-18 ${openId === o.id ? "ring-[1.5px] ring-inkAccentLine" : ""}`}>
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex flex-wrap items-center gap-8 text-14 font-semibold text-[#f1f4ee]">
										{o.number}
										<span className="fs-chip h-22 gap-6 px-8 text-10">
											<span className="h-6 w-6 rounded-50" style={{ background: STATUS_COLOR[o.status] }} />
											{t(`status_${o.status}`)}
										</span>
									</p>
									<p className="mt-[4px] text-12 text-[#8c948b]">{o.customerName}{o.responsible ? ` · ${o.responsible}` : ""}</p>
								</div>
								<p className="text-15 font-semibold text-[#f1f4ee]">{money(o.totals.gross, o.currency, locale)}</p>
							</div>
							<div className="mt-12 flex flex-wrap items-center gap-8">
								{NEXT[o.status] && (
									<button type="button" disabled={busy === o.id} onClick={() => advance(o.id, NEXT[o.status] as string)} className="fs-btn fs-btn-primary h-34 disabled:opacity-[0.5]">
										{t(`advance_${NEXT[o.status]}`)}
									</button>
								)}
								{["confirmed", "fulfilled"].includes(o.status) && !o.invoice && (
									<button type="button" disabled={busy === o.id} onClick={() => toInvoice(o.id)} className="fs-btn fs-btn-ghost h-34 border-[rgba(198,255,77,0.4)] text-[#c6ff4d] disabled:opacity-[0.5]">
										<TbReceipt size={15} /> {t("makeInvoice")}
									</button>
								)}
								<button type="button" onClick={() => downloadOrderPdf(o.id, o.number)} className="fs-btn fs-btn-ghost h-34">
									<TbDownload size={15} /> {t("downloadPdf")}
								</button>
								{/* Накладная (Lieferschein): номер присваивается при первой выписке и дальше не меняется */}
								<button
									type="button"
									onClick={() => downloadDelivery(o.id, o.number, o.deliveryNoteNumber ?? "")}
									className="fs-btn fs-btn-ghost h-34"
									title={o.deliveryNoteNumber ? t("deliveryIssued", { number: o.deliveryNoteNumber }) : t("deliveryCreate")}>
									<TbTruckDelivery size={15} /> {o.deliveryNoteNumber || t("deliveryNote")}
								</button>
								<DocumentTemplateButton kind="orders" id={o.id} number={o.number} template={o.template} onSave={updateOrder} />
								{o.invoice && (
									<button type="button" onClick={() => onOpenInvoice(o.invoice)} className="fs-link">{t("viewInvoice")}</button>
								)}
								{o.status === "draft" && (
									<button type="button" disabled={busy === o.id} onClick={() => advance(o.id, "cancelled")} className="text-12 text-[#9AA396] transition-colors hover:text-danger">{t("cancel")}</button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newOrder")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("newOrder")}</h2>
					<div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
						<FormField label={t("responsible")} value={responsible} onChange={(e) => setResponsible(e.target.value)} maxLength={120} />
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
