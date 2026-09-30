"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
	TbDownload,
	TbSend,
	TbFileText,
	TbLink,
	TbPlus,
	TbReceipt,
	TbTruckDelivery,
} from "react-icons/tb";
import { type Order, LineItem, useFinanceStore } from "@/store/useFinanceStore";
import { apiCall } from "@/store/crmApi";
import { defaultRateFor } from "@/lib/finance/tax";
import { STATUS_COLORS } from "@/utils/statusColors";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { downloadAct, downloadDeliveryNote, downloadDocumentPdf } from "./download";
import WaybillDialog from "./ordersParts/WaybillDialog";
import UkrposhtaDialog from "./ordersParts/UkrposhtaDialog";
import DocumentTemplateButton from "./DocumentTemplateButton";
import { money } from "./format";
import { emptyItem, useDefaultTaxRate } from "./lineItems";

const STATUS_COLOR: Record<string, string> = {
	draft: STATUS_COLORS.neutral, confirmed: STATUS_COLORS.info, fulfilled: STATUS_COLORS.warning,
	invoiced: STATUS_COLORS.special, closed: STATUS_COLORS.success, cancelled: STATUS_COLORS.danger,
};
const NEXT: Record<string, string | null> = { draft: "confirmed", confirmed: "fulfilled", fulfilled: null, invoiced: null, closed: null, cancelled: null };
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
	// Доставка «Новою Поштою»: если она подключена, у заказа появляется кнопка ТТН; иначе её нет вовсе
	const [delivery, setDelivery] = useState<{ connected: boolean } | null>(null);
	const [waybillFor, setWaybillFor] = useState<Order | null>(null);
	const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

	useEffect(() => { loadOrders(); loadProducts(); }, [loadOrders, loadProducts]);
	const [deliveryMode, setDeliveryMode] = useState<"" | "novaposhta" | "ukrposhta">("");
	useEffect(() => {
		// Какая доставка подключена у фирмы: у Новой Почты — ТТН в один клик, у Укрпошты — статус
		// по штрихкоду. Показываем ту кнопку, которая действительно работает.
		void apiCall<{ connected: boolean }>("/api/novaposhta").then((res) => {
			setDelivery({ connected: !!res.data?.connected });
			if (res.data?.connected) setDeliveryMode("novaposhta");
		});
		void apiCall<{ type: string; status: string }[]>("/api/integrations").then((res) => {
			const up = (res.data ?? []).some((i) => i.type === "ukrposhta" && i.status === "connected");
			if (up && !res.data?.some((i) => i.type === "novaposhta")) setDeliveryMode("ukrposhta");
			else if (up) setDeliveryMode((m) => m || "ukrposhta");
		});
	}, []);

	// Статус посылки по номеру ТТН: Нова Пошта отвечает человеческим статусом, показываем его в строке заказа
	async function refreshWaybill(id: string) {
		setBusy(id);
		const res = await apiCall(`/api/orders/${id}/waybill`);
		setBusy(null);
		if (!res.ok) return void toast.error(res.message);
		await loadOrders();
	}
	useDefaultTaxRate(settings, setItems);
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
	// Акт виконаних робіт — украинский документ, но кнопку показываем всем: фирма сама решает,
	// нужен ли он ей (в отличие от ТТН, которая без подключённой доставки смысла не имеет)
	async function downloadActPdf(id: string, actNumber: string) {
		if (!(await downloadAct(id, actNumber, locale))) toast.error(t("pdfFailed"));
	}

	// Укрпошта: штрихкод вписывает менеджер (номер известен после регистрации в отделении),
	// статус CRM тянет сама — кнопка обновляет его
	const [upFor, setUpFor] = useState<Order | null>(null);
	const [upCode, setUpCode] = useState("");
	// Отправление через ecom (нужен договор): отдельное окно с адресом отправки и отделением получателя
	const [upCreateFor, setUpCreateFor] = useState<Order | null>(null);
	async function saveUkrposhta() {
		if (!upFor) return;
		setBusy(upFor.id);
		const res = await apiCall(`/api/orders/${upFor.id}/ukrposhta`, "POST", { barcode: upCode.trim().toUpperCase() });
		setBusy(null);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("upSaved"));
		setUpFor(null);
		await loadOrders();
	}

	// Номер отправления — клиенту: в живую переписку (Telegram/Viber/WhatsApp/Messenger),
	// а если её нет — письмом с ящика фирмы. Куда ушло, показывает ответ сервера.
	async function notifyClient(o: Order) {
		setBusy(o.id + "notify");
		const res = await apiCall<{ via: string }>(`/api/orders/${o.id}/notify`, "POST", {});
		setBusy(null);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("notifySent", { via: res.data?.via ?? "" }));
	}

	// Публичная ссылка на статус заказа: клиент открывает её без входа и видит, где его заказ
	async function shareOrder(id: string) {
		setBusy(id);
		const res = await apiCall<{ url: string }>(`/api/orders/${id}/share`);
		setBusy(null);
		if (!res.ok || !res.data) return void toast.error(res.message);
		try {
			await navigator.clipboard.writeText(res.data.url);
			toast.success(t("shareCopied"));
		} catch {
			toast.success(res.data.url, { duration: 8000 });
		}
	}

	async function downloadDelivery(id: string, noteNumber: string) {
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
									onClick={() => downloadDelivery(o.id, o.deliveryNoteNumber ?? "")}
									className="fs-btn fs-btn-ghost h-34"
									title={o.deliveryNoteNumber ? t("deliveryIssued", { number: o.deliveryNoteNumber }) : t("deliveryCreate")}>
									<TbTruckDelivery size={15} /> {o.deliveryNoteNumber || t("deliveryNote")}
								</button>
								{/* Публичная ссылка для клиента: статус, состав, доставка и кнопка оплаты */}
								<button type="button" disabled={busy === o.id} onClick={() => void shareOrder(o.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]" title={t("shareHint")}>
									<TbLink size={15} /> {t("share")}
								</button>
								{/* Акт виконаних робіт (Украина): номер присваивается при первой выписке */}
								<button
									type="button"
									onClick={() => downloadActPdf(o.id, o.actNumber ?? "")}
									className="fs-btn fs-btn-ghost h-34"
									title={o.actNumber ? t("actIssued", { number: o.actNumber }) : t("actCreate")}>
									<TbFileText size={15} /> {o.actNumber || t("act")}
								</button>
								{/* Доставка «Новою Поштою»: номер ТТН и статус посылки — прямо в строке заказа */}
								{delivery?.connected && (o.waybill?.number ? (
									<button type="button" disabled={busy === o.id} onClick={() => void refreshWaybill(o.id)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-60" title={t("npRefresh")}>
										<TbTruckDelivery size={15} /> {o.waybill.number}{o.waybill.status ? ` · ${o.waybill.status}` : ""}
									</button>
								) : (
									<button type="button" onClick={() => setWaybillFor(o)} className="fs-btn fs-btn-ghost h-34">
										<TbTruckDelivery size={15} /> {t("npWaybillCreate")}
									</button>
								))}
								{/* Номер отправления уходит клиенту: в переписку, иначе письмом */}
								{(o.waybill?.number || o.ukrposhta?.barcode) && (
									<button type="button" disabled={busy === o.id + "notify"} onClick={() => void notifyClient(o)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]" title={t("notifyHint")}>
										<TbSend size={15} /> {t("notifyClient")}
									</button>
								)}
								{/* Укрпошта: штрихкод и статус отправления — вторая по популярности доставка */}
								{deliveryMode === "ukrposhta" && (
									<button
										type="button"
										onClick={() => { setUpFor(o); setUpCode(o.ukrposhta?.barcode ?? ""); }}
										className="fs-btn fs-btn-ghost h-34"
										title={o.ukrposhta?.status || undefined}>
										<TbTruckDelivery size={15} /> {o.ukrposhta?.barcode ? `${o.ukrposhta.barcode}${o.ukrposhta.status ? ` · ${o.ukrposhta.status.slice(0, 24)}` : ""}` : t("upAdd")}
									</button>
								)}
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

			{/* Укрпошта: менеджер вписывает штрихкод, CRM сохраняет его и сразу тянет статус */}
			<Modal open={upFor !== null} onClose={() => setUpFor(null)} label={t("upTitle")} className="w-full max-w-[460px]">
				<form onSubmit={(e) => { e.preventDefault(); void saveUkrposhta(); }} className="fs-popover p-20">
					<h2 className="mb-12 text-16 font-semibold text-[#f1f4ee]">{t("upTitle")}</h2>
					<FormField label={t("upBarcode")} value={upCode} onChange={(e) => setUpCode(e.target.value.toUpperCase())} placeholder="RB123456789UA" maxLength={20} autoFocus required />
					<p className="mt-8 text-11 leading-[1.5] text-[#9AA396]">{t("upHint")}</p>
					<div className="mt-16 flex flex-wrap items-center justify-between gap-10">
						{/* Отправление можно и создать здесь: номер назначит сама Укрпошта (нужен договор) */}
						<button
							type="button"
							onClick={() => { const o = upFor; setUpFor(null); if (o) setUpCreateFor(o); }}
							className="fs-btn fs-btn-ghost h-40">
							{t("upCreate")}
						</button>
						<div className="flex gap-10">
							<button type="button" onClick={() => setUpFor(null)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
							<button type="submit" disabled={busy === upFor?.id} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("save")}</button>
						</div>
					</div>
				</form>
			</Modal>

			{upCreateFor && (
				<UkrposhtaDialog orderId={upCreateFor.id} onClose={() => setUpCreateFor(null)} onDone={() => { setUpCreateFor(null); void loadOrders(); }} />
			)}

			{waybillFor && (
				<WaybillDialog
					orderId={waybillFor.id}
					customer={waybillFor.customerName}
					phone={waybillFor.contactPhone ?? ""}
					amount={waybillFor.totals?.gross ?? 0}
					open={waybillFor !== null}
					onClose={() => setWaybillFor(null)}
					onCreated={() => void loadOrders()}
				/>
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
