"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbAlertTriangle, TbArrowBackUp, TbPencil, TbPrinter, TbPlus, TbTrash } from "react-icons/tb";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import SearchBox from "../shared/SearchBox";
import Modal from "../shared/Modal";
import { apiCall } from "@/store/crmApi";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";
import { downloadAuthed } from "./download";
import ImportWizard from "../Settings/ImportWizard";

// Склад (ТЗ §12): несколько складов, движения только документами, сторно вместо правки, отчёты
// (остатки по складам, оборотка, неликвид, ABC) и инвентаризация, расхождения которой превращаются
// в движения излишков и недостач. Остаток — сумма движений по всем складам.
//
// Склады — это фильтр: нажатие на склад показывает остатки именно по нему, «Усі склади» — по всем
// сразу (раньше список складов был текстом и выглядел неработающими кнопками). Документ открывается
// кликом: видно строки, движения и сторно, печатается PDF-ом, а «Скасувати та виправити» проводит
// сторно и открывает форму с теми же строками — правка проведённого документа противоречит правилу
// «ошибку исправляет сторно, а не правка».

interface WarehouseRow { id: string; name: string; kind: string; address: string; isDefault: boolean; archived: boolean }
interface DocLine { product: string; name: string; sku: string; unit: string; qty: number; price: number; diff: number }
interface DocRow { id: string; kind: string; number: string; date: string; warehouseFrom: string; warehouseTo: string; note: string; by: string; reversed: boolean; reversalOf: string; lines: DocLine[] }
interface DocDetail extends DocRow {
	warehouseFromId: string;
	warehouseToId: string;
	reversalNumber: string;
	reversalOfNumber: string;
	movements: Array<{ id: string; product: string; name: string; qty: number; reason: string; unitCost: number; warehouse: string; note: string }>;
}
interface OnHandRow { id: string; name: string; sku: string; barcode: string; unit: string; total: number; byWarehouse: Record<string, number>; noWarehouse: number; reorderLevel: number; image: string }
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
	const { products, loadProducts, settings } = useFinanceStore();
	const [section, setSection] = useState<Section>("onhand");
	const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
	const [docs, setDocs] = useState<DocRow[]>([]);
	const [onHand, setOnHand] = useState<{ warehouses: Array<{ id: string; name: string }>; rows: OnHandRow[] } | null>(null);
	const [turnoverView, setTurnoverView] = useState<{ from: string; to: string; rows: TurnoverRowView[] } | null>(null);
	const [dead, setDead] = useState<Array<{ id: string; name: string; qty: number }>>([]);
	const [abc, setAbc] = useState<Array<{ product: string; name: string; sku: string; revenue: number; share: number; group: string }>>([]);
	const [busy, setBusy] = useState(false);
	// Фильтр остатков: конкретный склад или все («»)
	const [warehouseFilter, setWarehouseFilter] = useState("");
	const [onHandQuery, setOnHandQuery] = useState("");
	// Окна: новый склад, новый документ и просмотр документа
	const [whOpen, setWhOpen] = useState(false);
	const [whForm, setWhForm] = useState({ name: "", kind: "warehouse", address: "", isDefault: false });
	const [docOpen, setDocOpen] = useState(false);
	const [docKind, setDocKind] = useState<DocKind>("receipt");
	const [docForm, setDocForm] = useState({ date: new Date().toISOString().slice(0, 10), warehouseFrom: "", warehouseTo: "", note: "" });
	// Строки документа: товар выбирается поиском (сканер вводит штрихкод как текст), цена не спрашивается —
	// себестоимость берётся из карточки товара (lib/finance/stockDocs.ts)
	const [docLines, setDocLines] = useState<Array<{ product: string; qty: string }>>([]);
	const [lineQuery, setLineQuery] = useState("");
	const [viewDoc, setViewDoc] = useState<DocDetail | null>(null);
	const [viewBusy, setViewBusy] = useState(false);
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
	const productInfo = useMemo(() => new Map(goods.map((p) => [p.id, p])), [goods]);

	// Остатки: поиск по названию, артикулу и штрихкоду — сканер вводит номер обычным текстом
	const onHandRows = useMemo(() => {
		const rows = onHand?.rows ?? [];
		const q = onHandQuery.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.sku ?? "").toLowerCase().includes(q) || (r.barcode ?? "").includes(q));
	}, [onHand, onHandQuery]);

	// Совпадения для строки документа: то же правило поиска, что и в остатках
	const lineMatches = useMemo(() => {
		const q = lineQuery.trim().toLowerCase();
		if (!q) return [];
		return goods.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.barcode ?? "").includes(q)).slice(0, 6);
	}, [goods, lineQuery]);

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

	// Добавить строку товаром: из подсказок по поиску или сразу сканером (точное совпадение штрихкода/артикула)
	function addDocLine(productId: string) {
		setDocLines((lines) => (lines.some((l) => l.product === productId) ? lines : [...lines, { product: productId, qty: "1" }]));
		setLineQuery("");
	}
	function onLineQueryChange(v: string) {
		setLineQuery(v);
		const probe = v.trim().toLowerCase();
		const exact = goods.find((p) => (p.barcode && p.barcode.toLowerCase() === probe) || ((p.sku ?? "").toLowerCase() === probe));
		if (exact) addDocLine(exact.id);
	}

	async function saveDoc() {
		const lines = docLines.filter((l) => l.product && Number(l.qty) > 0).map((l) => ({ product: l.product, qty: Number(l.qty) }));
		if (!lines.length) return void toast.error(t("stockNoLines"));
		setBusy(true);
		const res = await apiCall<{ number: string }>("/api/stock-docs", "POST", { kind: docKind, ...docForm, lines });
		setBusy(false);
		if (!res.ok) return void toast.error(res.message);
		toast.success(t("stockDocPosted", { number: res.data?.number ?? "" }));
		setDocOpen(false);
		setDocLines([]);
		setLineQuery("");
		void load();
	}

	async function reverse(doc: DocRow): Promise<boolean> {
		setReverseFor(null);
		setBusy(true);
		const res = await apiCall("/api/stock-docs/" + doc.id + "/reverse", "POST", {});
		setBusy(false);
		if (!res.ok) { toast.error(res.message); return false; }
		toast.success(t("stockReversed"));
		void load();
		return true;
	}

	// Просмотр документа: тянем полную карточку с движениями
	async function openDoc(id: string) {
		setViewBusy(true);
		const res = await apiCall<DocDetail>(`/api/stock-docs/${id}`);
		setViewBusy(false);
		if (!res.ok || !res.data) return void toast.error(res.message);
		setViewDoc(res.data);
	}

	function printDoc(id: string, number: string) {
		void downloadAuthed(`/api/stock-docs/${id}/pdf?locale=${locale}`, `${number}.pdf`, t("pdfFailed"));
	}

	// «Скасувати та виправити»: сначала сторно исходного, затем форма с теми же строками —
	// проведённый документ не правится задним числом, история остаётся читаемой
	async function correctDoc(doc: DocDetail) {
		const ok = await reverse(doc as unknown as DocRow);
		if (!ok) return;
		setViewDoc(null);
		setDocKind(doc.kind as DocKind);
		setDocForm({ date: new Date().toISOString().slice(0, 10), warehouseFrom: doc.warehouseFromId, warehouseTo: doc.warehouseToId, note: doc.note });
		setDocLines(doc.lines.map((l) => ({ product: l.product, qty: String(l.qty) })));
		setLineQuery("");
		setDocOpen(true);
	}

	const input = "fs-field h-36 w-full px-10 text-12 outline-none";
	const [importOpen, setImportOpen] = useState(false);
	// Колонка «Без складу» нужна, только если там что-то есть: старые движения и резервы заказов
	const hasNoWarehouse = (onHand?.rows ?? []).some((r) => r.noWarehouse !== 0);

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
							// Склады — настоящий фильтр остатков, а не подписи: нажатие показывает остатки этого склада
							<div className="flex flex-wrap gap-8">
								<button
									type="button"
									onClick={() => setWarehouseFilter("")}
									className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${warehouseFilter === "" ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
									{t("stockAllWarehouses")}
								</button>
								{warehouses.filter((w) => !w.archived).map((w) => (
									<button
										key={w.id}
										type="button"
										onClick={() => setWarehouseFilter(w.id)}
										className={`rounded-10 border px-12 py-7 text-12 font-medium transition-colors ${warehouseFilter === w.id ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)] text-[#f1f4ee]" : "border-inkLine text-[#8c948b] hover:text-[#f1f4ee]"}`}>
										{w.name}
										<span className="ml-8 text-11 text-[#9AA396]">{t(`stockKind_${w.kind}`)}{w.isDefault ? ` · ${t("stockDefault")}` : ""}</span>
									</button>
								))}
							</div>
						)}
					</section>
					<section className="fs-card overflow-x-auto p-16 md:p-20">
						<div className="mb-10 flex flex-wrap items-center justify-between gap-10">
							<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("stockOnHand")}</h3>
							<SearchBox value={onHandQuery} onChange={setOnHandQuery} placeholder={t("stockSearchPlaceholder")} className="w-full md:w-[320px]" />
						</div>
						{!onHand || onHand.rows.length === 0 ? (
							<p className="text-12 text-[#8c948b]">{t("stockEmpty")}</p>
						) : onHandRows.length === 0 ? (
							<p className="text-12 text-[#8c948b]">{t("stockSearchEmpty")}</p>
						) : (
							<table className="w-full min-w-[560px] text-12">
								<thead>
									<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
										<th className="pb-6 font-medium">{t("stockColProduct")}</th>
										{warehouseFilter === "" ? (
											onHand.warehouses.map((w) => <th key={w.id} className="pb-6 text-right font-medium">{w.name}</th>)
										) : (
											<th className="pb-6 text-right font-medium">{onHand.warehouses.find((w) => w.id === warehouseFilter)?.name ?? ""}</th>
										)}
										{hasNoWarehouse && <th className="pb-6 text-right font-medium" title={t("stockNoWarehouseHint")}>{t("stockNoWarehouse")}</th>}
										<th className="pb-6 text-right font-medium">{t("stockColTotal")}</th>
									</tr>
								</thead>
								<tbody>
									{onHandRows.map((r) => (
										<tr key={r.id} className="border-t border-inkLine text-[#cfd4cb]">
											<td className="py-7 text-[#f1f4ee]">
												<span className="flex items-center gap-10">
													{r.image ? <img src={r.image} alt="" className="h-28 w-28 shrink-0 rounded-6 border border-inkLine object-cover" loading="lazy" /> : null}
													<span className="min-w-0">
														{r.name}
														<span className="ml-6 text-11 text-[#8c948b]">{r.sku}{r.barcode ? ` · ${r.barcode}` : ""}</span>
														{r.reorderLevel > 0 && r.total < r.reorderLevel && (
															<span className="ml-8 inline-flex items-center gap-4 text-11 text-[#F4A100]"><TbAlertTriangle size={11} /> {t("stockBelowMin")}</span>
														)}
													</span>
												</span>
											</td>
											{warehouseFilter === "" ? (
												onHand.warehouses.map((w) => <td key={w.id} className="py-7 text-right">{r.byWarehouse[w.id] ?? 0}</td>)
											) : (
												<td className="py-7 text-right">{r.byWarehouse[warehouseFilter] ?? 0}</td>
											)}
											{hasNoWarehouse && <td className="py-7 text-right text-[#9AA396]">{r.noWarehouse || 0}</td>}
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
						<button type="button" onClick={() => { setDocForm({ ...docForm, warehouseFrom: defaults.from, warehouseTo: defaults.to }); setDocLines([]); setLineQuery(""); setDocOpen(true); }} className="fs-btn fs-btn-ghost h-34">
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
									<tr key={d.id} className={`cursor-pointer border-t border-inkLine text-[#cfd4cb] transition-colors hover:bg-[rgba(255,255,255,0.03)] ${d.reversed ? "opacity-50" : ""}`} onClick={() => void openDoc(d.id)}>
										<td className="py-7 text-[#f1f4ee]">{d.number}</td>
										<td className="py-7">{t(`stockDoc_${d.kind}`)}{d.reversalOf ? ` · ${t("stockReversalMark")}` : ""}</td>
										<td className="py-7">{[d.warehouseFrom, d.warehouseTo].filter(Boolean).join(" → ")}</td>
										<td className="py-7">{d.lines.slice(0, 3).map((l) => `${l.name} ${l.qty}`).join(", ")}{d.lines.length > 3 ? " …" : ""}</td>
										<td className="py-7">{d.date}</td>
										<td className="py-7 text-right" onClick={(e) => e.stopPropagation()}>
											<span className="inline-flex gap-6">
												<button type="button" onClick={() => printDoc(d.id, d.number)} className="fs-btn fs-btn-ghost h-28" title={t("stockPrint")}>
													<TbPrinter size={12} />
												</button>
												{!d.reversed && !d.reversalOf && (
													<button type="button" disabled={busy} onClick={() => setReverseFor(d)} className="fs-btn fs-btn-ghost h-28 disabled:opacity-50">
														<TbArrowBackUp size={12} /> {t("stockReverse")}
													</button>
												)}
											</span>
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
											<span className="text-[#8c948b]">{money(r.revenue, settings?.currency ?? "UAH", locale)} · {r.share}%</span>
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

			{/* Новый документ склада: строки добавляются поиском — сканер вводит штрихкод как текст */}
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
									<span className="mb-6 block text-12 text-[#8c948b]">{docKind === "inventory" ? t("stockInventoryAt") : t("stockFrom")}</span>
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
						{/* Поиск товара: название, артикул или штрихкод. Точное совпадение кода добавляет строку сразу —
						    так работает сканер; подсказки добавляют товар нажатием или Enter */}
						<div className="relative mb-8">
							<input
								value={lineQuery}
								onChange={(e) => onLineQueryChange(e.target.value)}
								onKeyDown={(e) => { if (e.key === "Enter" && lineMatches.length) { e.preventDefault(); addDocLine(lineMatches[0].id); } }}
								placeholder={t("stockLineSearch")}
								className={`${input} h-40`}
								autoComplete="off"
							/>
							{lineQuery.trim() && !lineMatches.length && <p className="mt-6 text-11 text-[#9AA396]">{t("stockSearchEmpty")}</p>}
							{lineMatches.length > 0 && (
								<ul className="mt-6 flex flex-col gap-4">
									{lineMatches.map((p) => (
										<li key={p.id}>
											<button type="button" onClick={() => addDocLine(p.id)} className="w-full rounded-8 border border-inkLine px-10 py-6 text-left text-12 text-[#cfd4cb] transition-colors hover:border-[rgba(198,255,77,0.4)] hover:text-[#f1f4ee]">
												{p.name}
												<span className="ml-8 text-11 text-[#8c948b]">{p.sku}{p.barcode ? ` · ${p.barcode}` : ""} · {t("stockAtStock", { qty: p.stockQty, unit: p.unit })}</span>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
						<div className="flex flex-col gap-8">
							{docLines.map((line, i) => {
								const p = productInfo.get(line.product);
								return (
									<div key={line.product} className="grid grid-cols-[1fr_110px_32px] items-center gap-8">
										<span className="min-w-0 truncate text-13 text-[#f1f4ee]">
											{p?.name ?? "—"}
											<span className="ml-6 text-11 text-[#8c948b]">{p?.sku}</span>
										</span>
										<input
											value={line.qty}
											onChange={(e) => setDocLines(docLines.map((l, j) => (j === i ? { ...l, qty: e.target.value.replace(/[^\d.]/g, "") } : l)))}
											placeholder={docKind === "inventory" ? t("stockQtyFact") : t("stockQty")}
											className={input}
										/>
										<button type="button" onClick={() => setDocLines(docLines.filter((_, j) => j !== i))} className="text-[#8c948b] transition-colors hover:text-danger" aria-label={t("delete")}>
											<TbTrash size={15} />
										</button>
									</div>
								);
							})}
							{docLines.length === 0 && <p className="text-11 text-[#9AA396]">{t("stockNoLinesYet")}</p>}
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

			{/* Просмотр документа: строки, движения, сторно; печать и «скасувати та виправити» */}
			<Modal open={!!viewDoc} onClose={() => setViewDoc(null)} label={viewDoc?.number ?? ""} className="w-full max-w-[720px]">
				{viewDoc && (
					<div className="fs-popover fs-scroll max-h-[calc(100dvh-32px)] overflow-y-auto p-20">
						<div className="mb-10 flex flex-wrap items-center justify-between gap-10">
							<h2 className="text-15 font-semibold text-[#f1f4ee]">
								{t(`stockDoc_${viewDoc.kind}`)} № {viewDoc.number}
								{viewDoc.reversalOf && <span className="ml-8 text-12 text-[#9AA396]">{t("stockReversalMark")} {viewDoc.reversalOfNumber}</span>}
							</h2>
							{viewDoc.reversed && <span className="fs-chip border-[rgba(235,87,87,0.35)] text-danger">{t("stockReversedMark")}{viewDoc.reversalNumber ? ` · ${viewDoc.reversalNumber}` : ""}</span>}
						</div>
						<p className="mb-10 text-12 text-[#8c948b]">
							{viewDoc.date}
							{[viewDoc.warehouseFrom, viewDoc.warehouseTo].filter(Boolean).length ? ` · ${[viewDoc.warehouseFrom, viewDoc.warehouseTo].filter(Boolean).join(" → ")}` : ""}
							{viewDoc.by ? ` · ${t("stockPostedBy", { name: viewDoc.by })}` : ""}
						</p>
						{viewDoc.note && <p className="mb-10 text-12 text-[#cfd4cb]">{viewDoc.note}</p>}
						<table className="w-full min-w-[520px] text-12">
							<thead>
								<tr className="text-left text-11 uppercase tracking-[0.06em] text-[#8c948b]">
									<th className="pb-6 font-medium">{t("stockColProduct")}</th>
									{viewDoc.kind === "inventory" ? (
										<>
											<th className="pb-6 text-right font-medium">{t("stockQtyFact")}</th>
											<th className="pb-6 text-right font-medium">{t("stockQtyBook")}</th>
											<th className="pb-6 text-right font-medium">{t("stockQtyDiff")}</th>
										</>
									) : (
										<th className="pb-6 text-right font-medium">{t("stockQty")}</th>
									)}
								</tr>
							</thead>
							<tbody>
								{viewDoc.lines.map((l, i) => (
									<tr key={`${l.product}-${i}`} className="border-t border-inkLine text-[#cfd4cb]">
										<td className="py-6 text-[#f1f4ee]">{l.name}<span className="ml-6 text-11 text-[#8c948b]">{l.sku}</span></td>
										{viewDoc.kind === "inventory" ? (
											<>
												<td className="py-6 text-right">{l.qty} {l.unit}</td>
												<td className="py-6 text-right text-[#8c948b]">{Math.round((l.qty - l.diff) * 1000) / 1000} {l.unit}</td>
												<td className={`py-6 text-right ${l.diff === 0 ? "text-[#8c948b]" : l.diff > 0 ? "text-[#2DDEB6]" : "text-danger"}`}>{l.diff > 0 ? "+" : ""}{l.diff} {l.unit}</td>
											</>
										) : (
											<td className="py-6 text-right">{l.qty} {l.unit}</td>
										)}
									</tr>
								))}
							</tbody>
						</table>
						{viewDoc.movements.length > 0 && (
							<div className="mt-14">
								<p className="fs-eyebrow mb-6">{t("stockMovementsOfDoc")}</p>
								<ul className="flex flex-col gap-4 text-12 text-[#cfd4cb]">
									{viewDoc.movements.map((m) => (
										<li key={m.id} className="flex flex-wrap justify-between gap-10 border-t border-inkLine pt-4">
											<span>{m.name}<span className="ml-6 text-11 text-[#9AA396]">{m.warehouse}{m.unitCost ? ` · ${money(m.unitCost, settings?.currency ?? "UAH", locale)}` : ""}</span></span>
											<span className={m.qty >= 0 ? "text-[#2DDEB6]" : "text-[#F4A100]"}>{m.qty >= 0 ? "+" : ""}{m.qty}</span>
										</li>
									))}
								</ul>
							</div>
						)}
						<div className="mt-16 flex flex-wrap justify-end gap-10">
							<button type="button" onClick={() => printDoc(viewDoc.id, viewDoc.number)} className="fs-btn fs-btn-ghost h-38">
								<TbPrinter size={15} /> {t("stockPrint")}
							</button>
							{!viewDoc.reversed && !viewDoc.reversalOf && (
								<button type="button" disabled={viewBusy || busy} onClick={() => void correctDoc(viewDoc)} className="fs-btn fs-btn-ghost h-38 disabled:opacity-50">
									<TbPencil size={14} /> {t("stockCorrect")}
								</button>
							)}
							<button type="button" onClick={() => setViewDoc(null)} className="fs-btn fs-btn-primary h-38">{t("cancel")}</button>
						</div>
					</div>
				)}
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
