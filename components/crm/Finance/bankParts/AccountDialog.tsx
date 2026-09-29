"use client";
import React from "react";
import { useTranslations } from "next-intl";
import Modal from "../../shared/Modal";
import FormField from "../../shared/FormField";
import type { AccountForm, Kind } from "./model";

interface Props {
	open: boolean;
	onClose: () => void;
	form: AccountForm;
	onChange: (form: AccountForm) => void;
	notice: string;
	busy: boolean;
	onSubmit: (e: React.FormEvent) => void;
}

// Создание счёта или кассы: поля ровно те, что принимает POST /api/bank/accounts
export default function AccountDialog({ open, onClose, form, onChange, notice, busy, onSubmit }: Props) {
	const t = useTranslations("finance");
	return (
		<Modal open={open} onClose={onClose} label={t("bankNewAccount")} className="w-full max-w-[480px]">
			<form onSubmit={onSubmit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
				<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("bankNewAccount")}</h2>
				<div className="flex flex-col gap-12">
					<FormField label={t("bankName")} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} maxLength={200} autoFocus />
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("bankKind")}</span>
						<select value={form.kind} onChange={(e) => onChange({ ...form, kind: e.target.value as Kind })} className="fs-field h-40 w-full px-12 text-13 outline-none">
							<option value="bank">{t("bankKindBank")}</option>
							<option value="cash">{t("bankKindCash")}</option>
						</select>
					</label>
					<div className="grid grid-cols-2 gap-12">
						<FormField label={t("bankIban")} value={form.iban} onChange={(e) => onChange({ ...form, iban: e.target.value.toUpperCase() })} maxLength={40} />
						<FormField label={t("bankBic")} value={form.bic} onChange={(e) => onChange({ ...form, bic: e.target.value.toUpperCase() })} maxLength={20} />
					</div>
					<div className="grid grid-cols-2 gap-12">
						<FormField label={t("bankOpeningBalance")} type="number" step="0.01" value={form.openingBalance} onChange={(e) => onChange({ ...form, openingBalance: e.target.value })} />
						<FormField label={t("bankOpeningDate")} type="date" value={form.openingDate} onChange={(e) => onChange({ ...form, openingDate: e.target.value })} />
					</div>
					<p className="text-11 leading-[1.5] text-[#9AA396]">{t("bankOpeningHint")}</p>
				</div>
				{notice && <p className="mt-10 text-12 leading-[1.5] text-[#F4A100]">{notice}</p>}
				<div className="mt-20 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
					<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">{t("save")}</button>
				</div>
			</form>
		</Modal>
	);
}
