"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbAlertTriangle, TbPlayerPlay, TbPlus, TbTrash, TbX } from "react-icons/tb";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import Modal from "../shared/Modal";
import { apiCall } from "@/store/crmApi";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";

// Виробництво (ТЗ §13): спецификации (в т.ч. многоуровневые), производственные заказы
// (план → запуск → випуск) и потребность в материалах (MRP). Себестоимость собирается по факту:
// материалы по средней цене склада, труд по фактическому времени, накладные процентом от труда.

interface ComponentRow { product: string; name: string; sku: string; unit: string; qty: number; wastePercent: number; optional: boolean }
interface OperationRow { name: string; minutes: number; costPerHour: number; workCenter: string }
interface BomRowView { id: string; product: string; productName: string; productUnit: string; version: number; active: boolean; overheadPercent: number; components: ComponentRow[]; operations: OperationRow[]; outputs: Array<{ product: string; name: string; qty: number }> }
interface ProdOrderRow {
	id: string; number: string; product: string; productName: string; planQty: number; producedQty: number; scrapQty: number;
	status: string; due: string; warehouseMaterials: string; warehouseOutput: string;
	costs: { materials: number; labor: number; overhead: number; total: number }; planCost: number;
	materials: Array<{ product: string; name: string; unit: string; qty: number; usedQty: number; unitCost: number }>;
	operations: Array<{ name: string; minutes: number; actualMinutes: number; costPerHour: number }>;
}
interface MrpRowView { product: string; name: string; sku: string; unit: string; required: number; inStock: number; toBuy: number }

type Section = "boms" | "orders" | "mrp";
const STATUS_COLOR: Record<string, string> = { plan: "#8c948b", launched: "#5EA8F5", done: "#2DDEB6", cancelled: "#eb5757" };

