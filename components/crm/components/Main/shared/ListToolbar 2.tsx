"use client";
import React from "react";
import { useTranslations } from "next-intl";

interface Props {
	editLabel: string; // «Edit Contact» / «Edit Company»
	addLabel: string; // «Add Contact» / «Add Company»
	selectedCount: number;
	onEdit: () => void;
	onAdd: () => void;
	onDelete: () => void;
}

// Строка над таблицей: «Edit …» (активна, когда выбрана ровно одна строка), красная «Delete» (когда что-то выбрано) и «Add …».
export default function ListToolbar({ editLabel, addLabel, selectedCount, onEdit, onAdd, onDelete }: Props) {
	const t = useTranslations("crm");
	return (
		<div className="mb-30 flex flex-wrap items-center justify-end gap-24">
			{selectedCount > 0 && (
				<button type="button" onClick={onDelete} className="animate-fade-in text-18 font-semibold text-danger transition-opacity hover:opacity-80">
					{t("deleteSelected")} ({selectedCount})
				</button>
			)}
			<button
				type="button"
				onClick={onEdit}
				disabled={selectedCount !== 1}
				className="text-18 font-semibold text-[#999999] transition-colors enabled:hover:text-primaryColor disabled:cursor-not-allowed disabled:opacity-60">
				{editLabel}
			</button>
			<button
				type="button"
				onClick={onAdd}
				className="h-[50px] rounded-4 bg-primaryColor px-36 text-18 font-semibold text-white shadow-custom transition-opacity hover:opacity-80">
				{addLabel}
			</button>
		</div>
	);
}
