import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RecordItem } from "@/components/crm/components/Main/shared/records/config";

// Данные разделов на вкладках-таблицах (Inventory, Marketing ...) пока без сервера: хранятся в localStorage ("crm-records").
// Ключ данных — "раздел:вкладка". Пока пользователь вкладку не менял, в хранилище её нет, и показываются тестовые данные
// из config раздела; первая правка копирует тестовые данные сюда и дальше работает уже с ними.
// Когда появится API, заменяются только действия этого хранилища — страницы остаются теми же.

const uid = () => Math.random().toString(36).slice(2, 10);

interface RecordsStore {
	data: Record<string, RecordItem[]>;
	hidden: Record<string, string[]>; // скрытые колонки (шестерёнка в шапке таблицы)
	saveRecord: (key: string, seed: RecordItem[], record: { id?: string; values: Record<string, string> }) => void;
	deleteRecords: (key: string, seed: RecordItem[], ids: string[]) => void;
	setHidden: (key: string, columns: string[]) => void;
}

export const useRecordsStore = create<RecordsStore>()(
	persist(
		(set) => ({
			data: {},
			hidden: {},
			saveRecord: (key, seed, record) =>
				set((s) => {
					const list = s.data[key] ?? seed;
					const next = record.id
						? list.map((r) => (r.id === record.id ? { id: r.id, values: record.values } : r))
						: [{ id: uid(), values: record.values }, ...list];
					return { data: { ...s.data, [key]: next } };
				}),
			deleteRecords: (key, seed, ids) => set((s) => ({ data: { ...s.data, [key]: (s.data[key] ?? seed).filter((r) => !ids.includes(r.id)) } })),
			setHidden: (key, columns) => set((s) => ({ hidden: { ...s.hidden, [key]: columns } })),
		}),
		{ name: "crm-records", version: 1, skipHydration: true }
	)
);

// Вызывается один раз на странице раздела: читает localStorage уже в браузере
// (так HTML сервера и первая отрисовка клиента совпадают — обе с тестовыми данными по умолчанию).
export function useRecordsHydration() {
	useEffect(() => {
		useRecordsStore.persist.rehydrate();
	}, []);
}
