"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbCalendarOff, TbCalendarStats, TbPlus, TbTrash } from "react-icons/tb";
import { apiCall } from "@/app/store/crmApi";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import { depreciationSchedule } from "@/lib/finance/assets";
import type { AssetsSummary } from "@/lib/finance/assets";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import { PeriodSwitch, ReportLoading } from "./reportParts";
import type { PeriodKind } from "@/lib/finance/reports";
import { money } from "./format";

// Anlagen (основные средства, Anlagegüter): список с амортизацией за период. Цифры считает сервер
// (lib/finance/assets.ts → /api/assets), здесь — период, таблица, форма постановки на учёт и план
// амортизации по месяцам, чтобы было видно, как средство списывается по годам.

// Элемент списка /api/assets (app/api/assets/route.ts): поля модели плюс посчитанные сервером
// bookValue (остаточная стоимость) и periodDepreciation (амортизация за запрошенный период).
interface AssetRow {
	id: string;
	name: string;
	category: string;
	acquiredDate: string;
	cost: number;
	currency: string;
	usefulLifeYears: number;
	method: string;
	residualValue: number;
	disposalDate: string;
	notes: string;
	bookValue: number;
	periodDepreciation?: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { name: "", category: "", acquiredDate: today(), cost: "", usefulLifeYears: "", residualValue: "", notes: "" };

// Границы периода (месяц/квартал/год) — та же формула, что в lib/finance/reports.ts для отчётов;
// модуль тянет mongoose, на клиент его импортировать нельзя, поэтому расчёт повторён здесь.
const iso = (d: Date) => d.toISOString().slice(0, 10);
function periodRange(kind: PeriodKind): { from: string; to: string } {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();
	if (kind === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
	if (kind === "quarter") {
		const q = Math.floor(m / 3);
		return { from: iso(new Date(Date.UTC(y, q * 3, 1))), to: iso(new Date(Date.UTC(y, q * 3 + 3, 0))) };
	}
	return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
}

// Плитка сводки — как на дашборде и в Mahnwesen: подпись сверху, крупная цифра снизу.
function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
	return (
		<div className="fs-card p-16">
			<p className="text-12 text-[#8c948b]">{label}</p>
			<p className="mt-6 text-20 font-semibold" style={{ color: color ?? "#f1f4ee" }}>{value}</p>
		</div>
	);
}

// Экран вкладки «Anlagen» раздела Finance — открывается и по ссылке ?tab=assets (см. index.tsx)
export default function Assets() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const currency = useFinanceStore((s) => s.settings?.currency ?? "EUR");
	const [period, setPeriod] = useState<PeriodKind>("quarter");
	const [data, setData] = useState<{ assets: AssetRow[]; summary: AssetsSummary | null } | null>(null);
	const [failed, setFailed] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);
	const [formOpen, setFormOpen] = useState(false);
	const [form, setForm] = useState(EMPTY);
	// средство и его открытость хранятся отдельно: при закрытии содержимое остаётся в окне,
	// пока оно плавно исчезает (Modal размонтирует детей после анимации)
	const [schedule, setSchedule] = useState<AssetRow | null>(null);
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [dispose, setDispose] = useState<{ asset: AssetRow; date: string } | null>(null);
	const [disposeOpen, setDisposeOpen] = useState(false);
	const [toDelete, setToDelete] = useState<AssetRow | null>(null);
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);
	// список уже хоть раз показан: сбой повторной загрузки тогда не стирает таблицу, а уходит в тост
	const loadedRef = useRef(false);

	const range = useMemo(() => periodRange(period), [period]);

	// Смена периода перезапрашивает список; ответ старого запроса после ухода с экрана не применяется (alive)
	useEffect(() => {
		let alive = true;
		const { from, to } = periodRange(period);
		apiCall<{ assets: AssetRow[]; summary: AssetsSummary | null }>(`/api/assets?from=${from}&to=${to}`, "GET", undefined, { cache: "no-store" }).then((r) => {
			if (!alive) return;
			if (r.ok && r.data) {
				loadedRef.current = true;
				setData(r.data);
				setFailed(false);
				return;
			}
			if (loadedRef.current) { toast.error(t("assetsLoadFailed")); return; }
			setData(null);
			setFailed(true);
		});
		return () => { alive = false; };
	}, [period, reloadKey, t]);

	function reload() { setReloadKey((k) => k + 1); }

	// Известные отказы сервера (POST/PATCH /api/assets) переводим на язык интерфейса, остальное показываем как пришло
	function serverMessage(message: string): string {
		const m = (message || "").toLowerCase();
		if (m.includes("name is required") || m.includes("name must not be empty")) return t("assetErrName");
		if (m.includes("acquireddate")) return t("assetErrDate");
		if (m.includes("cost must be greater")) return t("assetErrCost");
		if (m.includes("usefullifeyears")) return t("assetErrYears");
		return message || t("assetSaveFailed");
	}

	function openNew() {
		setNotice("");
		setForm(EMPTY);
		setFormOpen(true);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setNotice("");
		setBusy(true);
		const r = await apiCall("/api/assets", "POST", {
			name: form.name.trim(),
			category: form.category.trim(),
			acquiredDate: form.acquiredDate,
			cost: Number(form.cost) || 0,
			usefulLifeYears: Number(form.usefulLifeYears) || 0,
			residualValue: Number(form.residualValue) || 0,
			notes: form.notes.trim(),
		});
		setBusy(false);
		if (!r.ok) {
			// Отказ (400) — это объяснение, а не поломка: спокойная строка в форме вместо красного тоста
			setNotice(serverMessage(r.message));
			return;
		}
		toast.success(t("saved"));
		setFormOpen(false);
		reload();
	}

	async function saveDisposal(date: string) {
		if (!dispose || busy) return;
		setNotice("");
		setBusy(true);
		const r = await apiCall(`/api/assets/${dispose.asset.id}`, "PATCH", { disposalDate: date });
		setBusy(false);
		if (!r.ok) {
			setNotice(serverMessage(r.message));
			return;
		}
		toast.success(date ? t("assetDisposed") : t("assetDisposalCleared"));
		setDisposeOpen(false);
		reload();
	}

	async function remove(asset: AssetRow) {
		const r = await apiCall(`/api/assets/${asset.id}`, "DELETE");
		if (!r.ok) { toast.error(t("assetDeleteFailed")); return; }
		reload();
	}

	// План амортизации считаем той же функцией, что и сервер (lib/finance/assets.ts) — строки те же
	const scheduleRows = useMemo(() => (schedule ? depreciationSchedule(schedule) : []), [schedule]);
	const scheduleTotal = scheduleRows.reduce((s, r) => s + r.amount, 0);

	if (!data && failed) {
		return <p className="fs-card p-30 text-center text-13 text-[#F4A100]">{t("assetsLoadFailed")}</p>;
	}
	if (!data) return <ReportLoading />;

	return (
		<div>
			<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("assetsTitle")}</h2>
				<PeriodSwitch value={period} onChange={setPeriod} />
			</div>
			<p className="mb-16 text-12 leading-[1.5] text-[#8c948b]">{t("assetsHint")}</p>

			{data.summary && (
				<div className="mb-16 grid grid-cols-2 gap-12 md:grid-cols-4">
					<Stat label={t("assetsTotalCost")} value={money(data.summary.totalCost, currency, locale)} />
					<Stat label={t("assetsPeriodDepreciation")} value={money(data.summary.depreciation, currency, locale)} color={data.summary.depreciation > 0 ? "#F4A100" : undefined} />
					<Stat label={t("assetsDepreciationToDate")} value={money(data.summary.depreciationToDate, currency, locale)} />
					<Stat label={t("assetsBookValue")} value={money(data.summary.bookValue, currency, locale)} color="#c6ff4d" />
				</div>
			)}

			<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
				<span className="text-12 text-[#9AA396]">{t("periodLabel")}: {range.from} – {range.to}</span>
				<button type="button" onClick={openNew} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("assetNew")}
				</button>
			</div>

			{data.assets.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("assetsEmpty")}</p>
			) : (
				<section className="fs-card overflow-x-auto">
					<table className="fs-table min-w-[980px]">
						<thead>
							<tr>
								<th className="px-16">{t("assetName")}</th>
								<th className="px-10">{t("colCategory")}</th>
								<th className="px-10">{t("colAcquired")}</th>
								<th className="px-10 text-right">{t("colCost")}</th>
								<th className="px-10 text-right">{t("colUsefulLife")}</th>
								<th className="px-10 text-right">{t("colDepreciation")}</th>
								<th className="px-10 text-right">{t("colBookValue")}</th>
								<th className="px-10" />
							</tr>
						</thead>
						<tbody>
							{data.assets.map((a) => (
								<tr key={a.id}>
									<td className="px-16 text-13 font-medium text-[#f1f4ee]">
										<div>{a.name}</div>
										{/* выбытие видно прямо в строке: из месяца Abgang средство больше не списывается */}
										{a.disposalDate && (
											<span className="fs-chip mt-6 h-22 border-[rgba(244,161,0,0.35)] px-8 text-10 text-[#F4A100]">
												{t("assetDisposedOn", { date: a.disposalDate })}
											</span>
										)}
									</td>
									<td className="px-10 text-13 text-[#8c948b]">{a.category || "—"}</td>
									<td className="px-10 text-13 text-[#8c948b]">{a.acquiredDate}</td>
									<td className="px-10 text-right text-13">{money(a.cost, a.currency, locale)}</td>
									{/* срок в годах — единица измерения в заголовке колонки, в ячейке только число */}
									<td className="px-10 text-right text-13 text-[#8c948b]">{a.usefulLifeYears}</td>
									<td className="px-10 text-right text-13">{(a.periodDepreciation ?? 0) !== 0 ? money(a.periodDepreciation ?? 0, a.currency, locale) : "—"}</td>
									<td className="px-10 text-right text-13 font-medium">{money(a.bookValue, a.currency, locale)}</td>
									<td className="px-10 text-right">
										<div className="flex items-center justify-end gap-14">
											<button type="button" onClick={() => { setSchedule(a); setScheduleOpen(true); }} className="fs-link whitespace-nowrap text-12">
												<TbCalendarStats size={15} aria-hidden /> {t("assetScheduleTitle")}
											</button>
											<button
												type="button"
												onClick={() => { setNotice(""); setDispose({ asset: a, date: a.disposalDate || today() }); setDisposeOpen(true); }}
												aria-label={t("assetDispose")}
												className="text-[#9AA396] transition-colors hover:text-[#F4A100]">
												<TbCalendarOff size={16} />
											</button>
											<button type="button" onClick={() => setToDelete(a)} aria-label={t("delete")} className="text-[#9AA396] transition-colors hover:text-danger">
												<TbTrash size={16} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}

			{/* Постановка на учёт: заполняются только те поля, что и в модели (models/Asset.ts) */}
			<Modal open={formOpen} onClose={() => setFormOpen(false)} label={t("assetNew")} className="w-full max-w-[480px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("assetNew")}</h2>
					<div className="flex flex-col gap-12">
						<FormField label={t("assetName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} autoFocus />
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("colCategory")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={100} />
							<FormField label={t("colAcquired")} type="date" value={form.acquiredDate} onChange={(e) => setForm({ ...form, acquiredDate: e.target.value })} />
						</div>
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("colCost")} type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
							<FormField label={t("colUsefulLife")} type="number" min="1" max="100" value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} />
						</div>
						<p className="text-11 leading-[1.5] text-[#9AA396]">{t("assetCostHint")}</p>
						<FormField label={t("assetResidualValue")} type="number" step="0.01" min="0" value={form.residualValue} onChange={(e) => setForm({ ...form, residualValue: e.target.value })} />
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("notes")}</span>
							<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} rows={3} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
						</label>
					</div>
					<p className="mt-14 text-11 leading-[1.5] text-[#9AA396]">{t("assetLinearHint")}</p>
					{notice && <p className="mt-10 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setFormOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">{t("save")}</button>
					</div>
				</form>
			</Modal>

			{/* План амортизации: те же месячные строки, что считает depreciationSchedule (lib/finance/assets.ts) */}
			<Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} label={t("assetScheduleTitle")} align="top" className="w-full max-w-[520px]">
				{schedule && (
					<div className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
						<h2 className="text-16 font-semibold text-[#f1f4ee]">{schedule.name}</h2>
						<p className="mt-6 text-12 leading-[1.5] text-[#8c948b]">{t("assetScheduleHint")}</p>

						<div className="mt-12 flex flex-col">
							<div className="flex items-center justify-between gap-16 border-b border-inkLineSoft py-9 text-13">
								<span className="text-[#8c948b]">{t("colAcquired")}</span>
								<span className="font-medium text-[#f1f4ee]">{schedule.acquiredDate}</span>
							</div>
							<div className="flex items-center justify-between gap-16 border-b border-inkLineSoft py-9 text-13">
								<span className="text-[#8c948b]">{t("colCost")}</span>
								<span className="font-medium text-[#f1f4ee]">{money(schedule.cost, schedule.currency, locale)}</span>
							</div>
							<div className="flex items-center justify-between gap-16 border-b border-inkLineSoft py-9 text-13">
								<span className="text-[#8c948b]">{t("colUsefulLife")}</span>
								<span className="font-medium text-[#f1f4ee]">{schedule.usefulLifeYears}</span>
							</div>
							{schedule.residualValue > 0 && (
								<div className="flex items-center justify-between gap-16 border-b border-inkLineSoft py-9 text-13">
									<span className="text-[#8c948b]">{t("assetResidualValue")}</span>
									<span className="font-medium text-[#f1f4ee]">{money(schedule.residualValue, schedule.currency, locale)}</span>
								</div>
							)}
						</div>

						{schedule.disposalDate && (
							<p className="mt-12 rounded-10 border border-[rgba(244,161,0,0.35)] bg-[rgba(244,161,0,0.08)] px-12 py-8 text-12 leading-[1.5] text-[#e6eae2]">
								{t("assetScheduleDisposed", { date: schedule.disposalDate })}
							</p>
						)}

						{scheduleRows.length === 0 ? (
							<p className="mt-14 text-13 text-[#8c948b]">{t("empty")}</p>
						) : (
							<>
								<table className="fs-table mt-14">
									<thead>
										<tr>
											<th className="px-0">{t("colMonth")}</th>
											<th className="px-0 text-right">{t("colDepreciation")}</th>
											<th className="px-0 text-right">{t("colBookValue")}</th>
										</tr>
									</thead>
									<tbody>
										{scheduleRows.map((r) => (
											<tr key={r.period}>
												<td className="px-0 text-13">{r.period}</td>
												<td className="px-0 text-right text-13">{money(r.amount, schedule.currency, locale)}</td>
												<td className="px-0 text-right text-13">{money(r.bookValue, schedule.currency, locale)}</td>
											</tr>
										))}
									</tbody>
								</table>
								<div className="flex items-center justify-between gap-16 border-t border-inkLine pt-10 text-13">
									<span className="font-semibold text-[#e6eae2]">{t("total")}</span>
									<span className="font-semibold text-[#f1f4ee]">{money(scheduleTotal, schedule.currency, locale)}</span>
								</div>
							</>
						)}

						<div className="mt-20 flex justify-end">
							<button type="button" onClick={() => setScheduleOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						</div>
					</div>
				)}
			</Modal>

			{/* Выбытие: дата сохраняется в PATCH /api/assets/:id — с этого месяца амортизация прекращается */}
			<Modal open={disposeOpen} onClose={() => setDisposeOpen(false)} label={t("assetDisposeTitle")} className="w-full max-w-[420px]">
				{dispose && (
					<form onSubmit={(e) => { e.preventDefault(); saveDisposal(dispose.date); }} className="fs-popover p-20 md:p-24">
						<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("assetDisposeTitle")}</h2>
						<p className="mb-14 mt-6 text-12 leading-[1.5] text-[#8c948b]">{dispose.asset.name}</p>
						<FormField label={t("assetDisposalDate")} type="date" value={dispose.date} onChange={(e) => setDispose({ ...dispose, date: e.target.value })} autoFocus />
						<p className="mt-10 text-11 leading-[1.5] text-[#9AA396]">{t("assetDisposalHint")}</p>
						{notice && <p className="mt-10 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
						<div className="mt-20 flex items-center justify-between gap-10">
							{dispose.asset.disposalDate
								? <button type="button" onClick={() => saveDisposal("")} disabled={busy} className="fs-btn fs-btn-ghost h-40 disabled:opacity-[0.5]">{t("assetDisposalClear")}</button>
								: <span />}
							<div className="flex items-center gap-10">
								<button type="button" onClick={() => setDisposeOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
								<button type="submit" disabled={busy || !dispose.date} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">{t("save")}</button>
							</div>
						</div>
					</form>
				)}
			</Modal>

			<ConfirmDialog
				open={!!toDelete}
				title={t("delete")}
				text={t("confirmDeleteAsset")}
				onCancel={() => setToDelete(null)}
				onConfirm={() => { if (toDelete) remove(toDelete); setToDelete(null); }}
			/>
		</div>
	);
}
