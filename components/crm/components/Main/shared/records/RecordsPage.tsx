"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MdArrowDownward, MdArrowUpward, MdChevronRight, MdEdit, MdSettings } from "react-icons/md";
import { useRecordsHydration, useRecordsStore } from "@/app/store/useRecordsStore";
import { formatDate } from "@/app/utils/crmFormat";
import { localeTag } from "@/app/utils/dateHelpers";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import Checkbox from "../Checkbox";
import ConfirmDialog from "../ConfirmDialog";
import ListToolbar from "../ListToolbar";
import SearchBox from "../SearchBox";
import { TAB_BAR } from "../tabBar";
import { Field, FieldOption, RecordItem, SectionConfig, STATUS_COLORS } from "./config";
import RecordModal from "./RecordModal";

const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// Что страница отдаёт вкладке с собственным содержимым (customTabs): поисковый запрос и способ открыть окно новой записи
export interface CustomTabApi {
	query: string;
	create: (tab: string, preset?: Record<string, string>) => void;
	edit: (tab: string, record: RecordItem) => void;
}

interface Props {
	config: SectionConfig;
	renderCustom?: (tab: string, api: CustomTabApi) => React.ReactNode;
	// список для select-полей без options в конфиге (например, этапы сделок из CRM)
	fieldOptions?: (tab: string, key: string) => FieldOption[] | undefined;
}

