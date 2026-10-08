"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbAlertTriangle, TbDownload, TbInfoCircle } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { useFinanceStore } from "@/store/useFinanceStore";
import { TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import Modal from "../shared/Modal";
import { downloadAuthed } from "./download";
import { money } from "./format";
import { PeriodSwitch, ReportFailed, ReportLoading } from "./reportParts";
import type { PeriodKind } from "@/lib/finance/reports";
import type { IssuedRegister, ReceivedRegister, EsfRow, ReceivedRow, EsfStatus } from "@/lib/finance/esf";

// Журналы счетов-фактур рынка UZ: выданные и полученные. Система готовит данные и показывает, чего не хватает для ЭСФ;
// сам ЭСФ создаётся и подписывается у оператора, а здесь человек отмечает результат (docs/UZBEKISTAN.md).

const STATUSES: EsfStatus[] = ["none", "prepared", "sent", "confirmed", "cancelled"];

function range(period: PeriodKind): { from: string; to: string } {
	const now = new Date();
	const y = now.getFullYear(), m = now.getMonth();
	const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	if (period === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
	if (period === "quarter") { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) }; }
	return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
}

export default function EsfJournal() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const currency = useFinanceStore((s) => s.settings?.currency ?? "UZS");
	const [kind, setKind] = useState<"issued" | "received">("issued");
	const [period, setPeriod] = useState<PeriodKind>("month");
	const [issued, setIssued] = useState<IssuedRegister | null>(null);
	const [received, setReceived] = useState<ReceivedRegister | null>(null);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const [edit, setEdit] = useState<EsfRow | null>(null);
	const [editRecv, setEditRecv] = useState<ReceivedRow | null>(null);
	const { from, to } = range(period);
	const fmt = (n: number | null) => (n === null ? "—" : money(n, "UZS", locale));

	const load = useCallback(async () => {
		setLoading(true); setFailed(false);
		const r = await apiCall<{ kind: string; register: IssuedRegister & ReceivedRegister }>(`/api/finance/uz/esf?kind=${kind}&from=${from}&to=${to}`, "GET", undefined, { cache: "no-store" });
		setLoading(false);
		if (!r.ok || !r.data) return setFailed(true);
		if (kind === "issued") setIssued(r.data.register as IssuedRegister); else setReceived(r.data.register as ReceivedRegister);
	}, [kind, from, to]);
	useEffect(() => { void load(); }, [load]);

	return (
		<div>
			<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("esfTitle")}</h2>
				<PeriodSwitch value={period} onChange={setPeriod} />
			</div>
			<div className="mb-14 flex items-start gap-10 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] p-12">
				<TbInfoCircle size={16} className="mt-[2px] shrink-0 text-[#8c948b]" aria-hidden />
				<p className="text-12 leading-[1.5] text-[#cfd4cb]">{t("esfNotEsf")}</p>
			</div>
			<div role="tablist" className="mb-14 flex items-center gap-8">
				{(["issued", "received"] as const).map((k) => (
					<button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`${TAB_ITEM} ${kind === k ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>{t(`esf_${k}`)}</button>
				))}
				<button type="button" onClick={() => void downloadAuthed(`/api/finance/uz/esf/export?kind=${kind}&from=${from}&to=${to}`, `esf-${kind}-${from}_${to}.csv`, t("pdfFailed"))} className="fs-btn fs-btn-ghost ml-auto h-34 text-12">
					<TbDownload size={14} /> {t("esfExportCsv")}
				</button>
			</div>

			{loading ? <ReportLoading /> : failed ? <ReportFailed /> : kind === "issued" && issued ? (
				<>
					<div className="mb-12 flex flex-wrap gap-x-20 gap-y-6 text-12 text-[#8c948b]">
						<span>{t("esfTotals", { net: fmt(issued.totals.net), tax: fmt(issued.totals.tax), gross: fmt(issued.totals.gross) })}</span>
						{issued.notReady > 0 && <span className="text-[#F4A100]">{t("esfNotReady", { n: issued.notReady })}</span>}
						{issued.notSent > 0 && <span>{t("esfNotSent", { n: issued.notSent })}</span>}
					</div>
					<div className="fs-card overflow-x-auto">
						<table className="fs-table min-w-[820px]">
							<thead><tr>
								<th className="px-16">{t("colInvoice")}</th><th className="px-10">{t("colDate")}</th><th className="px-10">{t("colCustomer")}</th>
								<th className="px-10">STIR</th><th className="px-10 text-right">{t("colNet")}</th><th className="px-10 text-right">{t("taxTotal")}</th><th className="px-10 text-right">{t("gross")}</th><th className="px-10">{t("esfColStatus")}</th>
							</tr></thead>
							<tbody>
								{issued.rows.length === 0 ? <tr><td colSpan={8} className="px-16 text-13 text-[#8c948b]">{t("empty")}</td></tr> : issued.rows.map((r) => (
									<tr key={r.id} className="cursor-pointer" onClick={() => setEdit(r)}>
										<td className="px-16 text-13 font-medium">{r.number}</td>
										<td className="px-10 text-13">{r.date}</td>
										<td className="px-10 text-13">{r.customer}</td>
										<td className="px-10 text-13">{r.customerInn || "—"}</td>
										<td className="px-10 text-right text-13">{fmt(r.net)}</td>
										<td className="px-10 text-right text-13">{fmt(r.tax)}</td>
										<td className="px-10 text-right text-13">{fmt(r.gross)}</td>
										<td className="px-10 text-12">
											<span className="fs-chip h-24 px-10 text-11">{t(`esfStatus_${r.mark.status}`)}</span>
											{r.errors > 0 && <span className="ml-8 text-[#ff9f9f]" title={t("esfErrors", { n: r.errors })}><TbAlertTriangle size={14} className="inline" aria-hidden /> {r.errors}</span>}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			) : kind === "received" && received ? (
				<>
					<div className="mb-12 flex flex-wrap gap-x-20 gap-y-6 text-12 text-[#8c948b]">
						<span>{t("esfReceivedTotals", { net: money(received.totals.net, currency, locale), vat: money(received.totals.vat, currency, locale) })}</span>
						{received.totals.withoutEsfVat > 0 && <span className="text-[#F4A100]">{t("esfNoEsfVat", { vat: money(received.totals.withoutEsfVat, currency, locale) })}</span>}
					</div>
					<div className="fs-card overflow-x-auto">
						<table className="fs-table min-w-[720px]">
							<thead><tr>
								<th className="px-16">{t("colDate")}</th><th className="px-10">{t("colVendor")}</th><th className="px-10">STIR</th><th className="px-10">{t("esfColNumber")}</th>
								<th className="px-10 text-right">{t("colNet")}</th><th className="px-10 text-right">{t("taxTotal")}</th>
							</tr></thead>
							<tbody>
								{received.rows.length === 0 ? <tr><td colSpan={6} className="px-16 text-13 text-[#8c948b]">{t("empty")}</td></tr> : received.rows.map((r) => (
									<tr key={r.id} className="cursor-pointer" onClick={() => setEditRecv(r)}>
										<td className="px-16 text-13">{r.date}</td>
										<td className="px-10 text-13">{r.vendor}</td>
										<td className="px-10 text-13">{r.supplierInn || "—"}</td>
										<td className="px-10 text-13">{r.hasEsf ? r.esfNumber : <span className="text-[#F4A100]">{t("esfMissing")}</span>}</td>
										<td className="px-10 text-right text-13">{money(r.net, r.currency, locale)}</td>
										<td className="px-10 text-right text-13">{money(r.vat, r.currency, locale)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			) : null}

			{edit && <IssuedDialog row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
			{editRecv && <ReceivedDialog row={editRecv} onClose={() => setEditRecv(null)} onSaved={() => { setEditRecv(null); void load(); }} />}
		</div>
	);
}

function IssuedDialog({ row, onClose, onSaved }: { row: EsfRow; onClose: () => void; onSaved: () => void }) {
	const t = useTranslations("finance");
	const [status, setStatus] = useState<EsfStatus>(row.mark.status);
	const [number, setNumber] = useState(row.mark.number ?? "");
	const [operator, setOperator] = useState(row.mark.operator ?? "");
	const [busy, setBusy] = useState(false);
	async function save() {
		setBusy(true);
		const r = await apiCall(`/api/invoices/${row.id}/esf`, "PATCH", { status, number, operator, at: new Date().toISOString().slice(0, 10) });
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		toast.success(t("saved"));
		onSaved();
	}
	return (
		<Modal open onClose={onClose} label={t("esfDialogTitle", { number: row.number })} className="w-full max-w-[560px]">
			<div className="fs-popover max-h-[90vh] overflow-y-auto p-18 md:p-24">
				<h3 className="text-16 font-semibold text-[#f1f4ee]">{t("esfDialogTitle", { number: row.number })}</h3>
				{row.issues.length > 0 ? (
					<ul className="mt-12 flex flex-col gap-6">
						{row.issues.map((i, k) => (
							<li key={k} className={`text-12 leading-[1.5] ${i.severity === "error" ? "text-[#ff9f9f]" : "text-[#F4A100]"}`}>
								{i.severity === "error" ? "✕ " : "! "}{t(`esfIssue_${i.code}` as never, (i.params ?? {}) as never)}
							</li>
						))}
					</ul>
				) : <p className="mt-12 text-12 text-[#c6ff4d]">{t("esfComplete")}</p>}
				<div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2">
					<label className="text-12 text-[#8c948b]">{t("esfColStatus")}
						<select className="fs-field mt-6 h-40 w-full px-12 text-13 outline-none" value={status} onChange={(e) => setStatus(e.target.value as EsfStatus)}>
							{STATUSES.map((s) => <option key={s} value={s}>{t(`esfStatus_${s}`)}</option>)}
						</select>
					</label>
					<label className="text-12 text-[#8c948b]">{t("esfColNumber")}
						<input className="fs-field mt-6 h-40 w-full px-12 text-13 outline-none" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} />
					</label>
					<label className="text-12 text-[#8c948b] md:col-span-2">{t("uzEsfOperator")}
						<input className="fs-field mt-6 h-40 w-full px-12 text-13 outline-none" value={operator} onChange={(e) => setOperator(e.target.value)} maxLength={60} />
					</label>
				</div>
				<p className="mt-10 text-11 text-[#9AA396]">{t("esfMarkHint")}</p>
				<div className="mt-16 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
					<button type="button" disabled={busy} onClick={() => void save()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("save")}</button>
				</div>
			</div>
		</Modal>
	);
}

function ReceivedDialog({ row, onClose, onSaved }: { row: ReceivedRow; onClose: () => void; onSaved: () => void }) {
	const t = useTranslations("finance");
	const [number, setNumber] = useState(row.esfNumber);
	const [date, setDate] = useState(row.esfDate);
	const [inn, setInn] = useState(row.supplierInn);
	const [busy, setBusy] = useState(false);
	async function save() {
		setBusy(true);
		const r = await apiCall(`/api/expenses/${row.id}`, "PATCH", { esf: number.trim() ? { number, date, supplierInn: inn } : null });
		setBusy(false);
		if (!r.ok) return void toast.error(r.message);
		toast.success(t("saved"));
		onSaved();
	}
	return (
		<Modal open onClose={onClose} label={t("esfReceivedDialog", { vendor: row.vendor })} className="w-full max-w-[520px]">
			<div className="fs-popover p-18 md:p-24">
				<h3 className="text-16 font-semibold text-[#f1f4ee]">{t("esfReceivedDialog", { vendor: row.vendor })}</h3>
				<p className="mt-6 text-12 text-[#8c948b]">{t("esfReceivedHint")}</p>
				<div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
					<label className="text-12 text-[#8c948b]">{t("esfColNumber")}<input className="fs-field mt-6 h-40 w-full px-12 text-13 outline-none" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} /></label>
					<label className="text-12 text-[#8c948b]">{t("colDate")}<input type="date" className="fs-field mt-6 h-40 w-full px-12 text-13 outline-none" value={date} onChange={(e) => setDate(e.target.value)} /></label>
					<label className="text-12 text-[#8c948b] md:col-span-2">STIR<input className="fs-field mt-6 h-40 w-full px-12 text-13 outline-none" value={inn} onChange={(e) => setInn(e.target.value)} maxLength={20} /></label>
				</div>
				<div className="mt-16 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-38">{t("cancel")}</button>
					<button type="button" disabled={busy} onClick={() => void save()} className="fs-btn fs-btn-primary h-38 disabled:opacity-50">{t("save")}</button>
				</div>
			</div>
		</Modal>
	);
}
