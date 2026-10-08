"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import Modal from "../shared/Modal";
import FormField from "../shared/FormField";

// Менеджер шаблонов договоров: неограниченное число шаблонов (аренда, найм, подряд…), у каждого —
// произвольные поля (key/label/type/source), которые подставляются в текст на месте {{key}}.
// Подписи на русском — это рабочий инструмент владельца; при необходимости их можно вынести в messages.

interface Field { key: string; label: string; type: "text" | "date" | "number" | "money"; source: "manual" | "contact" }
interface Draft { name: string; body: string; fields: Field[] }

const EMPTY: Draft = { name: "", body: "", fields: [] };

export default function ContractTemplatesManager({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { contractTemplates, loadContractTemplates, createContractTemplate, updateContractTemplate, deleteContractTemplate } = useFinanceStore();
	const [editing, setEditing] = useState<{ id: string } | null>(null);
	const [draft, setDraft] = useState<Draft>(EMPTY);
	const [saving, setSaving] = useState(false);

	useEffect(() => { if (open) loadContractTemplates(); }, [open, loadContractTemplates]);

	function startNew() {
		setEditing(null);
		setDraft({ ...EMPTY, body: "", fields: [] });
	}
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
	function close() { setEditing(null); setDraft(EMPTY); onClose(); }

	function setField(i: number, patch: Partial<Field>) {
		setDraft((d) => ({ ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
	}
	function addField() {
		setDraft((d) => ({ ...d, fields: [...d.fields, { key: "", label: "", type: "text", source: "manual" }] }));
	}
	function removeField(i: number) {
		setDraft((d) => ({ ...d, fields: d.fields.filter((_, j) => j !== i) }));
	}

	async function save() {
		if (!draft.name.trim()) return toast.error("Укажите название шаблона");
		setSaving(true);
		const err = editing
			? await updateContractTemplate(editing.id, draft)
			: await createContractTemplate(draft);
		setSaving(false);
		if (err) return toast.error(err);
		toast.success("Сохранено");
		close();
	}

	async function remove(id: string) {
		const err = await deleteContractTemplate(id);
		if (err) return toast.error(err);
	}

	const hasEditor = editing !== null || draft.fields.length > 0 || draft.body !== "" || draft.name !== "";

	return (
		<Modal open={open} onClose={close} label="Шаблоны договоров" className="w-full max-w-[860px]">
			<div className="fs-popover fs-scroll max-h-[88vh] overflow-y-auto p-20 md:p-24">
				{!hasEditor ? (
					<>
						<div className="mb-12 flex items-center justify-between">
							<h3 className="text-14 font-semibold text-[#f1f4ee]">Шаблоны договоров</h3>
							<button type="button" onClick={startNew} className="fs-btn fs-btn-primary h-36"><TbPlus size={15} /> Новый шаблон</button>
						</div>
						{contractTemplates.length === 0 ? (
							<p className="fs-card p-20 text-center text-12 text-[#8c948b]">
								Шаблонов пока нет. Создайте первый: например «Договор аренды» или «Договор найма» — с произвольными полями и подстановками {"{{поле}}"}.
							</p>
						) : (
							<ul className="flex flex-col gap-8">
								{contractTemplates.map((t) => (
									<li key={t.id} className="fs-card flex items-center justify-between gap-8 p-12">
										<div className="min-w-0">
											<p className="text-13 font-semibold text-[#f1f4ee]">{t.name}</p>
											<p className="text-11 text-[#8c948b]">{t.fields.length} полей</p>
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
							<FormField label="Название" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
							<div>
								<span className="mb-6 block text-12 text-[#8c948b]">Текст договора (подстановки {"{{ключ_поля}}"})</span>
								<textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={12} className="fs-field fs-scroll w-full resize-y p-10 text-12 leading-[1.5] outline-none" />
							</div>

							<div>
								<div className="mb-8 flex items-center justify-between">
									<span className="text-12 text-[#8c948b]">Поля (подставляются на месте {"{{ключ}}"})</span>
									<button type="button" onClick={addField} className="fs-btn fs-btn-ghost h-32"><TbPlus size={14} /> Добавить поле</button>
								</div>
								{draft.fields.length === 0 && <p className="text-11 text-[#8c948b]">Полей нет. Добавьте, например: passport («Паспортные данные»), address («Адрес прописки»), tenant («Арендатор»).</p>}
								<ul className="flex flex-col gap-8">
									{draft.fields.map((f, i) => (
										<li key={i} className="fs-card flex flex-wrap items-end gap-8 p-10">
											<div className="min-w-[120px] flex-1">
												<span className="mb-4 block text-11 text-[#8c948b]">Ключ (латиница)</span>
												<input value={f.key} onChange={(e) => setField(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() })} className="fs-field w-full px-8 py-6 text-12 outline-none" placeholder="passport" />
											</div>
											<div className="min-w-[140px] flex-1">
												<span className="mb-4 block text-11 text-[#8c948b]">Подпись</span>
												<input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} className="fs-field w-full px-8 py-6 text-12 outline-none" placeholder="Паспортные данные" />
											</div>
											<div className="w-[110px]">
												<span className="mb-4 block text-11 text-[#8c948b]">Тип</span>
												<select value={f.type} onChange={(e) => setField(i, { type: e.target.value as Field["type"] })} className="fs-field w-full px-6 py-6 text-12 outline-none">
													<option value="text">Текст</option>
													<option value="date">Дата</option>
													<option value="number">Число</option>
													<option value="money">Сумма</option>
												</select>
											</div>
											<div className="w-[150px]">
												<span className="mb-4 block text-11 text-[#8c948b]">Источник</span>
												<select value={f.source} onChange={(e) => setField(i, { source: e.target.value as Field["source"] })} className="fs-field w-full px-6 py-6 text-12 outline-none">
													<option value="manual">Вручную</option>
													<option value="contact">Из карточки клиента</option>
												</select>
											</div>
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
		</Modal>
	);
}
