"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { useRecordsHydration, useRecordsStore } from "@/store/useRecordsStore";
import { formatDate } from "@/utils/crmFormat";
import { localeTag } from "@/utils/dateHelpers";
import ConfirmDialog from "../ConfirmDialog";
import ListToolbar from "../ListToolbar";
import SearchBox from "../SearchBox";
import PageHeader from "@/components/crm/shared/PageHeader";
import { Field, FieldOption, RecordItem, SectionConfig, STATUS_COLORS } from "./config";
import RecordModal from "./RecordModal";
import RecordsTable, { Sort } from "./recordsParts/RecordsTable";
import TabBar from "./recordsParts/TabBar";

// Стабильные «пустые» значения: новый [] или {} на каждом рендере сбрасывал бы кэш useMemo ниже
const NO_KEYS: string[] = [];
const NO_FILTERS: Record<string, string> = {};
const NO_RECORDS: RecordItem[] = [];

// Что страница отдаёт вкладке с собственным содержимым (customTabs): поисковый запрос и способ открыть окно новой записи
export interface CustomTabApi {
	query: string;
	create: (tab: string, preset?: Record<string, string>) => void;
	edit: (tab: string, record: RecordItem) => void;
}

interface Props {
	config: SectionConfig;
	renderCustom?: (tab: string, api: CustomTabApi) => React.ReactNode;
	// после возврата со страницы входа стороннего сервиса (?param=…) сразу открыть нужную вкладку
	openTabOnParam?: { param: string; tab: string };
	// список для select-полей без options в конфиге (например, этапы сделок из CRM)
	fieldOptions?: (tab: string, key: string) => FieldOption[] | undefined;
}

// Страница раздела со вкладками: поиск, таблица с выбором строк, сортировкой по заголовку и настройкой колонок (шестерёнка),
// окно создания/правки записи. Вкладки из config.customTabs рисует renderCustom (например, Start в Marketing).
export default function RecordsPage({ config, renderCustom, fieldOptions, openTabOnParam }: Props) {
	const t = useTranslations(config.namespace);
	const tr = useTranslations("records");
	const locale = useLocale();
	const tag = localeTag(locale);
	useRecordsHydration(config.tabs.map((tb) => `${config.section}:${tb}`));
	const { data, hidden, saveRecord, deleteRecords, setHidden } = useRecordsStore();

	// ?tab=… открывает конкретную вкладку (те же ссылки, что и в «Финансах»: пришли из уведомления — попали на нужную вкладку)
	const [tab, setTab] = useState(() => {
		const wanted = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("tab") ?? "";
		return config.tabs.includes(wanted) ? wanted : config.tabs[0];
	});
	useEffect(() => {
		if (openTabOnParam && new URLSearchParams(window.location.search).has(openTabOnParam.param)) setTab(openTabOnParam.tab);
	}, [openTabOnParam?.param, openTabOnParam?.tab]); // eslint-disable-line react-hooks/exhaustive-deps -- срабатывает только при смене параметра, а сам объект openTabOnParam приходит новым на каждый рендер
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<Sort>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [modal, setModal] = useState<{ open: boolean; tab: string; record: RecordItem | null; preset?: Record<string, string> }>({ open: false, tab: config.tabs[0], record: null });
	const [toDelete, setToDelete] = useState<{ tab: string; ids: string[] } | null>(null);
	// выбранные значения фильтров — отдельно для каждой вкладки: у вкладок разные наборы колонок
	const [filters, setFilters] = useState<Record<string, Record<string, string>>>({});

	const isCustom = config.customTabs?.includes(tab) ?? false;
	const dataKey = (tb: string) => `${config.section}:${tb}`;
	const fields = useMemo(() => config.fields[tab] ?? [], [config, tab]);
	const hiddenKeys = hidden[dataKey(tab)] ?? NO_KEYS;
	const columns = useMemo(() => fields.filter((f) => !hiddenKeys.includes(f.key)), [fields, hiddenKeys]);
	const list = data[dataKey(tab)] ?? config.seed[tab] ?? NO_RECORDS;
	const statusColors = { ...STATUS_COLORS, ...config.statusColors };
	// Фильтры для поля поиска: по одному на каждую колонку-список текущей вкладки.
	// Берём только видимые колонки — фильтр по скрытой колонке сбивал бы с толку.
	const filterDefs = useMemo(
		() => columns.filter((f) => f.type === "select" && f.options?.length).map((f) => ({
			key: f.key,
			label: t(`f_${f.key}`),
			options: [{ value: "", label: `${tr("filterAll")} — ${t(`f_${f.key}`)}` }, ...(f.options ?? []).map((o) => ({ value: o, label: t(`o_${o}`) }))],
		})),
		[columns, t, tr],
	);
	const activeFilters = filters[tab] ?? NO_FILTERS;
	const setFilter = (key: string, value: string) => setFilters((f) => ({ ...f, [tab]: { ...(f[tab] ?? {}), [key]: value } }));

	// текст ячейки на текущем языке: значения списков переводятся, даты как в макете, числа с разделителями
	const display = useCallback((f: Field, value: string): string => {
		if (!value) return "";
		if (f.type === "select") return t(`o_${value}`);
		if (f.type === "date") return formatDate(value);
		if (f.type === "number") return Number(value).toLocaleString(tag);
		return value;
	}, [t, tag]);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		// сначала фильтры по колонкам, затем поиск по тексту — порядок на результат не влияет,
		// но так список поиска уже сужен и поиск идёт по меньшему числу записей
		const byFilters = Object.entries(activeFilters).filter(([, v]) => v).length
			? list.filter((r) => Object.entries(activeFilters).every(([k, v]) => !v || (r.values[k] ?? "") === v))
			: list;
		const filtered = q ? byFilters.filter((r) => fields.some((f) => display(f, r.values[f.key] ?? "").toLowerCase().includes(q))) : byFilters;
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
	}, [list, query, sort, fields, tag, activeFilters, display]);

	function changeTab(next: string) {
		setTab(next);
		setQuery("");
		setSort(null);
		setSelected([]);
	}

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

	const name = isCustom ? "" : t(`s_${tab}`);

	return (
		<div className="px-16 py-20 md:px-24 md:py-24 lg:px-32">
			<PageHeader right={<span className="fs-chip">{rows.length}</span>}>
				<div className="flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
					<TabBar tabs={config.tabs} active={tab} onChange={changeTab} label={(key) => t(`tab_${key}`)} />
					<SearchBox
						value={query}
						onChange={setQuery}
						placeholder={tr("search")}
						filters={filterDefs}
						active={activeFilters}
						onFilter={setFilter}
						className="w-full shrink-0 md:w-[340px]"
					/>
				</div>
			</PageHeader>

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

					<RecordsTable
						rows={rows}
						fields={fields}
						columns={columns}
						hiddenKeys={hiddenKeys}
						sort={sort}
						onSort={setSort}
						selected={selected}
						onSelect={setSelected}
						onToggleColumn={toggleColumn}
						onOpen={(r) => openModal(tab, r)}
						display={display}
						statusColors={statusColors}
						fieldLabel={(key) => t(`f_${key}`)}
						searching={!!query}
					/>
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
