"use client";
import { useTranslations } from "next-intl";
import { cardClass, Summary } from "./model";

export default function StatsGrid({ summary }: { summary: Summary }) {
	const t = useTranslations("admin");
	return (
		<div className="mb-24 grid grid-cols-2 gap-12 md:grid-cols-5">
			{[
				[t("firms"), summary.orgs], [t("users"), summary.users],
				[t("planFree"), summary.byPlan.free], [t("planStandard"), summary.byPlan.standard], [t("planProfessional"), summary.byPlan.professional],
			].map(([k, v]) => (
				<div key={String(k)} className={cardClass}><p className="text-11 text-[#8c948b]">{k}</p><p className="text-18 font-semibold text-[#f1f4ee]">{v}</p></div>
			))}
			<div className={cardClass}><p className="text-11 text-[#8c948b]">{t("mrr")}</p><p className="text-18 font-semibold text-[#f1f4ee]">{summary.mrr} €</p></div>
			<div className={cardClass}><p className="text-11 text-[#8c948b]">{t("blocked")}</p><p className="text-18 font-semibold text-[#f1f4ee]">{summary.blocked}</p></div>
			<div className={cardClass}><p className="text-11 text-[#8c948b]">{t("newRequests")}</p><p className="text-18 font-semibold text-[#f1f4ee]">{summary.newRequests}</p></div>
		</div>
	);
}
