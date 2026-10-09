"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import toast from "react-hot-toast";
import { TbEye, TbFileImport, TbListDetails, TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { useFinanceStore } from "@/store/useFinanceStore";
import { apiCall, authHeaders } from "@/store/crmApi";
import { marketOf } from "@/lib/finance/market";
import { CATALOG, GROUP_LABEL, GROUP_ORDER, KIND_GROUPS, KIND_LABEL, KIND_ORDER, groupsForKind, pickLang, fieldOf, fieldsForCountry, labelOf, tokensIn, type CatalogField, type ContractKind, type Country } from "@/lib/finance/contractFields";
import { htmlToText, textToHtml } from "@/lib/finance/contractRich";
import FormField from "../shared/FormField";
import ContractRichEditor, { type RichEditorHandle } from "./ContractRichEditor";
import { trFor } from "./contractUi";

// Редактор шаблонов договоров. Юрист загружает файл (.docx/.txt) или вставляет текст, затем из палитры перетаскивает в текст поля-меточки
// (имя, адрес, паспорт, коды, суммы…): при создании договора они подставляются из карточки выбранного клиента и настроек фирмы.
// Список полей — lib/finance/contractFields.ts (около 200, с учётом страны); чего нет в списке — добавляется «своим полем».

interface Field { key: string; label: string; type: "text" | "date" | "number" | "money"; source: "manual" | "contact" }
interface Draft { name: string; body: string; bodyHtml: string; kind: ContractKind; fields: Field[] }
const EMPTY: Draft = { name: "", body: "", bodyHtml: "", kind: "general", fields: [] };

const PALETTE = ["#C6FF4D", "#FFD166", "#FF6B6B", "#4ECDC4", "#A78BFA", "#F472B6", "#60A5FA", "#34D399", "#FB923C", "#2DD4BF", "#E879F9", "#94A3B8"];
const groupColor = (g: string) => PALETTE[Math.max(0, GROUP_ORDER.indexOf(g as never)) % PALETTE.length];

export default function ContractTemplatesManager() {
	const locale = useLocale();
	const tr = trFor(locale);
	const { contractTemplates, loadContractTemplates, createContractTemplate, updateContractTemplate, deleteContractTemplate, settings, loadSettings } = useFinanceStore();
	const [editing, setEditing] = useState<{ id: string } | null>(null);
	const [draft, setDraft] = useState<Draft>(EMPTY);
	const [saving, setSaving] = useState(false);
	const [query, setQuery] = useState("");
	const [allCountries, setAllCountries] = useState(false);
	const [preview, setPreview] = useState(false);
	const [fieldsOpen, setFieldsOpen] = useState(false);
	const editorRef = useRef<RichEditorHandle>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => { loadContractTemplates(); if (!settings) void loadSettings(); }, [loadContractTemplates, loadSettings, settings]);

	const country = (marketOf(settings?.country) as Country | null) ?? null;

	function startNew() { setEditing(null); setDraft({ ...EMPTY }); setPreview(false); }
	function startEdit(t: { id: string; name: string; body: string; bodyHtml?: string; kind?: string; fields: { key: string; label: string; type: string; source: string }[] }) {
		setEditing({ id: t.id });
		setPreview(false);
		setDraft({
			name: t.name, body: t.body, bodyHtml: t.bodyHtml || textToHtml(t.body), kind: (KIND_ORDER.includes(t.kind as ContractKind) ? t.kind : "general") as ContractKind,
			fields: t.fields.map((f) => ({
				key: f.key, label: f.label,
				type: (["text", "date", "number", "money"].includes(f.type) ? f.type : "text") as Field["type"],
				source: (f.source === "contact" ? "contact" : "manual") as Field["source"],
			})),
		});
	}
	function back() { setEditing(null); setDraft(EMPTY); setPreview(false); }

	// Вставка поля чипом в позицию курсора (клик по чипу палитры); перетаскивание обрабатывает сам редактор — в место, куда отпустили
	function insertToken(key: string) { editorRef.current?.insertToken(key); }

	function setField(i: number, patch: Partial<Field>) { setDraft((d) => ({ ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) })); }
	function addField() { setDraft((d) => ({ ...d, fields: [...d.fields, { key: "", label: "", type: "text", source: "manual" }] })); }
	function removeField(i: number) { setDraft((d) => ({ ...d, fields: d.fields.filter((_, j) => j !== i) })); }

	async function importFile(file: File) {
		const form = new FormData();
		form.append("file", file);
		try {
			const res = await fetch("/api/contract-templates/import", { method: "POST", headers: authHeaders(false), body: form });
			const json = (await res.json().catch(() => null)) as { text?: string; message?: string } | null;
			if (!res.ok || !json?.text) return void toast.error(json?.message || tr("importFailed"));
			setDraft((d) => ({ ...d, body: json.text as string, bodyHtml: textToHtml(json.text as string), name: d.name || file.name.replace(/\.[^.]+$/, "") }));
			toast.success(tr("imported"));
		} catch { toast.error(tr("importFailed")); }
		if (fileRef.current) fileRef.current.value = "";
	}

	async function save() {
		if (!draft.name.trim()) return toast.error(tr("nameRequired"));
		setSaving(true);
		const err = editing ? await updateContractTemplate(editing.id, draft) : await createContractTemplate(draft);
		setSaving(false);
		if (err) return toast.error(err);
		toast.success(tr("saved"));
		back();
	}
	async function remove(id: string) { const err = await deleteContractTemplate(id); if (err) toast.error(err); }

	// Палитра: поля страны фирмы (или все), с поиском, по группам
	const groups = useMemo(() => {
		const q = query.trim().toLowerCase();
		const list = fieldsForCountry(allCountries ? null : country, CATALOG).filter((f) => !q || f.key.toLowerCase().includes(q) || labelOf(f, locale).toLowerCase().includes(q));
		const allowed = groupsForKind(draft.kind);
		return GROUP_ORDER.filter((g) => allowed.includes(g)).map((g) => ({ id: g, items: list.filter((f) => f.group === g) })).filter((g) => g.items.length);
	}, [query, allCountries, country, locale, draft.kind]);

	const used = useMemo(() => tokensIn(draft.body), [draft.body]);
	const customKeys = useMemo(() => new Set(draft.fields.map((f) => f.key.toLowerCase())), [draft.fields]);
	const unknown = used.filter((k) => !fieldOf(k) && !customKeys.has(k.toLowerCase()));
	const previewText = useMemo(
		() => draft.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, k: string) => {
			const f = fieldOf(k);
			const c = draft.fields.find((x) => x.key.toLowerCase() === k.toLowerCase());
			return f ? `‹${labelOf(f, locale)}›` : c ? `‹${c.label || c.key}›` : whole;
		}),
		[draft.body, draft.fields, locale]
	);

	const hasEditor = editing !== null || draft.name !== "" || draft.body !== "" || draft.fields.length > 0;
	const chip = (key: string, label: string, color: string, title?: string) => (
		<button
			type="button"
			key={key}
			draggable
			onDragStart={(e) => { e.dataTransfer.setData("text/plain", `{{${key}}}`); e.dataTransfer.effectAllowed = "copy"; }}
			onClick={() => insertToken(key)}
			title={title ?? `{{${key}}}`}
			className="cursor-grab select-none rounded-full px-10 py-4 text-12 font-semibold text-[#0A0A0A] shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:cursor-grabbing"
			style={{ background: color }}
		>
			{label}
		</button>
	);

	const kindKeys = CATALOG.filter((f) => KIND_GROUPS[draft.kind].includes(f.group)).slice(0, 6).map((f) => f.key);
	const quick = ["number", "date", "firm", "signer", "customer", "customerPerson", "value", "start", "end", ...kindKeys];
	const paletteNode = (
		<div className="border-b border-[rgba(255,255,255,0.1)] bg-[#12181b] px-8 py-8">
			<div className="flex flex-wrap items-center gap-6">
				<span className="mr-4 text-11 text-[#8c948b]">{tr("quickFields")}</span>
				{quick.map((k) => { const f = fieldOf(k); return f ? chip(f.key, labelOf(f, locale), groupColor(f.group), `{{${f.key}}}`) : null; })}
			</div>
			{fieldsOpen && (
				<div className="mt-8 border-t border-[rgba(255,255,255,0.08)] pt-8">
					<div className="mb-8 flex flex-wrap items-center gap-8">
						<span className="text-12 font-medium text-[#f1f4ee]">{tr("paletteTitle")}</span>
						<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("search")} className="fs-field ml-auto h-30 min-w-[180px] flex-1 px-8 text-12 outline-none md:max-w-[280px]" />
						<select value={allCountries ? "all" : "mine"} onChange={(e) => setAllCountries(e.target.value === "all")} className="fs-field h-30 px-8 text-12 outline-none">
							<option value="mine">{tr("forCountry")}</option>
							<option value="all">{tr("allCountries")}</option>
						</select>
					</div>
					<div className="fs-scroll flex max-h-[320px] flex-col gap-8 overflow-y-auto pr-4">
						{draft.fields.some((f) => f.key) && (
							<div>
								<p className="mb-4 text-11 text-[#8c948b]">{tr("customFields")}</p>
								<div className="flex flex-wrap gap-6">{draft.fields.map((f, i) => (f.key ? chip(f.key, f.label || f.key, PALETTE[(i + 5) % PALETTE.length]) : null))}</div>
							</div>
						)}
						{groups.map((g) => (
							<details key={g.id} open={g.id === "contract" || !!query.trim() || g.id === "person"}>
								<summary className="cursor-pointer select-none text-12 font-medium text-[#cfd4cb]">{GROUP_LABEL[g.id][locale === "de" || locale === "ua" || locale === "uz" ? locale : "en"]} <span className="text-[#8c948b]">({g.items.length})</span></summary>
								<div className="mt-6 flex flex-wrap gap-6">{g.items.map((f: CatalogField) => chip(f.key, labelOf(f, locale), groupColor(f.group), `{{${f.key}}}`))}</div>
							</details>
						))}
					</div>
				</div>
			)}
		</div>
	);
	const fieldsButton = (
		<button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setFieldsOpen((v) => !v)} className="fs-btn fs-btn-ghost h-32 gap-4 px-10 text-12">
			<TbListDetails size={15} /> {tr("allFields")} {fieldsOpen ? "▴" : "▾"}
		</button>
	);

	return (
		<div className="flex flex-col gap-16">
			{!hasEditor && <FirmContractData />}
			<div className="fs-card p-16 md:p-24">
				{!hasEditor ? (
					<>
						<div className="mb-12 flex items-center justify-between">
							<h3 className="text-14 font-semibold text-[#f1f4ee]">{tr("templates")}</h3>
							<button type="button" onClick={startNew} className="fs-btn fs-btn-primary h-36"><TbPlus size={15} /> {tr("newTemplate")}</button>
						</div>
						{contractTemplates.length === 0 ? (
							<p className="fs-card p-20 text-center text-12 text-[#8c948b]">{tr("empty")}</p>
						) : (
							<ul className="flex flex-col gap-8">
								{contractTemplates.map((t) => (
									<li key={t.id} className="fs-card flex items-center justify-between gap-8 p-12">
										<div className="min-w-0">
											<p className="text-13 font-semibold text-[#f1f4ee]">{t.name}</p>
											<p className="text-11 text-[#8c948b]">{tokensIn(t.body).length} {tr("used")} · {t.fields.length} {tr("ownFields")}</p>
										</div>
										<div className="flex items-center gap-6">
											<button type="button" onClick={() => startEdit(t)} className="fs-btn fs-btn-ghost h-32"><TbPencil size={14} /> {tr("edit")}</button>
											<button type="button" onClick={() => void remove(t.id)} className="fs-btn fs-btn-ghost h-32 text-[#9AA396] hover:text-danger" aria-label="delete"><TbTrash size={14} /></button>
										</div>
									</li>
								))}
							</ul>
						)}
					</>
				) : (
					<>
						<h3 className="mb-12 text-14 font-semibold text-[#f1f4ee]">{editing ? tr("editTemplate") : tr("newTemplate")}</h3>
						<div className="flex flex-col gap-10">
							<FormField label={tr("nameLabel")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
							<label className="block">
								<span className="mb-4 block text-11 text-[#8c948b]">{tr("kindLabel")}</span>
								<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ContractKind })} className="fs-field h-36 w-full px-8 text-13 outline-none md:max-w-[360px]">
									{KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABEL[k][pickLang(locale)]}</option>)}
								</select>
							</label>

							<div>
								<div className="mb-6 flex flex-wrap items-center gap-8">
									<span className="text-12 text-[#8c948b]">{tr("yourText")}</span>
									<span className="inline-flex items-center gap-6 rounded-full bg-[rgba(255,255,255,0.06)] px-10 py-4 text-12 text-[#f1f4ee]"><span className="h-8 w-8 rounded-full bg-[#34D399]" />{tr("autoFields")}{used.length ? ` · ${used.length}` : ""}</span>
									<input ref={fileRef} type="file" accept=".docx,.txt,.md,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
									<button type="button" onClick={() => fileRef.current?.click()} className="fs-btn fs-btn-ghost ml-auto h-30"><TbFileImport size={14} /> {tr("importFile")}</button>
									<button type="button" onClick={() => setPreview((v) => !v)} className="fs-btn fs-btn-ghost h-30"><TbEye size={14} /> {preview ? tr("previewOff") : tr("preview")}</button>
								</div>
								{preview ? (
									<pre className="fs-field fs-scroll max-h-[480px] w-full overflow-auto whitespace-pre-wrap p-10 text-12 leading-[1.5]">{previewText}</pre>
								) : (
									<ContractRichEditor
										ref={editorRef}
										html={draft.bodyHtml}
										onChange={(h) => setDraft((d) => ({ ...d, bodyHtml: h, body: htmlToText(h) }))}
										placeholder={tr("placeholder")}
										blockLabels={{ p: tr("styleNormal") }}
										toolbarExtra={fieldsButton}
										palette={paletteNode}
									/>
								)}
								{unknown.length > 0 && (
									<p className="mt-6 text-11 text-[#F4A100]">{tr("unknown")} {unknown.map((k) => `{{${k}}}`).join(", ")}</p>
								)}
							</div>

							<div>
								<div className="mb-8 flex items-center justify-between">
									<span className="text-12 text-[#8c948b]">{tr("customFields")}</span>
									<button type="button" onClick={addField} className="fs-btn fs-btn-ghost h-32"><TbPlus size={14} /> {tr("addField")}</button>
								</div>
								<ul className="flex flex-col gap-8">
									{draft.fields.map((f, i) => (
										<li key={i} className="fs-card flex flex-wrap items-end gap-8 p-10">
											<div className="min-w-[130px] flex-1">
												<span className="mb-4 block text-11 text-[#8c948b]">{tr("key")}</span>
												<input value={f.key} onChange={(e) => setField(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() })} className="fs-field w-full px-8 py-6 text-12 outline-none" placeholder="passport" />
											</div>
											<div className="min-w-[160px] flex-1">
												<span className="mb-4 block text-11 text-[#8c948b]">{tr("label")}</span>
												<input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} className="fs-field w-full px-8 py-6 text-12 outline-none" />
											</div>
											<label className="flex items-center gap-6 pb-6 text-12 text-[#8c948b]">
												<input type="checkbox" checked={f.source === "contact"} onChange={(e) => setField(i, { source: e.target.checked ? "contact" : "manual" })} className="accent-[#C6FF4D]" />
												{tr("fromCard")}
											</label>
											<button type="button" onClick={() => removeField(i)} className="fs-btn fs-btn-ghost h-32 text-[#9AA396] hover:text-danger" aria-label="delete"><TbTrash size={14} /></button>
										</li>
									))}
								</ul>
							</div>
						</div>
						<div className="mt-16 flex justify-end gap-8">
							<button type="button" onClick={back} className="fs-btn fs-btn-ghost h-38">{tr("back")}</button>
							<button type="button" onClick={() => void save()} disabled={saving} className="fs-btn fs-btn-primary h-38 disabled:opacity-[0.5]">{tr("save")}</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

