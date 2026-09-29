"use client";
import { useTranslations } from "next-intl";
import Modal from "../../shared/Modal";
import type { Draft } from "./model";

interface Props {
	open: boolean;
	draft: Draft;
	sending: boolean;
	onChange: (draft: Draft) => void;
	onClose: () => void;
	onSave: (asDraft: boolean) => void;
}

const inputClass = "fs-field h-40 w-full px-12 text-13 outline-none";

export default function ComposeModal({ open, draft, sending, onChange, onClose, onSave }: Props) {
	const t = useTranslations("collab");
	return (
		<Modal open={open} onClose={onClose} label={t("newEmail")} className="w-full max-w-[600px]">
			<form onSubmit={(e) => { e.preventDefault(); onSave(false); }} className="fs-popover p-24">
				<h2 className="mb-20 text-16 font-semibold text-[#f1f4ee]">{t("newEmail")}</h2>
				<div className="flex flex-col gap-12">
					<input value={draft.to} onChange={(e) => onChange({ ...draft, to: e.target.value })} placeholder={t("mailTo")} aria-label={t("mailTo")} maxLength={300} className={inputClass} />
					<input value={draft.subject} onChange={(e) => onChange({ ...draft, subject: e.target.value })} placeholder={t("mailSubject")} aria-label={t("mailSubject")} maxLength={200} className={inputClass} />
					<textarea value={draft.body} onChange={(e) => onChange({ ...draft, body: e.target.value })} placeholder={t("mailBody")} aria-label={t("mailBody")} rows={7} maxLength={5000} className="fs-field h-auto resize-none p-12 text-13 outline-none" />
				</div>
				<div className="mt-20 flex flex-wrap justify-end gap-10">
					<button type="button" onClick={onClose} className="fs-btn fs-btn-ghost h-40">{t("cancel")}</button>
					<button type="button" disabled={sending} onClick={() => onSave(true)} className="fs-btn fs-btn-ghost h-40 disabled:opacity-50">{t("saveDraft")}</button>
					<button type="submit" disabled={sending} className="fs-btn fs-btn-primary h-40 disabled:opacity-50">{sending ? "…" : t("send")}</button>
				</div>
			</form>
		</Modal>
	);
}
