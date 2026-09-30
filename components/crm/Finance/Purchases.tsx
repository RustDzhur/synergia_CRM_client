"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCheck, TbPlus, TbTruckDelivery, TbX } from "react-icons/tb";
import ScanCode from "../shared/ScanCode";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import Modal from "../shared/Modal";
import { apiCall } from "@/store/crmApi";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";

// Закупівлі (ТЗ §12): заказы поставщикам, приход по накладной, счета поставщиков и возвраты —
// одна вкладка. Цепочка «замовлення → прихід → счёт → оплата» проходит здесь, а склад и
// себестоимость обновляются документом прихода (вкладка «Склад»).

interface SupplierRow { id: string; name: string; code: string; phone: string; email: string; paymentDays: number; currency: string; archived: boolean; notes: string }
interface PurchaseLine { product: string; name: string; sku: string; unit: string; qty: number; price: number; receivedQty: number }
interface PurchaseRow {
	id: string; number: string; supplier: string; supplierId: string; date: string; expectedDate: string;
	status: string; warehouse: string; warehouseId: string; currency: string; notes: string; lines: PurchaseLine[];
}
interface InvoiceRow { id: string; supplier: string; number: string; date: string; dueDate: string; amount: number; paidAmount: number; status: string; currency: string; overdue: boolean }
interface WarehouseRow { id: string; name: string }

type Section = "orders" | "suppliers" | "invoices";

const STATUS_COLOR: Record<string, string> = { draft: "#8c948b", confirmed: "#5EA8F5", received: "#2DDEB6", cancelled: "#eb5757" };

