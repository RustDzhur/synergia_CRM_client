"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdAdd } from "react-icons/md";
import { useFinanceStore } from "@/app/store/useFinanceStore";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#B3B3B3", active: "#0A8A2E", completed: "#5EA8F5", cancelled: "#EB5757" };
const EMPTY = { customerName: "", value: "0", currency: "EUR", startDate: "", endDate: "", notes: "" };

// Договоры: метаданные + статус (draft → active когда клиент подписал — событие contract_signed, на него можно
// завести правило автоматизации «поставить задачу закупить материалы» и т.п.). Сам файл договора прикладывается как
// обычный документ в разделе Documents и привязывается отдельно — здесь только карточка со статусом.
export default function Contracts() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { contracts, loadContracts, createContract, signContract, completeContract, cancelContract, deleteContract, settings } = useFinanceStore();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(EMPTY);
	const [busy, setBusy] = useState<string | null>(null);
	const [toDelete, setToDelete] = useState<string | null>(null);

	useEffect(() => { loadContracts(); }, [loadContracts]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.customerName.trim()) return toast.error(t("customerRequired"));
		const err = await createContract({ ...form, customerName: form.customerName.trim(), value: Number(form.value) || 0, currency: settings?.currency || form.currency });
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false); setForm(EMPTY);
	}
	async function act(id: string, fn: (id: string) => Promise<string | null>) { setBusy(id); const err = await fn(id); setBusy(null); if (err) toast.error(err); }

	return (
		<div>
			<div className="mb-20 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="flex h-[44px] items-center gap-6 rounded-8 bg-primaryColor px-20 text-16 font-medium text-white shadow-custom hover:opacity-80">
					<MdAdd size={20} /> {t("newContract")}
				</button>
			</div>
			{contracts.length === 0 ? (
				<p className="rounded-16 bg-[#F5F7FC] p-30 text-center text-16 text-[#999999]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-12">
					{contracts.map((c) => (
						<li key={c.id} className="rounded-16 bg-white p-16 shadow-heroImage md:p-20">
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex items-center gap-10 text-16 font-semibold text-[#333333]">
										{c.number}
										<span className="rounded-4 px-8 py-2 text-12 font-medium text-white" style={{ background: STATUS_COLOR[c.status] }}>{t(`cstatus_${c.status}`)}</span>
									</p>
									<p className="mt-[4px] text-14 text-[#666666]">{c.customerName}{c.startDate ? ` · ${c.startDate}${c.endDate ? ` – ${c.endDate}` : ""}` : ""}</p>
								</div>
								{c.value > 0 && <p className="text-18 font-semibold text-[#333333]">{money(c.value, c.currency, locale)}</p>}
							</div>
							<div className="mt-14 flex flex-wrap items-center gap-10">
								{c.status === "draft" && (
									<>
										<button type="button" disabled={busy === c.id} onClick={() => act(c.id, signContract)} className="rounded-8 bg-primaryColor px-16 py-8 text-14 font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("markSigned")}</button>
										<button type="button" disabled={busy === c.id} onClick={() => setToDelete(c.id)} className="text-14 text-[#999999] hover:text-danger">{t("delete")}</button>
									</>
								)}
								{c.status === "active" && (
									<>
										<button type="button" disabled={busy === c.id} onClick={() => act(c.id, completeContract)} className="rounded-8 border border-[#0A8A2E] px-16 py-8 text-14 font-medium text-[#0A8A2E] transition-opacity hover:opacity-80 disabled:opacity-[0.5]">{t("markCompleted")}</button>
										<button type="button" disabled={busy === c.id} onClick={() => act(c.id, cancelContract)} className="text-14 text-[#999999] hover:text-danger">{t("cancel")}</button>
									</>
								)}
								{c.status === "active" && c.signedAt && <span className="text-14 text-[#999999]">{t("signedOn", { date: new Date(c.signedAt).toLocaleDateString(locale) })}</span>}
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newContract")} className="w-full max-w-[480px]">
				<form onSubmit={submit} className="rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-16 text-20 font-medium text-black">{t("newContract")}</h2>
					<div className="flex flex-col gap-14">
						<FormField label={t("customer")} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} maxLength={200} autoFocus />
						<FormField label={t("contractValue")} type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
						<div className="grid grid-cols-2 gap-14">
							<FormField label={t("startDate")} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
							<FormField label={t("endDate")} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
						</div>
					</div>
					<div className="mt-24 flex justify-end gap-12">
						<button type="button" onClick={() => setOpen(false)} className="h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("cancel")}</button>
						<button type="submit" className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("delete")} text={t("confirmDeleteContract")} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteContract(toDelete); setToDelete(null); }} />
		</div>
	);
}
