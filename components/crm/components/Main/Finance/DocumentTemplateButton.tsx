"use client";
import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { TbDownload, TbPalette } from "react-icons/tb";
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
			<button type="button" onClick={openDialog} className={className ?? "fs-btn fs-btn-ghost h-34"}>
				<TbPalette size={15} /> {t("template")}
			</button>

			<Modal open={open} onClose={() => setOpen(false)} label={t("templateTitle")} className="w-full max-w-[860px]">
				<div className="fs-popover fs-scroll max-h-[90vh] overflow-y-auto p-20 md:p-24">
					<h2 className="mb-6 text-16 font-semibold text-[#f1f4ee]">{t("templateTitle")}</h2>
					<p className="mb-16 text-12 text-[#8c948b]">{t("templateHint", { number })}</p>
					<TemplatePicker value={picked} onChange={setPicked} inherit={settingsTemplate} />
					<p className="mt-12 text-11 text-[#9AA396]">{t("templateInherit", { name: picked ? t(`tpl_${picked}`) : t("templateFromSettings") })}</p>
					<div className="mt-20 flex flex-wrap justify-end gap-10">
						<button type="button" onClick={() => setPicked("")} className="fs-btn fs-btn-ghost mr-auto h-40">{t("templateReset")}</button>
						<button type="button" disabled={busy} onClick={preview} className="fs-btn fs-btn-ghost h-40 disabled:opacity-60">
							<TbDownload size={16} /> {t("preview")}
						</button>
						<button type="button" disabled={busy} onClick={save} className="fs-btn fs-btn-primary h-40 disabled:opacity-60">{t("save")}</button>
					</div>
				</div>
			</Modal>
		</>
	);
}
