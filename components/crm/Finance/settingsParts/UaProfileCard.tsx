"use client";
import React, { useRef } from "react";
import toast from "react-hot-toast";
import { useFormatter, useTranslations } from "next-intl";
import { TbUpload } from "react-icons/tb";
import { fileToLogo, MAX_AVATAR_FILE_BYTES } from "@/utils/avatar";
import { limitsForYear, rulesFor, rulesNotice } from "@/lib/finance/ua/rules";
import { taxSystemsFor, uaFieldError, type UaTaxSystem } from "@/lib/validation/ua";
import FormField from "../../shared/FormField";

// Карточка «Украина: налоговый профиль» (ТЗ §6). Форма зависит от uaLegalForm: ФОП не видит полей
// юрлица (ЄДРПОУ) и наоборот; система налогообложения ведёт за собой группу єдиного податку.
// Валидаторы общие с сервером (lib/validation/ua.ts) — они возвращают код, текст берётся из переводов.

export interface UaProfileForm {
	uaLegalForm: string;
	uaTaxSystem: string;
	uaGroup: string;
	uaSingleRate: string;
	uaVatPayer: boolean;
	uaVatRegDate: string;
	uaVatCertificate: string;
	uaVatRates: number[];
	uaEdrpou: string;
	uaIpn: string;
	uaKved: string;
	uaBank: string;
	uaIban: string;
	uaMfo: string;
	uaSignerName: string;
	uaSignerPosition: string;
	uaSignature: string;
	uaSeal: string;
	uaEsvMonthly: string;
	uaMilitaryRate: string;
	uaMilitaryFixed: string;
	uaVatLimit: string;
	uaVatPeriod: string;
	rateMargin: string;
}

