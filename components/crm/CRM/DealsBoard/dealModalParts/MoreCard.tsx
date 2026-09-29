"use client";
import { useTranslations } from "next-intl";
import type { Deal } from "@/store/useCrmStore";
import { formatDate } from "@/utils/crmFormat";
import FormField, { fieldClass } from "../../../shared/FormField";
import { Card, CardHeader, Row, SaveRow, SectionFooter } from "./layout";
import type { MoreDraft } from "./model";

interface Props {
	deal: Deal;
	editing: boolean;
	draft: MoreDraft;
	onChange: (draft: MoreDraft) => void;
	onToggle: () => void;
	onSave: () => void;
	onDeleteSection: () => void;
}

export default function MoreCard({ deal, editing, draft, onChange, onToggle, onSave, onDeleteSection }: Props) {
	const t = useTranslations("crm");
	const yesNo = (v: boolean) => (v ? t("yes") : t("no"));
	return (
		<Card>
			<CardHeader title={t("more")} action={editing ? t("cancel") : t("edit")} onAction={onToggle} />
			<div className="px-16 py-14">
				{editing ? (
					<>
						<FormField label={t("dealType")} value={draft.dealType} onChange={(e) => onChange({ ...draft, dealType: e.target.value })} wrapperClassName="mb-12" />
						<label className="mb-12 block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("availableToAll")}</span>
							<select
								value={draft.availableToAll ? "yes" : "no"}
								onChange={(e) => onChange({ ...draft, availableToAll: e.target.value === "yes" })}
								className={fieldClass}>
								<option value="yes">{t("yes")}</option>
								<option value="no">{t("no")}</option>
							</select>
						</label>
						<FormField label={t("responsible")} value={draft.responsible} onChange={(e) => onChange({ ...draft, responsible: e.target.value })} wrapperClassName="mb-12" />
						<FormField label={t("utm")} value={draft.utm} onChange={(e) => onChange({ ...draft, utm: e.target.value })} />
						<SaveRow onSave={onSave} onCancel={onToggle} />
					</>
				) : (
					<>
						<Row label={t("dealType")}>{deal.dealType}</Row>
						<Row label={t("startDate")}>{formatDate(deal.startDate)}</Row>
						<Row label={t("availableToAll")}>{yesNo(deal.availableToAll ?? true)}</Row>
						<Row label={t("responsible")} accent>{deal.responsible}</Row>
						<Row label={t("utm")}>{deal.utm || t("none")}</Row>
					</>
				)}
			</div>
			<SectionFooter onDelete={onDeleteSection} />
		</Card>
	);
}
