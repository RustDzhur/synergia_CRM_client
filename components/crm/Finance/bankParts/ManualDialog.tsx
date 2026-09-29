"use client";
import React from "react";
import { useTranslations } from "next-intl";
import Modal from "../../shared/Modal";
import FormField from "../../shared/FormField";
import type { ManualForm } from "./model";

interface Props {
	open: boolean;
	onClose: () => void;
	form: ManualForm;
	onChange: (form: ManualForm) => void;
	notice: string;
	busy: boolean;
	onSubmit: (e: React.FormEvent) => void;
}

// Ручное движение — то, чем ведётся касса: дата, сумма (плюс — приход, минус — расход), контрагент
export default function ManualDialog({ open, onClose, form, onChange, notice, busy, onSubmit }: Props) {
	const t = useTranslations("finance");
	return (
		<Modal open={open} onClose={onClose} label={t("bankAddMovement")} className="w-full max-w-[440px]">
			<form onSubmit={onSubmit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
				<h2 className="text-16 font-semibold text-[#f1f4ee]">{t("bankAddMovement")}</h2>
				<p className="mb-14 mt-6 text-12 leading-[1.5] text-[#8c948b]">{t("bankManualHint")}</p>
				<div className="flex flex-col gap-12">
					<div className="grid grid-cols-2 gap-12">
						<FormField label={t("colDate")} type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })} />
						<FormField label={t("colAmount")} type="number" step="0.01" value={form.amount} onChange={(e) => onChange({ ...form, amount: e.target.value })} autoFocus />
					</div>
					<p className="text-11 leading-[1.5] text-[#9AA396]">{t("bankAmountHint")}</p>
					<FormField label={t("colCounterparty")} value={form.counterparty} onChange={(e) => onChange({ ...form, counterparty: e.target.value })} maxLength={200} />
					<FormField label={t("colReference")} value={form.reference} onChange={(e) => onChange({ ...form, reference: e.target.value })} maxLength={500} />
					<label className="block">
						<span className="mb-6 block text-12 text-[#8c948b]">{t("notes")}</span>
						<textarea value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} maxLength={1000} rows={3} className="fs-field fs-scroll w-full resize-none p-10 text-13 outline-none" />
					</label>
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
