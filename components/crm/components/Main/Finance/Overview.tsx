"use client";
import React, { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdWarning } from "react-icons/md";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import { money } from "./format";

const Kpi = ({ label, value, color }: { label: string; value: string; color?: string }) => (
	<div className="rounded-16 bg-white p-20 shadow-heroImage">
		<p className="text-14 text-[#999999]">{label}</p>
		<p className="mt-6 text-24 font-semibold" style={{ color: color ?? "#333333" }}>{value}</p>
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
			<div className="grid grid-cols-2 gap-14 md:grid-cols-5">
				<Kpi label={t("kpiRevenue")} value={money(dashboard.revenue, currency, locale)} color="#0A8A2E" />
				<Kpi label={t("kpiOutstanding")} value={money(dashboard.outstandingAmount, currency, locale)} />
				<Kpi label={t("kpiOverdue")} value={money(dashboard.overdueAmount, currency, locale)} color={dashboard.overdueAmount > 0 ? "#EB5757" : undefined} />
				<Kpi label={t("kpiExpenses")} value={money(dashboard.expenses, currency, locale)} />
				<Kpi label={t("kpiProfit")} value={money(dashboard.profit, currency, locale)} color={dashboard.profit >= 0 ? "#0A8A2E" : "#EB5757"} />
			</div>

			<div className="mt-20 rounded-16 bg-white p-20 shadow-heroImage">
				<h3 className="mb-16 text-18 font-medium text-[#333333]">{t("chartTitle")}</h3>
				<div className="flex items-end gap-10 overflow-x-auto pb-2" style={{ minHeight: 160 }}>
					{dashboard.series.map((s) => (
						<div key={s.month} className="flex shrink-0 flex-col items-center gap-[4px]" style={{ width: 44 }}>
							<div className="flex h-[130px] items-end gap-2">
								<div className="w-[16px] rounded-t-4 bg-[#8CB5E1]" style={{ height: `${Math.max(2, (s.revenue / maxSeries) * 130)}px` }} title={`${t("kpiRevenue")}: ${s.revenue}`} />
								<div className="w-[16px] rounded-t-4 bg-[#F4A100]" style={{ height: `${Math.max(2, (s.expenses / maxSeries) * 130)}px` }} title={`${t("kpiExpenses")}: ${s.expenses}`} />
							</div>
							<span className="text-12 text-[#999999]">{s.month.slice(5)}</span>
						</div>
					))}
				</div>
				<div className="mt-10 flex gap-20 text-14 text-[#666666]">
					<span className="flex items-center gap-6"><span className="h-[10px] w-[10px] rounded-4 bg-[#8CB5E1]" />{t("kpiRevenue")}</span>
					<span className="flex items-center gap-6"><span className="h-[10px] w-[10px] rounded-4 bg-[#F4A100]" />{t("kpiExpenses")}</span>
				</div>
			</div>

			<div className="mt-20 grid grid-cols-1 gap-20 md:grid-cols-2">
				<div className="rounded-16 bg-white p-20 shadow-heroImage">
					<h3 className="mb-14 text-18 font-medium text-[#333333]">{t("ordersFunnel")}</h3>
					{Object.keys(dashboard.orderCounts).length === 0 ? <p className="text-14 text-[#999999]">{t("empty")}</p> : (
						<ul className="flex flex-col gap-8">
							{Object.entries(dashboard.orderCounts).map(([status, n]) => (
								<li key={status} className="flex items-center justify-between text-14"><span className="text-[#666666]">{t(`status_${status}`)}</span><span className="font-medium text-[#333333]">{n}</span></li>
							))}
						</ul>
					)}
				</div>
				<div className="rounded-16 bg-white p-20 shadow-heroImage">
					<h3 className="mb-14 text-18 font-medium text-[#333333]">{t("lowStockTitle")}</h3>
					{dashboard.lowStock.length === 0 ? <p className="text-14 text-[#999999]">{t("noLowStock")}</p> : (
						<ul className="flex flex-col gap-8">
							{dashboard.lowStock.map((p) => (
								<li key={p.id} className="flex items-center gap-8 text-14 text-danger"><MdWarning size={16} /> {p.name} — {p.stockQty}/{p.reorderLevel}</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
