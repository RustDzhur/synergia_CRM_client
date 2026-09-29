"use client";
import { useTranslations } from "next-intl";
import { type FeatureKey, FEATURE_KEYS, limitsLine, planFor } from "@/config/plans";
import Modal from "../../shared/Modal";
import { inputClass, OrgRow } from "./model";

interface Props {
	org: OrgRow | null;
	onClose: () => void;
	onToggle: (key: FeatureKey, value: boolean | undefined) => void;
}

// Разделы фирмы: что открыто по тарифу и что администратор включил или выключил вручную
export default function FeaturesModal({ org, onClose, onToggle }: Props) {
	const t = useTranslations("admin");
	const tf = useTranslations("upgrade");
	return (
		<Modal open={!!org} onClose={onClose} label={t("features")} align="top" className="fs-popover w-full max-w-[560px] p-20">
			{org && (
				<>
					<h2 className="mb-6 text-15 font-semibold text-[#f1f4ee]">{t("featuresTitle", { name: org.name })}</h2>
					<p className="mb-16 text-12 text-[#8c948b]">{t("featuresHelp")}</p>
					<div className="mb-16 flex flex-wrap items-center gap-8 text-12 text-[#8c948b]">
						<span className="fs-chip h-24 border-[rgba(198,255,77,0.30)] px-8 text-10 text-[#c6ff4d]">{org.plan}</span>
						<span>{limitsLine(planFor(org.plan), tf)}</span>
					</div>
					<ul className="mb-20 flex flex-col gap-8">
						{FEATURE_KEYS.map((key) => {
							const byPlan = !!planFor(org.plan).features[key];
							const override = org.featureOverrides?.[key];
							const on = override ?? byPlan;
							return (
								<li key={key} className="flex items-center gap-12 rounded-10 border border-inkLine p-10">
									<span className="flex-1 text-13 text-[#f1f4ee]">{tf(key)}</span>
									<span className={`rounded-50 px-10 py-2 text-10 ${on ? "bg-[rgba(45,222,182,0.12)] text-[#2DDEB6]" : "bg-[rgba(255,255,255,0.05)] text-[#8c948b]"}`}>
										{override === undefined ? (byPlan ? t("featByPlan") : t("featOff")) : override ? t("featExtra") : t("featOff")}
									</span>
									<select
										value={override === undefined ? "" : override ? "on" : "off"}
										onChange={(e) => onToggle(key, e.target.value === "" ? undefined : e.target.value === "on")}
										aria-label={tf(key)}
										className={inputClass}>
										<option value="">{t("featByPlan")}</option>
										<option value="on">{t("featExtra")}</option>
										<option value="off">{t("featOff")}</option>
									</select>
								</li>
							);
						})}
					</ul>
					<button type="button" onClick={onClose} className="fs-btn fs-btn-primary h-36">{t("cancel")}</button>
				</>
			)}
		</Modal>
	);
}
