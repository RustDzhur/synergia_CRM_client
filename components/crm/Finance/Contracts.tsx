"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbDownload, TbEye, TbPlus } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { useContactStore } from "@/store/useContactStore";
import { useCompaniesStore } from "@/store/useCompaniesStore";
import { STATUS_COLORS } from "@/utils/statusColors";
import Modal from "../shared/Modal";
import ConfirmDialog from "../shared/ConfirmDialog";
import FormField from "../shared/FormField";
import SuggestInput, { type SuggestOption } from "../shared/SuggestInput";
import { downloadDocumentPdf, viewDocumentPdf } from "./download";
import DocumentTemplateButton from "./DocumentTemplateButton";
import { money } from "./format";
import { marketOf } from "@/lib/finance/market";
import { defaultContractText } from "@/lib/finance/contractText";
import { fieldOf } from "@/lib/finance/contractFields";
import { apiCall } from "@/store/crmApi";
import ContractDataPanel, { belongsToContact } from "./ContractDataPanel";
import { trFor } from "./contractUi";

const STATUS_COLOR: Record<string, string> = {
	draft: STATUS_COLORS.neutral, active: STATUS_COLORS.success,
	completed: STATUS_COLORS.info, cancelled: STATUS_COLORS.danger,
};
const EMPTY = { customerName: "", value: "0", currency: "EUR", startDate: "", endDate: "", notes: "", body: "", templateId: "", fields: {} as Record<string, string> };