export default function Production() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { products, loadProducts, settings } = useFinanceStore();
	const [section, setSection] = useState<Section>("orders");
	const [boms, setBoms] = useState<BomRowView[]>([]);
	const [orders, setOrders] = useState<ProdOrderRow[]>([]);
	const [mrp, setMrp] = useState<MrpRowView[]>([]);
	const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
	const [busy, setBusy] = useState("");

	const [bomOpen, setBomOpen] = useState(false);
	const [bomForm, setBomForm] = useState({ product: "", overheadPercent: "0" });
	const [bomComponents, setBomComponents] = useState<Array<{ product: string; qty: string; wastePercent: string }>>([{ product: "", qty: "1", wastePercent: "0" }]);
	const [bomOperations, setBomOperations] = useState<Array<{ name: string; minutes: string; costPerHour: string }>>([]);
	const [poOpen, setPoOpen] = useState(false);
	const [poForm, setPoForm] = useState({ product: "", qty: "1", warehouseMaterials: "", warehouseOutput: "", due: "", note: "" });
	const [outputFor, setOutputFor] = useState<ProdOrderRow | null>(null);
	const [outputForm, setOutputForm] = useState({ qty: "", scrapQty: "0", actualMinutes: "" });
	const [cancelFor, setCancelFor] = useState<ProdOrderRow | null>(null);

	const load = useCallback(async () => {
		const [b, o, wh, m] = await Promise.all([
			apiCall<BomRowView[]>("/api/boms"),
			apiCall<ProdOrderRow[]>("/api/production-orders"),
			apiCall<Array<{ id: string; name: string }>>("/api/warehouses"),
			apiCall<{ rows: MrpRowView[] }>("/api/production/mrp"),
		]);
		if (b.ok && b.data) setBoms(b.data);
		if (o.ok && o.data) setOrders(o.data);
		if (wh.ok && wh.data) setWarehouses(wh.data);
		if (m.ok && m.data) setMrp(m.data.rows);
	}, []);
	useEffect(() => { void load(); loadProducts(); }, [load, loadProducts]);
	useEffect(() => { if (section === "mrp") void apiCall<{ rows: MrpRowView[] }>("/api/production/mrp").then((r) => r.ok && r.data && setMrp(r.data.rows)); }, [section]);

	const goods = useMemo(() => products.filter((p) => !p.archived), [products]);
	const input = "fs-field h-36 w-full px-10 text-12 outline-none";

	async function saveBom() {
		const components = bomComponents.filter((c) => c.product && Number(c.qty) > 0).map((c) => ({ product: c.product, qty: Number(c.qty), wastePercent: Number(c.wastePercent) || 0 }));
		const operations = bomOperations.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), minutes: Number(o.minutes) || 0, costPerHour: Number(o.costPerHour) || 0 }));
		if (!bomForm.product) return void toast.error(t("prodPickProduct"));
		if (!components.length && !operations.length) return void toast.error(t("prodBomEmpty"));
		setBusy("bom");
		const res = await apiCall("/api/boms", "POST", { product: bomForm.product, components, operations, overheadPercent: Number(bomForm.overheadPercent) || 0 });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("saved"));
		setBomOpen(false);
		void load();
	}

	async function createOrder() {
		if (!poForm.product) return void toast.error(t("prodPickProduct"));
		setBusy("po");
		const res = await apiCall<{ number: string; planCost: number }>("/api/production-orders", "POST", { ...poForm, qty: Number(poForm.qty) || 0 });
		setBusy("");
		if (!res.ok || !res.data) return void toast.error(res.message);
		toast.success(t("prodOrderCreated", { number: res.data.number, cost: res.data.planCost.toFixed(2) }));
		setPoOpen(false);
		void load();
	}

	async function launch(order: ProdOrderRow) {
		setBusy(order.id);
		const res = await apiCall(`/api/production-orders/${order.id}`, "POST", { action: "launch" });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("prodLaunched"));
		void load();
	}

	async function output() {
		if (!outputFor) return;
		setBusy("output");
		const res = await apiCall<{ unitCost: number }>(`/api/production-orders/${outputFor.id}`, "POST", {
			action: "output",
			qty: Number(outputForm.qty) || 0,
			scrapQty: Number(outputForm.scrapQty) || 0,
			actualMinutes: Number(outputForm.actualMinutes) || 0,
		});
		setBusy("");
		if (!res.ok || !res.data) return void toast.error(res.message);
		toast.success(t("prodOutputDone", { unit: res.data.unitCost.toFixed(2) }));
		setOutputFor(null);
		void load();
	}

	async function cancel(order: ProdOrderRow) {
		setCancelFor(null);
		setBusy(order.id);
		const res = await apiCall(`/api/production-orders/${order.id}`, "POST", { action: "cancel" });
		setBusy("");
		if (!res.ok) return void toast.error(res.message);
		void load();
	}

	return (
		<div className="flex flex-col gap-16">
			<div className="flex flex-wrap gap-8">
				{(["orders", "boms", "mrp"] as Section[]).map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => setSection(s)}
						className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${section === s ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
						{t(`prodTab_${s}`)}
					</button>
				))}
			</div>

			{section === "orders" && (
				<section className="fs-card overflow-x-auto p-16 md:p-20">
					<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("prodOrders")}</h3>
						<button type="button" disabled={!boms.length} onClick={() => { setPoForm({ ...poForm, product: boms[0]?.product ?? "", warehouseMaterials: warehouses[0]?.id ?? "", warehouseOutput: warehouses[0]?.id ?? "" }); setPoOpen(true); }} className="fs-btn fs-btn-ghost h-34 disabled:opacity-50">
							<TbPlus size={14} /> {t("prodNewOrder")}
						</button>
					</div>
					{orders.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{boms.length ? t("prodNoOrders") : t("prodNoBomsFirst")}</p>
					) : (
						<table className="w-full min-w-[760px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-6 font-medium">{t("stockColNumber")}</th>
									<th className="pb-6 font-medium">{t("prodColProduct")}</th>
									<th className="pb-6 font-medium">{t("prodColPlan")}</th>
									<th className="pb-6 font-medium">{t("stockColKind")}</th>
									<th className="pb-6 text-right font-medium">{t("prodPlanCost")}</th>
									<th className="pb-6 text-right font-medium">{t("prodFactCost")}</th>
									<th className="pb-6" />
								</tr>
							</thead>
							<tbody>
								{orders.map((o) => (
									<tr key={o.id} className="border-t border-inkLine text-[#cfd4cb]">
										<td className="py-7 text-[#f1f4ee]">{o.number}<span className="ml-6 text-11 text-[#8c948b]">{o.due}</span></td>
										<td className="py-7">{o.productName}</td>
										<td className="py-7">{o.producedQty}/{o.planQty}{o.scrapQty ? ` · ${t("prodScrap")} ${o.scrapQty}` : ""}</td>
										<td className="py-7"><span style={{ color: STATUS_COLOR[o.status] ?? "#8c948b" }}>{t(`prodStatus_${o.status}`)}</span></td>
										<td className="py-7 text-right">{money(o.planCost, settings?.currency ?? "EUR", locale)}</td>
										<td className="py-7 text-right">{money(o.costs?.total ?? 0, settings?.currency ?? "EUR", locale)}</td>
										<td className="py-7">
											<div className="flex items-center justify-end gap-6">
												{o.status === "plan" && (
													<button type="button" disabled={busy !== ""} onClick={() => void launch(o)} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
														<TbPlayerPlay size={13} /> {t("prodLaunch")}
													</button>
												)}
												{(o.status === "launched" || o.status === "plan") && (
													<button type="button" disabled={busy !== ""} onClick={() => { setOutputFor(o); setOutputForm({ qty: String(Math.max(0, o.planQty - o.producedQty)), scrapQty: "0", actualMinutes: "" }); }} className="fs-btn fs-btn-ghost h-30 disabled:opacity-50">
														{t("prodOutput")}
													</button>
												)}
												{o.status !== "done" && o.status !== "cancelled" && (
													<button type="button" disabled={busy !== ""} onClick={() => setCancelFor(o)} aria-label={t("cancel")} className="text-[#9AA396] transition-colors hover:text-danger disabled:opacity-50">
														<TbX size={14} />
													</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			)}

			{section === "boms" && (
				<section className="fs-card p-16 md:p-20">
					<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("prodBoms")}</h3>
						<button type="button" onClick={() => { setBomForm({ product: goods[0]?.id ?? "", overheadPercent: "0" }); setBomComponents([{ product: "", qty: "1", wastePercent: "0" }]); setBomOperations([]); setBomOpen(true); }} className="fs-btn fs-btn-ghost h-34">
							<TbPlus size={14} /> {t("prodNewBom")}
						</button>
					</div>
					{boms.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{t("prodNoBoms")}</p>
					) : (
						<ul className="flex flex-col gap-10">
							{boms.filter((b) => b.active).map((b) => (
								<li key={b.id} className="border-t border-inkLine pt-8">
									<div className="flex flex-wrap items-center justify-between gap-10 text-13">
										<span className="text-[#f1f4ee]">{b.productName}<span className="ml-6 text-11 text-[#8c948b]">v{b.version} · {t("prodOverhead")} {b.overheadPercent}%</span></span>
										<button type="button" onClick={() => { setBomForm({ product: b.product, overheadPercent: String(b.overheadPercent) }); setBomComponents(b.components.map((c) => ({ product: c.product, qty: String(c.qty), wastePercent: String(c.wastePercent) }))); setBomOperations(b.operations.map((o) => ({ name: o.name, minutes: String(o.minutes), costPerHour: String(o.costPerHour) }))); setBomOpen(true); }} className="fs-link">
											{t("edit")}
										</button>
									</div>
									<p className="mt-4 text-11 text-[#8c948b]">
										{b.components.map((c) => `${c.name} × ${c.qty}${c.wastePercent ? ` (+${c.wastePercent}%)` : ""}`).join(" · ")}
										{b.operations.length ? ` · ${b.operations.map((o) => `${o.name} ${o.minutes} ${t("prodMin")}`).join(", ")}` : ""}
									</p>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{section === "mrp" && (
				<section className="fs-card overflow-x-auto p-16 md:p-20">
					<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("prodMrp")}</h3>
					{mrp.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{t("prodNoNeeds")}</p>
					) : (
						<table className="w-full min-w-[560px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-6 font-medium">{t("stockColProduct")}</th>
									<th className="pb-6 text-right font-medium">{t("prodRequired")}</th>
									<th className="pb-6 text-right font-medium">{t("prodInStock")}</th>
									<th className="pb-6 text-right font-medium">{t("prodToBuy")}</th>
								</tr>
							</thead>
							<tbody>
								{mrp.map((r) => (
									<tr key={r.product} className="border-t border-inkLine text-[#cfd4cb]">
										<td className="py-7 text-[#f1f4ee]">{r.name}<span className="ml-6 text-11 text-[#8c948b]">{r.sku}</span></td>
										<td className="py-7 text-right">{r.required} {r.unit}</td>
										<td className="py-7 text-right">{r.inStock}</td>
										<td className={`py-7 text-right font-medium ${r.toBuy > 0 ? "text-[#F4A100]" : "text-[#2DDEB6]"}`}>{r.toBuy > 0 ? `${r.toBuy} ${r.unit}` : "✓"}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			)}

			{/* Спецификация: состав, нормы расхода, операции */}
			<Modal open={bomOpen} onClose={() => setBomOpen(false)} label={t("prodNewBom")} className="w-full max-w-[680px]">
				<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col p-20">
					<h2 className="mb-12 text-15 font-semibold text-[#f1f4ee]">{t("prodBomTitle")}</h2>
					<div className="fs-scroll min-h-0 flex-1 overflow-y-auto pr-4">
						<div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-2">
							<label className="block">
								<span className="mb-6 block text-12 text-[#8c948b]">{t("prodColProduct")}</span>
								<select value={bomForm.product} onChange={(e) => setBomForm({ ...bomForm, product: e.target.value })} className={input}>
									{goods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
								</select>
							</label>
							<FormField label={t("prodOverhead")} value={bomForm.overheadPercent} onChange={(e) => setBomForm({ ...bomForm, overheadPercent: e.target.value.replace(/[^\d.]/g, "") })} maxLength={5} />
						</div>
						<span className="mb-6 block text-12 text-[#8c948b]">{t("prodComponents")}</span>
						<div className="flex flex-col gap-8">
							{bomComponents.map((line, i) => (
								<div key={i} className="grid grid-cols-[1fr_80px_80px_32px] items-center gap-8">
									<select value={line.product} onChange={(e) => setBomComponents(bomComponents.map((l, j) => (j === i ? { ...l, product: e.target.value } : l)))} className={input}>
										<option value="">—</option>
										{goods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
									</select>
									<input value={line.qty} onChange={(e) => setBomComponents(bomComponents.map((l, j) => (j === i ? { ...l, qty: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("stockQty")} className={input} />
									<input value={line.wastePercent} onChange={(e) => setBomComponents(bomComponents.map((l, j) => (j === i ? { ...l, wastePercent: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("prodWaste")} className={input} />
									<button type="button" onClick={() => setBomComponents(bomComponents.length > 1 ? bomComponents.filter((_, j) => j !== i) : bomComponents)} aria-label={t("delete")} className="text-[#8c948b] transition-colors hover:text-danger">
										<TbTrash size={14} />
									</button>
								</div>
							))}
							<button type="button" onClick={() => setBomComponents([...bomComponents, { product: "", qty: "1", wastePercent: "0" }])} className="fs-link text-left">{t("stockAddLine")}</button>
						</div>
						<span className="mb-6 mt-14 block text-12 text-[#8c948b]">{t("prodOperations")}</span>
						<div className="flex flex-col gap-8">
							{bomOperations.map((line, i) => (
								<div key={i} className="grid grid-cols-[1fr_80px_100px_32px] items-center gap-8">
									<input value={line.name} onChange={(e) => setBomOperations(bomOperations.map((l, j) => (j === i ? { ...l, name: e.target.value } : l)))} placeholder={t("prodOperationName")} className={input} />
									<input value={line.minutes} onChange={(e) => setBomOperations(bomOperations.map((l, j) => (j === i ? { ...l, minutes: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("prodMin")} className={input} />
									<input value={line.costPerHour} onChange={(e) => setBomOperations(bomOperations.map((l, j) => (j === i ? { ...l, costPerHour: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("prodCostPerHour")} className={input} />
									<button type="button" onClick={() => setBomOperations(bomOperations.filter((_, j) => j !== i))} aria-label={t("delete")} className="text-[#8c948b] transition-colors hover:text-danger">
										<TbTrash size={14} />
									</button>
								</div>
							))}
							<button type="button" onClick={() => setBomOperations([...bomOperations, { name: "", minutes: "0", costPerHour: "0" }])} className="fs-link text-left">{t("prodAddOperation")}</button>
						</div>
					</div>
					<div className="mt-16 flex justify-end gap-10">
						<button type="button" onClick={() => setBomOpen(false)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy !== ""} onClick={() => void saveBom()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("save")}</button>
					</div>
				</div>
			</Modal>

			{/* Новый производственный заказ */}
			<Modal open={poOpen} onClose={() => setPoOpen(false)} label={t("prodNewOrder")} className="w-full max-w-[520px]">
				<div className="fs-popover flex flex-col gap-12 p-20">
					<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("prodNewOrder")}</h2>
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("prodColProduct")}</span>
						<select value={poForm.product} onChange={(e) => setPoForm({ ...poForm, product: e.target.value })} className="fs-field h-40 w-full px-12 text-13 outline-none">
							{boms.filter((b) => b.active).map((b) => <option key={b.id} value={b.product}>{b.productName}</option>)}
						</select>
					</label>
					<div className="grid grid-cols-2 gap-12">
						<FormField label={t("stockQty")} value={poForm.qty} onChange={(e) => setPoForm({ ...poForm, qty: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
						<FormField label={t("purExpected")} type="date" value={poForm.due} onChange={(e) => setPoForm({ ...poForm, due: e.target.value })} />
					</div>
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("prodMaterialsFrom")}</span>
						<select value={poForm.warehouseMaterials} onChange={(e) => setPoForm({ ...poForm, warehouseMaterials: e.target.value })} className="fs-field h-40 w-full px-12 text-13 outline-none">
							<option value="">—</option>
							{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
						</select>
					</label>
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("prodOutputTo")}</span>
						<select value={poForm.warehouseOutput} onChange={(e) => setPoForm({ ...poForm, warehouseOutput: e.target.value })} className="fs-field h-40 w-full px-12 text-13 outline-none">
							<option value="">—</option>
							{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
						</select>
					</label>
					<FormField label={t("stockNote")} value={poForm.note} onChange={(e) => setPoForm({ ...poForm, note: e.target.value })} maxLength={600} />
					<div className="mt-4 flex justify-end gap-10">
						<button type="button" onClick={() => setPoOpen(false)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy !== ""} onClick={() => void createOrder()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("prodCreateOrder")}</button>
					</div>
				</div>
			</Modal>

			{/* Выпуск: количество, брак, фактические минуты */}
			<Modal open={!!outputFor} onClose={() => setOutputFor(null)} label={t("prodOutput")} className="w-full max-w-[480px]">
				<div className="fs-popover flex flex-col gap-12 p-20">
					<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("prodOutputTitle", { number: outputFor?.number ?? "" })}</h2>
					<div className="grid grid-cols-2 gap-12">
						<FormField label={t("stockQty")} value={outputForm.qty} onChange={(e) => setOutputForm({ ...outputForm, qty: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
						<FormField label={t("prodScrap")} value={outputForm.scrapQty} onChange={(e) => setOutputForm({ ...outputForm, scrapQty: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
					</div>
					<FormField label={t("prodActualMinutes")} value={outputForm.actualMinutes} onChange={(e) => setOutputForm({ ...outputForm, actualMinutes: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
					<p className="flex items-start gap-8 text-11 leading-[1.5] text-[#9AA396]">
						<TbAlertTriangle size={13} className="mt-[2px] shrink-0" /> {t("prodOutputHint")}
					</p>
					<div className="mt-4 flex justify-end gap-10">
						<button type="button" onClick={() => setOutputFor(null)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy !== ""} onClick={() => void output()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("prodOutput")}</button>
					</div>
				</div>
			</Modal>

			<ConfirmDialog
				open={!!cancelFor}
				onCancel={() => setCancelFor(null)}
				onConfirm={() => cancelFor && void cancel(cancelFor)}
				title={t("cancel")}
				text={t("prodCancelConfirm", { number: cancelFor?.number ?? "" })}
				confirmLabel={t("cancel")}
			/>
		</div>
	);
}
