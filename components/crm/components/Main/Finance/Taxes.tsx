"use client";
import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbAlertTriangle, TbInfoCircle } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";
import { AiAnalysis, PeriodSwitch, ReportDisclaimer, ReportFailed, ReportLoading, useReport } from "./reportParts";
import type { IncomeSurplus, PeriodKind, VatReturn, VatLine } from "@/lib/finance/reports";

// Steuern: UStVA (Voranmeldung по НДС) и EÜR (доходы минус расходы). Цифры считает сервер
// (lib/finance/reports.ts → /api/finance/reports), здесь — только таблицы, итог, подсказки ELSTER и разбор от ИИ.

// Таблица оборотов по ставкам (и для продаж, и для входного налога): ставка, нетто, налог.
function VatLines({ title, lines, fmt }: { title: string; lines: VatLine[]; fmt: (n: number) => string }) {
	const t = useTranslations("finance");
	return (
		<section className="fs-card overflow-x-auto">
			<h3 className="px-16 pt-14 text-14 font-semibold text-[#f1f4ee]">{title}</h3>
			<table className="fs-table mt-8 min-w-[360px]">
				<thead>
					<tr>
						<th className="px-16">{t("colRate")}</th>
						<th className="px-10 text-right">{t("colNet")}</th>
						<th className="px-10 text-right">{t("taxTotal")}</th>
					</tr>
				</thead>
				<tbody>
					{lines.length === 0 ? (
						<tr><td className="px-16 text-13 text-[#8c948b]" colSpan={3}>{t("empty")}</td></tr>
					) : (
						lines.map((l) => (
							<tr key={l.rate}>
								<td className="px-16 text-13">{l.rate} %</td>
								<td className="px-10 text-right text-13">{fmt(l.net)}</td>
								<td className="px-10 text-right text-13">{fmt(l.tax)}</td>
							</tr>
						))
					)}
				</tbody>
			</table>
		</section>
	);
}

function VatView({ period, currency }: { period: PeriodKind; currency: string }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { report, loading, failed } = useReport<VatReturn>("vat", period);
	const fmt = (n: number) => money(n, currency, locale);
	if (loading) return <ReportLoading />;
	if (failed || !report) return <ReportFailed />;

	// Zahllast — доплатить (сумма > 0), Erstattung — вернут (сумма < 0); показываем абсолютную величину
	const owesTax = report.payable >= 0;

	return (
		<div className="flex flex-col gap-16">
			<p className="text-12 text-[#9AA396]">{t("periodLabel")}: {report.from} – {report.to}</p>

			{/* Kleinunternehmer (§ 19 UStG): декларация не подаётся, но цифры не прячем — они всё равно информативны */}
			{report.exempt && (
				<div className="flex items-start gap-10 rounded-10 border border-[rgba(244,161,0,0.35)] bg-[rgba(244,161,0,0.08)] p-14">
					<TbInfoCircle size={17} className="mt-[2px] shrink-0 text-[#F4A100]" aria-hidden />
					<p className="text-13 leading-[1.5] text-[#e6eae2]">{t("vatExempt")}</p>
				</div>
			)}

			<VatLines title={t("vatSalesTitle")} lines={report.sales} fmt={fmt} />
			<VatLines title={t("vatInputTitle")} lines={report.inputVat} fmt={fmt} />

			<section className="fs-card p-16 md:p-20">
				<div className="flex items-center justify-between gap-16 border-b border-inkLineSoft py-9 text-13">
					<span className="text-[#8c948b]">{t("vatSalesTax")}</span>
					<span className="font-medium text-[#f1f4ee]">{fmt(report.salesTax)}</span>
				</div>
				<div className="flex items-center justify-between gap-16 border-b border-inkLineSoft py-9 text-13">
					<span className="text-[#8c948b]">{t("vatInputTax")}</span>
					<span className="font-medium text-[#f1f4ee]">− {fmt(report.inputTax)}</span>
				</div>
				<div className="flex items-center justify-between gap-16 pt-12">
					<span className="text-15 font-semibold text-[#e6eae2]">{owesTax ? t("vatPayable") : t("vatRefund")}</span>
					<span className="text-20 font-semibold" style={{ color: owesTax ? "#F4A100" : "#c6ff4d" }}>{fmt(Math.abs(report.payable))}</span>
				</div>
			</section>

			{/* Куда именно вписать каждую цифру в ELSTER: строка бланка (Kennzahl) и поле */}
			<section className="fs-card p-16 md:p-20">
				<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("elsterTitle")}</h3>
				<p className="mt-6 text-12 text-[#8c948b]">{t("elsterHint")}</p>
				<ul className="mt-12 flex flex-col gap-10">
					{report.elster.map((e, i) => (
						<li key={i} className="flex flex-wrap items-baseline justify-between gap-x-16 gap-y-6 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] px-14 py-10">
							<div className="min-w-0">
								<p className="text-13 font-medium text-[#f1f4ee]">{e.label}</p>
								<p className="mt-4 text-12 text-[#9AA396]">{e.where}</p>
							</div>
							<div className="flex shrink-0 items-baseline gap-10">
								<span className="fs-chip h-24 px-10 text-11 text-[#cfd4cb]">Kz {e.kennzahl}</span>
								<span className="text-13 font-medium text-[#f1f4ee]">{fmt(e.value)}</span>
							</div>
						</li>
					))}
				</ul>
			</section>

			{report.warnings.length > 0 && (
				<div className="rounded-10 border border-[rgba(244,161,0,0.35)] bg-[rgba(244,161,0,0.08)] p-14">
					<p className="flex items-center gap-8 text-12 font-semibold text-[#F4A100]">
						<TbAlertTriangle size={15} aria-hidden /> {t("warningTitle")}
					</p>
					<ul className="mt-8 flex list-disc flex-col gap-6 pl-18 text-13 leading-[1.5] text-[#cfd4cb]">
						{report.warnings.map((w, i) => <li key={i}>{w}</li>)}
					</ul>
				</div>
			)}
		</div>
	);
}

