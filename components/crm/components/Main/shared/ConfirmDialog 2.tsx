"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { MdClose } from "react-icons/md";
import Modal from "./Modal";

interface Props {
	open: boolean;
	title: string;
	text: string;
	onCancel: () => void;
	onConfirm: () => void;
	confirmLabel?: string;
}

// Диалог подтверждения из макета: синяя шапка с крестиком, текст по центру, Cancel / Continue.
export default function ConfirmDialog({ open, title, text, onCancel, onConfirm, confirmLabel }: Props) {
	const t = useTranslations("crm");
	return (
		<Modal open={open} onClose={onCancel} label={title} zIndex={80} className="w-full max-w-[400px]">
			<div className="overflow-hidden rounded-16 bg-white shadow-heroImage">
				<div className="flex items-center justify-between bg-primaryColor px-20 py-12">
					<h2 className="text-20 font-medium text-white">{title}</h2>
					<button type="button" onClick={onCancel} aria-label={t("close")} className="text-white transition-opacity hover:opacity-80">
						<MdClose size={22} />
					</button>
				</div>
				<p className="px-30 pb-30 pt-24 text-center text-16 text-[#666666]">{text}</p>
				<div className="flex items-center justify-center gap-24 pb-24">
					<button type="button" onClick={onCancel} className="px-16 py-10 text-16 font-medium text-[#999999] transition-colors hover:text-black">
						{t("cancel")}
					</button>
					<button
						type="button"
						onClick={onConfirm}
						className="rounded-4 bg-primaryColor px-24 py-10 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80">
						{confirmLabel ?? t("continue")}
					</button>
				</div>
			</div>
		</Modal>
	);
}
