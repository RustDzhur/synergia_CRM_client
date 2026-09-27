"use client";
import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPlus, TbScan, TbTrash } from "react-icons/tb";
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
			<div className="mb-16 flex justify-end gap-10">
				<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) scanReceipt(f); }} aria-label={t("scanReceipt")} />
				<button type="button" disabled={scanning} onClick={() => fileRef.current?.click()} className="fs-btn fs-btn-ghost h-40 disabled:opacity-[0.5]">
					<TbScan size={16} /> {t("scanReceipt")}
				</button>
				<button type="button" onClick={() => { setForm(EMPTY); setOpen(true); }} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newExpense")}
				</button>
			</div>
			{expenses.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<div className="fs-card overflow-x-auto">
					<table className="fs-table min-w-[560px] text-left">
						<thead><tr><th className="px-16">{t("colDate")}</th><th className="px-10">{t("colVendor")}</th><th className="px-10">{t("colCategory")}</th><th className="px-10 text-right">{t("colAmount")}</th><th className="px-10" /></tr></thead>
						<tbody>
							{expenses.map((ex) => (
								<tr key={ex.id}>
									<td className="px-16 text-13 text-[#8c948b]">{ex.date}</td>
									<td className="px-10 text-13 font-medium text-[#f1f4ee]">{ex.vendor}</td>
									<td className="px-10 text-13 text-[#8c948b]">{ex.category || "—"}</td>
									<td className="px-10 text-right text-13">{money(ex.amount, ex.currency || settings?.currency || "EUR", locale)}</td>
									<td className="px-10 text-right"><button type="button" onClick={() => setToDelete(ex.id)} aria-label={t("delete")} className="text-[#9AA396] transition-colors hover:text-danger"><TbTrash size={16} /></button></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newExpense")} className="w-full max-w-[440px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("newExpense")}</h2>
					{form.receipt && <p className="mb-14 rounded-10 border border-[rgba(198,255,77,0.22)] bg-[rgba(198,255,77,0.06)] px-12 py-8 text-12 text-[#cfd4cb]">{t("scannedFromReceipt")}</p>}
					<div className="flex flex-col gap-12">
						<FormField label={t("colVendor")} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} maxLength={200} autoFocus />
						<FormField label={t("colCategory")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={100} />
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("colAmount")} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
							<FormField label={t("itemTax")} type="number" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
						</div>
						{form.receipt && form.currency && (
							<FormField label={t("currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={6} />
						)}
						<FormField label={t("colDate")} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
					</div>
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("delete")} text={t("confirmDeleteExpense")} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteExpense(toDelete); setToDelete(null); }} />
		</div>
	);
}
