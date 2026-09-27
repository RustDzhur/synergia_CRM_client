"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd, MdDelete } from "react-icons/md";
import { LineItem, useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { money } from "./format";

const EMPTY_ITEM: LineItem = { description: "", qty: 1, unitPrice: 0, taxRate: 0 };
const today = () => new Date().toISOString().slice(0, 10);

// Шаблоны повторяющихся счетов: раз в месяц/год крон создаёт из шаблона новый счёт (черновик или сразу отправленный —
// autoSend) и сдвигает nextRunDate дальше. Сами уже созданные счета видны в разделе Invoices, здесь — только шаблоны.
export default function RecurringInvoices() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { recurringInvoices, products, loadRecurringInvoices, loadProducts, createRecurringInvoice, updateRecurringInvoice, deleteRecurringInvoice, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
	const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
	const [dayOfMonth, setDayOfMonth] = useState("1");
	const [nextRunDate, setNextRunDate] = useState(today());
	const [autoSend, setAutoSend] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

	useEffect(() => { loadRecurringInvoices(); loadProducts(); }, [loadRecurringInvoices, loadProducts]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!customerName.trim()) return toast.error(t("customerRequired"));
		const cleanItems = items.filter((it) => it.description.trim());
		if (!cleanItems.length) return toast.error(t("itemsRequired"));
		const err = await createRecurringInvoice({
			customerName: customerName.trim(), items: cleanItems, currency: settings?.currency || "EUR",
			interval, dayOfMonth: Number(dayOfMonth) || 1, nextRunDate, autoSend,
		});
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setCustomerName(""); setItems([{ ...EMPTY_ITEM }]); setInterval("monthly"); setDayOfMonth("1"); setNextRunDate(today()); setAutoSend(false);
	}
	async function toggleActive(id: string, active: boolean) {
		setBusy(id);
		const err = await updateRecurringInvoice(id, { active });
		setBusy(null);
		if (err) toast.error(err);
	}
	async function remove(id: string) {
		setBusy(id);
		const err = await deleteRecurringInvoice(id);
		setBusy(null);
		setConfirmDelete(null);
		if (err) toast.error(err);
	}

	return (
		<div>
			<div className="mb-20 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
					<MdAdd size={20} /> {t("newRecurringInvoice")}
				</button>
			</div>
			{recurringInvoices.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("recurringEmpty")}</p>
			) : (
				<ul className="flex flex-col gap-12">
					{recurringInvoices.map((r) => (
						<li key={r.id} className="rounded-16 bg-white p-16 shadow-heroImage md:p-20">
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex items-center gap-10 text-16 font-semibold text-[#333333]">
										{r.customerName}
										<span className={`rounded-4 px-8 py-2 text-12 font-medium text-white ${r.active ? "bg-[#0A8A2E]" : "bg-[#B3B3B3]"}`}>{r.active ? t("recurringActive") : t("recurringPaused")}</span>
									</p>
									<p className="mt-[4px] text-14 text-[#666666]">
										{t(r.interval === "monthly" ? "recurringMonthly" : "recurringYearly")} · {t("recurringNextRun")}: {r.nextRunDate}
										{r.autoSend ? ` · ${t("recurringAutoSend")}` : ""}
									</p>
								</div>
								<p className="text-18 font-semibold text-[#333333]">{money(r.totals.gross, r.currency, locale)}</p>
							</div>
							<div className="mt-14 flex flex-wrap items-center gap-10">
								<button type="button" disabled={busy === r.id} onClick={() => toggleActive(r.id, !r.active)} className="rounded-8 border border-[#E6E6E6] px-16 py-8 text-14 font-medium text-[#666666] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">
									{r.active ? t("recurringPause") : t("recurringResume")}
								</button>
								<button type="button" disabled={busy === r.id} onClick={() => setConfirmDelete(r.id)} className="flex items-center gap-6 rounded-8 border border-[#EB5757] px-16 py-8 text-14 font-medium text-[#EB5757] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">
									<MdDelete size={16} /> {t("delete")}
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newRecurringInvoice")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{t("newRecurringInvoice")}</h2>
					<div className="mb-16">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-16 grid grid-cols-2 gap-14">
						<label>
							<span className="mb-6 block text-16 text-[#999999]">{t("recurringInterval")}</span>
							<select value={interval} onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")} className="h-[44px] w-full rounded-8 border border-[#E6E6E6] bg-white px-10 text-16 text-[#4D4D4D] outline-none focus:border-[#5EA8F5]">
								<option value="monthly">{t("recurringMonthly")}</option>
								<option value="yearly">{t("recurringYearly")}</option>
							</select>
						</label>
						<FormField label={t("recurringDayOfMonth")} type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
						<FormField label={t("recurringNextRun")} type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} />
						<label className="mt-[28px] flex items-center gap-10 text-16 text-[#666666]">
							<input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="h-[18px] w-[18px] accent-primaryColor" />
							{t("recurringAutoSend")}
						</label>
					</div>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setOpen(false)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!confirmDelete} title={t("delete")} text={t("confirmDeleteRecurring")} onCancel={() => setConfirmDelete(null)} onConfirm={() => { if (confirmDelete) remove(confirmDelete); }} />
		</div>
	);
}
