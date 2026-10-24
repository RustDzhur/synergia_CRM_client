"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useContactStore } from "@/store/useContactStore";
import { useCompaniesStore } from "@/store/useCompaniesStore";
import { NewDeal } from "@/store/useCrmStore";
import FormField from "../../shared/FormField";
import SuggestInput, { SuggestOption } from "../../shared/SuggestInput";

interface Props {
	onSubmit: (data: NewDeal) => Promise<void>;
	onCancel: () => void;
	autoFocus: boolean;
}

const EMPTY: NewDeal = { clientName: "", contactName: "", companyName: "", contact: "", company: "", startDate: "", endDate: "" };

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
		// нужен только момент открытия формы: реагировать на изменение списков значило бы грузить их снова и снова
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

	const label = "mb-6 block text-12 text-[#8c948b]";

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
			className="rounded-12 border border-inkLine bg-[rgba(255,255,255,0.02)] p-12">
			<FormField
				label={t("taskName")}
				value={form.clientName}
				onChange={(e) => set({ clientName: e.target.value })}
				placeholder={t("taskNamePlaceholder")}
				maxLength={200}
				wrapperClassName="mb-10"
			/>
			<span className={label}>{t("client")}</span>
			<div className="mb-10">
				<SuggestInput
					value={form.contactName ?? ""}
					onChange={(text) => set({ contactName: text, contact: "" })}
					onPick={(o) => {
						const picked = contacts.find((c) => c._id === o.key);
						set({ contactName: o.title, contact: o.key, companyName: form.companyName || picked?.company || "" });
					}}
					options={contactOptions}
					placeholder={t("contactNamePlaceholder")}
				/>
			</div>
			<span className={label}>{t("company")}</span>
			<div className="mb-10">
				<SuggestInput
					value={form.companyName ?? ""}
					onChange={(text) => set({ companyName: text, company: "" })}
					onPick={(o) => set({ companyName: o.title, company: o.key })}
					options={companyOptions}
					placeholder={t("companyNamePlaceholder")}
				/>
			</div>
			<FormField
				label={t("startDate")}
				type="date"
				value={form.startDate ?? ""}
				onChange={(e) => set({ startDate: e.target.value })}
				wrapperClassName="mb-10"
			/>
			<FormField
				label={t("endDate")}
				type="date"
				value={form.endDate ?? ""}
				onChange={(e) => set({ endDate: e.target.value })}
				wrapperClassName="mb-12"
			/>
			{/* Колонка узкая (222px, на планшете 180px), а подписи в ua/de длинные («Скасувати», «Abbrechen»):
			    кнопки делят ширину поровну, а если не помещаются в ряд — переносятся друг под друга, но не выходят за карточку */}
			<div className="flex flex-wrap gap-8">
				<button type="button" onClick={onCancel} className="fs-btn fs-btn-ghost h-34 min-w-[88px] flex-1 whitespace-nowrap px-10 text-12">
					{t("cancel")}
				</button>
				<button
					type="submit"
					disabled={busy || !form.clientName.trim()}
					className="fs-btn fs-btn-primary h-34 min-w-[88px] flex-1 whitespace-nowrap px-10 text-12 disabled:opacity-60">
					{t("save")}
				</button>
			</div>
		</form>
	);
}
