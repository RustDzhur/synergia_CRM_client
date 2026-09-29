"use client";
import { useTranslations } from "next-intl";
import type { Deal } from "@/store/useCrmStore";
import { fieldClass } from "../../../shared/FormField";
import { Card, CardHeader, Row, SaveRow, SectionFooter } from "./layout";

interface Props {
	deal: Deal;
	editing: boolean;
	value: string;
	onChange: (value: string) => void;
	onToggle: () => void;
	onSave: () => void;
	onDeleteSection: () => void;
}

export default function RecurringCard({ deal, editing, value, onChange, onToggle, onSave, onDeleteSection }: Props) {
	const t = useTranslations("crm");
	const labels: Record<string, string> = {
		"": t("noSelection"), daily: t("recurDaily"), weekly: t("recurWeekly"), monthly: t("recurMonthly"), yearly: t("recurYearly"),
	};
	return (
		<Card>
			<CardHeader title={t("recurringDeal")} action={editing ? t("cancel") : t("edit")} onAction={onToggle} />
			<div className="px-16 py-14">
				{editing ? (
					<>
						<label className="block">
							<span className="mb-6 block text-12 text-[#8c948b]">{t("recurringDeal")}</span>
							<select value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass}>
								{Object.entries(labels).map(([key, label]) => (
									<option key={key} value={key}>{label}</option>
								))}
							</select>
						</label>
						<SaveRow onSave={onSave} onCancel={onToggle} />
					</>
				) : (
					<Row label={t("recurringDeal")}>{labels[deal.recurring ?? ""] ?? deal.recurring}</Row>
				)}
			</div>
			<SectionFooter onDelete={onDeleteSection} />
		</Card>
	);
}
