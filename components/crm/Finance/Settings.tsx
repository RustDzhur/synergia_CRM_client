"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { useFinanceStore } from "@/store/useFinanceStore";
import { fileToLogo, MAX_AVATAR_FILE_BYTES, MAX_LOGO_CHARS } from "@/utils/avatar";
import FormField from "../shared/FormField";
import TemplatePicker from "./TemplatePicker";

// Поля манаведения появились в API позже, чем тип FinanceSettings в сторе (app/store/useFinanceStore.ts):
// читаем и сохраняем их рядом с остальными, не расширяя общий тип ради трёх полей.
type DunningFields = { dunningFees?: number[]; dunningInterestRate?: number; dunningPaymentDays?: number };

// Настройки бухгалтерии: страна определяет ставку налога по умолчанию на новых документах (её всё равно можно поменять
// на конкретном документе) — заполнять не обязательно, но без страны ставка по умолчанию 0 %. Остальное — реквизиты,
// контакты и свой текст, которые печатаются в шапке и подвале документов (lib/finance/layouts.ts), плюс логотип.
export default function FinanceSettingsTab() {
	const t = useTranslations("finance");
	const { settings, countries, loadSettings, saveSettings } = useFinanceStore();
	// пустые сборы = сборы не начисляются (как и на сервере); поля заполнятся настоящими значениями, когда придут настройки
	const [form, setForm] = useState({ country: "", currency: "EUR", smallBusiness: false, rateMargin: "0", uaLegalForm: "fop", uaGroup: "3", uaSingleRate: "5", uaVatPayer: false, uaEsvMonthly: "1760", uaMilitaryRate: "1", uaMilitaryFixed: "800", uaVatLimit: "1000000", uaVatPeriod: "month", legalName: "", address: "", taxId: "", vatId: "", registerNumber: "", managingDirector: "", phone: "", email: "", website: "", logo: "", footerText: "", iban: "", bic: "", paymentTermsDays: "14", invoicePrefix: "RE", quotePrefix: "AN", creditNotePrefix: "GS", reminderIntervalDays: "7", dunningFees: ["", "", "", "", ""], dunningInterestRate: "", dunningPaymentDays: "7", template: "classic", paymentQr: true });
	const [saving, setSaving] = useState(false);
	const logoInput = useRef<HTMLInputElement>(null);

	useEffect(() => { loadSettings(); }, [loadSettings]);
	useEffect(() => {
		if (!settings) return;
		const dn = settings as typeof settings & DunningFields;
		// сборы по ступеням: индекс 0 в интерфейсе не используется, поэтому показываем ровно пять полей 0..4
		const fees = Array.from({ length: 5 }, (_, i) => (dn.dunningFees?.[i] !== undefined ? String(dn.dunningFees[i]) : ""));
		setForm({ country: settings.country, currency: settings.currency, smallBusiness: settings.smallBusiness, rateMargin: String(settings.rateMargin ?? 0), uaLegalForm: settings.uaLegalForm ?? "fop", uaGroup: String(settings.uaGroup ?? 3), uaSingleRate: String(settings.uaSingleRate ?? 5), uaVatPayer: !!settings.uaVatPayer, uaEsvMonthly: String(settings.uaEsvMonthly ?? 1760), uaMilitaryRate: String(settings.uaMilitaryRate ?? 1), uaMilitaryFixed: String(settings.uaMilitaryFixed ?? 800), uaVatLimit: String(settings.uaVatLimit ?? 1000000), uaVatPeriod: settings.uaVatPeriod ?? "month", legalName: settings.legalName, address: settings.address, taxId: settings.taxId, vatId: settings.vatId, registerNumber: settings.registerNumber, managingDirector: settings.managingDirector, phone: settings.phone, email: settings.email, website: settings.website, logo: settings.logo, footerText: settings.footerText, iban: settings.iban, bic: settings.bic, paymentTermsDays: String(settings.paymentTermsDays), invoicePrefix: settings.invoicePrefix, quotePrefix: settings.quotePrefix, creditNotePrefix: settings.creditNotePrefix, reminderIntervalDays: String(settings.reminderIntervalDays), dunningFees: fees, dunningInterestRate: String(dn.dunningInterestRate ?? 0), dunningPaymentDays: String(dn.dunningPaymentDays ?? 7), template: settings.template || "classic", paymentQr: settings.paymentQr !== false });
	}, [settings]);

	const selectedCountry = countries.find((c) => c.code === form.country);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		const err = await saveSettings({
			...form,
			paymentTermsDays: Number(form.paymentTermsDays) || 14,
			reminderIntervalDays: Number(form.reminderIntervalDays) || 7,
			// пустое поле сбора = 0: сбор не начисляется; проценты и срок приводим к диапазонам, которые принимает PATCH
			dunningFees: form.dunningFees.map((v) => Math.max(0, Number(v) || 0)),
			dunningInterestRate: Math.max(0, Math.min(30, Number(form.dunningInterestRate) || 0)),
			dunningPaymentDays: Math.max(1, Math.min(60, Math.round(Number(form.dunningPaymentDays) || 7))),
			// украинская налоговая модель: числа приходят строками из полей ввода
			rateMargin: Math.max(0, Math.min(50, Number(form.rateMargin) || 0)),
			uaGroup: Number(form.uaGroup) || 3,
			uaSingleRate: Number(form.uaSingleRate) === 3 ? 3 : 5,
			uaEsvMonthly: Math.max(0, Number(form.uaEsvMonthly) || 0),
			uaMilitaryRate: Math.max(0, Number(form.uaMilitaryRate) || 0),
			uaMilitaryFixed: Math.max(0, Number(form.uaMilitaryFixed) || 0),
			uaVatLimit: Math.max(0, Number(form.uaVatLimit) || 1000000),
		} as any);
		setSaving(false);
		if (err) return toast.error(err);
		toast.success(t("saved"));
	}

	// Логотип готовится в браузере тем же ресайзом, что и аватар (app/utils/avatar.ts): в настройки уходит маленький
	// data-URL, а сервер принимает картинку не больше MAX_LOGO_CHARS символов — иначе логотип молча очищался бы при сохранении.
	async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = ""; // чтобы можно было выбрать тот же файл повторно
		if (!file) return;
		if (!file.type.startsWith("image/")) return void toast.error(t("logoNotImage"));
		if (file.size > MAX_AVATAR_FILE_BYTES) return void toast.error(t("logoTooBig"));
		try {
			const logo = await fileToLogo(file);
			if (logo.length > MAX_LOGO_CHARS) return void toast.error(t("logoTooBig"));
			setForm({ ...form, logo });
		} catch {
			toast.error(t("logoNotImage"));
		}
	}

	const field = "fs-field h-40 w-full px-12 text-13 outline-none";
	const label = "mb-6 block text-12 text-[#8c948b]";
	const hint = "mt-[4px] block text-11 text-[#9AA396]";

	return (
		<form onSubmit={submit} className="max-w-[640px]">
			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("taxSection")}</h3>
				<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
					<label>
						<span className={label}>{t("country")}</span>
						<select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={field}>
							<option value="">{t("countryNone")}</option>
							{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
						</select>
					</label>
					<FormField label={t("currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={6} />
				</div>
				{/* Подсказка повторяет то, что реально делает код (lib/finance/tax.ts): у освобождённой фирмы ставка
				    страны не применяется вообще — 0 % и пометка §19 на каждом документе, поэтому и текст другой */}
				{form.smallBusiness ? (
					<p className="mt-8 text-12 text-[#9AA396]">{t("taxHintExempt")}</p>
				) : selectedCountry ? (
					<p className="mt-8 text-12 text-[#8c948b]">{t("taxHint", { rate: selectedCountry.standard, label: selectedCountry.label })}</p>
				) : null}
				<label className="mt-14 flex items-center gap-10 text-13 text-[#cfd4cb]">
					<input type="checkbox" checked={form.smallBusiness} onChange={(e) => setForm({ ...form, smallBusiness: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
					{t("smallBusiness")}
				</label>
				<p className="mt-[4px] pl-[26px] text-11 text-[#9AA396]">{t("smallBusinessHint")}</p>
			</div>

			{/* Украинская налоговая модель: ФОП на єдиному податку или ТОВ, единый налог, военный сбор
			    и ЄСВ. Цифры — умолчания на 2025 год, их можно менять: законы пересматриваются, и
			    приложение не должно решать за бухгалтера. Отчёты по этим настройкам — в «Податках». */}
			{form.country === "UA" && (
				<div className="mb-16 fs-card p-16 md:p-20">
					<h3 className="mb-4 text-14 font-semibold text-[#f1f4ee]">{t("uaSection")}</h3>
					<p className="mb-14 text-12 leading-[1.5] text-[#8c948b]">{t("uaSectionHint")}</p>
					<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
						<label className="block">
							<span className={label}>{t("uaLegalForm")}</span>
							<select value={form.uaLegalForm} onChange={(e) => setForm({ ...form, uaLegalForm: e.target.value })} className={field}>
								<option value="fop">{t("uaLegalFop")}</option>
								<option value="tov">{t("uaLegalTov")}</option>
							</select>
						</label>
						<label className="block">
							<span className={label}>{t("uaGroup")}</span>
							<select value={form.uaGroup} onChange={(e) => setForm({ ...form, uaGroup: e.target.value })} className={field}>
								<option value="1">{t("uaGroup1")}</option>
								<option value="2">{t("uaGroup2")}</option>
								<option value="3">{t("uaGroup3")}</option>
								<option value="0">{t("uaGroup0")}</option>
							</select>
						</label>
						<label className="block">
							<span className={label}>{t("uaSingleRate")}</span>
							<select value={form.uaSingleRate} onChange={(e) => setForm({ ...form, uaSingleRate: e.target.value })} className={field}>
								<option value="5">{t("uaSingle5")}</option>
								<option value="3">{t("uaSingle3")}</option>
							</select>
						</label>
						<FormField label={t("uaVatLimit")} value={form.uaVatLimit} onChange={(e) => setForm({ ...form, uaVatLimit: e.target.value.replace(/[^\d]/g, "") })} maxLength={10} />
						<FormField label={t("uaEsvMonthly")} value={form.uaEsvMonthly} onChange={(e) => setForm({ ...form, uaEsvMonthly: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
						<FormField label={t("uaMilitaryRate")} value={form.uaMilitaryRate} onChange={(e) => setForm({ ...form, uaMilitaryRate: e.target.value.replace(/[^\d.]/g, "") })} maxLength={6} />
						<FormField label={t("uaMilitaryFixed")} value={form.uaMilitaryFixed} onChange={(e) => setForm({ ...form, uaMilitaryFixed: e.target.value.replace(/[^\d.]/g, "") })} maxLength={8} />
						<label className="block">
							<span className={label}>{t("uaVatPeriod")}</span>
							<select value={form.uaVatPeriod} onChange={(e) => setForm({ ...form, uaVatPeriod: e.target.value })} className={field}>
								<option value="month">{t("uaPeriodMonth")}</option>
								<option value="quarter">{t("uaPeriodQuarter")}</option>
							</select>
						</label>
					</div>
					<label className="mt-14 flex items-center gap-10 text-13 text-[#cfd4cb]">
						<input type="checkbox" checked={form.uaVatPayer} onChange={(e) => setForm({ ...form, uaVatPayer: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
						{t("uaVatPayer")}
					</label>
					{/* Курс для счетов в валюте: печатаем сумму в ₴ по курсу НБУ плюс наценка фирмы.
					    Ноль — чистый курс Нацбанка. */}
					<label className="mt-14 block max-w-[260px]">
						<span className={label}>{t("rateMargin")}</span>
						<input value={form.rateMargin} onChange={(e) => setForm({ ...form, rateMargin: e.target.value.replace(/[^\d.]/g, "") })} className={field} maxLength={5} inputMode="decimal" />
						<span className={hint}>{t("rateMarginHint")}</span>
					</label>
				</div>
			)}

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("companySection")}</h3>
				<div className="flex flex-col gap-12">
					<FormField label={t("legalName")} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} maxLength={200} />
					<FormField label={t("address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} />
					<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label={t("taxId")} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} maxLength={100} />
						<FormField label={t("vatId")} value={form.vatId} onChange={(e) => setForm({ ...form, vatId: e.target.value })} maxLength={100} />
					</div>
					<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label={t("registerNumber")} value={form.registerNumber} onChange={(e) => setForm({ ...form, registerNumber: e.target.value })} maxLength={100} />
						<FormField label={t("managingDirector")} value={form.managingDirector} onChange={(e) => setForm({ ...form, managingDirector: e.target.value })} maxLength={100} />
					</div>
					<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
						<FormField label="IBAN" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} maxLength={40} />
						<FormField label="BIC" value={form.bic} onChange={(e) => setForm({ ...form, bic: e.target.value })} maxLength={20} />
					</div>
				</div>
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("contactSection")}</h3>
				<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
					<FormField label={t("phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={100} />
					<FormField label={t("email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={100} />
				</div>
				<div className="mt-12">
					<FormField label={t("website")} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} maxLength={100} />
				</div>
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("documentSection")}</h3>
				<div className="flex flex-wrap items-start gap-14">
					<div className="flex h-[84px] w-[168px] shrink-0 items-center justify-center overflow-hidden rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] p-8">
						{/* Превью того, что уйдёт в шапку PDF: белый фон — как у страницы документа */}
						{form.logo ? <img src={form.logo} alt={t("logo")} className="max-h-full max-w-full object-contain" /> : <span className="text-11 text-[#9AA396]">{t("logo")}</span>}
					</div>
					<div className="flex flex-col items-start gap-6">
						<button type="button" onClick={() => logoInput.current?.click()} className="fs-btn fs-btn-ghost h-34">{t("logoUpload")}</button>
						{form.logo && <button type="button" onClick={() => setForm({ ...form, logo: "" })} className="fs-link">{t("logoRemove")}</button>}
						<input ref={logoInput} type="file" accept="image/*" onChange={pickLogo} className="hidden" />
					</div>
				</div>
				<p className={hint}>{t("logoHint")}</p>
				<label className="mt-14 block">
					<span className={label}>{t("footerText")}</span>
					<textarea value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} maxLength={1200} rows={3} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
					<span className={hint}>{t("footerTextHint")}</span>
				</label>
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("templateSection")}</h3>
				<p className="mb-14 text-12 text-[#8c948b]">{t("templateSectionHint")}</p>
				<TemplatePicker value={form.template || "classic"} onChange={(v) => setForm({ ...form, template: v || "classic" })} columns={5} />
				<label className="mt-16 flex items-center gap-10 text-13 text-[#cfd4cb]">
					<input type="checkbox" checked={form.paymentQr} onChange={(e) => setForm({ ...form, paymentQr: e.target.checked })} className="h-16 w-16 accent-[#c6ff4d]" />
					{t("paymentQr")}
				</label>
				<p className="mt-[4px] pl-[26px] text-11 text-[#9AA396]">{t("paymentQrHint")}</p>
			</div>

			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-14 text-14 font-semibold text-[#f1f4ee]">{t("invoiceSection")}</h3>
				<div className="grid grid-cols-1 gap-12 md:grid-cols-2">
					<FormField label={t("paymentTerms")} type="number" min={0} value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} />
					<FormField label={t("reminderIntervalLabel")} type="number" min={1} max={90} value={form.reminderIntervalDays} onChange={(e) => setForm({ ...form, reminderIntervalDays: e.target.value })} />
					<FormField label={t("invoicePrefix")} value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} maxLength={10} />
					<FormField label={t("quotePrefix")} value={form.quotePrefix} onChange={(e) => setForm({ ...form, quotePrefix: e.target.value.toUpperCase() })} maxLength={10} />
					<FormField label={t("creditNotePrefixLabel")} value={form.creditNotePrefix} onChange={(e) => setForm({ ...form, creditNotePrefix: e.target.value.toUpperCase() })} maxLength={10} />
				</div>
			</div>

			{/* Манаведение: сбор за каждую ступень напоминания и справочная ставка процентов. Пока сборы не заполнены,
			    они нулевые — начислять их или нет, решает фирма, и подсказка говорит об этом прямо. */}
			<div className="mb-16 fs-card p-16 md:p-20">
				<h3 className="mb-8 text-14 font-semibold text-[#f1f4ee]">{t("dunningSection")}</h3>
				<p className="mb-14 text-12 leading-[1.5] text-[#8c948b]">{t("dunningSettingsHint")}</p>
				<span className={label}>{t("dunningFeesLabel")}</span>
				<div className="grid grid-cols-2 gap-12 md:grid-cols-5">
					{form.dunningFees.map((v, i) => (
						<FormField
							key={i}
							label={i === 0 ? t("dunningFeeUnused") : t(`level_${i}`)}
							type="number"
							min={0}
							step="0.01"
							value={v}
							disabled={i === 0}
							className={i === 0 ? "opacity-50" : ""}
							onChange={(e) => setForm({ ...form, dunningFees: form.dunningFees.map((x, j) => (j === i ? e.target.value : x)) })}
						/>
					))}
				</div>
				<div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
					<FormField label={t("dunningInterestLabel")} type="number" min={0} max={30} step="0.1" value={form.dunningInterestRate} onChange={(e) => setForm({ ...form, dunningInterestRate: e.target.value })} />
					<FormField label={t("dunningPaymentDaysLabel")} type="number" min={1} max={60} value={form.dunningPaymentDays} onChange={(e) => setForm({ ...form, dunningPaymentDays: e.target.value })} />
				</div>
			</div>

			<button type="submit" disabled={saving} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("save")}</button>
		</form>
	);
}
