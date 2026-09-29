"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { TbFolder } from "react-icons/tb";
import Modal from "../../shared/Modal";
import FileTypeIcon from "../FileTypeIcon";
import { ICON_TYPE } from "./model";
import type { NameMode } from "./model";

interface Props {
	mode: NameMode | null;
	name: string;
	onName: (name: string) => void;
	busy: boolean;
	onClose: () => void;
	onSubmit: (e: React.FormEvent) => void;
}

// Имя нового документа или папки и переименование — одно окно на все четыре случая
export default function NameDialog({ mode, name, onName, busy, onClose, onSubmit }: Props) {
	const t = useTranslations("collab");
	const isFolder = mode?.kind === "folder-new" || mode?.kind === "folder-rename";
	return (
		<Modal open={mode !== null} onClose={onClose} label={t("document")} className="w-full max-w-[440px]">
			<form onSubmit={onSubmit} className="fs-popover p-20">
				<h2 className="mb-16 flex items-center gap-12 text-16 font-semibold text-[#f1f4ee]">
					{mode?.kind === "doc" && <FileTypeIcon type={ICON_TYPE[mode.docKind]} size={20} withLabel={false} />}
					{isFolder && <TbFolder size={20} className="text-[#FABF4D]" aria-hidden />}
					{mode?.kind === "doc" ? t("newDocument") : mode?.kind === "folder-new" ? t("folderNew") : t("rename")}
				</h2>
				<input
					value={name}
					onChange={(e) => onName(e.target.value)}
					maxLength={100}
					autoFocus
					placeholder={isFolder ? t("folderName") : undefined}
					aria-label={t("fileName")}
					className="fs-field h-40 w-full px-12 text-13 outline-none transition-colors"
				/>
				{mode?.kind === "doc" && <p className="mt-8 text-12 text-[#8c948b]">{t("docOpenNote")}</p>}
				<div className="mt-20 flex justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
					<button type="submit" disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">
						{busy ? "…" : mode?.kind === "doc" || mode?.kind === "folder-new" ? t("create") : t("save")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
