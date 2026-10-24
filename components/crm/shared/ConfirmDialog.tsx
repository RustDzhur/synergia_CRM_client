"use client";
import "react";
import { useTranslations } from "next-intl";
import { TbX } from "react-icons/tb";
import Modal from "./Modal";

interface Props {
	open: boolean;
	title: string;
	text: string;
	onCancel: () => void;
	onConfirm: () => void;
	confirmLabel?: string;
}

// Диалог подтверждения: заголовок с крестиком, текст по центру, отмена и основное действие.
export default function ConfirmDialog({ open, title, text, onCancel, onConfirm, confirmLabel }: Props) {
	const t = useTranslations("crm");
	return (
		<Modal open={open} onClose={onCancel} label={title} zIndex={80} className="w-full max-w-[400px]">
			<div className="fs-popover overflow-hidden">
				<div className="flex items-center justify-between border-b border-inkLine px-16 py-12">
					<h2 className="text-14 font-semibold text-[#edf2ff]">{title}</h2>
					<button type="button" onClick={onCancel} aria-label={t("close")} className="text-[#9aa7c9] transition-colors hover:text-[#edf2ff]">
						<TbX size={18} />
					</button>
				</div>
				<p className="px-20 pb-20 pt-18 text-center text-13 text-[#9aa7c9]">{text}</p>
				<div className="flex items-center justify-center gap-10 border-t border-inkLine px-16 py-12">
					<button type="button" onClick={onCancel} className="fs-btn fs-btn-ghost h-36">
						{t("cancel")}
					</button>
					<button type="button" onClick={onConfirm} className="fs-btn fs-btn-primary h-36">
						{confirmLabel ?? t("continue")}
					</button>
				</div>
			</div>
		</Modal>
	);
}