// Список сумм с итогом внизу: Einnahmen (одна строка) и Ausgaben по категориям
function AmountList({ title, rows, total, totalLabel, fmt }: { title: string; rows: Array<{ label: string; amount: number }>; total: number; totalLabel: string; fmt: (n: number) => string }) {
	const t = useTranslations("finance");
	return (
		<section className="fs-card p-16 md:p-20">
			<h3 className="text-14 font-semibold text-[#f1f4ee]">{title}</h3>
			{rows.length === 0 ? (
				<p className="mt-10 text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<ul className="mt-10 flex flex-col">
					{rows.map((r) => (
						<li key={r.label} className="flex items-start justify-between gap-16 border-b border-inkLineSoft py-9 text-13 last:border-b-0">
							<span className="min-w-0 text-[#cfd4cb]">{r.label}</span>
							<span className="shrink-0 font-medium text-[#f1f4ee]">{fmt(r.amount)}</span>
						</li>
					))}
				</ul>
			)}
			<div className="mt-10 flex items-center justify-between gap-16 border-t border-inkLine pt-10 text-13">
				<span className="font-semibold text-[#e6eae2]">{totalLabel}</span>
				<span className="font-semibold text-[#f1f4ee]">{fmt(total)}</span>
			</div>
		</section>
	);
}

function EurView({ period, currency }: { period: PeriodKind; currency: string }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { report, loading, failed } = useReport<IncomeSurplus>("eur", period);
	const fmt = (n: number) => money(n, currency, locale);
	if (loading) return <ReportLoading />;
	if (failed || !report) return <ReportFailed />;

	return (
		<div className="flex flex-col gap-16">
			<p className="text-12 text-[#9AA396]">{t("periodLabel")}: {report.from} – {report.to}</p>
			<div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
				<AmountList title={t("eurIncome")} rows={report.income} total={report.incomeTotal} totalLabel={t("total")} fmt={fmt} />
				<AmountList title={t("eurExpenses")} rows={report.expenses} total={report.expenseTotal} totalLabel={t("total")} fmt={fmt} />
			</div>
			<section className="fs-card p-16 md:p-20">
				<div className="flex items-center justify-between gap-16">
					<span className="text-15 font-semibold text-[#e6eae2]">{report.profit >= 0 ? t("kpiProfit") : t("lossLabel")}</span>
					<span className="text-24 font-semibold" style={{ color: report.profit >= 0 ? "#c6ff4d" : "#eb5757" }}>{fmt(report.profit)}</span>
				</div>
			</section>
		</div>
	);
}

// kind приходит из адреса вкладки: ?tab=vat → UStVA, ?tab=eur → EÜR (см. index.tsx)
export default function Taxes({ kind }: { kind: "vat" | "eur" }) {
	const t = useTranslations("finance");
	const currency = useFinanceStore((s) => s.settings?.currency ?? "EUR");
	const [period, setPeriod] = useState<PeriodKind>("quarter");

	return (
		<div>
			<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{kind === "vat" ? t("vatTitle") : t("eurTitle")}</h2>
				<PeriodSwitch value={period} onChange={setPeriod} />
			</div>
			{kind === "vat" ? <VatView period={period} currency={currency} /> : <EurView period={period} currency={currency} />}
			<div className="mt-16"><AiAnalysis kind={kind} period={period} /></div>
			<ReportDisclaimer className="mt-14" />
		</div>
	);
}
