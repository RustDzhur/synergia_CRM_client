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
				<div key={String(k)} className={cardClass}><p className="text-11 text-[#9aa7c9]">{k}</p><p className="text-18 font-semibold text-[#edf2ff]">{v}</p></div>
			))}
			<div className={cardClass}><p className="text-11 text-[#9aa7c9]">{t("mrr")}</p><p className="text-18 font-semibold text-[#edf2ff]">{summary.mrr} €</p></div>
			<div className={cardClass}><p className="text-11 text-[#9aa7c9]">{t("blocked")}</p><p className="text-18 font-semibold text-[#edf2ff]">{summary.blocked}</p></div>
			<div className={cardClass}><p className="text-11 text-[#9aa7c9]">{t("newRequests")}</p><p className="text-18 font-semibold text-[#edf2ff]">{summary.newRequests}</p></div>
		</div>
	);
}
