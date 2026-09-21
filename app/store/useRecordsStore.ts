import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecordItem } from "@/components/crm/components/Main/shared/records/config";
import { apiCall } from "./crmApi";

// Таблицы разделов (Automation, Marketing, Inventory…) хранятся на сервере и общие для сотрудников фирмы (/api/records).
// Ключ данных — "раздел:вкладка". Пока вкладку никто не менял, на сервере записей нет, и показываются тестовые данные из config
// раздела; первая правка сначала сохраняет их на сервере, а потом применяет изменение. Скрытые колонки таблицы — настройка
// отображения, она остаётся в браузере (localStorage).

const uid = () => Math.random().toString(36).slice(2, 10);

interface RecordsStore {
	data: Record<string, RecordItem[]>;
	hidden: Record<string, string[]>; // скрытые колонки (шестерёнка в шапке таблицы)
	load: (key: string) => Promise<void>;
	saveRecord: (key: string, seed: RecordItem[], record: { id?: string; values: Record<string, string> }) => Promise<void>;
	deleteRecords: (key: string, seed: RecordItem[], ids: string[]) => Promise<void>;
	setHidden: (key: string, columns: string[]) => void;
}

export const useRecordsStore = create<RecordsStore>()(
	persist(
		(set, get) => ({
			data: {},
			hidden: {},

			load: async (key) => {
				const res = await apiCall<{ initialized: boolean; records: RecordItem[] }>(`/api/records?key=${encodeURIComponent(key)}`);
				if (!res.ok || !res.data) return;
				// не менявшуюся вкладку не трогаем — остаются тестовые данные раздела
				if (res.data.initialized) set((s) => ({ data: { ...s.data, [key]: res.data!.records } }));
			},

			saveRecord: async (key, seed, record) => {
				const list = get().data[key] ?? seed;
				const isNew = !record.id;
				const id = record.id ?? uid();
				const next = isNew ? [{ id, values: record.values }, ...list] : list.map((r) => (r.id === id ? { id, values: record.values } : r));
				set((s) => ({ data: { ...s.data, [key]: next } }));
				// первая правка вкладки: тестовые данные становятся настоящими записями, затем сохраняется изменение
				const toSave = get().data[key] && list !== seed ? [{ id, values: record.values }] : next;
				await apiCall("/api/records", "POST", { key, records: toSave });
			},

			deleteRecords: async (key, seed, ids) => {
				const list = get().data[key] ?? seed;
				const fromSeed = !get().data[key];
				set((s) => ({ data: { ...s.data, [key]: list.filter((r) => !ids.includes(r.id)) } }));
				if (fromSeed) await apiCall("/api/records", "POST", { key, records: list.filter((r) => !ids.includes(r.id)) });
				else await apiCall("/api/records", "DELETE", { key, ids });
			},

			setHidden: (key, columns) => set((s) => ({ hidden: { ...s.hidden, [key]: columns } })),
		}),
		{
			name: "crm-records",
			version: 2,
			skipHydration: true,
			// в браузере остаются только настройки колонок; сами записи — на сервере
			partialize: (s) => ({ hidden: s.hidden }) as unknown as RecordsStore,
			migrate: () => ({ hidden: {} }) as unknown as RecordsStore,
		}
	)
);

// Вызывается на странице раздела: читает настройки колонок из localStorage уже в браузере
// (так HTML сервера и первая отрисовка клиента совпадают) и подгружает с сервера вкладки раздела.
export function useRecordsHydration(keys: string[] = []) {
	useEffect(() => {
		useRecordsStore.persist.rehydrate();
		keys.forEach((k) => useRecordsStore.getState().load(k));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [keys.join("|")]);
}
