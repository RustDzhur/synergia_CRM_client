import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "./crmApi";
import { loadLegacyEvents, migrateLegacyEvents } from "./collabLegacy";

// Хранилище раздела Collaboration. События календаря живут на сервере (/api/events): их видят все участники
// фирмы, и по ним работают напоминания (lib/calendar/reminders.ts). Онлайн-документы пока без сервера —
// их тестовые данные лежат в localStorage браузера (ключ "crm-collab").

export type CalendarKind = "my" | "company";
export interface CalEvent {
	id: string;
	title: string;
	description: string; // подробное описание события (показывается в форме под названием)
	color: string;
	calendar: CalendarKind;
	date: string; // "YYYY-MM-DD"
	startTime: string; // "HH:mm"
	endDate: string;
	endTime: string;
	attendees: string;
	location: string;
	reminder: number; // за сколько минут напомнить; 0 — без напоминания
	/** событие сохранено в CRM, но не перенесено в Google: текст причины для окна события */
	syncError?: string;
}

export type DocType = "docx" | "xlsx" | "pptx";
export interface DocFile {
	id: string;
	name: string;
	type: DocType;
	createdBy: string;
	createdAt: string;
	shared: boolean;
	archived: boolean;
}

// Черновик события: с id — правка существующего, без id — новое.
// syncError — ответ сервера, а не поле события, поэтому в черновик не попадает.
export type EventDraft = Omit<CalEvent, "id" | "syncError"> & { id?: string };

// Как событие приходит с сервера (документ Mongo)
interface ServerEvent extends Partial<Omit<CalEvent, "id">> {
	_id: string;
	title: string;
	reminder?: number;
	syncError?: string; // заполняет сервер, когда событие не уехало в Google
}

const toEvent = (doc: ServerEvent): CalEvent => ({
	id: String(doc._id),
	title: doc.title ?? "",
	description: doc.description ?? "",
	color: doc.color ?? "",
	calendar: doc.calendar === "company" ? "company" : "my",
	date: doc.date ?? "",
	startTime: doc.startTime ?? "",
	endDate: doc.endDate ?? "",
	endTime: doc.endTime ?? "",
	attendees: doc.attendees ?? "",
	location: doc.location ?? "",
	reminder: Number(doc.reminder) || 0,
	...(doc.syncError ? { syncError: doc.syncError } : {}),
});

const uid = () => Math.random().toString(36).slice(2, 10);

interface CollabStore {
	events: CalEvent[];
	eventsLoading: boolean;
	docs: DocFile[];

	fetchEvents: () => Promise<void>;
	/** null — сервер не принял событие (сеть или ошибка) */
	saveEvent: (event: EventDraft) => Promise<CalEvent | null>;
	/** null — сервер не удалил; иначе предупреждение: пустая строка — удалено без замечаний */
	deleteEvent: (id: string) => Promise<{ syncError: string } | null>;

	addDoc: (name: string, type: DocType, createdBy: string) => void;
	updateDoc: (id: string, patch: Partial<Pick<DocFile, "name" | "shared" | "archived">>) => void;
	deleteDoc: (id: string) => void;
}

export const useCollabStore = create<CollabStore>()(
	persist(
		(set, get) => ({
			events: [],
			eventsLoading: false,
			docs: [],

			fetchEvents: async () => {
				set({ eventsLoading: true });
				const list = await api<ServerEvent[]>("/api/events");
				set({ events: list ? list.map(toEvent) : get().events, eventsLoading: false });
			},

			saveEvent: async (event) => {
				const { id, ...rest } = event;
				const fields = { ...rest } as Record<string, unknown>;
				// syncError — ответ сервера о переносе во внешний календарь, а не поле события:
				// обратно его отправлять незачем (в окне события черновик приходит целиком)
				delete fields.syncError;
				const saved = id ? await api<ServerEvent>(`/api/events/${id}`, "PATCH", fields) : await api<ServerEvent>("/api/events", "POST", fields);
				if (!saved) return null;
				const next = toEvent(saved);
				const exists = get().events.some((e) => e.id === next.id);
				set({ events: exists ? get().events.map((e) => (e.id === next.id ? next : e)) : [...get().events, next] });
				return next;
			},

			deleteEvent: async (id) => {
				const res = await api<{ ok: boolean; syncError?: string }>(`/api/events/${id}`, "DELETE");
				if (!res?.ok) return null;
				set({ events: get().events.filter((e) => e.id !== id) });
				return { syncError: res.syncError ?? "" };
			},

			addDoc: (name, type, createdBy) =>
				set((s) => ({ docs: [{ id: uid(), name, type, createdBy, createdAt: new Date().toISOString(), shared: false, archived: false }, ...s.docs] })),
			updateDoc: (id, patch) => set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
			deleteDoc: (id) => set((s) => ({ docs: s.docs.filter((d) => d.id !== id) })),
		}),
		{
			name: "crm-collab",
			version: 4,
			// v2: беседы Chat and Calls и почта Web Mails пришли с сервера; v3: так же и лента Feed;
			// v4: события календаря переехали на сервер — в localStorage остаются только документы.
			migrate: (state) => {
				const rest = { ...(state as Record<string, unknown>) };
				delete rest.chats;
				delete rest.mails;
				delete rest.mailProvider;
				delete rest.posts;
				delete rest.events;
				return { docs: (Array.isArray(rest.docs) ? rest.docs : []) as DocFile[] } as never;
			},
			// Сохраняем только документы: события приходят с сервера
			partialize: (s) => ({ docs: s.docs }),
			// Читаем localStorage уже в браузере (см. useCollabHydration): на сервере и при первой отрисовке
			// всегда пустое состояние — иначе HTML сервера и клиента разойдутся.
			skipHydration: true,
		}
	)
);

// Вызывается один раз на странице, которой нужны события (календарь, дашборд): подтягивает документы
// из localStorage, переносит старые события на сервер (app/store/collabLegacy.ts) и загружает список событий.
// enabled = false — раздел закрыт тарифом фирмы: не тратим запрос впустую (сервер всё равно ответит 403).
export function useCollabHydration(enabled = true) {
	useEffect(() => {
		if (!enabled) return;
		// читаем старые события ДО rehydrate: он перезаписывает сохранённое состояние уже без них
		loadLegacyEvents();
		useCollabStore.persist.rehydrate();
		void migrateLegacyEvents().finally(() => { void useCollabStore.getState().fetchEvents(); });
	}, [enabled]);
}
