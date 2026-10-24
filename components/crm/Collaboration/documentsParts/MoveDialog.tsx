"use client";
import React from "react";
import { useTranslations } from "next-intl";
import Modal from "../../shared/Modal";
import type { Target } from "./model";

interface Props {
	target: Target | null;
	options: { id: string; label: string }[];
	value: string;
	onValue: (value: string) => void;
	busy: boolean;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
}

export default function MoveDialog({ target, options, value, onValue, busy, onClose, onSubmit }: Props) {
	const t = useTranslations("collab");
	return (
		<Modal open={target !== null} onClose={onClose} label={t("moveTo")} className="w-full max-w-[440px]">
			<form onSubmit={onSubmit} className="fs-popover p-20">
				<h2 className="mb-6 text-16 font-semibold text-[#f1f4ee]">{t("moveTo")}</h2>
				<p className="mb-12 truncate text-12 text-[#8c948b]">{target?.type === "folder" ? target.folder.name : target?.doc.name}</p>
				<select value={value} onChange={(e) => onValue(e.target.value)} aria-label={t("moveTo")} className="fs-field h-40 w-full px-12 text-13 outline-none">
					{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
				</select>
				<div className="mt-20 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
					<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{busy ? "…" : t("moveHere")}</button>
				</div>
			</form>
		</Modal>
	);
}
