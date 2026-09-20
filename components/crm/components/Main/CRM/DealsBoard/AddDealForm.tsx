"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useContactStore } from "@/app/store/useContactStore";
import { useCompaniesStore } from "@/app/store/useCompaniesStore";
import { NewDeal } from "@/app/store/useCrmStore";
import FormField from "../../shared/FormField";
import SuggestInput, { SuggestOption } from "../../shared/SuggestInput";

interface Props {
	onSubmit: (data: NewDeal) => Promise<void>;
	onCancel: () => void;
	autoFocus: boolean;
}

const EMPTY: NewDeal = { clientName: "", contactName: "", companyName: "", startDate: "", endDate: "" };

// Форма «Add Task» в колонке: название, клиент (контакт с подсказками), компания, две даты.
export default function AddDealForm({ onSubmit, onCancel, autoFocus }: Props) {
	const t = useTranslations("crm");
	const [form, setForm] = useState<NewDeal>(EMPTY);
	const [busy, setBusy] = useState(false);
	const { contacts, fetchContacts } = useContactStore();
	const { companies, fetchCompanies } = useCompaniesStore();

	// подсказки подгружаем, когда форму открыли первый раз
	useEffect(() => {
		if (!autoFocus) return;
		if (contacts.length === 0) fetchContacts();
		if (companies.length === 0) fetchCompanies();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoFocus]);

	const set = (patch: Partial<NewDeal>) => setForm((f) => ({ ...f, ...patch }));

	const contactOptions = useMemo<SuggestOption[]>(() => {
		const q = (form.contactName ?? "").toLowerCase();
		return contacts
			.filter((c) => !q || [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: c._id, title: c.name, lines: [c.phone ?? "", c.email ?? ""] }));
	}, [contacts, form.contactName]);

	const companyOptions = useMemo<SuggestOption[]>(() => {
		const q = (form.companyName ?? "").toLowerCase();
		return companies
			.filter((c) => !q || [c.name, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: c._id, title: c.name, lines: [c.email ?? ""] }));
	}, [companies, form.companyName]);

	async function submit() {
		if (!form.clientName.trim() || busy) return;
		setBusy(true);
		await onSubmit(form);
		setBusy(false);
		setForm(EMPTY);
	}

	const label = "mb-6 block text-14 text-[#999999]";

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
			className="rounded-8 bg-white p-12 shadow-custom">
			<FormField
				label={t("taskName")}
				value={form.clientName}
				onChange={(e) => set({ clientName: e.target.value })}
				placeholder={t("taskNamePlaceholder")}
				maxLength={200}
				wrapperClassName="mb-10"
				className="!bg-white"
			/>
			<span className={label}>{t("client")}</span>
			<div className="mb-10">
				<SuggestInput
					value={form.contactName ?? ""}
					onChange={(text) => set({ contactName: text })}
					onPick={(o) => {
						const picked = contacts.find((c) => c._id === o.key);
						set({ contactName: o.title, companyName: form.companyName || picked?.company || "" });
					}}
					options={contactOptions}
					placeholder={t("contactNamePlaceholder")}
					className="!bg-white"
				/>
			</div>
			<span className={label}>{t("company")}</span>
			<div className="mb-10">
				<SuggestInput
					value={form.companyName ?? ""}
					onChange={(text) => set({ companyName: text })}
					onPick={(o) => set({ companyName: o.title })}
					options={companyOptions}
					placeholder={t("companyNamePlaceholder")}
					className="!bg-white"
				/>
			</div>
			<FormField
				label={t("startDate")}
				type="date"
				value={form.startDate ?? ""}
				onChange={(e) => set({ startDate: e.target.value })}
				wrapperClassName="mb-10"
				className="!bg-white"
			/>
			<FormField
				label={t("endDate")}
				type="date"
				value={form.endDate ?? ""}
				onChange={(e) => set({ endDate: e.target.value })}
				wrapperClassName="mb-12"
				className="!bg-white"
			/>
			<div className="flex items-center justify-end gap-12">
				<button type="button" onClick={onCancel} className="px-12 py-8 text-16 font-medium text-[#999999] transition-colors hover:text-black">
					{t("cancel")}
				</button>
				<button
					type="submit"
					disabled={busy || !form.clientName.trim()}
					className="rounded-4 bg-primaryColor px-20 py-8 text-16 font-medium text-white shadow-custom transition-opacity disabled:opacity-60">
					{t("save")}
				</button>
			</div>
		</form>
	);
}
