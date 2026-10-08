"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { uzFieldError, UZ_TAX_REGIMES, type UzProfile } from "@/lib/validation/uz";
import { apiCall } from "@/store/crmApi";
import FormField from "../../shared/FormField";

// Карточка «Узбекистан: реквизиты фирмы» (docs/TZ_MASTER.md §4.2). Валидаторы общие с сервером (lib/validation/uz.ts):
// они возвращают код ошибки, текст берётся из переводов (uzErr_*). Пустое поле ошибкой не считается.

interface Rule { code: string; title: Record<string, string>; rate: number | null; validFrom: string; validTo: string | null; source: string; sourceUrl: string; verifiedBy: string | null }

export default function UzProfileCard({ value, onChange }: { value: UzProfile; onChange: (next: UzProfile) => void }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [rules, setRules] = useState<Rule[]>([]);
	useEffect(() => {
		let alive = true;
		void apiCall<{ rules: Rule[] }>("/api/finance/tax-rules?market=UZ").then((r) => { if (alive && r.ok && r.data) setRules(r.data.rules); });
		return () => { alive = false; };
	}, []);

	const set = (patch: Partial<UzProfile>) => onChange({ ...value, ...patch });
	const label = "mb-6 block text-12 text-[#8c948b]";
	const hint = "mt-[4px] block text-11 text-[#9AA396]";
	const err = "mt-[4px] block text-11 text-[#ff9f9f]";
	const error = (k: keyof UzProfile) => { const code = uzFieldError(k, value[k]); return code ? t(`uzErr_${code}` as never) : ""; };
	const text = (k: keyof UzProfile, labelKey: string, opts: { maxLength?: number; hint?: string; placeholder?: string } = {}) => (
		<div>
			<FormField label={t(labelKey as never)} value={String(value[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as Partial<UzProfile>)} maxLength={opts.maxLength ?? 120} placeholder={opts.placeholder} />
			{error(k) ? <span className={err}>{error(k)}</span> : opts.hint ? <span className={hint}>{opts.hint}</span> : null}
		</div>
	);
	const title = (r: Rule) => r.title?.[locale === "ua" ? "ua" : locale] || r.title?.en || r.code;

	return (
		<div className="mb-16 fs-card p-16 md:p-20">
			<h3 className="text-14 font-semibold text-[#f1f4ee]">{t("uzSection")}</h3>
			<p className="mt-6 text-12 text-[#8c948b]">{t("uzSectionHint")}</p>
			<div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
				{text("inn", "uzInn", { maxLength: 20, hint: t("uzInnHint") })}
				{text("pinfl", "uzPinfl", { maxLength: 20 })}
				{text("vatCode", "uzVatCode", { maxLength: 20 })}
				{text("oked", "uzOked", { maxLength: 40 })}
				{text("bank", "uzBank")}
				{text("mfo", "uzMfo", { maxLength: 10 })}
				{text("account", "uzAccount", { maxLength: 30 })}
				{text("esfOperator", "uzEsfOperator", { maxLength: 60 })}
				{text("director", "uzDirector")}
				{text("accountant", "uzAccountant")}
				<div>
					<span className={label}>{t("uzTaxRegime")}</span>
					<select className="fs-field h-40 w-full px-12 text-13 outline-none" value={value.taxRegime} onChange={(e) => set({ taxRegime: e.target.value as UzProfile["taxRegime"] })}>
						<option value="">—</option>
						{UZ_TAX_REGIMES.map((r) => <option key={r} value={r}>{t(`uzRegime_${r}` as never)}</option>)}
					</select>
				</div>
				<div>
					<FormField label={t("uzVatRegDate")} value={value.vatRegDate} onChange={(e) => set({ vatRegDate: e.target.value })} maxLength={10} placeholder="2026-06-01" />
					{error("vatRegDate") && <span className={err}>{error("vatRegDate")}</span>}
				</div>
			</div>
			<label className="mt-14 flex items-center gap-10 text-13 text-[#cfd4cb]">
				<input type="checkbox" checked={value.vatPayer} onChange={(e) => set({ vatPayer: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
				{t("uzVatPayer")}
			</label>

			{rules.length > 0 && (
				<div className="mt-18 border-t border-inkLine pt-14">
					<h4 className="text-13 font-semibold text-[#f1f4ee]">{t("uzRulesTitle")}</h4>
					<p className="mt-4 text-11 text-[#9AA396]">{t("uzRulesHint")}</p>
					<ul className="mt-10 flex flex-col gap-8">
						{rules.map((r) => (
							<li key={`${r.code}-${r.validFrom}`} className="rounded-10 border border-inkLine bg-[rgba(255,255,255,0.02)] px-12 py-9 text-12">
								<div className="flex flex-wrap items-baseline justify-between gap-x-12 gap-y-4">
									<span className="font-medium text-[#e6eae2]">{title(r)}{r.rate != null ? ` — ${r.rate} %` : ""}</span>
									<span className="text-11 text-[#9AA396]">{t("uzRuleFrom", { date: r.validFrom })}{r.validTo ? ` · ${t("uzRuleTo", { date: r.validTo })}` : ""}</span>
								</div>
								<div className="mt-4 flex flex-wrap items-center justify-between gap-x-12 gap-y-4 text-11">
									<a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-[#8c948b] underline-offset-2 hover:underline">{t("uzRuleSource")}: {r.source}</a>
									<span className={r.verifiedBy ? "text-[#c6ff4d]" : "text-[#F4A100]"}>{r.verifiedBy ? t("uzRuleVerified", { by: r.verifiedBy }) : t("uzRuleUnverified")}</span>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
