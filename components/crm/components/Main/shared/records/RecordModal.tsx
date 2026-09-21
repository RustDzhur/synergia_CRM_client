"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose } from "react-icons/md";
import FormField, { fieldClass } from "../FormField";
import Modal from "../Modal";
import type { FieldOption, RecordItem, SectionConfig } from "./config";

interface Props {
	open: boolean;
	config: SectionConfig;
	tab: string;
	record: RecordItem | null; // null — новая запись
	preset?: Record<string, string>; // значения по умолчанию для новой записи (например, канал кампании)
	// список для select-полей без options в конфиге (например, этапы сделок)
	fieldOptions?: (tab: string, key: string) => FieldOption[] | undefined;
	onClose: () => void;
	onSave: (values: Record<string, string>, id?: string) => void;
	onDelete: (record: RecordItem) => void;
}

// Окно создания/правки записи. Поля берутся из config раздела, поэтому одно окно обслуживает все вкладки всех разделов.
export default function RecordModal({ open, config, tab, record, preset, fieldOptions, onClose, onSave, onDelete }: Props) {
	const t = useTranslations(config.namespace);
	const tr = useTranslations("records");
	const fields = useMemo(() => config.fields[tab] ?? [], [config, tab]);
	const [values, setValues] = useState<Record<string, string>>({});

	const optionsFor = (key: string, list?: string[]): FieldOption[] =>
		list ? list.map((o) => ({ value: o, label: t(`o_${o}`) })) : fieldOptions?.(tab, key) ?? [];

	// при каждом открытии подставляем актуальную запись; при закрытии оставляем — окно плавно гаснет с теми же данными
	useEffect(() => {
		if (!open) return;
		const initial: Record<string, string> = {};
		for (const f of fields) {
			initial[f.key] = record?.values[f.key] ?? preset?.[f.key] ?? (f.type === "select" ? optionsFor(f.key, f.options)[0]?.value ?? "" : "");
		}
		setValues(initial);
		// список этапов может подгрузиться, пока окно открыто, — заново заполнять форму из-за этого не нужно
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, record, preset, fields]);

	const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
	const name = t(`s_${tab}`);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		for (const f of fields) {
			const label = t(`f_${f.key}`);
			if (f.required && !values[f.key]?.trim()) return void toast.error(tr("required", { field: label }));
			if (f.type === "number" && values[f.key] && !(Number(values[f.key]) >= 0)) return void toast.error(tr("badNumber", { field: label }));
		}
		const clean: Record<string, string> = {};
		for (const f of fields) clean[f.key] = (values[f.key] ?? "").trim();
		onSave(clean, record?.id);
	}

	return (
		<Modal open={open} onClose={onClose} label={name} className="w-full max-w-[560px]">
			<form onSubmit={submit} className="relative max-h-[90vh] overflow-y-auto rounded-16 border border-[#E2F1F5] bg-white p-24 shadow-heroImage">
				<button type="button" onClick={onClose} aria-label={tr("cancel")} className="absolute right-16 top-16 text-iconColor transition-colors hover:text-black">
					<MdClose size={24} />
				</button>
				<h2 className="mb-20 pr-30 text-24 font-medium text-black">{record ? tr("edit", { name }) : tr("add", { name })}</h2>
				<div className="grid grid-cols-1 gap-16 md:grid-cols-2">
					{fields.map((f) =>
						f.type === "select" ? (
							<label key={f.key} className="block">
								<span className="mb-6 block text-16 text-[#999999]">{t(`f_${f.key}`)}</span>
								<select value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={`${fieldClass} cursor-pointer`}>
									{optionsFor(f.key, f.options).map((o) => (
										<option key={o.value} value={o.value}>{o.label}</option>
									))}
								</select>
							</label>
						) : (
							<FormField
								key={f.key}
								label={t(`f_${f.key}`)}
								type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
								min={f.type === "number" ? 0 : undefined}
								step={f.type === "number" ? "any" : undefined}
								value={values[f.key] ?? ""}
								onChange={(e) => set(f.key, e.target.value)}
								maxLength={f.type === "text" ? 100 : undefined}
								wrapperClassName={f.wide || f.key === "name" ? "md:col-span-2" : ""}
							/>
						)
					)}
				</div>
				<div className="mt-24 flex flex-wrap items-center justify-end gap-12">
					{record && (
						<button type="button" onClick={() => onDelete(record)} className="mr-auto px-8 py-10 text-16 font-medium text-danger transition-opacity hover:opacity-80">
							{tr("delete")}
						</button>
					)}
					<button type="button" onClick={onClose} className="h-50 rounded-8 border border-[#E6E6E6] px-24 text-16 font-medium text-[#666666] transition-colors hover:bg-gray">
						{tr("cancel")}
					</button>
					<button type="submit" className="h-50 rounded-8 bg-primaryColor px-30 text-16 font-medium text-white shadow-custom transition-opacity hover:opacity-80">
						{record ? tr("save") : tr("create")}
					</button>
				</div>
			</form>
		</Modal>
	);
}
