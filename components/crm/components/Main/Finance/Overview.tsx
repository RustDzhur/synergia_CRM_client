"use client";
import React, { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbAlertTriangle } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";

const Kpi = ({ label, value, color }: { label: string; value: string; color?: string }) => (
	<div className="fs-card p-16">
		<p className="text-12 text-[#8c948b]">{label}</p>
		<p className="mt-6 text-20 font-semibold" style={{ color: color ?? "#f1f4ee" }}>{value}</p>
	</div>
);

// Обзор: доход, к получению, просрочено, расходы, прибыль — те же данные, что и карточка Finance на общем Dashboard,
// плюс помесячный график и предупреждение о низком остатке склада.
export default function Overview() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { dashboard, loadDashboard, settings } = useFinanceStore();
	useEffect(() => { loadDashboard(6); }, [loadDashboard]);
	if (!dashboard) return null;
	const currency = settings?.currency ?? "EUR";
	const maxSeries = Math.max(1, ...dashboard.series.map((s) => Math.max(s.revenue, s.expenses)));

	return (
		<div>
			<div className="grid grid-cols-2 gap-12 md:grid-cols-5">
				<Kpi label={t("kpiRevenue")} value={money(dashboard.revenue, currency, locale)} color="#c6ff4d" />
				<Kpi label={t("kpiOutstanding")} value={money(dashboard.outstandingAmount, currency, locale)} />
				<Kpi label={t("kpiOverdue")} value={money(dashboard.overdueAmount, currency, locale)} color={dashboard.overdueAmount > 0 ? "#eb5757" : undefined} />
				<Kpi label={t("kpiExpenses")} value={money(dashboard.expenses, currency, locale)} />
				<Kpi label={t("kpiProfit")} value={money(dashboard.profit, currency, locale)} color={dashboard.profit >= 0 ? "#c6ff4d" : "#eb5757"} />
			</div>

			<div className="mt-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("chartTitle")}</h3>
				<div className="fs-scroll flex items-end gap-10 overflow-x-auto pb-2" style={{ minHeight: 150 }}>
					{dashboard.series.map((s) => (
						<div key={s.month} className="flex shrink-0 flex-col items-center gap-[4px]" style={{ width: 40 }}>
							<div className="flex h-[120px] items-end gap-2">
								<div className="w-[14px] rounded-t-[3px] bg-[#c6ff4d]" style={{ height: `${Math.max(2, (s.revenue / maxSeries) * 120)}px` }} title={`${t("kpiRevenue")}: ${s.revenue}`} />
								<div className="w-[14px] rounded-t-[3px] bg-[#8C948B]" style={{ height: `${Math.max(2, (s.expenses / maxSeries) * 120)}px` }} title={`${t("kpiExpenses")}: ${s.expenses}`} />
							</div>
							<span className="text-11 text-[#9AA396]">{s.month.slice(5)}</span>
						</div>
					))}
				</div>
				<div className="mt-10 flex gap-20 text-12 text-[#8c948b]">
					<span className="flex items-center gap-6"><span className="h-[10px] w-[10px] rounded-[3px] bg-[#c6ff4d]" />{t("kpiRevenue")}</span>
					<span className="flex items-center gap-6"><span className="h-[10px] w-[10px] rounded-[3px] bg-[#8C948B]" />{t("kpiExpenses")}</span>
				</div>
			</div>

			<div className="mt-16 grid grid-cols-1 gap-16 md:grid-cols-2">
				<div className="fs-card p-16 md:p-20">
					<h3 className="mb-12 text-14 font-semibold text-[#f1f4ee]">{t("ordersFunnel")}</h3>
					{Object.keys(dashboard.orderCounts).length === 0 ? <p className="text-13 text-[#8c948b]">{t("empty")}</p> : (
						<ul className="flex flex-col gap-8">
							{Object.entries(dashboard.orderCounts).map(([status, n]) => (
								<li key={status} className="flex items-center justify-between text-13"><span className="text-[#8c948b]">{t(`status_${status}`)}</span><span className="font-medium text-[#f1f4ee]">{n}</span></li>
							))}
						</ul>
					)}
				</div>
				<div className="fs-card p-16 md:p-20">
					<h3 className="mb-12 text-14 font-semibold text-[#f1f4ee]">{t("lowStockTitle")}</h3>
					{dashboard.lowStock.length === 0 ? <p className="text-13 text-[#8c948b]">{t("noLowStock")}</p> : (
						<ul className="flex flex-col gap-8">
							{dashboard.lowStock.map((p) => (
								<li key={p.id} className="flex items-center gap-8 text-13 text-danger"><TbAlertTriangle size={15} /> {p.name} — {p.stockQty}/{p.reorderLevel}</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
