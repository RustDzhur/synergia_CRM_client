"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Deal } from "@/store/useCrmStore";
import { formatDate } from "@/utils/crmFormat";
import FormField, { fieldClass } from "../../../shared/FormField";
import SuggestInput, { SuggestOption } from "../../../shared/SuggestInput";
import { Card, CardHeader, Row, SaveRow } from "./layout";
import type { AboutDraft } from "./model";

interface Person {
	_id: string;
	name: string;
	phone?: string;
	email?: string;
	company?: string;
}

interface Props {
	deal: Deal;
	editing: boolean;
	draft: AboutDraft;
	onChange: (draft: AboutDraft) => void;
	onToggle: () => void;
	onSave: () => void;
	stages: { _id: string; name: string }[];
	contacts: Person[];
	companies: { _id: string; name: string; email?: string }[];
}

export default function AboutCard({ deal, editing, draft, onChange, onToggle, onSave, stages, contacts, companies }: Props) {
	const t = useTranslations("crm");

	const contactOptions = useMemo<SuggestOption[]>(() => {
		const q = draft.contactName.toLowerCase();
		return contacts
			.filter((c) => !q || [c.name, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: c._id, title: c.name, lines: [c.phone ?? "", c.email ?? ""] }));
	}, [contacts, draft.contactName]);

	const companyOptions = useMemo<SuggestOption[]>(() => {
		const q = draft.companyName.toLowerCase();
		return companies
			.filter((c) => !q || [c.name, c.email].some((v) => v?.toLowerCase().includes(q)))
			.map((c) => ({ key: c._id, title: c.name, lines: [c.email ?? ""] }));
	}, [companies, draft.companyName]);

	return (
		<Card>
			<CardHeader title={t("aboutDeal")} action={editing ? t("cancel") : t("edit")} onAction={onToggle} />
			<div className="px-16 py-14">
				{editing ? (
					<>
						<FormField
							label={t("taskName")}
							value={draft.clientName}
							onChange={(e) => onChange({ ...draft, clientName: e.target.value })}
							maxLength={200}
							wrapperClassName="mb-12"
						/>
						<label className="mb-12 block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("stage")}</span>
							<select value={draft.stage} onChange={(e) => onChange({ ...draft, stage: e.target.value })} className={fieldClass}>
								{stages.map((s) => (
									<option key={s._id} value={s._id}>{s.name}</option>
								))}
							</select>
						</label>
						<FormField
							label={t("startDate")}
							type="date"
							value={draft.startDate}
							onChange={(e) => onChange({ ...draft, startDate: e.target.value })}
							wrapperClassName="mb-16"
						/>
						<div className="-mx-16 rounded-10 bg-[rgba(255,255,255,0.03)] px-16 py-14">
							<p className="mb-10 text-12 font-medium text-[#8c948b]">{t("client")}</p>
							<span className="mb-6 block text-12 text-[#8c948b]">{t("contact")}</span>
							<SuggestInput
								value={draft.contactName}
								onChange={(text) => onChange({ ...draft, contactName: text, contact: "" })}
								onPick={(o) => {
									const picked = contacts.find((c) => c._id === o.key);
									onChange({ ...draft, contactName: o.title, contact: o.key, companyName: draft.companyName || picked?.company || "" });
								}}
								options={contactOptions}
								placeholder={t("contactSearchPlaceholder")}
								showSearchIcon
							/>
							<button
								type="button"
								onClick={() => onChange({ ...draft, contactName: draft.contactName ? `${draft.contactName}, ` : "", contact: "" })}
								className="my-8 block text-12 text-[#c6ff4d] transition-opacity hover:opacity-80">
								{t("addParticipant")}
							</button>
							<span className="mb-6 block text-12 text-[#8c948b]">{t("company")}</span>
							<SuggestInput
								value={draft.companyName}
								onChange={(text) => onChange({ ...draft, companyName: text, company: "" })}
								onPick={(o) => onChange({ ...draft, companyName: o.title, company: o.key })}
								options={companyOptions}
								placeholder={t("companySearchPlaceholder")}
								showSearchIcon
							/>
						</div>
						<SaveRow onSave={onSave} onCancel={onToggle} />
					</>
				) : (
					<>
						<Row label={t("taskName")}>{deal.clientName}</Row>
						<Row label={t("stage")}>{stages.find((s) => s._id === deal.stage)?.name}</Row>
						<Row label={t("startDate")}>{formatDate(deal.startDate)}</Row>
						<Row label={t("contact")}>{deal.contactName}</Row>
						<Row label={t("company")}>{deal.companyName}</Row>
					</>
				)}
			</div>
		</Card>
	);
}
