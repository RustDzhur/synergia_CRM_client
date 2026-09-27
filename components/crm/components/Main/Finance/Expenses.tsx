"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdDelete, MdDocumentScanner } from "react-icons/md";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import { authHeaders } from "@/app/store/crmApi";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import { money } from "./format";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { vendor: "", category: "", amount: "0", taxRate: "0", currency: "", date: today(), recurring: "", notes: "", receipt: "" };

// Расходы (Beleg): закупки, аренда, подписки. Вторая половина отчёта о прибыли на дашборде вместе со счетами.
export default function Expenses() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { expenses, loadExpenses, createExpense, deleteExpense, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(EMPTY);
	const [toDelete, setToDelete] = useState<string | null>(null);
	const [scanning, setScanning] = useState(false);
	const fileRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => { loadExpenses(); }, [loadExpenses]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.vendor.trim()) return toast.error(t("vendorRequired"));
		const err = await createExpense({ vendor: form.vendor.trim(), category: form.category.trim(), amount: Number(form.amount) || 0, taxRate: Number(form.taxRate) || 0, currency: form.currency || undefined, date: form.date, recurring: form.recurring as "" | "monthly" | "yearly", notes: form.notes.trim(), receipt: form.receipt || undefined });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false);
		setForm(EMPTY);
	}

	async function scanReceipt(file: File) {
		setScanning(true);
		const id = toast.loading(t("scanning"));
		try {
			const body = new FormData();
			body.append("file", file);
			const upRes = await fetch("/api/documents/upload", { method: "POST", headers: authHeaders(false), body });
			const upJson = await upRes.json().catch(() => null);
			if (!upRes.ok) throw new Error(upJson?.message || `Error ${upRes.status}`);
			const exRes = await fetch("/api/expenses/extract", { method: "POST", headers: authHeaders(), body: JSON.stringify({ documentId: upJson.id }) });
			const exJson = await exRes.json().catch(() => null);
			if (!exRes.ok) throw new Error(exJson?.message || `Error ${exRes.status}`);
			setForm({
				vendor: exJson.vendor || "", category: exJson.category || "",
				amount: exJson.amount ? String(exJson.amount) : "0", taxRate: exJson.taxRate ? String(exJson.taxRate) : "0",
				currency: exJson.currency && exJson.currency !== (settings?.currency ?? "EUR") ? exJson.currency : "",
				date: exJson.date || today(), recurring: "", notes: "", receipt: exJson.documentId,
			});
			toast.dismiss(id);
			toast.success(t("scanDone"));
			setOpen(true);
		} catch (e) {
			toast.dismiss(id);
			toast.error(e instanceof Error ? e.message : t("scanFailed"));
		} finally {
			setScanning(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	}

	return (
		<div>
			<div className="mb-20 flex justify-end gap-12">
				<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) scanReceipt(f); }} aria-label={t("scanReceipt")} />
				<button type="button" disabled={scanning} onClick={() => fileRef.current?.click()} className="flex h-[44px] items-center gap-6 rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">
					<MdDocumentScanner size={20} /> {t("scanReceipt")}
				</button>
				<button type="button" onClick={() => { setForm(EMPTY); setOpen(true); }} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
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
					{form.receipt && <p className="mb-16 rounded-8 bg-[#EAF6FF] px-14 py-10 text-14 text-[#333333]">{t("scannedFromReceipt")}</p>}
					<div className="flex flex-col gap-14">
						<FormField label={t("colVendor")} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} maxLength={200} autoFocus />
						<FormField label={t("colCategory")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={100} />
						<div className="grid grid-cols-2 gap-14">
							<FormField label={t("colAmount")} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
							<FormField label={t("itemTax")} type="number" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
						</div>
						{form.receipt && form.currency && (
							<FormField label={t("currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={6} />
						)}
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
