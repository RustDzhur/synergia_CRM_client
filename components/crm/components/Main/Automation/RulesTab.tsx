"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdClose, MdEdit, MdErrorOutline, MdHelp, MdKeyboardArrowDown } from "react-icons/md";
import type { Stage } from "@/app/store/useCrmStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import type { CustomTabApi } from "../shared/records/RecordsPage";
import type { RecordItem } from "../shared/records/config";
import { useSectionRecords } from "../shared/records/useSectionRecords";
import { AUTOMATION, PLAN_LIMIT, SCOPES, TARGETS, TIMINGS } from "./config";
import StagePipeline from "./StagePipeline";

interface Props extends CustomTabApi {
	stages: Stage[];
}

// Выбор из списка в виде цветного текста (как в макете): поверх текста лежит прозрачный нативный <select>,
// поэтому список открывается штатно и не обрезается прокруткой блока с карточками.
function InlineSelect({ value, options, onChange, label, className = "" }: {
	value: string;
	options: { value: string; label: string }[];
	onChange: (v: string) => void;
	label: string;
	className?: string;
}) {
	const current = options.find((o) => o.value === value)?.label ?? value;
	return (
		<label className={`relative inline-block cursor-pointer transition-opacity hover:opacity-80 ${className}`}>
			{current}
			<select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
				{options.map((o) => (
					<option key={o.value} value={o.value}>{o.label}</option>
				))}
			</select>
		</label>
	);
}

// Карточка правила или триггера: срок срабатывания, название (переименование по карандашу), кому, «Copy» и «Edit».
function RuleCard({ record, onChange, onRename, onCopy, onEdit, onDelete }: {
	record: RecordItem;
	onChange: (patch: Record<string, string>) => void;
	onRename: (name: string) => void;
	onCopy: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const t = useTranslations("automation");
	const tr = useTranslations("records");
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(record.values.name);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing) inputRef.current?.select();
	}, [editing]);

	function commit() {
		setEditing(false);
		const value = draft.trim();
		if (value && value !== record.values.name) onRename(value);
		else setDraft(record.values.name);
	}

	const timings = TIMINGS.map((v) => ({ value: v, label: t(`o_${v}`) }));
	const targets = TARGETS.map((v) => ({ value: v, label: t(`o_${v}`) }));

	return (
		<li className="flex h-[195px] w-[200px] animate-fade-in flex-col rounded-16 bg-white p-20 shadow-heroImage">
			<div className="flex items-start justify-between gap-8 text-14 text-primaryColor">
				<InlineSelect value={record.values.timing} options={timings} onChange={(v) => onChange({ timing: v })} label={t("f_timing")} />
				<button type="button" onClick={onDelete} aria-label={tr("delete")} className="-mt-2 text-[#4D4D4D] transition-colors hover:text-danger">
					<MdClose size={20} />
				</button>
			</div>

			<div className="mt-6 flex items-center gap-6 text-16 text-[#4D4D4D]">
				{editing ? (
					<input
						ref={inputRef}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === "Enter") commit();
							if (e.key === "Escape") { setDraft(record.values.name); setEditing(false); }
						}}
						maxLength={100}
						aria-label={t("f_name")}
						className="w-full min-w-0 border-b border-primaryColor bg-transparent outline-none"
					/>
				) : (
					<>
						<span className="truncate" title={record.values.name}>{record.values.name}</span>
						<button type="button" onClick={() => { setDraft(record.values.name); setEditing(true); }} aria-label={t("rename")} className="shrink-0 text-[#B3B3B3] transition-colors hover:text-primaryColor">
							<MdEdit size={16} />
						</button>
					</>
				)}
			</div>

			<p className="mt-auto text-14 text-[#B3B3B3]">{t("to")}</p>
			<InlineSelect value={record.values.target} options={targets} onChange={(v) => onChange({ target: v })} label={t("f_target")} className="mb-16 w-fit max-w-full truncate text-16 text-primaryColor" />

			<div className="flex items-center justify-between text-14">
				<button type="button" onClick={onCopy} className="text-[#B3B3B3] transition-colors hover:text-primaryColor">{t("copy")}</button>
				<button type="button" onClick={onEdit} className="text-[#4D4D4D] transition-colors hover:text-primaryColor">{t("edit")}</button>
			</div>
		</li>
	);
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
	return (
		<section className="mb-30">
			<div className="mb-16 flex items-center gap-10">
				<h2 className="text-20 font-semibold text-[#666666] lg:text-24">{title}</h2>
				<span title={hint} className="text-[#CCCCCC]"><MdHelp size={22} aria-label={hint} /></span>
				<span className="h-px flex-1 bg-[#D9D9D9]" />
			</div>
			{children}
		</section>
	);
}