// Договоры: карточка, текст договора и статус (draft → active когда клиент подписал — событие
// contract_signed, на него можно завести правило автоматизации). Клиент выбирается из CRM (Contact
// или Company), поэтому контакт, заведённый в CRM, здесь подхватывается сразу; текст договора
// печатается в PDF с подстановкой полей ({{number}}, {{customer}}, {{value}} — lib/finance/contractText.ts).
export default function Contracts() {
	const t = useTranslations("finance");
	const locale = useLocale();
	const { contracts, loadContracts, contractTemplates, loadContractTemplates, createContract, updateContract, signContract, completeContract, cancelContract, deleteContract, settings } = useFinanceStore();
	const { contacts, fetchContacts } = useContactStore();
	const { companies, fetchCompanies } = useCompaniesStore();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(EMPTY);
	const [link, setLink] = useState<{ contact?: string; company?: string }>({});
	const [busy, setBusy] = useState<string | null>(null);
	const [toDelete, setToDelete] = useState<string | null>(null);
	const [saveToCard, setSaveToCard] = useState(false);
	const tr = trFor(locale);

	useEffect(() => { loadContracts(); }, [loadContracts]);
	// Подсказки клиента — из CRM: грузим при открытии формы, списки общие с CRM-разделом
	useEffect(() => {
		if (!open) return;
		if (contacts.length === 0) fetchContacts();
		if (companies.length === 0) fetchCompanies();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// Клиент: контакты и фирмы CRM одним списком подсказок («c:» — контакт, «k:» — фирма):
	// при выборе договор привязывается к записи CRM, а не остаётся текстом
	const clientOptions = useMemo<SuggestOption[]>(() => {
		const q = form.customerName.trim().toLowerCase();
		const fromContacts = contacts
			.filter((c) => !q || [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: `c:${c._id}`, title: c.name, lines: [c.phone ?? "", c.email ?? ""] }));
		const fromCompanies = companies
			.filter((c) => !q || c.name.toLowerCase().includes(q))
			.map((c) => ({ key: `k:${c._id}`, title: c.name, lines: [c.email ?? ""] }));
		return [...fromContacts, ...fromCompanies];
	}, [contacts, companies, form.customerName]);

	const activeTemplate = useMemo(() => contractTemplates.find((t) => t.id === form.templateId), [contractTemplates, form.templateId]);

	function selectTemplate(id: string) {
		const tpl = contractTemplates.find((t) => t.id === id);
		if (!tpl) { setForm((f) => ({ ...f, templateId: "", body: settings?.contractTemplate?.trim() || defaultContractText(marketOf(settings?.country) ?? null), fields: {} })); return; }
		const fields: Record<string, string> = {}; // значения подставляются из карточек панелью «Данные для договора»; здесь только то, что вводится вручную
		setForm((f) => ({ ...f, templateId: id, body: tpl.body, fields }));
	}

	// Текст договора: типовой фирмы из настроек, иначе встроенный — вписывается при открытии формы
	function openNew() {
		void loadContractTemplates();
		setForm({ ...EMPTY, currency: settings?.currency || "EUR", body: settings?.contractTemplate?.trim() || defaultContractText(marketOf(settings?.country) ?? null) });
		setLink({});
		setOpen(true);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!form.customerName.trim()) return toast.error(t("customerRequired"));
		const err = await createContract({ ...form, ...link, customerName: form.customerName.trim(), value: Number(form.value) || 0, currency: settings?.currency || form.currency });
		if (err) return toast.error(err);
		if (saveToCard) await saveClientDetails();
		toast.success(t("saved"));
		setOpen(false); setForm(EMPTY); setLink({});
	}
	// Реквизиты клиента, поправленные в форме, — в его карточку: данные человека в контакт, организации — в компанию
	async function saveClientDetails() {
		const toContact: Record<string, string> = {}, toCompany: Record<string, string> = {};
		for (const [key, value] of Object.entries(form.fields)) {
			const f = fieldOf(key);
			if (!f || f.side !== "customer" || f.computed || !value.trim()) continue;
			const toPerson = belongsToContact(f) ? !!link.contact : !link.company && !!link.contact;
			(toPerson ? toContact : toCompany)[f.base] = value.trim();
		}
		if (link.contact && Object.keys(toContact).length) await apiCall(`/api/contacts/${link.contact}`, "PATCH", { extra: toContact });
		if (link.company && Object.keys(toCompany).length) await apiCall(`/api/companies/${link.company}`, "PATCH", { extra: toCompany });
	}
	async function act(id: string, fn: (id: string) => Promise<string | null>) { setBusy(id); const err = await fn(id); setBusy(null); if (err) toast.error(err); }
	async function downloadContractPdf(id: string, number: string) {
		void downloadDocumentPdf("contracts", id, number, locale);
	}
	async function viewContractPdf(id: string, number: string) {
		void viewDocumentPdf("contracts", id, number, locale);
	}

	return (
		<div>
			<div className="mb-16 flex justify-end">
				<button type="button" onClick={openNew} className="fs-btn fs-btn-primary h-40">
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
								<button type="button" onClick={() => viewContractPdf(c.id, c.number)} className="fs-btn fs-btn-ghost h-34">
									<TbEye size={15} /> {t("viewPdf")}
								</button>
								<button type="button" onClick={() => downloadContractPdf(c.id, c.number)} className="fs-btn fs-btn-ghost h-34">
									<TbDownload size={15} /> {t("downloadPdf")}
								</button>
								<DocumentTemplateButton kind="contracts" id={c.id} number={c.number} template={c.template} onSave={updateContract} />
							</div>
						</li>
					))}
				</ul>
			)}

			<Modal open={open} onClose={() => setOpen(false)} label={t("newContract")} className="w-full max-w-[720px]">
				<form onSubmit={submit} className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-14 text-16 font-semibold text-[#f1f4ee]">{t("newContract")}</h2>
					<div className="flex flex-col gap-12">
						{/* Клиент подтягивается из CRM (контакты и фирмы) — тот же список, что в разделе CRM */}
						<div>
							<span className="mb-6 block text-12 text-[#8c948b]">{t("customer")}</span>
							<SuggestInput
								value={form.customerName}
								onChange={(v) => { setForm({ ...form, customerName: v }); setLink({}); }}
								onPick={(o) => {
									const [kind, id] = o.key.split(":");
									setForm({ ...form, customerName: o.title });
									setLink(kind === "k" ? { company: id } : { contact: id });
								}}
								options={clientOptions}
								placeholder={t("contractClientPlaceholder")}
								showSearchIcon
							/>
							{link.contact || link.company ? <span className="mt-6 block text-11 text-[#9AA396]">{t("contractClientLinked")}</span> : null}
						</div>
						<div>
							<span className="mb-6 block text-12 text-[#8c948b]">{tr("templates")}</span>
							<select value={form.templateId} onChange={(e) => selectTemplate(e.target.value)} className="fs-field w-full px-8 py-8 text-13 outline-none">
								<option value="">—</option>
							{contractTemplates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
							</select>
						</div>
						<FormField label={t("contractValue")} type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
						<div className="grid grid-cols-2 gap-12">
							<FormField label={t("startDate")} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
							<FormField label={t("endDate")} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
						</div>
						{/* Текст договора: правится под фирму; поля подставляются на месте {{…}} при печати PDF */}
<ContractDataPanel
							body={form.body}
							customFields={activeTemplate?.fields ?? []}
							link={link}
							customerName={form.customerName}
							values={form.fields}
							onChange={(key, value) => setForm((f) => ({ ...f, fields: { ...f.fields, [key]: value } }))}
							saveToCard={saveToCard}
							onSaveToCard={setSaveToCard}
						/>
						<div>
							<span className="mb-6 block text-12 text-[#8c948b]">{t("contractBody")}</span>
							<textarea
								value={form.body}
								onChange={(e) => setForm({ ...form, body: e.target.value })}
								rows={12}
								className="fs-field fs-scroll w-full resize-y p-10 text-12 leading-[1.5] outline-none"
							/>
							<span className="mt-[4px] block text-11 text-[#9AA396]">{t("contractBodyHint", { vars: "{{number}} {{customer}} {{value}} {{start}} {{end}}" })}</span>
						</div>
						<FormField label={t("notes")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
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
