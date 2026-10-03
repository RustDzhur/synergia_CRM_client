"use client";
import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbAlertTriangle } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { money } from "./format";
import PairBars from "../shared/PairBars";

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
	// календарный год: все 12 месяцев, январь–декабрь
	useEffect(() => { loadDashboard(12, new Date().getFullYear()); }, [loadDashboard]);
	if (!dashboard) return null;
	const currency = settings?.currency ?? "EUR";

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
				<PairBars data={dashboard.series.map((s) => ({ label: s.month.slice(5), a: s.revenue, b: s.expenses, titleA: `${t("kpiRevenue")}: ${s.revenue}`, titleB: `${t("kpiExpenses")}: ${s.expenses}` }))} />
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