export default function UaProfileCard({ form, set, year }: { form: UaProfileForm; set: (patch: Partial<UaProfileForm>) => void; year: number }) {
	const t = useTranslations("finance");
	const format = useFormatter();
	const signatureInput = useRef<HTMLInputElement>(null);
	const sealInput = useRef<HTMLInputElement>(null);

	const field = "fs-field h-40 w-full px-12 text-13 outline-none";
	const label = "mb-6 block text-12 text-[#8c948b]";
	const hint = "mt-[4px] block text-11 text-[#9AA396]";
	const err = "mt-[4px] block text-11 text-[#ff9f9f]";

	// Ошибка поля — код из общего валидатора; пустое поле ошибкой не считается
	const error = (key: keyof UaProfileForm): string => {
		const code = uaFieldError(key, form[key]);
		return code ? t(`uaErr_${code}`) : "";
	};

	const isCompany = form.uaLegalForm === "tov" || form.uaLegalForm === "other";
	const systems = taxSystemsFor(form.uaLegalForm);
	const rates = rulesFor(year);
	const limits = limitsForYear({ uaLimits: limitsFromForm(form, year) }, year);

	async function pickImage(e: React.ChangeEvent<HTMLInputElement>, key: "uaSignature" | "uaSeal") {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/")) return void toast.error(t("logoNotImage"));
		if (file.size > MAX_AVATAR_FILE_BYTES) return void toast.error(t("logoTooBig"));
		try {
			const data = await fileToLogo(file);
			set({ [key]: data } as Partial<UaProfileForm>);
		} catch {
			toast.error(t("logoNotImage"));
		}
	}

	// Лимиты живут отдельным массивом [{year, group, amount}] и не входят в плоскую форму: собираем
	// их строковые значения при каждом рендере, а сохраняет их submit в Settings.tsx
	function limitsFromForm(f: UaProfileForm, y: number): Array<{ year: number; group: number; amount: number }> {
		const raw = (f as unknown as { uaLimitsText?: Record<string, string> }).uaLimitsText ?? {};
		return [1, 2, 3].map((group) => ({ year: y, group, amount: Number(raw[String(group)] ?? "") || 0 }));
	}

	const limitsText = (form as unknown as { uaLimitsText?: Record<string, string> }).uaLimitsText ?? {};

	return (
		<div className="mb-16 fs-card p-16 md:p-20">
			<h3 className="mb-4 text-14 font-semibold text-[#f1f4ee]">{t("uaSection")}</h3>
			<p className="mb-14 text-12 leading-[1.5] text-[#8c948b]">{t("uaSectionHint")}</p>
			<p className="mb-14 text-11 text-[#9AA396]">{rulesNotice(year)} · {rates.source}</p>

			<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
				<label className="block">
					<span className={label}>{t("uaLegalForm")}</span>
					<select
						value={form.uaLegalForm}
						onChange={(e) => {
							// Смена формы ведёт за собой систему: у ФОП и юрлица разные системы налогообложения
							const legalForm = e.target.value;
							const allowed = taxSystemsFor(legalForm);
							const next = allowed.includes(form.uaTaxSystem as UaTaxSystem) ? form.uaTaxSystem : allowed[0];
							set({ uaLegalForm: legalForm, uaTaxSystem: next });
						}}
						className={field}>
						<option value="fop">{t("uaLegalFop")}</option>
						<option value="tov">{t("uaLegalTov")}</option>
						<option value="other">{t("uaLegalOther")}</option>
					</select>
				</label>
				<label className="block">
					<span className={label}>{t("uaTaxSystem")}</span>
					<select value={form.uaTaxSystem} onChange={(e) => {
						const system = e.target.value as UaTaxSystem;
						// Группа следует за системой: single_2 → 2-я группа, general_* → общая система
						const group = system.startsWith("single_") ? system.replace("single_", "") : "0";
						set({ uaTaxSystem: system, uaGroup: group });
					}} className={field}>
						{systems.map((s) => <option key={s} value={s}>{t(`uaSystem_${s}`)}</option>)}
					</select>
				</label>
				{(form.uaTaxSystem === "single_3" || form.uaTaxSystem === "single_tov") && (
					<label className="block">
						<span className={label}>{t("uaSingleRate")}</span>
						<select value={form.uaSingleRate} onChange={(e) => set({ uaSingleRate: e.target.value })} className={field}>
							<option value="5">{t("uaSingle5")}</option>
							<option value="3">{t("uaSingle3")}</option>
						</select>
					</label>
				)}
			</div>

			{/* ПДВ: у неплатника документы печатают «ПДВ не нараховується», поэтому ставки спрашиваем только у плательщика */}
			<label className="mt-14 flex items-center gap-10 text-13 text-[#cfd4cb]">
				<input type="checkbox" checked={form.uaVatPayer} onChange={(e) => set({ uaVatPayer: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
				{t("uaVatPayer")}
			</label>
			{form.uaVatPayer && (
				<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2">
					<label className="block">
						<span className={label}>{t("uaVatRegDate")}</span>
						<input type="date" value={form.uaVatRegDate} onChange={(e) => set({ uaVatRegDate: e.target.value })} className={field} />
					</label>
					<FormField label={t("uaVatCertificate")} value={form.uaVatCertificate} onChange={(e) => set({ uaVatCertificate: e.target.value.replace(/[^\d]/g, "") })} maxLength={12} />
					<div className="md:col-span-2">
						<span className={label}>{t("uaVatRates")}</span>
						<div className="flex flex-wrap gap-14">
							{[20, 7, 0].map((rate) => (
								<label key={rate} className="flex items-center gap-8 text-13 text-[#cfd4cb]">
									<input
										type="checkbox"
										checked={form.uaVatRates.includes(rate)}
										onChange={(e) => set({ uaVatRates: e.target.checked ? [...form.uaVatRates, rate].sort((a, b) => b - a) : form.uaVatRates.filter((r) => r !== rate) })}
										className="h-16 w-16 accent-[#c6ff4d]"
									/>
									{rate} %
								</label>
							))}
							<span className="text-11 text-[#9AA396]">{t("uaVatRatesHint")}</span>
						</div>
					</div>
				</div>
			)}

			{/* Реквизиты: ЄДРПОУ спрашиваем у юрлица, ІПН — у ФОП; поле, которого форма не знает, скрыто */}
			<div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
				{isCompany ? (
					<div>
						<FormField label={t("uaEdrpou")} value={form.uaEdrpou} onChange={(e) => set({ uaEdrpou: e.target.value.replace(/[^\d]/g, "") })} maxLength={8} />
						{error("uaEdrpou") && <span className={err}>{error("uaEdrpou")}</span>}
					</div>
				) : (
					<div>
						<FormField label={t("uaIpn")} value={form.uaIpn} onChange={(e) => set({ uaIpn: e.target.value.replace(/[^\d]/g, "") })} maxLength={12} />
						{error("uaIpn") && <span className={err}>{error("uaIpn")}</span>}
					</div>
				)}
				<FormField label={t("uaKved")} value={form.uaKved} onChange={(e) => set({ uaKved: e.target.value })} maxLength={200} placeholder="62.01, 63.11" />
			</div>

			<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3">
				<FormField label={t("uaBank")} value={form.uaBank} onChange={(e) => set({ uaBank: e.target.value })} maxLength={100} />
				<div>
					<FormField label="IBAN" value={form.uaIban} onChange={(e) => set({ uaIban: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 29) })} maxLength={29} placeholder="UA…" />
					{error("uaIban") && <span className={err}>{error("uaIban")}</span>}
				</div>
				<div>
					<FormField label={t("uaMfo")} value={form.uaMfo} onChange={(e) => set({ uaMfo: e.target.value.replace(/[^\d]/g, "") })} maxLength={6} />
					{error("uaMfo") && <span className={err}>{error("uaMfo")}</span>}
				</div>
			</div>

			{/* Подписант и изображения подписи/печати попадают в документы (акт, накладная, счёт) */}
			<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2">
				<FormField label={t("uaSignerName")} value={form.uaSignerName} onChange={(e) => set({ uaSignerName: e.target.value })} maxLength={100} />
				<FormField label={t("uaSignerPosition")} value={form.uaSignerPosition} onChange={(e) => set({ uaSignerPosition: e.target.value })} maxLength={100} />
			</div>
			<div className="mt-12 flex flex-wrap gap-16">
				{([["uaSignature", t("uaSignature"), signatureInput] as const, ["uaSeal", t("uaSeal"), sealInput] as const]).map(([key, caption, ref]) => (
					<div key={key} className="flex items-start gap-12">
						<div className="flex h-[84px] w-[168px] shrink-0 items-center justify-center overflow-hidden rounded-10 border border-inkLine bg-white p-8">
							{form[key] ? <img src={form[key]} alt={caption} className="max-h-full max-w-full object-contain" /> : <span className="text-11 text-[#9AA396]">{caption}</span>}
						</div>
						<div className="flex flex-col items-start gap-6">
							<button type="button" onClick={() => ref.current?.click()} className="fs-btn fs-btn-ghost h-34">
								<TbUpload size={14} />
								{caption}
							</button>
							{form[key] && <button type="button" onClick={() => set({ [key]: "" } as Partial<UaProfileForm>)} className="fs-link">{t("logoRemove")}</button>}
							<input ref={ref} type="file" accept="image/*" onChange={(e) => void pickImage(e, key)} className="hidden" />
						</div>
					</div>
				))}
			</div>
			<p className={hint}>{t("uaStampHint")}</p>

			{/* Лимиты групп на год: справочные значения подставлены, фирма может вписать свои (ТЗ §6) */}
			<div className="mt-16">
				<span className={label}>{t("uaLimitsTitle", { year })}</span>
				<div className="grid grid-cols-2 gap-12 md:grid-cols-3">
					{[1, 2, 3].map((group) => (
						<label key={group} className="block">
							<span className="mb-4 block text-11 text-[#9AA396]">{t("uaGroupLimit", { group })}</span>
							<input
								inputMode="numeric"
								value={limitsText[String(group)] ?? String(limits.find((l) => l.group === group)?.amount ?? "")}
								onChange={(e) => set({ uaLimitsText: { ...limitsText, [String(group)]: e.target.value.replace(/[^\d]/g, "") } } as unknown as Partial<UaProfileForm>)}
								className={field}
								placeholder={String(rates.groupLimits[group] ?? "")}
							/>
						</label>
					))}
				</div>
				<p className={hint}>{t("uaLimitsHint", { amount: format.number(limits.find((l) => l.group === 3)?.amount ?? 0) })}</p>
			</div>

			{/* Ставки и сборы фирмы: значения по умолчанию — справочные за год, но их можно поправить */}
			<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2">
				<FormField label={t("uaEsvMonthly")} value={form.uaEsvMonthly} onChange={(e) => set({ uaEsvMonthly: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
				<FormField label={t("uaMilitaryRate")} value={form.uaMilitaryRate} onChange={(e) => set({ uaMilitaryRate: e.target.value.replace(/[^\d.]/g, "") })} maxLength={6} />
				<FormField label={t("uaMilitaryFixed")} value={form.uaMilitaryFixed} onChange={(e) => set({ uaMilitaryFixed: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
				<FormField label={t("uaVatLimit")} value={form.uaVatLimit} onChange={(e) => set({ uaVatLimit: e.target.value.replace(/[^\d]/g, "") })} maxLength={10} />
			</div>
			<div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2">
				<label className="block">
					<span className={label}>{t("uaVatPeriod")}</span>
					<select value={form.uaVatPeriod} onChange={(e) => set({ uaVatPeriod: e.target.value })} className={field}>
						<option value="month">{t("uaPeriodMonth")}</option>
						<option value="quarter">{t("uaPeriodQuarter")}</option>
					</select>
				</label>
				{/* Курс для счетов в валюте: печатаем сумму в ₴ по курсу НБУ плюс наценка фирмы. Ноль — чистый курс. */}
				<label className="block">
					<span className={label}>{t("rateMargin")}</span>
					<input value={form.rateMargin} onChange={(e) => set({ rateMargin: e.target.value.replace(/[^\d.]/g, "") })} className={field} maxLength={5} inputMode="decimal" />
					<span className={hint}>{t("rateMarginHint")}</span>
				</label>
			</div>
		</div>
	);
}
