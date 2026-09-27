"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdPalette, MdDownload } from "react-icons/md";
import Modal from "../shared/Modal";
import TemplatePicker from "./TemplatePicker";
import { downloadDocumentPdf, DocumentKind } from "./download";
import { useFinanceStore } from "@/app/store/useFinanceStore";

// Оформление конкретного документа: кнопка на строке открывает окно с десяткой шаблонов, выбранный
// сохраняется в самом документе (PATCH) и дальше печатается именно он — счёт клиенту и договор могут
// выглядеть по-разному. Предпросмотр отдаёт PDF по ещё не сохранённому шаблону, чтобы выбирать глазами.
export default function DocumentTemplateButton({ kind, id, number, template, onSave, className }: {
	kind: DocumentKind;
	id: string;
	number: string;
	template: string;
	onSave: (id: string, data: { template: string }) => Promise<string | null>;
	className?: string;
}) {
	const t = useTranslations("finance");
	const locale = useLocale();
	// шаблон из настроек бухгалтерии: он напечатается, если у документа своего нет
	const settingsTemplate = useFinanceStore((s) => s.settings?.template || "classic");
	const [open, setOpen] = useState(false);
	const [picked, setPicked] = useState(template);
	const [busy, setBusy] = useState(false);

	// документ мог обновиться на сервере — при открытии окна берём его текущее оформление
	useEffect(() => { if (open) setPicked(template); }, [open, template]);
	function openDialog() { setPicked(template); setOpen(true); }

	async function save() {
		setBusy(true);
		const err = await onSave(id, { template: picked });
		setBusy(false);
		if (err) return toast.error(err);
		toast.success(t("saved"));
		setOpen(false);
	}
	async function preview() {
		setBusy(true);
		const ok = await downloadDocumentPdf(kind, id, number, locale, picked || undefined);
		setBusy(false);
		if (!ok) return toast.error(t("pdfFailed"));
	}

	return (
		<>
			<button type="button" onClick={openDialog} className={className ?? "flex items-center gap-6 rounded-8 border border-[#E6E6E6] px-16 py-8 text-14 font-medium text-[#666666] transition-opacity hover:opacity-80"}>
				<MdPalette size={16} /> {t("template")}
			</button>

			<Modal open={open} onClose={() => setOpen(false)} label={t("templateTitle")} className="w-full max-w-[860px]">
				<div className="max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
					<h2 className="mb-6 text-20 font-medium text-black">{t("templateTitle")}</h2>
					<p className="mb-16 text-14 text-[#999999]">{t("templateHint", { number })}</p>
					<TemplatePicker value={picked} onChange={setPicked} inherit={settingsTemplate} />
					<p className="mt-12 text-14 text-[#B3B3B3]">{t("templateInherit", { name: picked ? t(`tpl_${picked}`) : t("templateFromSettings") })}</p>
					<div className="mt-24 flex flex-wrap justify-end gap-12">
						<button type="button" onClick={() => setPicked("")} className="mr-auto h-[44px] rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] hover:bg-gray">{t("templateReset")}</button>
						<button type="button" disabled={busy} onClick={preview} className="flex h-[44px] items-center gap-6 rounded-8 border border-[#E6E6E6] px-20 text-16 font-medium text-[#666666] transition-opacity hover:opacity-80 disabled:opacity-60">
							<MdDownload size={18} /> {t("preview")}
						</button>
						<button type="button" disabled={busy} onClick={save} className="h-[44px] rounded-8 bg-primaryColor px-24 text-16 font-medium text-white shadow-custom hover:opacity-80 disabled:opacity-60">{t("save")}</button>
					</div>
				</div>
			</Modal>
		</>
	);
}
