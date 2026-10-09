"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import FormField from "../shared/FormField";

// Редактор шаблонов договоров. Текст вставляется сверху, а в него — специальные поля-меточки:
// их видно как цветные чипы, их можно взять мышкой и перетащить в текст (или кликнуть — встанет в место курсора).
// Каждый чип подписан, что за поле он подставляет. Сохраняется шаблон с именем (аренда, найм, подряд…).

interface Field { key: string; label: string; type: "text" | "date" | "number" | "money"; source: "manual" | "contact" }
interface Draft { name: string; body: string; fields: Field[] }

const EMPTY: Draft = { name: "", body: "", fields: [] };

// Встроенные поля договора — их значения подставляются сами из карточки клиента и настроек фирмы.
const BUILTIN: { key: string; label: string }[] = [
	{ key: "number", label: "Номер договора" },
	{ key: "date", label: "Дата договора" },
	{ key: "today", label: "Сегодняшняя дата (день печати)" },
	{ key: "customer", label: "Клиент (название или ФИО)" },
	{ key: "customerPerson", label: "Контактное лицо клиента" },
	{ key: "customerAddress", label: "Адрес клиента" },
	{ key: "customerTaxId", label: "Код клиента (ЄДРПОУ / ІПН / STIR)" },
	{ key: "customerPhone", label: "Телефон клиента" },
	{ key: "customerEmail", label: "E-mail клиента" },
	{ key: "value", label: "Сумма договора" },
	{ key: "start", label: "Начало работ" },
	{ key: "end", label: "Окончание работ" },
	{ key: "firm", label: "Название фирмы (исполнитель)" },
	{ key: "firmAddress", label: "Адрес фирмы" },
	{ key: "firmTaxId", label: "Код фирмы (ЄДРПОУ / ІПН / STIR)" },
	{ key: "signer", label: "Подписант (ФОП или директор)" },
	{ key: "firmPhone", label: "Телефон фирмы" },
	{ key: "firmEmail", label: "E-mail фирмы" },
	{ key: "firmWebsite", label: "Сайт фирмы" },
	{ key: "firmBank", label: "Банк фирмы" },
	{ key: "firmIban", label: "IBAN фирмы" },
];
const PALETTE = ["#C6FF4D", "#FFD166", "#FF6B6B", "#4ECDC4", "#A78BFA", "#F472B6", "#60A5FA", "#34D399", "#FB923C", "#2DD4BF", "#E879F9", "#94A3B8"];
const chipColor = (i: number) => PALETTE[i % PALETTE.length];

