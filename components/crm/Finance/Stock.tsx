"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbAlertTriangle, TbArrowBackUp, TbPlus, TbTrash } from "react-icons/tb";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import Modal from "../shared/Modal";
import { apiCall } from "@/store/crmApi";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";
import { downloadAuthed } from "./download";
import ImportWizard from "../Settings/ImportWizard";

// Склад (ТЗ §12): несколько складов, движения только документами, сторно вместо правки, отчёты
// (остатки по складам, оборотка, неликвид, ABC) и инвентаризация, расхождения которой превращаются
// в документы излишков и недостач. Остаток — сумма движений по всем складам.

interface WarehouseRow { id: string; name: string; kind: string; address: string; isDefault: boolean; archived: boolean }
interface DocLine { product: string; name: string; sku: string; unit: string; qty: number; price: number }
interface DocRow { id: string; kind: string; number: string; date: string; warehouseFrom: string; warehouseTo: string; note: string; by: string; reversed: boolean; reversalOf: string; lines: DocLine[] }
interface OnHandRow { id: string; name: string; sku: string; unit: string; total: number; byWarehouse: Record<string, number>; reorderLevel: number }
interface TurnoverRowView { product: string; name: string; sku: string; unit: string; opening: number; incoming: number; outgoing: number; closing: number }

type Section = "onhand" | "docs" | "reports";

const DOC_KINDS = ["receipt", "issue", "transfer", "writeoff", "surplus", "inventory"] as const;
type DocKind = (typeof DOC_KINDS)[number];

// Какие склады нужны каждому виду документа — от этого зависят поля окна
const NEEDS: Record<DocKind, { from?: boolean; to?: boolean }> = {
    receipt: { to: true },
    issue: { from: true },
    transfer: { from: true, to: true },
    writeoff: { from: true },
    surplus: { to: true },
    inventory: { from: true },
};

