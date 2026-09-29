"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type FinanceDashboard, useFinanceStore } from "@/store/useFinanceStore";
import { useFeature, useOrgStore } from "@/store/useOrgStore";
import { money } from "../Finance/format";
import { Kpi } from "../Ads/AdsPanel";

// Карточка «Finance» на Dashboard: доход, к получению, просрочено, расходы — те же цифры, что в разделе Finance → Overview.
export default function FinanceCard() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const enabled = useFeature("inventory");
	// пока список фирм не загружен, неизвестно, входят ли финансы в тариф — запрос не отправляем
	const planLoaded = useOrgStore((s) => s.loaded);
	const { dashboard, loadDashboard, settings, loadSettings } = useFinanceStore();
	useEffect(() => { if (planLoaded && enabled) { loadSettings(); loadDashboard(1); } }, [planLoaded, enabled, loadSettings, loadDashboard]);
	// финансы не входят в тариф фирмы — карточки на дашборде нет (раздела всё равно нет в меню)
	if (!planLoaded || !enabled || !dashboard) return null;
	const currency = settings?.currency ?? "EUR";
	const nothingYet = dashboard.revenue === 0 && dashboard.outstandingAmount === 0 && dashboard.expenses === 0 && dashboard.invoiceCounts.draft === 0;

	return (
		<section className="fs-card p-16 md:p-20">
			<header className="flex flex-wrap items-center justify-between gap-12">
				<h2 className="shrink-0 text-14 font-semibold text-[#f1f4ee]">{t("title")}</h2>
				<Link href={`/${locale}/crm/inventory`} className="text-12 font-semibold text-[#c6ff4d] transition-opacity hover:opacity-80">{t("details")}</Link>
			</header>
			{nothingYet ? (
				<p className="mt-14 text-13 text-[#8c948b]">{t("dashboardEmpty")}</p>
			) : (
				<>
					<div className="mt-14 grid grid-cols-2 gap-8">
						<Kpi label={t("kpiRevenue")} value={money(dashboard.revenue, currency, locale)} />
						<Kpi label={t("kpiOutstanding")} value={money(dashboard.outstandingAmount, currency, locale)} />
						<Kpi label={t("kpiOverdue")} value={money(dashboard.overdueAmount, currency, locale)} />
						<Kpi label={t("kpiProfit")} value={money(dashboard.profit, currency, locale)} />
					</div>
					{/* Доход и расходы по месяцам — тот же график, что в разделе «Финансы», чтобы цифры
					    были видны сразу после входа, не открывая раздел */}
					<FinanceBars series={dashboard.series} />
				</>
			)}
		</section>
	);
}

// Столбики «доход / расходы» по месяцам. Две колонки на месяц, высота считается от максимума серии,
// поэтому график читается и при маленьких суммах.
function FinanceBars({ series }: { series: FinanceDashboard["series"] }) {
	const t = useTranslations("finance");
	const max = Math.max(1, ...series.flatMap((s) => [s.revenue, s.expenses]));
	return (
		<div className="mt-16 border-t border-inkLine pt-14">
			<div className="fs-scroll flex items-end gap-10 overflow-x-auto pb-2" style={{ minHeight: 120 }}>
				{series.map((s) => (
					<div key={s.month} className="flex shrink-0 flex-col items-center gap-4" style={{ width: 40 }}>
						<div className="flex h-[96px] items-end gap-2">
							<div
								className="w-[13px] rounded-t-3 bg-[#c6ff4d]"
								style={{ height: `${Math.max(2, (s.revenue / max) * 96)}px` }}
								title={`${t("kpiRevenue")}: ${s.revenue}`}
							/>
							<div
								className="w-[13px] rounded-t-3 bg-[#8C948B]"
								style={{ height: `${Math.max(2, (s.expenses / max) * 96)}px` }}
								title={`${t("kpiExpenses")}: ${s.expenses}`}
							/>
						</div>
						<span className="text-11 text-[#9AA396]">{s.month.slice(5)}</span>
					</div>
				))}
			</div>
			<div className="mt-8 flex gap-20 text-11 text-[#8c948b]">
				<span className="flex items-center gap-6"><span className="h-10 w-10 rounded-3 bg-[#c6ff4d]" />{t("kpiRevenue")}</span>
				<span className="flex items-center gap-6"><span className="h-10 w-10 rounded-3 bg-[#8C948B]" />{t("kpiExpenses")}</span>
			</div>
		</div>
	);
}
