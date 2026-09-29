"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";
import { AiAnalysis, PeriodSwitch, ReportDisclaimer, ReportFailed, ReportLoading, useReport } from "./reportParts";
import type { BusinessAnalysis, PeriodKind, TrialBalance } from "@/lib/finance/reports";
import { localeTag } from "@/utils/dateHelpers";

// Auswertungen: BWA (выручка, затраты и результат по месяцам) и SuSa (управленческая оборотно-сальдовая ведомость).
// Цифры считает сервер (lib/finance/reports.ts → /api/finance/reports); клиент только показывает их и период.

// «2026-07» → «Июл 2026» на языке интерфейса (под столбиком графика — без года, там он не помещается).
// Дату собираем в местном времени, чтобы месяц не съезжал на день назад.
const monthLabel = (period: string, locale: string, withYear = true) => {
	const [y, m] = period.split("-");
	const tag = localeTag(locale);
	return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(tag, withYear ? { month: "short", year: "numeric" } : { month: "short" });
};

function BwaView({ period, currency }: { period: PeriodKind; currency: string }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { report, loading, failed } = useReport<BusinessAnalysis>("bwa", period);
	const fmt = (n: number) => money(n, currency, locale);
	if (loading) return <ReportLoading />;
	if (failed || !report) return <ReportFailed />;

	// общая шкала для графика: максимальная из выручки и затрат всех месяцев
	const max = Math.max(1, ...report.months.map((m) => Math.max(m.revenue, m.costs)));

	return (
		<div className="flex flex-col gap-16">
			<p className="text-12 text-[#9AA396]">{t("periodLabel")}: {report.from} – {report.to}</p>

			{report.months.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<>
					{/* Выручка и затраты по месяцам — те же столбики, что в обзоре раздела (простые div'ы, без библиотек) */}
					<section className="fs-card p-16 md:p-20">
						<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("bwaChartTitle")}</h3>
						<div className="fs-scroll flex items-end gap-10 overflow-x-auto pb-2" style={{ minHeight: 150 }}>
							{report.months.map((m) => (
								<div key={m.period} className="flex shrink-0 flex-col items-center gap-[4px]" style={{ width: 44 }}>
									<div className="flex h-[120px] items-end gap-2">
										<div className="w-[14px] rounded-t-[3px] bg-[#c6ff4d]" style={{ height: `${Math.max(2, (m.revenue / max) * 120)}px` }} title={`${t("bwaRevenue")}: ${m.revenue}`} />
										<div className="w-[14px] rounded-t-[3px] bg-[#8C948B]" style={{ height: `${Math.max(2, (m.costs / max) * 120)}px` }} title={`${t("bwaCosts")}: ${m.costs}`} />
									</div>
									<span className="text-11 text-[#9AA396]">{monthLabel(m.period, locale, false)}</span>
								</div>
							))}
						</div>
						<div className="mt-10 flex gap-20 text-12 text-[#8c948b]">
							<span className="flex items-center gap-6"><span className="h-[10px] w-[10px] rounded-[3px] bg-[#c6ff4d]" />{t("bwaRevenue")}</span>
							<span className="flex items-center gap-6"><span className="h-[10px] w-[10px] rounded-[3px] bg-[#8C948B]" />{t("bwaCosts")}</span>
						</div>
					</section>

					<section className="fs-card overflow-x-auto">
						<table className="fs-table min-w-[560px]">
							<thead>
								<tr>
									<th className="px-16">{t("colMonth")}</th>
									<th className="px-10 text-right">{t("bwaRevenue")}</th>
									<th className="px-10 text-right">{t("bwaCosts")}</th>
									<th className="px-10 text-right">{t("kpiProfit")}</th>
								</tr>
							</thead>
							<tbody>
								{report.months.map((m) => (
									<tr key={m.period}>
										<td className="px-16 text-13">{monthLabel(m.period, locale)}</td>
										<td className="px-10 text-right text-13">{fmt(m.revenue)}</td>
										<td className="px-10 text-right text-13">{fmt(m.costs)}</td>
										<td className="px-10 text-right text-13" style={{ color: m.profit >= 0 ? "#c6ff4d" : "#eb5757" }}>{fmt(m.profit)}</td>
									</tr>
								))}
							</tbody>
							<tfoot>
								<tr>
									<td className="border-t border-inkLine px-16 py-12 text-13 font-semibold text-[#e6eae2]">{t("total")}</td>
									<td className="border-t border-inkLine px-10 py-12 text-right text-13 font-semibold text-[#f1f4ee]">{fmt(report.revenue)}</td>
									<td className="border-t border-inkLine px-10 py-12 text-right text-13 font-semibold text-[#f1f4ee]">{fmt(report.costs)}</td>
									<td className="border-t border-inkLine px-10 py-12 text-right text-13 font-semibold" style={{ color: report.profit >= 0 ? "#c6ff4d" : "#eb5757" }}>{fmt(report.profit)}</td>
								</tr>
							</tfoot>
						</table>
					</section>
				</>
			)}

			<section className="fs-card p-16 md:p-20">
				<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("bwaCostBreakdown")}</h3>
				{report.costRows.length === 0 ? (
					<p className="mt-10 text-13 text-[#8c948b]">{t("empty")}</p>
				) : (
					<ul className="mt-10 flex flex-col">
						{report.costRows.map((c) => (
							<li key={c.key} className="flex items-start justify-between gap-16 border-b border-inkLineSoft py-9 text-13 last:border-b-0">
								<span className="min-w-0 text-[#cfd4cb]">{c.key}</span>
								<span className="flex shrink-0 items-baseline gap-10">
									<span className="text-12 text-[#9AA396]">{report.costs > 0 ? Math.round((c.amount / report.costs) * 100) : 0} %</span>
									<span className="font-medium text-[#f1f4ee]">{fmt(c.amount)}</span>
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}

function SusaView({ period, currency }: { period: PeriodKind; currency: string }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { report, loading, failed } = useReport<TrialBalance>("susa", period);
	const fmt = (n: number) => money(n, currency, locale);
	if (loading) return <ReportLoading />;
	if (failed || !report) return <ReportFailed />;

	return (
		<div className="flex flex-col gap-16">
			<p className="text-12 text-[#9AA396]">{t("periodLabel")}: {report.from} – {report.to}</p>
			<section className="fs-card overflow-x-auto">
				<table className="fs-table min-w-[560px]">
					<thead>
						<tr>
							<th className="px-16">{t("colAccount")}</th>
							<th className="px-10">{t("colName")}</th>
							<th className="px-10 text-right">{t("colDebit")}</th>
							<th className="px-10 text-right">{t("colCredit")}</th>
							<th className="px-10 text-right">{t("colBalance")}</th>
						</tr>
					</thead>
					<tbody>
						{report.rows.length === 0 ? (
							<tr><td className="px-16 text-13 text-[#8c948b]" colSpan={5}>{t("empty")}</td></tr>
						) : (
							report.rows.map((r) => (
								<tr key={`${r.account}-${r.name}`}>
									<td className="px-16 text-13 text-[#8c948b]">{r.account}</td>
									<td className="px-10 text-13 font-medium text-[#f1f4ee]">{r.name}</td>
									<td className="px-10 text-right text-13">{fmt(r.debit)}</td>
									<td className="px-10 text-right text-13">{fmt(r.credit)}</td>
									<td className="px-10 text-right text-13">{fmt(r.balance)}</td>
								</tr>
							))
						)}
					</tbody>
					<tfoot>
						<tr>
							<td className="border-t border-inkLine px-16 py-12 text-13 font-semibold text-[#e6eae2]" colSpan={2}>{t("total")}</td>
							<td className="border-t border-inkLine px-10 py-12 text-right text-13 font-semibold text-[#f1f4ee]">{fmt(report.debitTotal)}</td>
							<td className="border-t border-inkLine px-10 py-12 text-right text-13 font-semibold text-[#f1f4ee]">{fmt(report.creditTotal)}</td>
							<td className="border-t border-inkLine" />
						</tr>
					</tfoot>
				</table>
			</section>
		</div>
	);
}

// kind приходит из адреса вкладки: ?tab=bwa → BWA, ?tab=susa → SuSa (см. index.tsx)
export default function Reports({ kind }: { kind: "bwa" | "susa" }) {
	const t = useTranslations("finance");
	const currency = useFinanceStore((s) => s.settings?.currency ?? "EUR");
	const [period, setPeriod] = useState<PeriodKind>("quarter");

	return (
		<div>
			<div className="mb-16 flex flex-wrap items-center justify-between gap-x-20 gap-y-10">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{kind === "bwa" ? t("bwaTitle") : t("susaTitle")}</h2>
				<PeriodSwitch value={period} onChange={setPeriod} />
			</div>
			{kind === "bwa" ? <BwaView period={period} currency={currency} /> : <SusaView period={period} currency={currency} />}
			{/* Разбор от ИИ: цифры считает сервер, модель только объясняет их словами */}
			<div className="mt-16"><AiAnalysis kind={kind} period={period} /></div>
			<ReportDisclaimer className="mt-14" />
		</div>
	);
}