export default function Stock() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { products, loadProducts } = useFinanceStore();
	const [section, setSection] = useState<Section>("onhand");
	const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
	const [docs, setDocs] = useState<DocRow[]>([]);
	const [onHand, setOnHand] = useState<{ warehouses: Array<{ id: string; name: string }>; rows: OnHandRow[] } | null>(null);
	const [turnoverView, setTurnoverView] = useState<{ from: string; to: string; rows: TurnoverRowView[] } | null>(null);
	const [dead, setDead] = useState<Array<{ id: string; name: string; qty: number }>>([]);
	const [abc, setAbc] = useState<Array<{ product: string; name: string; sku: string; revenue: number; share: number; group: string }>>([]);
	const [busy, setBusy] = useState(false);
	// Окна: новый склад и новый документ
	const [whOpen, setWhOpen] = useState(false);
	const [whForm, setWhForm] = useState({ name: "", kind: "warehouse", address: "", isDefault: false });
	const [docOpen, setDocOpen] = useState(false);
	const [docKind, setDocKind] = useState<DocKind>("receipt");
	const [docForm, setDocForm] = useState({ date: new Date().toISOString().slice(0, 10), warehouseFrom: "", warehouseTo: "", note: "" });
	const [docLines, setDocLines] = useState<Array<{ product: string; qty: string; price: string }>>([{ product: "", qty: "1", price: "" }]);
	const [reverseFor, setReverseFor] = useState<DocRow | null>(null);

	const load = useCallback(async () => {
		const [wh, dc, oh] = await Promise.all([
			apiCall<WarehouseRow[]>("/api/warehouses"),
			apiCall<DocRow[]>("/api/stock-docs"),
			apiCall<{ warehouses: Array<{ id: string; name: string }>; rows: OnHandRow[] }>("/api/stock?kind=on-hand"),
		]);
		if (wh.ok && wh.data) setWarehouses(wh.data);
		if (dc.ok && dc.data) setDocs(dc.data);
		if (oh.ok && oh.data) setOnHand(oh.data);
	}, []);
	useEffect(() => { void load(); loadProducts(); }, [load, loadProducts]);

	const goods = useMemo(() => products.filter((p) => p.type === "good" && !p.archived), [products]);
	const defaults = useMemo(() => suppliersDefault(warehouses), [warehouses]);

	async function loadReports() {
		const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
		const to = new Date().toISOString().slice(0, 10);
		const [tv, dd, ab] = await Promise.all([
			apiCall<{ from: string; to: string; rows: TurnoverRowView[] }>(`/api/stock?kind=turnover&from=${from}&to=${to}`),
			apiCall<{ rows: Array<{ id: string; name: string; qty: number }> }>("/api/stock?kind=dead"),
			apiCall<{ rows: Array<{ product: string; name: string; sku: string; revenue: number; share: number; group: string }> }>("/api/stock?kind=abc"),
		]);
		if (tv.ok && tv.data) setTurnoverView(tv.data);
		if (dd.ok && dd.data) setDead(dd.data.rows);
		if (ab.ok && ab.data) setAbc(ab.data.rows);
	}
	useEffect(() => { if (section === "reports") void loadReports(); }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

	async function saveWarehouse() {
		setBusy(true);
		const res = await apiCall<WarehouseRow>("/api/warehouses", "POST", whForm);
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("stockSaved"));
		setWhOpen(false);
		void load();
	}

	async function saveDoc() {
		const lines = docLines.filter((l) => l.product && Number(l.qty) > 0).map((l) => ({ product: l.product, qty: Number(l.qty), price: Number(l.price) || 0 }));
		if (!lines.length) return void toast.error(t("stockNoLines"));
		setBusy(true);
		const res = await apiCall<{ number: string }>("/api/stock-docs", "POST", { kind: docKind, ...docForm, lines });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("stockDocPosted", { number: res.data?.number ?? "" }));
		setDocOpen(false);
		setDocLines([{ product: "", qty: "1", price: "" }]);
		void load();
	}

	async function reverse(doc: DocRow) {
		setReverseFor(null);
		setBusy(true);
		const res = await apiCall("/api/stock-docs/" + doc.id + "/reverse", "POST", {});
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("stockReversed"));
		void load();
	}

	const input = "fs-field h-36 w-full px-10 text-12 outline-none";
	const [importOpen, setImportOpen] = useState(false);

	return (
		<div className="flex flex-col gap-16">
			{/* Импорт/экспорт остатков (ТЗ §17): мастер открывается окном здесь же, без ухода в настройки */}
			<div className="mb-12 flex flex-wrap items-center gap-8">
				<button type="button" onClick={() => setImportOpen(true)} className="fs-btn fs-btn-ghost h-32 text-12">{t("stockImport")}</button>
				<button type="button" onClick={() => void downloadAuthed("/api/export?kind=products&format=csv", "products.csv", t("pdfFailed"))} className="fs-btn fs-btn-ghost h-32 text-12">{t("stockExportCsv")}</button>
				<button type="button" onClick={() => void downloadAuthed("/api/stock?kind=on-hand&format=csv", "stock-on-hand.csv", t("pdfFailed"))} className="fs-btn fs-btn-ghost h-32 text-12">{t("stockExportOnHand")}</button>
			</div>
			<Modal open={importOpen} onClose={() => setImportOpen(false)} label={t("stockImport")} className="w-full max-w-[920px]">
				<div className="fs-popover fs-scroll max-h-[calc(100vh-32px)] overflow-y-auto p-16 md:p-20">
					{importOpen && <ImportWizard kind="stock" embedded />}
				</div>
			</Modal>
			{/* Разделы склада: остатки, документы, отчёты */}
			<div className="flex flex-wrap gap-8">
				{(["onhand", "docs", "reports"] as Section[]).map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => setSection(s)}
						className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${section === s ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
						{t(`stockTab_${s}`)}
					</button>
				))}
			</div>

			{section === "onhand" && (
				<>
					<section className="fs-card p-16 md:p-20">
						<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
							<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("stockWarehouses")}</h3>
							<button type="button" onClick={() => { setWhForm({ name: "", kind: "warehouse", address: "", isDefault: warehouses.length === 0 }); setWhOpen(true); }} className="fs-btn fs-btn-ghost h-34">
								<TbPlus size={14} /> {t("stockAddWarehouse")}
							</button>
						</div>
						{warehouses.length === 0 ? (
							<p className="text-12 text-[#8c948b]">{t("stockNoWarehouses")}</p>
						) : (
							<ul className="flex flex-wrap gap-8">
								{warehouses.filter((w) => !w.archived).map((w) => (
									<li key={w.id} className="rounded-10 border border-inkLine px-12 py-8 text-12 text-[#cfd4cb]">
										<span className="text-[#f1f4ee]">{w.name}</span>
										<span className="ml-8 text-11 text-[#8c948b]">{t(`stockKind_${w.kind}`)}{w.isDefault ? ` · ${t("stockDefault")}` : ""}</span>
									</li>
								))}
							</ul>
						)}
					</section>
					<section className="fs-card overflow-x-auto p-16 md:p-20">
						<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("stockOnHand")}</h3>
						{!onHand || onHand.rows.length === 0 ? (
							<p className="text-12 text-[#8c948b]">{t("stockEmpty")}</p>
						) : (
							<table className="w-full min-w-[560px] text-12">
								<thead>
									<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
										<th className="pb-6 font-medium">{t("stockColProduct")}</th>
										{onHand.warehouses.map((w) => <th key={w.id} className="pb-6 text-right font-medium">{w.name}</th>)}
										<th className="pb-6 text-right font-medium">{t("stockColTotal")}</th>
									</tr>
								</thead>
								<tbody>
									{onHand.rows.map((r) => (
										<tr key={r.id} className="border-t border-inkLine text-[#cfd4cb]">
											<td className="py-7 text-[#f1f4ee]">{r.name}<span className="ml-6 text-11 text-[#8c948b]">{r.sku}</span>
												{r.reorderLevel > 0 && r.total < r.reorderLevel && (
													<span className="ml-8 inline-flex items-center gap-4 text-11 text-[#F4A100]"><TbAlertTriangle size={11} /> {t("stockBelowMin")}</span>
												)}
											</td>
											{onHand.warehouses.map((w) => <td key={w.id} className="py-7 text-right">{r.byWarehouse[w.id] ?? 0}</td>)}
											<td className="py-7 text-right font-medium text-[#f1f4ee]">{r.total} {r.unit}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</section>
				</>
			)}

			{section === "docs" && (
				<section className="fs-card overflow-x-auto p-16 md:p-20">
					<div className="mb-12 flex flex-wrap items-center justify-between gap-10">
						<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("stockDocs")}</h3>
						<button type="button" onClick={() => { setDocForm({ ...docForm, warehouseFrom: defaults.from, warehouseTo: defaults.to }); setDocOpen(true); }} className="fs-btn fs-btn-ghost h-34">
							<TbPlus size={14} /> {t("stockNewDoc")}
						</button>
					</div>
					{docs.length === 0 ? (
						<p className="text-12 text-[#8c948b]">{t("stockNoDocs")}</p>
					) : (
						<table className="w-full min-w-[720px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-6 font-medium">{t("stockColNumber")}</th>
									<th className="pb-6 font-medium">{t("stockColKind")}</th>
									<th className="pb-6 font-medium">{t("stockColRoute")}</th>
									<th className="pb-6 font-medium">{t("stockColLines")}</th>
									<th className="pb-6 font-medium">{t("stockColDate")}</th>
									<th className="pb-6" />
								</tr>
							</thead>
							<tbody>
								{docs.map((d) => (
									<tr key={d.id} className={`border-t border-inkLine text-[#cfd4cb] ${d.reversed ? "opacity-50" : ""}`}>
										<td className="py-7 text-[#f1f4ee]">{d.number}</td>
										<td className="py-7">{t(`stockDoc_${d.kind}`)}{d.reversalOf ? ` · ${t("stockReversalMark")}` : ""}</td>
										<td className="py-7">{[d.warehouseFrom, d.warehouseTo].filter(Boolean).join(" → ")}</td>
										<td className="py-7">{d.lines.slice(0, 3).map((l) => `${l.name} ${l.qty}`).join(", ")}{d.lines.length > 3 ? " …" : ""}</td>
										<td className="py-7">{d.date}</td>
										<td className="py-7 text-right">
											{!d.reversed && !d.reversalOf && (
												<button type="button" disabled={busy} onClick={() => setReverseFor(d)} className="fs-btn fs-btn-ghost h-28 disabled:opacity-50">
													<TbArrowBackUp size={12} /> {t("stockReverse")}
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

			{section === "reports" && (
				<>
					<section className="fs-card overflow-x-auto p-16 md:p-20">
						<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("stockTurnover", { from: turnoverView?.from ?? "", to: turnoverView?.to ?? "" })}</h3>
						{!turnoverView || turnoverView.rows.length === 0 ? (
							<p className="text-12 text-[#8c948b]">{t("stockEmpty")}</p>
						) : (
							<table className="w-full min-w-[560px] text-12">
								<thead>
									<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
										<th className="pb-6 font-medium">{t("stockColProduct")}</th>
										<th className="pb-6 text-right font-medium">{t("stockOpening")}</th>
										<th className="pb-6 text-right font-medium">{t("stockIncoming")}</th>
										<th className="pb-6 text-right font-medium">{t("stockOutgoing")}</th>
										<th className="pb-6 text-right font-medium">{t("stockClosing")}</th>
									</tr>
								</thead>
								<tbody>
									{turnoverView.rows.map((r) => (
										<tr key={r.product} className="border-t border-inkLine text-[#cfd4cb]">
											<td className="py-7 text-[#f1f4ee]">{r.name}<span className="ml-6 text-11 text-[#8c948b]">{r.sku}</span></td>
											<td className="py-7 text-right">{r.opening}</td>
											<td className="py-7 text-right text-[#2DDEB6]">+{r.incoming}</td>
											<td className="py-7 text-right text-[#F4A100]">−{r.outgoing}</td>
											<td className="py-7 text-right font-medium text-[#f1f4ee]">{r.closing}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</section>
					<div className="grid grid-cols-1 gap-16 xl:grid-cols-2">
						<section className="fs-card p-16 md:p-20">
							<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("stockDead")}</h3>
							{dead.length === 0 ? <p className="text-12 text-[#8c948b]">{t("stockNoDead")}</p> : (
								<ul className="flex flex-col gap-6 text-12 text-[#cfd4cb]">
									{dead.slice(0, 10).map((d) => <li key={d.id}>{d.name} · {d.qty} {t("stockPcs")}</li>)}
								</ul>
							)}
						</section>
						<section className="fs-card p-16 md:p-20">
							<h3 className="mb-10 text-14 font-semibold text-[#f1f4ee]">{t("stockAbc")}</h3>
							{abc.length === 0 ? <p className="text-12 text-[#8c948b]">{t("stockEmpty")}</p> : (
								<ul className="flex flex-col gap-6 text-12 text-[#cfd4cb]">
									{abc.slice(0, 10).map((r) => (
										<li key={r.product} className="flex justify-between gap-10">
											<span>{r.group} · {r.name}</span>
											<span className="text-[#8c948b]">{money(r.revenue, "UAH", locale)} · {r.share}%</span>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>
				</>
			)}

			{/* Новый склад */}
			<Modal open={whOpen} onClose={() => setWhOpen(false)} label={t("stockAddWarehouse")} className="w-full max-w-[460px]">
				<div className="fs-popover flex flex-col gap-12 p-20">
					<h2 className="text-15 font-semibold text-[#f1f4ee]">{t("stockAddWarehouse")}</h2>
					<FormField label={t("stockWhName")} value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} maxLength={80} autoFocus />
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("stockWhKind")}</span>
						<select value={whForm.kind} onChange={(e) => setWhForm({ ...whForm, kind: e.target.value })} className="fs-field h-40 w-full px-12 text-13 outline-none">
							{["warehouse", "store", "transit"].map((k) => <option key={k} value={k}>{t(`stockKind_${k}`)}</option>)}
						</select>
					</label>
					<FormField label={t("stockWhAddress")} value={whForm.address} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} maxLength={200} />
					<label className="flex items-center gap-10 text-13 text-[#cfd4cb]">
						<input type="checkbox" checked={whForm.isDefault} onChange={(e) => setWhForm({ ...whForm, isDefault: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
						{t("stockDefault")}
					</label>
					<div className="mt-4 flex justify-end gap-10">
						<button type="button" onClick={() => setWhOpen(false)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy || !whForm.name.trim()} onClick={() => void saveWarehouse()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("save")}</button>
					</div>
				</div>
			</Modal>

			{/* Новый документ склада */}
			<Modal open={docOpen} onClose={() => setDocOpen(false)} label={t("stockNewDoc")} className="w-full max-w-[640px]">
				<div className="fs-popover flex max-h-[calc(100dvh-32px)] flex-col p-20">
					<h2 className="mb-12 text-15 font-semibold text-[#f1f4ee]">{t("stockNewDoc")}</h2>
					<div className="fs-scroll min-h-0 flex-1 overflow-y-auto pr-4">
						<label className="mb-12 block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("stockColKind")}</span>
							<select value={docKind} onChange={(e) => setDocKind(e.target.value as DocKind)} className="fs-field h-40 w-full px-12 text-13 outline-none">
								{DOC_KINDS.map((k) => <option key={k} value={k}>{t(`stockDoc_${k}`)}</option>)}
							</select>
						</label>
						<div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-3">
							{NEEDS[docKind].from && (
								<label className="block">
									<span className="mb-6 block text-12 text-[#8c948b]">{t("stockFrom")}</span>
									<select value={docForm.warehouseFrom} onChange={(e) => setDocForm({ ...docForm, warehouseFrom: e.target.value })} className={input}>
										<option value="">—</option>
										{warehouses.filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
									</select>
								</label>
							)}
							{NEEDS[docKind].to && (
								<label className="block">
									<span className="mb-6 block text-12 text-[#8c948b]">{t("stockTo")}</span>
									<select value={docForm.warehouseTo} onChange={(e) => setDocForm({ ...docForm, warehouseTo: e.target.value })} className={input}>
										<option value="">—</option>
										{warehouses.filter((w) => !w.archived).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
									</select>
								</label>
							)}
							<FormField label={t("stockColDate")} type="date" value={docForm.date} onChange={(e) => setDocForm({ ...docForm, date: e.target.value })} />
						</div>
						<span className="mb-6 block text-12 text-[#8c948b]">{t("stockColLines")}</span>
						<div className="flex flex-col gap-8">
							{docLines.map((line, i) => (
								<div key={i} className="grid grid-cols-[1fr_90px_110px_32px] items-center gap-8">
									<select value={line.product} onChange={(e) => setDocLines(docLines.map((l, j) => (j === i ? { ...l, product: e.target.value } : l)))} className={input}>
										<option value="">—</option>
										{goods.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` · ${p.sku}` : ""}</option>)}
									</select>
									<input value={line.qty} onChange={(e) => setDocLines(docLines.map((l, j) => (j === i ? { ...l, qty: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("stockQty")} className={input} />
									<input value={line.price} onChange={(e) => setDocLines(docLines.map((l, j) => (j === i ? { ...l, price: e.target.value.replace(/[^\d.]/g, "") } : l)))} placeholder={t("stockPrice")} className={input} />
									<button type="button" onClick={() => setDocLines(docLines.length > 1 ? docLines.filter((_, j) => j !== i) : docLines)} className="text-[#8c948b] transition-colors hover:text-danger" aria-label={t("delete")}>
										<TbTrash size={15} />
									</button>
								</div>
							))}
							<button type="button" onClick={() => setDocLines([...docLines, { product: "", qty: "1", price: "" }])} className="fs-link text-left">{t("stockAddLine")}</button>
						</div>
						<FormField label={t("stockNote")} value={docForm.note} onChange={(e) => setDocForm({ ...docForm, note: e.target.value })} maxLength={500} className="mt-12" />
						{docKind === "inventory" && <p className="mt-8 text-11 text-[#9AA396]">{t("stockInventoryHint")}</p>}
					</div>
					<div className="mt-16 flex justify-end gap-10">
						<button type="button" onClick={() => setDocOpen(false)} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
						<button type="button" disabled={busy} onClick={() => void saveDoc()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("stockPost")}</button>
					</div>
				</div>
			</Modal>

			<ConfirmDialog
				open={!!reverseFor}
				onCancel={() => setReverseFor(null)}
				onConfirm={() => reverseFor && void reverse(reverseFor)}
				title={t("stockReverse")}
				text={t("stockReverseConfirm", { number: reverseFor?.number ?? "" })}
				confirmLabel={t("stockReverse")}
			/>
		</div>
	);
}

// Склады по умолчанию для окна документа: явный «по умолчанию» или первый в списке
function suppliersDefault(warehouses: WarehouseRow[]): { from: string; to: string } {
    const active = warehouses.filter((w) => !w.archived);
    const def = active.find((w) => w.isDefault) ?? active[0];
    return { from: def?.id ?? "", to: def?.id ?? "" };
}
