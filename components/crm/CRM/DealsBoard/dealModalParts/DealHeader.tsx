"use client";
import { useTranslations } from "next-intl";
import { TbPencil, TbX } from "react-icons/tb";
import AiSummaryButton from "../../../AiAssistant/AiSummaryButton";

interface Props {
	name: string;
	editing: boolean;
	draft: string;
	onDraft: (value: string) => void;
	onEdit: () => void;
	onSave: () => void;
	onCancel: () => void;
	onClose: () => void;
}

// Заголовок карточки: название с правкой на месте, сводка ИИ и закрытие
export default function DealHeader({ name, editing, draft, onDraft, onEdit, onSave, onCancel, onClose }: Props) {
	const t = useTranslations("crm");
	return (
		<div className="mb-20 flex items-center justify-between gap-16">
			<div className="flex min-w-0 items-center gap-12">
				{editing ? (
					<input
						autoFocus
						value={draft}
						onChange={(e) => onDraft(e.target.value)}
						onBlur={onSave}
						onKeyDown={(e) => {
							if (e.key === "Enter") onSave();
							if (e.key === "Escape") onCancel();
						}}
						maxLength={200}
						className="fs-field min-w-0 px-10 py-6 text-16 outline-none md:text-20"
					/>
				) : (
					<>
						<h2 className="truncate text-18 font-semibold text-[#edf2ff] md:text-20">{name}</h2>
						<button
							type="button"
							aria-label={t("edit")}
							onClick={onEdit}
							className="shrink-0 text-[#9aa7c9] transition-colors hover:text-[#7c93ff]">
							<TbPencil size={18} />
						</button>
					</>
				)}
			</div>
			<div className="flex shrink-0 items-center gap-16">
				<AiSummaryButton kind="deal" name={name} />
				<button type="button" onClick={onClose} aria-label={t("close")} className="shrink-0 text-[#9aa7c9] transition-colors hover:text-[#edf2ff]">
					<TbX size={24} />
				</button>
			</div>
		</div>
	);
}