// Страница раздела со вкладками: поиск, таблица с выбором строк, сортировкой по заголовку и настройкой колонок (шестерёнка),
// окно создания/правки записи. Вкладки из config.customTabs рисует renderCustom (например, Start в Marketing).
export default function RecordsPage({ config, renderCustom, fieldOptions }: Props) {
	const t = useTranslations(config.namespace);
	const tr = useTranslations("records");
	const tc = useTranslations("crm");
	const locale = useLocale();
	const tag = localeTag(locale);
	useRecordsHydration(config.tabs.filter((tb) => !(config.customTabs ?? []).includes(tb) || true).map((tb) => `${config.section}:${tb}`));
	const { data, hidden, saveRecord, deleteRecords, setHidden } = useRecordsStore();

	const [tab, setTab] = useState(config.tabs[0]);
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [modal, setModal] = useState<{ open: boolean; tab: string; record: RecordItem | null; preset?: Record<string, string> }>({ open: false, tab: config.tabs[0], record: null });
	const [toDelete, setToDelete] = useState<{ tab: string; ids: string[] } | null>(null);
	const [gearOpen, setGearOpen] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);
	const gearRef = useRef<HTMLDivElement>(null);
	const barRef = useRef<HTMLDivElement>(null);
	useClickOutside(gearRef, gearOpen, () => setGearOpen(false));

	const isCustom = config.customTabs?.includes(tab) ?? false;
	const dataKey = (tb: string) => `${config.section}:${tb}`;
	const fields = useMemo(() => config.fields[tab] ?? [], [config, tab]);
	const hiddenKeys = hidden[dataKey(tab)] ?? [];
	const columns = fields.filter((f) => !hiddenKeys.includes(f.key));
	const list = data[dataKey(tab)] ?? config.seed[tab] ?? [];
	const statusColors = { ...STATUS_COLORS, ...config.statusColors };

	// текст ячейки на текущем языке: значения списков переводятся, даты как в макете, числа с разделителями
	const display = (f: Field, value: string): string => {
		if (!value) return "";
		if (f.type === "select") return t(`o_${value}`);
		if (f.type === "date") return formatDate(value);
		if (f.type === "number") return Number(value).toLocaleString(tag);
		return value;
	};

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const filtered = q ? list.filter((r) => fields.some((f) => display(f, r.values[f.key] ?? "").toLowerCase().includes(q))) : list;
		if (!sort) return filtered;
		const f = fields.find((x) => x.key === sort.key);
		if (!f) return filtered;
		return [...filtered].sort((a, b) => {
			const av = a.values[f.key] ?? "", bv = b.values[f.key] ?? "";
			// пустые значения всегда внизу, при любом направлении
			if (!av || !bv) return !av && !bv ? 0 : !av ? 1 : -1;
			if (f.type === "number") return sort.dir * (Number(av) - Number(bv));
			// даты хранятся как ГГГГ-ММ-ДД — сравниваем их, а не текст «ДД.ММ.ГГГГ», который сортируется неверно
			if (f.type === "date") return sort.dir * av.localeCompare(bv);
			return sort.dir * display(f, av).localeCompare(display(f, bv), tag, { numeric: true });
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [list, query, sort, fields, locale]);

	function changeTab(next: string) {
		setTab(next);
		setQuery("");
		setSort(null);
		setSelected([]);
		setGearOpen(false);
	}

	// список вкладок шире экрана: активная вкладка выезжает в видимую область, справа стрелка «дальше»
	useEffect(() => {
		barRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
	}, [tab]);
	useEffect(() => {
		const bar = barRef.current;
		if (!bar) return;
		const update = () => setCanScrollRight(bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4);
		update();
		bar.addEventListener("scroll", update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(bar);
		return () => { bar.removeEventListener("scroll", update); ro.disconnect(); };
	}, []);

	// показать/скрыть колонку; если скрыли ту, по которой включена сортировка, сортировка сбрасывается
	function toggleColumn(key: string) {
		const hide = !hiddenKeys.includes(key);
		setHidden(dataKey(tab), hide ? [...hiddenKeys, key] : hiddenKeys.filter((k) => k !== key));
		if (hide && sort?.key === key) setSort(null);
	}

	const openModal = (tb: string, record: RecordItem | null, preset?: Record<string, string>) => setModal({ open: true, tab: tb, record, preset });
	const closeModal = () => setModal((m) => ({ ...m, open: false }));

	function save(values: Record<string, string>, id?: string) {
		saveRecord(dataKey(modal.tab), config.seed[modal.tab] ?? [], { id, values });
		toast.success(tr("saved"));
		closeModal();
		if (modal.tab !== tab) changeTab(modal.tab); // запись создана из другой вкладки (например, из Start) — показываем её
	}
	function confirmDelete() {
		if (!toDelete) return;
		const { tab: tb, ids } = toDelete;
		setToDelete(null);
		closeModal();
		deleteRecords(dataKey(tb), config.seed[tb] ?? [], ids);
		setSelected((s) => s.filter((id) => !ids.includes(id)));
		toast.success(tr("deleted"));
	}

	const allChecked = rows.length > 0 && rows.every((r) => selected.includes(r.id));
	const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
	const th = "border-l border-[#F0F0F0] px-10 py-16 text-center text-16 font-medium text-[#999999] md:text-18";
	const name = isCustom ? "" : t(`s_${tab}`);

	return (
		<div className="p-16 pt-0 md:p-30">
			<div className="mb-20 flex flex-col gap-16 md:mb-30 md:flex-row md:items-center md:justify-between md:gap-30">
				<div className="relative min-w-0 md:flex-1 lg:flex-none">
					<div ref={barRef} role="tablist" className={`${TAB_BAR} gap-6 overflow-x-auto ${HIDE_SCROLLBAR}`}>
						{config.tabs.map((key) => (
							<button
								key={key}
								type="button"
								role="tab"
								aria-selected={tab === key}
								onClick={() => changeTab(key)}
								className={`shrink-0 whitespace-nowrap rounded-4 px-16 py-10 text-16 font-medium tracking-[0.32px] transition-colors duration-200 ${
									tab === key ? "bg-primaryColor text-white" : "text-[#CCCCCC] hover:text-[#999999]"
								}`}>
								{t(`tab_${key}`)}
							</button>
						))}
					</div>
					{canScrollRight && (
						<button
							type="button"
							aria-label={tr("scrollTabs")}
							onClick={() => barRef.current?.scrollBy({ left: 160, behavior: "smooth" })}
							className="absolute right-10 top-1/2 hidden h-[36px] w-[36px] -translate-y-1/2 items-center justify-center rounded-50 bg-[#F2F2F2] text-[#999999] transition-colors hover:text-primaryColor md:flex">
							<MdChevronRight size={26} />
						</button>
					)}
				</div>
				<SearchBox value={query} onChange={setQuery} placeholder={tr("search")} className="w-full md:w-[220px] lg:w-[300px]" />
			</div>

			{isCustom ? (
				renderCustom?.(tab, { query, create: (tb, preset) => openModal(tb, null, preset), edit: (tb, record) => openModal(tb, record) })
			) : (
				<>
					<ListToolbar
						editLabel={tr("edit", { name })}
						addLabel={tr("add", { name })}
						selectedCount={selected.length}
						onEdit={() => openModal(tab, list.find((r) => r.id === selected[0]) ?? null)}
						onAdd={() => openModal(tab, null)}
						onDelete={() => setToDelete({ tab, ids: selected })}
					/>

					<div className="min-h-[360px] overflow-x-auto rounded-16 bg-white shadow-heroImage md:min-h-[420px] lg:min-h-[500px]">
						<table className="w-full min-w-[820px] table-fixed border-collapse">
							<thead>
								<tr className="bg-[#FAFCFF]">
									<th className="w-[46px] py-16 pl-16 text-left">
										<Checkbox checked={allChecked} onChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])} label={tc("selectAll")} />
									</th>
									<th className="w-[60px] py-16 text-center">
										<div ref={gearRef} className="relative inline-block">
											<button type="button" onClick={() => setGearOpen(!gearOpen)} aria-expanded={gearOpen} aria-label={tr("columns")} className="text-[#999999] transition-colors hover:text-primaryColor">
												<MdSettings size={24} className={`transition-transform duration-300 ${gearOpen ? "rotate-90" : ""}`} />
											</button>
											<Dropdown open={gearOpen} className="left-0 top-full mt-8 min-w-[220px]">
												<div className="rounded-8 border border-[#E2F1F5] bg-white p-12 text-left shadow-custom">
													<p className="mb-8 text-14 text-[#B3B3B3]">{tr("columns")}</p>
													{fields.map((f) => (
														// строка кликабельна целиком; флажок сам обрабатывает нажатие, поэтому его обёртка гасит всплытие
														<div
															key={f.key}
															onClick={() => f.key !== "name" && toggleColumn(f.key)}
															className={`flex items-center gap-10 py-6 text-16 text-[#666666] ${f.key === "name" ? "opacity-60" : "cursor-pointer"}`}>
															<span onClick={(e) => e.stopPropagation()}>
																<Checkbox
																	checked={f.key === "name" || !hiddenKeys.includes(f.key)}
																	onChange={() => f.key !== "name" && toggleColumn(f.key)}
																	label={t(`f_${f.key}`)}
																/>
															</span>
															{t(`f_${f.key}`)}
														</div>
													))}
												</div>
											</Dropdown>
										</div>
									</th>
									{columns.map((f) => {
										const active = sort?.key === f.key;
										return (
											<th key={f.key} aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"} className={th}>
												<button
													type="button"
													onClick={() => setSort(active && sort!.dir === -1 ? null : { key: f.key, dir: active ? -1 : 1 })}
													className={`inline-flex max-w-full items-center gap-6 transition-colors hover:text-primaryColor ${active ? "text-primaryColor" : ""}`}>
													<span className="truncate">{t(`f_${f.key}`)}</span>
													{active && (sort!.dir === 1 ? <MdArrowUpward size={16} /> : <MdArrowDownward size={16} />)}
												</button>
											</th>
										);
									})}
								</tr>
							</thead>
							<tbody>
								{rows.map((r) => {
									const checked = selected.includes(r.id);
									return (
										<tr
											key={r.id}
											onClick={() => openModal(tab, r)}
											className={`h-[60px] animate-fade-in cursor-pointer border-b border-[#F0F0F0] transition-colors duration-150 hover:bg-[#F7F9FF] ${checked ? "bg-[#F5F9FF]" : ""}`}>
											<td className="pl-16" onClick={(e) => e.stopPropagation()}>
												<Checkbox checked={checked} onChange={() => toggle(r.id)} label={tc("selectRow")} />
											</td>
											<td className="text-center">
												<button type="button" aria-label={tr("editRow")} onClick={(e) => { e.stopPropagation(); openModal(tab, r); }} className="text-[#B3B3B3] transition-colors hover:text-primaryColor">
													<MdEdit size={20} />
												</button>
											</td>
											{columns.map((f) => {
												const value = r.values[f.key] ?? "";
												return (
													<td key={f.key} className="truncate px-10 text-center text-16 text-[#999999] md:text-18">
														{f.key === "status" && value ? (
															<span className="inline-flex items-center gap-8">
																<span className="h-8 w-8 rounded-50" style={{ background: statusColors[value] ?? "#999999" }} />
																{display(f, value)}
															</span>
														) : (
															display(f, value)
														)}
													</td>
												);
											})}
										</tr>
									);
								})}
							</tbody>
						</table>
						{rows.length === 0 && <p className="py-40 text-center text-16 text-[#999999]">{query ? tr("nothingFound") : tr("empty")}</p>}
					</div>
				</>
			)}

			<RecordModal
				open={modal.open}
				config={config}
				tab={modal.tab}
				record={modal.record}
				preset={modal.preset}
				fieldOptions={fieldOptions}
				onClose={closeModal}
				onSave={save}
				onDelete={(r) => setToDelete({ tab: modal.tab, ids: [r.id] })}
			/>
			<ConfirmDialog
				open={toDelete !== null}
				title={tr("delete")}
				text={toDelete?.ids.length === 1 ? tr("confirmDeleteOne") : tr("confirmDelete", { count: toDelete?.ids.length ?? 0 })}
				onCancel={() => setToDelete(null)}
				onConfirm={confirmDelete}
			/>
		</div>
	);
}
