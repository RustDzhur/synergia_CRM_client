import { useRecordsStore } from "@/app/store/useRecordsStore";
import type { RecordItem, SectionConfig } from "./config";

const EMPTY: RecordItem[] = [];

// Записи одной вкладки раздела для вкладок с собственным содержимым (customTabs): те же данные и то же хранилище,
// что у таблиц RecordsPage, поэтому окно правки и таблицы видят одни и те же записи.
export function useSectionRecords(config: SectionConfig, tab: string) {
	const key = `${config.section}:${tab}`;
	const seed = config.seed[tab] ?? EMPTY;
	const records = useRecordsStore((s) => s.data[key]) ?? seed;
	const saveRecord = useRecordsStore((s) => s.saveRecord);
	const deleteRecords = useRecordsStore((s) => s.deleteRecords);
	return {
		records,
		save: (record: { id?: string; values: Record<string, string> }) => saveRecord(key, seed, record),
		remove: (ids: string[]) => deleteRecords(key, seed, ids),
	};
}
