"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbPlus, TbTrash } from "react-icons/tb";
import { LineItem, useFinanceStore } from "@/app/store/useFinanceStore";
import { defaultRateFor } from "@/lib/finance/tax";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import LineItemsEditor from "./LineItemsEditor";
import { money } from "./format";

// Пустая строка шаблона: не жёсткий 0, а ставка фирмы по умолчанию (lib/finance/tax.ts) — страна из настроек или 0 у освобождённых
const emptyItem = (taxRate: number): LineItem => ({ description: "", qty: 1, unitPrice: 0, taxRate });
const today = () => new Date().toISOString().slice(0, 10);

// Шаблоны повторяющихся счетов: раз в месяц/год крон создаёт из шаблона новый счёт (черновик или сразу отправленный —
// autoSend) и сдвигает nextRunDate дальше. Сами уже созданные счета видны в разделе Invoices, здесь — только шаблоны.
export default function RecurringInvoices() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { recurringInvoices, products, loadRecurringInvoices, loadProducts, createRecurringInvoice, updateRecurringInvoice, deleteRecurringInvoice, settings } = useFinanceStore();
	const defaultTaxRate = defaultRateFor(settings ?? {});
	const [open, setOpen] = useState(false);
	const [customerName, setCustomerName] = useState("");
	const [items, setItems] = useState<LineItem[]>([emptyItem(defaultTaxRate)]);
	const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
	const [dayOfMonth, setDayOfMonth] = useState("1");
	const [nextRunDate, setNextRunDate] = useState(today());
	const [autoSend, setAutoSend] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

	useEffect(() => { loadRecurringInvoices(); loadProducts(); }, [loadRecurringInvoices, loadProducts]);
	// Настройки бухгалтерии приходят асинхронно (их грузит раздел Finance): нетронутую первую строку досеиваем
	// ставкой фирмы, когда они загрузятся, — иначе шаблон, открытый сразу по ссылке, уходил бы с нулевым налогом
	useEffect(() => {
		if (!settings) return;
		setItems((cur) => cur.map((it) => (!it.description && !it.product && !it.unitPrice ? { ...it, taxRate: defaultRateFor(settings) } : it)));
	}, [settings]);

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
		setOpen(false); setCustomerName(""); setItems([emptyItem(defaultTaxRate)]); setInterval("monthly"); setDayOfMonth("1"); setNextRunDate(today()); setAutoSend(false);
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
			<div className="mb-16 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newRecurringInvoice")}
				</button>
			</div>
			{recurringInvoices.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("recurringEmpty")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{recurringInvoices.map((r) => (
						<li key={r.id} className="fs-card p-14 md:p-18">
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex flex-wrap items-center gap-8 text-14 font-semibold text-[#f1f4ee]">
										{r.customerName}
										<span className={`fs-chip h-22 px-8 text-10 ${r.active ? "border-[rgba(198,255,77,0.35)] text-[#c6ff4d]" : ""}`}>{r.active ? t("recurringActive") : t("recurringPaused")}</span>
									</p>
									<p className="mt-[4px] text-12 text-[#8c948b]">
										{t(r.interval === "monthly" ? "recurringMonthly" : "recurringYearly")} · {t("recurringNextRun")}: {r.nextRunDate}
										{r.autoSend ? ` · ${t("recurringAutoSend")}` : ""}
									</p>
								</div>
								<p className="text-15 font-semibold text-[#f1f4ee]">{money(r.totals.gross, r.currency, locale)}</p>
							</div>
							<div className="mt-12 flex flex-wrap items-center gap-8">
								<button type="button" disabled={busy === r.id} onClick={() => toggleActive(r.id, !r.active)} className="fs-btn fs-btn-ghost h-34 disabled:opacity-[0.5]">
									{r.active ? t("recurringPause") : t("recurringResume")}
								</button>
								<button type="button" disabled={busy === r.id} onClick={() => setConfirmDelete(r.id)} className="fs-btn fs-btn-ghost h-34 border-[rgba(235,87,87,0.35)] text-danger disabled:opacity-[0.5]">
									<TbTrash size={15} /> {t("delete")}
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newRecurringInvoice")} className="w-full max-w-[640px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("newRecurringInvoice")}</h2>
					<div className="mb-16">
						<FormField label={t("customer")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={200} autoFocus />
					</div>
					<LineItemsEditor items={items} onChange={setItems} products={products.filter((p) => !p.archived)} currency={settings?.currency ?? "EUR"} />
					<div className="mt-16 grid grid-cols-2 gap-12">
						<label>
							<span className="mb-6 block text-12 text-[#8c948b]">{t("recurringInterval")}</span>
							<select value={interval} onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")} className="fs-field h-40 w-full px-12 text-13 outline-none">
								<option value="monthly">{t("recurringMonthly")}</option>
								<option value="yearly">{t("recurringYearly")}</option>
							</select>
						</label>
						<FormField label={t("recurringDayOfMonth")} type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
						<FormField label={t("recurringNextRun")} type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} />
						<label className="mt-24 flex items-center gap-10 text-13 text-[#cfd4cb]">
							<input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="h-16 w-16 accent-[#c6ff4d]" />
							{t("recurringAutoSend")}
						</label>
					</div>
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!confirmDelete} title={t("delete")} text={t("confirmDeleteRecurring")} onCancel={() => setConfirmDelete(null)} onConfirm={() => { if (confirmDelete) remove(confirmDelete); }} />
		</div>
	);
}
