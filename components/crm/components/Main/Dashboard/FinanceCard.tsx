"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import { money } from "../Finance/format";
import { Kpi } from "../Ads/AdsPanel";

// Карточка «Finance» на Dashboard: доход, к получению, просрочено, расходы — те же цифры, что в разделе Finance → Overview.
export default function FinanceCard() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { dashboard, loadDashboard, settings, loadSettings } = useFinanceStore();
	useEffect(() => { loadSettings(); loadDashboard(1); }, [loadSettings, loadDashboard]);
	if (!dashboard) return null;
	const currency = settings?.currency ?? "EUR";
	const nothingYet = dashboard.revenue === 0 && dashboard.outstandingAmount === 0 && dashboard.expenses === 0 && dashboard.invoiceCounts.draft === 0;

	return (
		<section className="rounded-16 border border-[#F0F0F0] bg-white p-20 shadow-[0_2px_8px_rgba(0,0,0,0.16)] lg:p-25">
			<header className="flex flex-wrap items-center justify-between gap-12">
				<h2 className="shrink-0 text-20 font-medium text-[#4D4D4D] lg:text-24">{t("title")}</h2>
				<Link href={`/${locale}/crm/inventory`} className="text-16 font-medium text-primaryColor transition-opacity hover:opacity-80">{t("details")}</Link>
			</header>
			{nothingYet ? (
				<p className="mt-16 text-16 text-[#999999]">{t("dashboardEmpty")}</p>
			) : (
				<div className="mt-16 grid grid-cols-2 gap-10">
					<Kpi label={t("kpiRevenue")} value={money(dashboard.revenue, currency, locale)} />
					<Kpi label={t("kpiOutstanding")} value={money(dashboard.outstandingAmount, currency, locale)} />
					<Kpi label={t("kpiOverdue")} value={money(dashboard.overdueAmount, currency, locale)} />
					<Kpi label={t("kpiProfit")} value={money(dashboard.profit, currency, locale)} />
				</div>
			)}
		</section>
	);
}
