"use client";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import FormField from "../shared/FormField";

// Настройки бухгалтерии: страна определяет ставку налога по умолчанию на новых счетах (её всё равно можно поменять
// на конкретном счёте) — заполнять не обязательно, но без страны ставка по умолчанию 0%.
export default function FinanceSettingsTab() {
	const t = useTranslations("finance");
	const { settings, countries, loadSettings, saveSettings } = useFinanceStore();
	const [form, setForm] = useState({ country: "", currency: "EUR", smallBusiness: false, legalName: "", address: "", taxId: "", iban: "", bic: "", paymentTermsDays: "14", invoicePrefix: "RE" });
	const [saving, setSaving] = useState(false);

	useEffect(() => { loadSettings(); }, [loadSettings]);
	useEffect(() => {
		if (settings) setForm({ country: settings.country, currency: settings.currency, smallBusiness: settings.smallBusiness, legalName: settings.legalName, address: settings.address, taxId: settings.taxId, iban: settings.iban, bic: settings.bic, paymentTermsDays: String(settings.paymentTermsDays), invoicePrefix: settings.invoicePrefix });
	}, [settings]);

	const selectedCountry = countries.find((c) => c.code === form.country);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		const err = await saveSettings({ ...form, paymentTermsDays: Number(form.paymentTermsDays) || 14 } as any);
		setSaving(false);
		if (err) return toast.error(err);
		toast.success(t("saved"));
	}

	const field = "h-[44px] w-full rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-[#4D4D4D] outline-none focus:border-[#5EA8F5]";
	const label = "mb-6 block text-16 text-[#999999]";

	return (
		<form onSubmit={submit} className="max-w-[640px]">
			<div className="mb-20 rounded-16 bg-white p-20 shadow-heroImage">
				<h3 className="mb-16 text-18 font-medium text-[#333333]">{t("taxSection")}</h3>
				<div className="grid grid-cols-1 gap-14 md:grid-cols-2">
					<label>
						<span className={label}>{t("country")}</span>
						<select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={field}>
							<option value="">{t("countryNone")}</option>
							{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
						</select>
					</label>
					<FormField label={t("currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={6} />
				</div>
				{selectedCountry && (
					<p className="mt-10 text-14 text-[#999999]">{t("taxHint", { rate: selectedCountry.standard, label: selectedCountry.label })}</p>
				)}
				<label className="mt-14 flex items-center gap-10 text-16 text-[#666666]">
					<input type="checkbox" checked={form.smallBusiness} onChange={(e) => setForm({ ...form, smallBusiness: e.target.checked })} className="h-[18px] w-[18px] accent-primaryColor" />
					{t("smallBusiness")}
				</label>
				<p className="mt-[4px] pl-[28px] text-14 text-[#B3B3B3]">{t("smallBusinessHint")}</p>
			</div>

			<div className="mb-20 rounded-16 bg-white p-20 shadow-heroImage">
				<h3 className="mb-16 text-18 font-medium text-[#333333]">{t("companySection")}</h3>
				<div className="flex flex-col gap-14">
					<FormField label={t("legalName")} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} maxLength={200} />
					<FormField label={t("address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} />
					<FormField label={t("taxId")} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} maxLength={60} />
					<div className="grid grid-cols-2 gap-14">
						<FormField label="IBAN" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} maxLength={40} />
						<FormField label="BIC" value={form.bic} onChange={(e) => setForm({ ...form, bic: e.target.value })} maxLength={20} />
					</div>
				</div>
			</div>

			<div className="mb-20 rounded-16 bg-white p-20 shadow-heroImage">
				<h3 className="mb-16 text-18 font-medium text-[#333333]">{t("invoiceSection")}</h3>
				<div className="grid grid-cols-2 gap-14">
					<FormField label={t("paymentTerms")} type="number" min={0} value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} />
					<FormField label={t("invoicePrefix")} value={form.invoicePrefix} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} maxLength={10} />
				</div>
			</div>

			<button type="submit" disabled={saving} className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80 disabled:opacity-60">{t("save")}</button>
		</form>
	);
}
