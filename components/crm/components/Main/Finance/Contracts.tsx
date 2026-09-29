"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbDownload, TbPlus } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import { downloadDocumentPdf } from "./download";
import DocumentTemplateButton from "./DocumentTemplateButton";
import { money } from "./format";

const STATUS_COLOR: Record<string, string> = { draft: "#8c948b", active: "#c6ff4d", completed: "#5EA8F5", cancelled: "#eb5757" };
const EMPTY = { customerName: "", value: "0", currency: "EUR", startDate: "", endDate: "", notes: "" };

// Договоры: метаданные + статус (draft → active когда клиент подписал — событие contract_signed, на него можно
// завести правило автоматизации «поставить задачу закупить материалы» и т.п.). Сам файл договора прикладывается как
// обычный документ в разделе Documents и привязывается отдельно — здесь только карточка со статусом.
export default function Contracts() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { contracts, loadContracts, createContract, updateContract, signContract, completeContract, cancelContract, deleteContract, settings } = useFinanceStore();
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
	async function downloadContractPdf(id: string, number: string) {
		if (!(await downloadDocumentPdf("contracts", id, number, locale))) toast.error(t("pdfFailed"));
	}

	return (
		<div>
			<div className="mb-16 flex justify-end">
				<button type="button" onClick={() => setOpen(true)} className="fs-btn fs-btn-primary h-40">
					<TbPlus size={16} /> {t("newContract")}
				</button>
			</div>
			{contracts.length === 0 ? (
				<p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("empty")}</p>
			) : (
				<ul className="flex flex-col gap-10">
					{contracts.map((c) => (
						<li key={c.id} className="fs-card p-14 md:p-18">
							<div className="flex flex-wrap items-start justify-between gap-12">
								<div className="min-w-0">
									<p className="flex flex-wrap items-center gap-8 text-14 font-semibold text-[#f1f4ee]">
										{c.number}
										<span className="fs-chip h-22 gap-6 px-8 text-10">
											<span className="h-6 w-6 rounded-50" style={{ background: STATUS_COLOR[c.status] }} />
											{t(`cstatus_${c.status}`)}
										</span>
									</p>
									<p className="mt-[4px] text-12 text-[#8c948b]">{c.customerName}{c.startDate ? ` · ${c.startDate}${c.endDate ? ` – ${c.endDate}` : ""}` : ""}</p>
								</div>
								{c.value > 0 && <p className="text-15 font-semibold text-[#f1f4ee]">{money(c.value, c.currency, locale)}</p>}
							</div>
							<div className="mt-12 flex flex-wrap items-center gap-8">
								{c.status === "draft" && (
									<>
										<button type="button" disabled={busy === c.id} onClick={() => act(c.id, signContract)} className="fs-btn fs-btn-primary h-34 disabled:opacity-[0.5]">{t("markSigned")}</button>
										<button type="button" disabled={busy === c.id} onClick={() => setToDelete(c.id)} className="text-12 text-[#9AA396] transition-colors hover:text-danger">{t("delete")}</button>
									</>
								)}
								{c.status === "active" && (
									<>
										<button type="button" disabled={busy === c.id} onClick={() => act(c.id, completeContract)} className="fs-btn fs-btn-ghost h-34 border-[rgba(198,255,77,0.4)] text-[#c6ff4d] disabled:opacity-[0.5]">{t("markCompleted")}</button>
										<button type="button" disabled={busy === c.id} onClick={() => act(c.id, cancelContract)} className="text-12 text-[#9AA396] transition-colors hover:text-danger">{t("cancel")}</button>
									</>
								)}
								{c.status === "active" && c.signedAt && <span className="text-12 text-[#9AA396]">{t("signedOn", { date: new Date(c.signedAt).toLocaleDateString(locale) })}</span>}
								<button type="button" onClick={() => downloadContractPdf(c.id, c.number)} className="fs-btn fs-btn-ghost h-34">
									<TbDownload size={15} /> {t("downloadPdf")}
								</button>
								<DocumentTemplateButton kind="contracts" id={c.id} number={c.number} template={c.template} onSave={updateContract} />
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newContract")} className="w-full max-w-[480px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("newContract")}</h2>
					<div className="flex flex-col gap-12">
						<FormField label={t("customer")} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} maxLength={200} autoFocus />
						<FormField label={t("contractValue")} type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("startDate")} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
							<FormField label={t("endDate")} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
						</div>
					</div>
					<div className="mt-20 flex justify-end gap-10">
						<button type="button" onClick={() => setOpen(false)} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
						<button type="submit" className="fs-btn fs-btn-primary h-40">{t("save")}</button>
					</div>
				</form>
			</Modal>

			<ConfirmDialog open={!!toDelete} title={t("delete")} text={t("confirmDeleteContract")} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteContract(toDelete); setToDelete(null); }} />
		</div>
	);
}
