"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useActiveOrg } from "@/store/useOrgStore";
import ActivityWizard from "../activityParts/ActivityWizard";

// «Налаштування → Види діяльності»: тот же мастер «Чем занимается фирма?», но открывается вручную.
// Раньше мастер показывался один раз и пропадал навсегда — фирма, выбравшая «тільки послуги», не могла
// потом включить производство или опт. Обещание мастера «змінити можна в налаштуваннях» теперь правда.
export default function ActivitiesCard() {
	const t = useTranslations("finance");
	const org = useActiveOrg();
	const [open, setOpen] = useState(false);
	const activities = org?.activities ?? [];

	return (
		<div className="mb-16 fs-card p-16 md:p-20">
			<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("actSection")}</h3>
			<p className="mb-12 text-12 leading-[1.5] text-[#8c948b]">{t("actSectionHint")}</p>
			<p className="mb-14 text-13 text-[#cfd4cb]">{activities.length ? activities.map((a) => t(`act_${a}`)).join(" · ") : t("actNone")}</p>
			<button type="button" onClick={() => setOpen(true)} className="fs-btn fs-btn-ghost h-38">{t("actChange")}</button>
			<ActivityWizard open={open} onClose={() => setOpen(false)} initial={activities} edit />
		</div>
	);
}
