"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { TbPlus } from "react-icons/tb";

interface Props {
	editLabel: string; // «Edit Contact» / «Edit Company»
	addLabel: string; // «Add Contact» / «Add Company»
	selectedCount: number;
	onEdit: () => void;
	onAdd: () => void;
	onDelete: () => void;
}

// Строка действий над таблицей: «Edit …» (активна, когда выбрана ровно одна строка),
// красная «Delete» (когда что-то выбрано) и основная кнопка «Add …».
export default function ListToolbar({ editLabel, addLabel, selectedCount, onEdit, onAdd, onDelete }: Props) {
	const t = useTranslations("crm");
	return (
		<div className="mb-16 flex flex-wrap items-center justify-end gap-20">
			{selectedCount > 0 && (
				<button type="button" onClick={onDelete} className="animate-fade-in text-13 font-semibold text-danger transition-opacity hover:opacity-80">
					{t("deleteSelected")} ({selectedCount})
				</button>
			)}
			<button
				type="button"
				onClick={onEdit}
				disabled={selectedCount !== 1}
				className="text-13 font-semibold text-[#8c948b] transition-colors enabled:hover:text-[#f1f4ee] disabled:cursor-not-allowed disabled:opacity-50">
				{editLabel}
			</button>
			<button type="button" onClick={onAdd} className="fs-btn fs-btn-primary h-40">
				<TbPlus size={17} />
				{addLabel}
			</button>
		</div>
	);
}