export default function Purchases() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { products, loadProducts } = useFinanceStore();
	const [section, setSection] = useState<Section>("orders");
	const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
	const [orders, setOrders] = useState<PurchaseRow[]>([]);
	const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
	const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
	const [busy, setBusy] = useState("");
	// Окна: поставщик, заказ, приход
	const [supOpen, setSupOpen] = useState(false);
	const [supForm, setSupForm] = useState({ name: "", code: "", phone: "", email: "", paymentDays: "0", currency: "", notes: "" });
	const [poOpen, setPoOpen] = useState(false);
	const [poForm, setPoForm] = useState({ supplier: "", date: new Date().toISOString().slice(0, 10), expectedDate: "", warehouse: "", notes: "" });
	const [poLines, setPoLines] = useState<Array<{ product: string; qty: string; price: string }>>([{ product: "", qty: "1", price: "" }]);
	const [receiveFor, setReceiveFor] = useState<PurchaseRow | null>(null);
	const [receiveForm, setReceiveForm] = useState<{ quantities: string[]; invoiceNumber: string; invoiceDate: string; dueDate: string; warehouse: string }>({ quantities: [], invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10), dueDate: "", warehouse: "" });
	const [cancelFor, setCancelFor] = useState<PurchaseRow | null>(null);

	const load = useCallback(async () => {
		const [su, po, inv, wh] = await Promise.all([
			apiCall<SupplierRow[]>("/api/suppliers"),
			apiCall<PurchaseRow[]>("/api/purchases"),
			apiCall<InvoiceRow[]>("/api/supplier-invoices"),
			apiCall<WarehouseRow[]>("/api/warehouses"),
		]);
		if (su.ok && su.data) setSuppliers(su.data);
		if (po.ok && po.data) setOrders(po.data);
		if (inv.ok && inv.data) setInvoices(inv.data);
		if (wh.ok && wh.data) setWarehouses(wh.data);
	}, []);
	useEffect(() => { void load(); loadProducts(); }, [load, loadProducts]);

	const goods = useMemo(() => products.filter((p) => !p.archived), [products]);

	// Код от сканера: находим товар по штрихкоду или артикулу и добавляем строку заказа сразу;
	// цена подставляется закупочная — её всегда можно перебить в строке
	function onScanLine(code: string) {
		const probe = code.trim().toLowerCase();
		const found = goods.find((p) => (p.barcode && p.barcode.toLowerCase() === probe) || (p.sku ?? "").toLowerCase() === probe);
		if (!found) return void toast.error(t("scanNotFound", { code }));
		setPoLines([...poLines, { product: found.id, qty: "1", price: String(found.purchasePrice ?? "") }]);
	}
	const activeSuppliers = useMemo(() => suppliers.filter((s) => !s.archived), [suppliers]);
	const input = "fs-field h-36 w-full px-10 text-12 outline-none";

	async function saveSupplier() {
		setBusy("sup");
		const res = await apiCall("/api/suppliers", "POST", { ...supForm, paymentDays: Number(supForm.paymentDays) || 0 });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("saved"));
		setSupOpen(false);
		void load();
	}

	async function createOrder() {
		const lines = poLines.filter((l) => l.product && Number(l.qty) > 0).map((l) => ({ product: l.product, qty: Number(l.qty), price: Number(l.price) || 0 }));
		if (!poForm.supplier) return void toast.error(t("purPickSupplier"));
		if (!lines.length) return void toast.error(t("stockNoLines"));
		setBusy("po");
		const res = await apiCall<{ number: string }>("/api/purchases", "POST", { ...poForm, lines });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("purOrderCreated", { number: res.data?.number ?? "" }));
		setPoOpen(false);
		setPoLines([{ product: "", qty: "1", price: "" }]);
		void load();
	}

	function openReceive(po: PurchaseRow) {
		setReceiveFor(po);
		setReceiveForm({
			quantities: po.lines.map((l) => String(Math.max(0, l.qty - l.receivedQty))),
			invoiceNumber: "",
			invoiceDate: new Date().toISOString().slice(0, 10),
			dueDate: "",
			warehouse: po.warehouseId || warehouses[0]?.id || "",
		});
	}

	async function receive() {
		if (!receiveFor) return;
		if (!receiveForm.warehouse) return void toast.error(t("purPickWarehouse"));
		setBusy("receive");
		const res = await apiCall<{ doc: { number: string }; fullyReceived: boolean }>(`/api/purchases/${receiveFor.id}`, "POST", {
			action: "receive",
			quantities: receiveForm.quantities.map((q) => Number(q) || 0),
			warehouse: receiveForm.warehouse,
			// Счёт поставщика создаётся всегда: без номера тоже — долг и расход закупки видны в отчётах,
			// номер можно принести позже. Дата и срок оплаты, введённые в окне, сохраняются и без номера
			invoice: { number: receiveForm.invoiceNumber.trim(), date: receiveForm.invoiceDate, dueDate: receiveForm.dueDate },
		});
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("purReceived", { number: res.data?.doc.number ?? "" }));
		setReceiveFor(null);
		void load();
	}

	async function payInvoice(row: InvoiceRow) {
		setBusy(row.id);
		const res = await apiCall("/api/supplier-invoices", "PATCH", { id: row.id, action: "pay" });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("purInvoicePaid"));
		void load();
	}

	async function cancelOrder(row: PurchaseRow) {
		setCancelFor(null);
		setBusy(row.id);
		const res = await apiCall(`/api/purchases/${row.id}`, "POST", { action: "cancel" });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		void load();
	}

	return (
		<div className="flex flex-col gap-16">
			<div className="flex flex-wrap gap-8">
				{(["orders", "suppliers", "invoices"] as Section[]).map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => setSection(s)}
						className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${section === s ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
						{t(`purTab_${s}`)}
					</button>
				))}
			</div>

			{section === "orders" && (
				<section className="fs-card overflow-x-auto p-16 md:p-20">
					<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("purOrders")}</h3>
						<button type="button" disabled={!activeSuppliers.length} onClick={() => { setPoForm({ ...poForm, supplier: activeSuppliers[0]?.id ?? "", warehouse: warehouses[0]?.id ?? "" }); setPoOpen(true); }} className="fs-btn fs-btn-ghost h-34 disabled:opacity-50">
							<TbPlus size={14} /> {t("purNewOrder")}
						</button>
					</div>
					{orders.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{activeSuppliers.length ? t("purNoOrders") : t("purAddSupplierFirst")}</p>
					) : (
						<table className="w-full min-w-[760px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-6 font-medium">{t("stockColNumber")}</th>
									<th className="pb-6 font-medium">{t("purColSupplier")}</th>
									<th className="pb-6 font-medium">{t("stockColKind")}</th>
									<th className="pb-6 font-medium">{t("stockColLines")}</th>
									<th className="pb-6 text-right font-medium">{t("stockColTotal")}</th>
									<th className="pb-6" />
								</tr>
							</thead>
							<tbody>
								{orders.map((po) => {
									const total = po.lines.reduce((s, l) => s + l.qty * l.price, 0);
									return (
										<tr key={po.id} className="border-t border-inkLine text-[#cfd4cb]">
											<td className="py-7 text-[#f1f4ee]">{po.number}<span className="ml-6 text-11 text-[#8c948b]">{po.date}</span></td>
											<td className="py-7">{po.supplier}</td>
											<td className="py-7"><span style={{ color: STATUS_COLOR[po.status] ?? "#8c948b" }}>{t(`purStatus_${po.status}`)}</span>
												{po.warehouse && <span className="ml-6 text-11 text-[#8c948b]">{po.warehouse}</span>}</td>
											<td className="py-7">{po.lines.slice(0, 2).map((l) => `${l.name} ${l.receivedQty}/${l.qty}`).join(", ")}{po.lines.length > 2 ? " …" : ""}</td>
											<td className="py-7 text-right">{money(total, po.currency, locale)}</td>
											<td className="py-7">
												<div className="flex items-center justify-end gap-6">
													{po.status !== "received" && po.status !== "cancelled" && (
														<button type="button" disabled={busy !== ""} onClick={() => openReceive(po)} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
															<TbTruckDelivery size={13} /> {t("purReceive")}
														</button>
													)}
													{po.status === "received" && <span className="inline-flex items-center gap-4 text-11 text-[#2DDEB6]"><TbCheck size={12} /> {t("purStatus_received")}</span>}
													{po.status !== "received" && po.status !== "cancelled" && (
														<button type="button" disabled={busy !== ""} onClick={() => setCancelFor(po)} className="text-[#9AA396] transition-colors hover:text-danger disabled:opacity-50" aria-label={t("cancel")}>
															<TbX size={14} />
														</button>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					)}
				</section>
			)}

			{section === "suppliers" && (
				<section className="fs-card p-16 md:p-20">
					<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("purSuppliers")}</h3>
						<button type="button" onClick={() => { setSupForm({ name: "", code: "", phone: "", email: "", paymentDays: "0", currency: "", notes: "" }); setSupOpen(true); }} className="fs-btn fs-btn-ghost h-34">
							<TbPlus size={14} /> {t("purAddSupplier")}
						</button>
					</div>
					{suppliers.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{t("purNoSuppliers")}</p>
					) : (
						<ul className="flex flex-col gap-8">
							{suppliers.map((s) => (
								<li key={s.id} className={`flex flex-wrap items-center justify-between gap-10 border-t border-inkLine pt-8 text-12 ${s.archived ? "opacity-50" : ""}`}>
									<span className="text-[#f1f4ee]">{s.name}<span className="ml-6 text-11 text-[#8c948b]">{s.code}</span></span>
									<span className="text-[#8c948b]">{[s.phone, s.email].filter(Boolean).join(" · ")}</span>
									<span className="text-[#8c948b]">{s.paymentDays ? t("purPaymentDaysWith", { days: s.paymentDays }) : ""} {s.currency}</span>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{section === "invoices" && (
				<section className="fs-card overflow-x-auto p-16 md:p-20">
					<h3 className="mb-12 text-14 font-semibold text-[#f1f4ee]">{t("purInvoices")}</h3>
					{invoices.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{t("purNoInvoices")}</p>
					) : (
						<table className="w-full min-w-[640px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-6 font-medium">{t("purColSupplier")}</th>
									<th className="pb-6 font-medium">{t("stockColNumber")}</th>
									<th className="pb-6 font-medium">{t("purColDue")}</th>
									<th className="pb-6 text-right font-medium">{t("stockColTotal")}</th>
									<th className="pb-6 text-right font-medium">{t("purColPaid")}</th>
									<th className="pb-6" />
								</tr>
							</thead>
							<tbody>
								{invoices.map((i) => (
									<tr key={i.id} className="border-t border-inkLine text-[#cfd4cb]">
										<td className="py-7 text-[#f1f4ee]">{i.supplier}</td>
										<td className="py-7">{i.number || "—"}<span className="ml-6 text-11 text-[#8c948b]">{i.date}</span></td>
										<td className={`py-7 ${i.overdue ? "text-[#F4A100]" : ""}`}>{i.dueDate || "—"}</td>
										<td className="py-7 text-right">{money(i.amount, i.currency, locale)}</td>
										<td className="py-7 text-right">{money(i.paidAmount, i.currency, locale)}</td>
										<td className="py-7 text-right">
											{i.status === "paid" ? (
												<span className="inline-flex items-center gap-4 text-11 text-[#2DDEB6]"><TbCheck size={12} /> {t("purStatus_paid")}</span>
											) : (
												<button type="button" disabled={busy !== ""} onClick={() => void payInvoice(i)} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
													{t("purPay")}
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			)}

			{/* Новый поставщик */}
			<Modal open={supOpen} onClose={() => setSupOpen(false)} label={t("purAddSupplier")} className="w-full max-w-[480px]">
				<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col gap-12 overflow-y-auto p-20">
					<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("purAddSupplier")}</h2>
					<FormField label={t("purName")} value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} maxLength={120} autoFocus />
					<div className="grid grid-cols-2 gap-12">
						<FormField label={t("purCode")} value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} maxLength={60} />
						<FormField label={t("npPhone")} value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} maxLength={40} />
					</div>
					<FormField label={t("email")} value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} maxLength={120} />
					<div className="grid grid-cols-2 gap-12">
						<FormField label={t("purPaymentDaysLabel")} value={supForm.paymentDays} onChange={(e) => setSupForm({ ...supForm, paymentDays: e.target.value.replace(/[^\d]/g, "") })} maxLength={4} />
						<FormField label={t("currency")} value={supForm.currency} onChange={(e) => setSupForm({ ...supForm, currency: e.target.value.toUpperCase() })} maxLength={6} />
					</div>
					<FormField label={t("stockNote")} value={supForm.notes} onChange={(e) => setSupForm({ ...supForm, notes: e.target.value })} maxLength={600} />
					<div className="mt-4 flex justify-end gap-10">
						<button type="button" onClick={() => setSupOpen(false)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy !== "" || !supForm.name.trim()} onClick={() => void saveSupplier()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("save")}</button>
					</div>
				</div>
			</Modal>

			{/* Новый заказ поставщику */}
			<Modal open={poOpen} onClose={() => setPoOpen(false)} label={t("purNewOrder")} className="w-full max-w-[640px]">
				<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col p-20">
					<h2 className="mb-12 text-15 font-semibold text-[#f1f4ee]">{t("purNewOrder")}</h2>
					<div className="fs-scroll min-h-0 flex-1 overflow-y-auto pr-4">
						<div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-2">
							<label className="block">
								<span className="mb-6 block text-12 text-[#8c948b]">{t("purColSupplier")}</span>
								<select value={poForm.supplier} onChange={(e) => setPoForm({ ...poForm, supplier: e.target.value })} className={input}>
									{activeSuppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
								</select>
							</label>
							<label className="block">
								<span className="mb-6 block text-12 text-[#8c948b]">{t("stockTo")}</span>
								<select value={poForm.warehouse} onChange={(e) => setPoForm({ ...poForm, warehouse: e.target.value })} className={input}>
									<option value="">—</option>
									{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
								</select>
							</label>
							<FormField label={t("stockColDate")} type="date" value={poForm.date} onChange={(e) => setPoForm({ ...poForm, date: e.target.value })} />
							<FormField label={t("purExpected")} type="date" value={poForm.expectedDate} onChange={(e) => setPoForm({ ...poForm, expectedDate: e.target.value })} />
						</div>
						<span className="mb-6 block text-12 text-[#8c948b]">{t("stockColLines")}</span>
						<div className="flex flex-col gap-8">
							{poLines.map((line, i) => (
								<div key={i} className="grid grid-cols-[1fr_90px_110px_32px] items-center gap-8">
									<select value={line.product} onChange={(e) => setPoLines(poLines.map((l, j) => (j === i ? { ...l, product: e.target.value } : l)))} className={input}>
										<option value="">—</option>
										{goods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
									</select>
									<input value={line.qty} onChange={(e) => setPoLines(poLines.map((l, j) => (j === i ? { ...l, qty: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("stockQty")} className={input} />
									<input value={line.price} onChange={(e) => setPoLines(poLines.map((l, j) => (j === i ? { ...l, price: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("stockPrice")} className={input} />
									<button type="button" onClick={() => setPoLines(poLines.length > 1 ? poLines.filter((_, j) => j !== i) : poLines)} className="text-[#8c948b] transition-colors hover:text-danger" aria-label={t("delete")}>
										<TbX size={15} />
									</button>
								</div>
							))}
							<div className="flex items-center gap-12">
								<button type="button" onClick={() => setPoLines([...poLines, { product: "", qty: "1", price: "" }])} className="fs-link text-left">{t("stockAddLine")}</button>
								{/* Сканер: код товара добавляет строку закупки сразу — вручную выбирать из списка не нужно */}
								<ScanCode onDetect={onScanLine} />
							</div>
						</div>
						<FormField label={t("stockNote")} value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} maxLength={600} className="mt-12" />
					</div>
					<div className="mt-16 flex justify-end gap-10">
						<button type="button" onClick={() => setPoOpen(false)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy !== ""} onClick={() => void createOrder()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("purCreateOrder")}</button>
					</div>
				</div>
			</Modal>

			{/* Приход по накладной: сколько принимаем, счёт поставщика, склад */}
			<Modal open={!!receiveFor} onClose={() => setReceiveFor(null)} label={t("purReceive")} className="w-full max-w-[560px]">
				<div className="fs-popover flex flex-col gap-12 p-20">
					<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("purReceiveTitle", { number: receiveFor?.number ?? "" })}</h2>
					<div className="flex flex-col gap-8">
						{receiveFor?.lines.map((l, i) => (
							<div key={i} className="grid grid-cols-[1fr_100px] items-center gap-8 text-12">
								<span className="text-[#cfd4cb]">{l.name}<span className="ml-6 text-11 text-[#8c948b]">{t("purOrdered", { qty: l.qty })}</span></span>
								<input
									value={receiveForm.quantities[i] ?? ""}
									onChange={(e) => setReceiveForm({ ...receiveForm, quantities: receiveForm.quantities.map((q, j) => (j === i ? e.target.value.replace(/[^\d.]/g, "") : q)) })}
									className={input}
								/>
							</div>
						))}
					</div>
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("stockTo")}</span>
						<select value={receiveForm.warehouse} onChange={(e) => setReceiveForm({ ...receiveForm, warehouse: e.target.value })} className={input}>
							<option value="">—</option>
							{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
						</select>
					</label>
					<div className="grid grid-cols-1 gap-12 md:grid-cols-3">
						<FormField label={t("purInvoiceNumber")} value={receiveForm.invoiceNumber} onChange={(e) => setReceiveForm({ ...receiveForm, invoiceNumber: e.target.value })} maxLength={60} />
						<FormField label={t("stockColDate")} type="date" value={receiveForm.invoiceDate} onChange={(e) => setReceiveForm({ ...receiveForm, invoiceDate: e.target.value })} />
						<FormField label={t("purColDue")} type="date" value={receiveForm.dueDate} onChange={(e) => setReceiveForm({ ...receiveForm, dueDate: e.target.value })} />
					</div>
					<p className="text-11 text-[#9AA396]">{t("purInvoiceHint")}</p>
					<div className="mt-4 flex justify-end gap-10">
						<button type="button" onClick={() => setReceiveFor(null)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy !== ""} onClick={() => void receive()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("purReceive")}</button>
					</div>
				</div>
			</Modal>

			<ConfirmDialog
				open={!!cancelFor}
				onCancel={() => setCancelFor(null)}
				onConfirm={() => cancelFor && void cancelOrder(cancelFor)}
				title={t("cancel")}
				text={t("purCancelConfirm", { number: cancelFor?.number ?? "" })}
				confirmLabel={t("cancel")}
			/>
		</div>
	);
}