// Реквизиты нашей фирмы для договоров: часть берётся из настроек бухгалтерии (видна серым), остальное — добавляется здесь
function FirmContractData() {
	const locale = useLocale();
	const tr = trFor(locale);
	const { settings, saveSettings } = useFinanceStore();
	const [resolved, setResolved] = useState<Record<string, string>>({});
	const [edits, setEdits] = useState<Record<string, string>>({});
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const country = (marketOf(settings?.country) as Country | null) ?? null;

	useEffect(() => {
		if (!open) return;
		void apiCall<{ firm: Record<string, string> }>("/api/contract-templates/client-data").then((r) => { if (r.ok && r.data) setResolved(r.data.firm); });
	}, [open, settings?.contractData]);

	const fields = useMemo(() => {
		const q = query.trim().toLowerCase();
		return fieldsForCountry(country, CATALOG).filter((f) => f.side === "firm" && !f.computed && (!q || f.key.toLowerCase().includes(q) || labelOf(f, locale).toLowerCase().includes(q)));
	}, [country, locale, query]);

	async function save() {
		const err = await saveSettings({ contractData: edits });
		if (err) return void toast.error(err);
		setEdits({});
		toast.success(tr("saved"));
	}

	return (
		<div className="fs-card p-16 md:p-24">
			<button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
				<h3 className="text-14 font-semibold text-[#f1f4ee]">{tr("firmTitle")}</h3>
				<span className="text-12 text-[#8c948b]">{open ? "−" : "+"}</span>
			</button>
			{open && (
				<div className="mt-12">
					<p className="mb-10 text-12 text-[#8c948b]">{tr("firmHint")}</p>
					<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("search")} className="fs-field mb-10 h-32 w-full px-8 text-12 outline-none md:max-w-[320px]" />
					<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
						{GROUP_ORDER.map((g) => {
							const items = fields.filter((f) => f.group === g);
							if (!items.length) return null;
							return (
								<div key={g} className="md:col-span-2">
									<p className="mb-6 text-12 font-medium text-[#cfd4cb]">{GROUP_LABEL[g][locale === "de" || locale === "ua" || locale === "uz" ? locale : "en"]}</p>
									<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
										{items.map((f) => (
											<label key={f.key} className="block">
												<span className="mb-4 block text-11 text-[#8c948b]">{labelOf(f, locale).replace(/^[^:]+:\s*/, "")}</span>
												<input
													value={edits[f.base] ?? settings?.contractData?.[f.base] ?? ""}
													onChange={(e) => setEdits((d) => ({ ...d, [f.base]: e.target.value }))}
													placeholder={resolved[f.base] || ""}
													className="fs-field w-full px-8 py-6 text-12 outline-none"
												/>
											</label>
										))}
									</div>
								</div>
							);
						})}
					</div>
					<div className="mt-12 flex justify-end">
						<button type="button" onClick={() => void save()} disabled={!Object.keys(edits).length} className="fs-btn fs-btn-primary h-36 disabled:opacity-[0.5]">{tr("firmSave")}</button>
					</div>
				</div>
			)}
		</div>
	);
}