export default function ContractTemplatesManager() {
	const { contractTemplates, loadContractTemplates, createContractTemplate, updateContractTemplate, deleteContractTemplate } = useFinanceStore();
	const [editing, setEditing] = useState<{ id: string } | null>(null);
	const [draft, setDraft] = useState<Draft>(EMPTY);
	const [saving, setSaving] = useState(false);
	const taRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => { loadContractTemplates(); }, [loadContractTemplates]);

	function startNew() { setEditing(null); setDraft({ ...EMPTY }); }
	function startEdit(t: { id: string; name: string; body: string; fields: { key: string; label: string; type: string; source: string }[] }) {
		setEditing({ id: t.id });
		setDraft({
			name: t.name, body: t.body,
			fields: t.fields.map((f) => ({
				key: f.key, label: f.label,
				type: (["text", "date", "number", "money"].includes(f.type) ? f.type : "text") as Field["type"],
				source: (f.source === "contact" ? "contact" : "manual") as Field["source"],
			})),
		});
	}
	function back() { setEditing(null); setDraft(EMPTY); }

	// Вставка метки {{key}} в текст: в позицию курсора (или в конец)
	function insertToken(key: string) {
		const ta = taRef.current;
		const pos = ta ? (ta.selectionStart ?? draft.body.length) : draft.body.length;
		const token = `{{${key}}}`;
		const next = draft.body.slice(0, pos) + token + draft.body.slice(pos);
		setDraft((d) => ({ ...d, body: next }));
		requestAnimationFrame(() => { if (ta) { ta.focus(); const p = pos + token.length; ta.setSelectionRange(p, p); } });
	}

	function setField(i: number, patch: Partial<Field>) { setDraft((d) => ({ ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })); }
	function addField() { setDraft((d) => ({ ...d, fields: [...d.fields, { key: "", label: "", type: "text", source: "manual" }] })); }
	function removeField(i: number) { setDraft((d) => ({ ...d, fields: d.fields.filter((_, j) => j !== i) })); }

	async function save() {
		if (!draft.name.trim()) return toast.error("Укажите название шаблона");
		setSaving(true);
		const err = editing ? await updateContractTemplate(editing.id, draft) : await createContractTemplate(draft);
		setSaving(false);
		if (err) return toast.error(err);
		toast.success("Сохранено");
		back();
	}
	async function remove(id: string) { const err = await deleteContractTemplate(id); if (err) toast.error(err); }

	const hasEditor = editing !== null || draft.name !== "" || draft.body !== "" || draft.fields.length > 0;
	const chip = (key: string, label: string, color: string) => (
		<button
			type="button"
			key={key}
			draggable
			onDragStart={(e) => e.dataTransfer.setData("text/plain", key)}
			onClick={() => insertToken(key)}
			title={`${label} — в текст встанет ${`{{${key}}}`}`}
			className="cursor-grab select-none rounded-full px-10 py-4 text-12 font-semibold text-[#0A0A0A] shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:cursor-grabbing"
			style={{ background: color }}
		>
			{label}
		</button>
	);

	return (
		<div className="fs-card p-16 md:p-24">
				{!hasEditor ? (
					<>
						<div className="mb-12 flex items-center justify-between">
							<h3 className="text-14 font-semibold text-[#f1f4ee]">Шаблоны договоров</h3>
							<button type="button" onClick={startNew} className="fs-btn fs-btn-primary h-36"><TbPlus size={15} /> Новый шаблон</button>
						</div>
						{contractTemplates.length === 0 ? (
							<p className="fs-card p-20 text-center text-12 text-[#8c948b]">
								Шаблонов пока нет. Создайте первый: «Договор аренды», «Договор найма»… — вставьте текст и перетащите в него поля-меточки.
							</p>
						) : (
							<ul className="flex flex-col gap-8">
								{contractTemplates.map((t) => (
									<li key={t.id} className="fs-card flex items-center justify-between gap-8 p-12">
										<div className="min-w-0">
											<p className="text-13 font-semibold text-[#f1f4ee]">{t.name}</p>
											<p className="text-11 text-[#8c948b]">{t.fields.length} своих полей</p>
										</div>
										<div className="flex items-center gap-6">
											<button type="button" onClick={() => startEdit(t)} className="fs-btn fs-btn-ghost h-32"><TbPencil size={14} /> Изменить</button>
											<button type="button" onClick={() => void remove(t.id)} className="fs-btn fs-btn-ghost h-32 text-[#9AA396] hover:text-danger"><TbTrash size={14} /></button>
										</div>
									</li>
								))}
							</ul>
						)}
					</>
				) : (
					<>
						<h3 className="mb-12 text-14 font-semibold text-[#f1f4ee]">{editing ? "Изменить шаблон" : "Новый шаблон"}</h3>
						<div className="flex flex-col gap-10">
							<FormField label="Название шаблона (например «Договор аренды»)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />

							{/* Палитра полей-меток: перетащите в текст или кликните */}
							<div className="fs-card p-12">
								<span className="mb-8 block text-12 font-medium text-[#f1f4ee]">Поля-меточки (перетащите в текст или кликните)</span>
								<div className="flex flex-wrap gap-6">
									{BUILTIN.map((f, i) => chip(f.key, f.label, chipColor(i)))}
									{draft.fields.map((f, i) => f.key ? chip(f.key, f.label || f.key, chipColor(i + BUILTIN.length)) : null)}
								</div>
							</div>

							{/* Текст договора — сюда перетаскиваются метки */}
							<div>
								<span className="mb-6 block text-12 text-[#8c948b]">Текст договора</span>
								<textarea
									ref={taRef}
									value={draft.body}
									onChange={(e) => setDraft({ ...draft, body: e.target.value })}
									onDragOver={(e) => e.preventDefault()}
									onDrop={(e) => { e.preventDefault(); const k = e.dataTransfer.getData("text/plain"); if (k) insertToken(k); }}
									rows={14}
									placeholder={"Вставьте текст договора. В нужное место перетащите метку, например {{customer}} и {{passport}}."}
									className="fs-field fs-scroll w-full resize-y p-10 text-12 leading-[1.5] outline-none"
								/>
							</div>

							{/* Свои поля */}
							<div>
								<div className="mb-8 flex items-center justify-between">
									<span className="text-12 text-[#8c948b]">Свои поля (паспорт, адрес прописки, арендатор…)</span>
									<button type="button" onClick={addField} className="fs-btn fs-btn-ghost h-32"><TbPlus size={14} /> Добавить поле</button>
								</div>
								{draft.fields.length === 0 && <p className="text-11 text-[#8c948b]">Добавьте свои поля, чтобы договор подставлял данные, которых нет среди встроенных.</p>}
								<ul className="flex flex-col gap-8">
									{draft.fields.map((f, i) => (
										<li key={i} className="fs-card flex flex-wrap items-end gap-8 p-10">
											<div className="min-w-[130px] flex-1">
												<span className="mb-4 block text-11 text-[#8c948b]">Ключ (латиницей, для {"{{…}}"})</span>
												<input value={f.key} onChange={(e) => setField(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() })} className="fs-field w-full px-8 py-6 text-12 outline-none" placeholder="passport" />
											</div>
											<div className="min-w-[160px] flex-1">
												<span className="mb-4 block text-11 text-[#8c948b]">Подпись (что за поле)</span>
												<input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} className="fs-field w-full px-8 py-6 text-12 outline-none" placeholder="Паспортные данные" />
											</div>
											<label className="flex items-center gap-6 pb-6 text-12 text-[#8c948b]">
												<input type="checkbox" checked={f.source === "contact"} onChange={(e) => setField(i, { source: e.target.checked ? "contact" : "manual" })} className="accent-[#C6FF4D]" />
												из карточки клиента
											</label>
											<button type="button" onClick={() => removeField(i)} className="fs-btn fs-btn-ghost h-32 text-[#9AA396] hover:text-danger"><TbTrash size={14} /></button>
										</li>
									))}
								</ul>
							</div>
						</div>
						<div className="mt-16 flex justify-end gap-8">
							<button type="button" onClick={() => { setEditing(null); setDraft(EMPTY); }} className="fs-btn fs-btn-ghost h-38">Назад</button>
							<button type="button" onClick={() => void save()} disabled={saving} className="fs-btn fs-btn-primary h-38 disabled:opacity-[0.5]">Сохранить</button>
						</div>
					</>
				)}
		</div>
	);
}
