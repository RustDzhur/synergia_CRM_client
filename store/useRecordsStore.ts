import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecordItem } from "@/components/crm/shared/records/config";
import { apiCall } from "./crmApi";

// Таблицы разделов (Automation, Marketing, Inventory…) хранятся на сервере и общие для сотрудников фирмы (/api/records).
// Ключ данных — "раздел:вкладка". Пока вкладку никто не менял, на сервере записей нет, и показываются тестовые данные из config
// раздела; первая правка сначала сохраняет их на сервере, а потом применяет изменение. Скрытые колонки таблицы — настройка
// отображения, она остаётся в браузере (localStorage).

const uid = () => Math.random().toString(36).slice(2, 10);

// Результат сохранения: сервер может отказать (например, тариф не разрешает ещё одно правило автоматизации),
// и тогда правку нужно откатить и показать причину — иначе запись остаётся в таблице, хотя её никто не сохранил.
export interface SaveResult { ok: boolean; message: string; code: string; status: number }

// Сервер отказал — возвращаем таблицу к состоянию до правки (запись не сохранена, значит её и не должно быть видно)
function finish(key: string, previous: RecordItem[] | undefined, res: { ok: boolean; message: string; code: string; status: number }): SaveResult {
	if (!res.ok) useRecordsStore.setState((s) => {
		const data = { ...s.data };
		if (previous) data[key] = previous;
		else delete data[key];
		return { data };
	});
	return res;
}

interface RecordsStore {
	data: Record<string, RecordItem[]>;
	hidden: Record<string, string[]>; // скрытые колонки (шестерёнка в шапке таблицы)
	load: (key: string) => Promise<void>;
	saveRecord: (key: string, seed: RecordItem[], record: { id?: string; values: Record<string, string> }) => Promise<SaveResult>;
	deleteRecords: (key: string, seed: RecordItem[], ids: string[]) => Promise<SaveResult>;
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
				const previous = get().data[key];
				const list = previous ?? seed;
				const isNew = !record.id;
				const id = record.id ?? uid();
				const next = isNew ? [{ id, values: record.values }, ...list] : list.map((r) => (r.id === id ? { id, values: record.values } : r));
				set((s) => ({ data: { ...s.data, [key]: next } }));
				// первая правка вкладки: тестовые данные становятся настоящими записями, затем сохраняется изменение
				const toSave = previous && list !== seed ? [{ id, values: record.values }] : next;
				return finish(key, previous, await apiCall("/api/records", "POST", { key, records: toSave }));
			},

			deleteRecords: async (key, seed, ids) => {
				const previous = get().data[key];
				const list = previous ?? seed;
				const fromSeed = !previous;
				set((s) => ({ data: { ...s.data, [key]: list.filter((r) => !ids.includes(r.id)) } }));
				const res = fromSeed
					? await apiCall("/api/records", "POST", { key, records: list.filter((r) => !ids.includes(r.id)) })
					: await apiCall("/api/records", "DELETE", { key, ids });
				return finish(key, previous, res);
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
