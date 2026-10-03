"use client";
import { useLocale, useTranslations } from "next-intl";
import { localeTag } from "@/utils/dateHelpers";
import { addDays, day, inputClass, OrgRow, PLANS } from "./model";

interface Props {
	orgs: OrgRow[];
	query: string;
	onQuery: (q: string) => void;
	onPatch: (id: string, body: Record<string, unknown>) => void;
	onFeatures: (o: OrgRow) => void;
	onEnv: (o: OrgRow) => void;
	onCancel: (o: OrgRow) => void;
}

export default function OrgsTable({ orgs, query, onQuery, onPatch, onFeatures, onEnv, onCancel }: Props) {
	const t = useTranslations("admin");
	const locale = useLocale();
	return (
		<>
			<div className="mb-12 flex items-center gap-12">
				<h2 className="text-14 font-semibold text-[#f1f4ee]">{t("firms")}</h2>
				<input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")} className={`${inputClass} w-[240px]`} />
			</div>
			<div className="fs-card overflow-x-auto">
				<table className="fs-table min-w-[900px]">
					<thead>
						<tr>
							{[t("colFirm"), t("colOwner"), t("colPlan"), t("colStripe"), t("colOverride"), t("colMembers"), t("colCreated"), ""].map((h, i) => <th key={i} className="px-12 py-12">{h}</th>)}
						</tr>
					</thead>
					<tbody>
						{orgs.map((o) => (
							<tr key={o.id} className={o.blocked ? "bg-[rgba(235,87,87,0.06)]" : ""}>
								<td className="px-12 py-10 text-13 font-medium text-[#f1f4ee] fs-wrap">{o.name}{o.blocked && <span className="ml-6 text-12 text-danger">({t("blockedTag")})</span>}</td>
								<td className="px-12 py-10 text-13 text-[#8c948b] fs-wrap"><span className="block">{o.ownerName}</span><span className="text-12 text-[#9AA396]">{o.ownerEmail}</span></td>
								<td className="px-12 py-10"><span className="fs-chip h-24 border-[rgba(198,255,77,0.30)] px-8 text-10 text-[#c6ff4d]">{o.plan}</span></td>
								<td className="px-12 py-10 text-13 text-[#8c948b]">
									{o.status ? `${o.stripePlan} · ${o.status}${o.interval ? ` · ${o.interval === "year" ? t("year") : t("month")}` : ""}` : "—"}
									{o.periodEnd && <span className="block text-12 text-[#9AA396]">{o.cancelAtPeriodEnd ? t("endsOn") : t("renewsOn")} {new Date(o.periodEnd).toLocaleDateString(localeTag(locale))}</span>}
								</td>
								<td className="px-12 py-10">
									<div className="flex flex-wrap items-center gap-6">
										<select value={o.override} onChange={(e) => onPatch(o.id, { planOverride: e.target.value, planOverrideUntil: e.target.value ? addDays(31) : null })} aria-label={t("colOverride")} className={inputClass}>
											<option value="">{t("noOverride")}</option>
											{PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
										</select>
										{o.override && <input type="date" value={day(o.overrideUntil)} onChange={(e) => onPatch(o.id, { planOverrideUntil: e.target.value ? new Date(`${e.target.value}T23:59:00`).toISOString() : null })} aria-label={t("until")} className={inputClass} />}
									</div>
								</td>
								<td className="px-12 py-10 text-13 text-[#8c948b]">{o.members}</td>
								<td className="px-12 py-10 text-13 text-[#9AA396]">{day(o.createdAt)}</td>
								<td className="px-12 py-10">
									<div className="flex flex-wrap gap-8">
										<button type="button" onClick={() => onFeatures(o)} className="text-12 text-[#c6ff4d] hover:underline">{t("features")}</button>
										<button type="button" onClick={() => onEnv(o)} className="text-12 text-[#c6ff4d] hover:underline">{t("envButton")}</button>
										{o.hasSubscription && !o.cancelAtPeriodEnd && <button type="button" onClick={() => onCancel(o)} className="text-12 text-[#c6ff4d] hover:underline">{t("cancelSub")}</button>}
										<button type="button" onClick={() => onPatch(o.id, { blocked: !o.blocked })} className={`text-12 hover:underline ${o.blocked ? "text-[#2DDEB6]" : "text-danger"}`}>{o.blocked ? t("unblock") : t("block")}</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				{orgs.length === 0 && <p className="py-30 text-center text-13 text-[#8c948b]">{t("none")}</p>}
			</div>
		</>
	);
}
