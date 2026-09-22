"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdDelete } from "react-icons/md";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import { money } from "./format";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { vendor: "", category: "", amount: "0", taxRate: "0", date: today(), recurring: "", notes: "" };

// Расходы (Beleg): закупки, аренда, подписки. Вторая половина отчёта о прибыли на дашборде вместе со счетами.
export default function Expenses() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { expenses, loadExpenses, createExpense, deleteExpense, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(EMPTY);
	const [toDelete, setToDelete] = useState<string | null>(null);

	useEffect(() => { loadExpenses(); }, [loadExpenses]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.vendor.trim()) return toast.error(t("vendorRequired"));
		const err = await createExpense({ vendor: form.vendor.trim(), category: form.category.trim(), amount: Number(form.amount) || 0, taxRate: Number(form.taxRate) || 0, date: form.date, recurring: form.recurring as "" | "monthly" | "yearly", notes: form.notes.trim() });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false);
		setForm(EMPTY);
	}

	return (
		<div>
			<div className="mb-20 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
					<MdAdd size={20} /> {t("newExpense")}
				</button>
			</div>
			{expenses.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("empty")}</p>
			) : (
				<div className="overflow-x-auto rounded-16 bg-white shadow-heroImage">
					<table className="w-full min-w-[560px] text-left text-14">
						<thead><tr className="text-12 text-[#999999]"><th className="px-16 py-12 font-normal">{t("colDate")}</th><th className="px-10 py-12 font-normal">{t("colVendor")}</th><th className="px-10 py-12 font-normal">{t("colCategory")}</th><th className="px-10 py-12 text-right font-normal">{t("colAmount")}</th><th className="px-10 py-12" /></tr></thead>
						<tbody>
							{expenses.map((ex) => (
								<tr key={ex.id} className="border-t border-[#F0F0F0]">
									<td className="px-16 py-12 text-[#999999]">{ex.date}</td>
									<td className="px-10 py-12 font-medium text-[#333333]">{ex.vendor}</td>
									<td className="px-10 py-12 text-[#999999]">{ex.category || "—"}</td>
									<td className="px-10 py-12 text-right">{money(ex.amount, ex.currency || settings?.currency || "EUR", locale)}</td>
									<td className="px-10 py-12 text-right"><button type="button" onClick={() => setToDelete(ex.id)} aria-label={t("delete")} className="text-[#B3B3B3] hover:text-danger"><MdDelete size={18} /></button></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newExpense")} className="w-full max-w-[440px]">
				<form onSubmit={submit} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{t("newExpense")}</h2>
					<div className="flex flex-col gap-14">
						<FormField label={t("colVendor")} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} maxLength={200} autoFocus />
						<FormField label={t("colCategory")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={100} />
						<div className="grid grid-cols-2 gap-14">
							<FormField label={t("colAmount")} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
							<FormField label={t("itemTax")} type="number" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
						</div>
						<FormField label={t("colDate")} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
					</div>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setOpen(false)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("delete")} text={t("confirmDeleteExpense")} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteExpense(toDelete); setToDelete(null); }} />
		</div>
	);
}