// Вкладка Automation Rules: заголовок с «Create» и выбором области («General / Personal»), плашка с лимитом тарифа,
// этапы сделок с кнопками «Add» и два раздела карточек — Triggers и Automation Rules.
export default function RulesTab({ stages, query, create, edit }: Props) {
	const t = useTranslations("automation");
	const tr = useTranslations("records");
	const { records, save, remove } = useSectionRecords(AUTOMATION, "rules");
	const ordered = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);
	const [scope, setScope] = useState("general");
	const [stage, setStage] = useState<string | null>(null);
	const [toDelete, setToDelete] = useState<RecordItem | null>(null);

	// по умолчанию выбран первый этап (как в макете: активна кнопка «Add» под первым этапом);
	// если пользователь сам снял выбор — «все этапы» — больше не подставляем
	const stageTouched = useRef(false);
	useEffect(() => {
		if (stage === null && ordered.length > 0 && !stageTouched.current) setStage(ordered[0]._id);
	}, [ordered, stage]);
	const selectStage = (id: string | null) => { stageTouched.current = true; setStage(id); };

	const q = query.trim().toLowerCase();
	const visible = records.filter((r) => {
		if (r.values.scope !== scope) return false;
		// правило с пустым этапом действует на любом этапе
		if (stage && r.values.stage && r.values.stage !== stage) return false;
		if (!q) return true;
		return [r.values.name, t(`o_${r.values.timing}`), t(`o_${r.values.target}`)].some((v) => v?.toLowerCase().includes(q));
	});
	const triggers = visible.filter((r) => r.values.kind === "trigger");
	const rules = visible.filter((r) => r.values.kind !== "trigger");
	const used = records.length;

	const patch = (r: RecordItem, p: Record<string, string>) => save({ id: r.id, values: { ...r.values, ...p } });
	function copy(r: RecordItem) {
		save({ values: { ...r.values, name: `${r.values.name} (${t("copySuffix")})`.slice(0, 100) } });
		toast.success(t("copied"));
	}
	function cards(list: RecordItem[]) {
		if (list.length === 0) return <p className="text-14 text-[#B3B3B3]">{q ? tr("nothingFound") : t("nothingHere")}</p>;
		return (
			// до четырёх карточек — один ряд, больше — два ряда, как в макете; лишние уходят вправо с прокруткой
			<ul
				style={{ gridTemplateRows: `repeat(${list.length > 4 ? 2 : 1}, auto)` }}
				className="grid auto-cols-[200px] grid-flow-col gap-20 overflow-x-auto px-2 pb-16 [scrollbar-width:thin]">
				{list.map((r) => (
					<RuleCard
						key={r.id}
						record={r}
						onChange={(p) => patch(r, p)}
						onRename={(name) => patch(r, { name })}
						onCopy={() => copy(r)}
						onEdit={() => edit("rules", r)}
						onDelete={() => setToDelete(r)}
					/>
				))}
			</ul>
		);
	}

	return (
		<div>
			<div className="mb-20 flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
				<h1 className="text-24 font-normal text-[#666666] lg:text-32">{t("rulesTitle")}</h1>
				<div className="flex gap-16">
					<button
						type="button"
						onClick={() => create("rules", { scope, stage: stage ?? "" })}
						className="h-[50px] flex-1 rounded-4 bg-primaryColor px-30 text-16 font-semibold text-white shadow-custom transition-opacity hover:opacity-80 md:flex-none md:text-18">
						{t("create")}
					</button>
					<label className="relative flex h-[50px] flex-1 cursor-pointer items-center justify-between gap-10 rounded-4 border-2 border-[#B3B3B3] bg-white px-20 text-16 font-medium text-[#B3B3B3] transition-colors hover:border-primaryColor hover:text-primaryColor md:min-w-[143px] md:flex-none md:text-18">
						{t(`o_${scope}`)}
						<MdKeyboardArrowDown size={22} aria-hidden />
						<select value={scope} onChange={(e) => setScope(e.target.value)} aria-label={t("scope")} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
							{SCOPES.map((s) => (
								<option key={s} value={s}>{t(`o_${s}`)}</option>
							))}
						</select>
					</label>
				</div>
			</div>

			<p className="mb-20 flex items-start gap-10 rounded-8 bg-[#F5F7FC] px-16 py-10 text-14 text-primaryColor md:items-center">
				<MdErrorOutline size={20} className="mt-[1px] shrink-0 md:mt-0" aria-hidden />
				<span>
					{t("planBanner", { count: PLAN_LIMIT })}{" "}
					<span className={used > PLAN_LIMIT ? "font-semibold text-danger" : "text-[#B3B3B3]"}>({used}/{PLAN_LIMIT})</span>
				</span>
			</p>

			<StagePipeline
				stages={ordered}
				selected={stage}
				onSelect={selectStage}
				onAdd={(id) => { selectStage(id); create("rules", { scope, stage: id }); }}
			/>

			<Section title={t("triggers")} hint={t("triggersHint")}>{cards(triggers)}</Section>
			<Section title={t("rules")} hint={t("rulesHint")}>{cards(rules)}</Section>

			<ConfirmDialog
				open={toDelete !== null}
				title={tr("delete")}
				text={tr("confirmDeleteOne")}
				onCancel={() => setToDelete(null)}
				onConfirm={() => { if (toDelete) { remove([toDelete.id]); toast.success(tr("deleted")); } setToDelete(null); }}
			/>
		</div>
	);
}
