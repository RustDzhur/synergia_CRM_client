import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Разделы Collaboration Feed, Calendar и Online Documents пока без сервера (Chat and Calls и Web Mails работают через API):
// тестовые данные лежат здесь и сохраняются в localStorage браузера (ключ "crm-collab").
// Когда появятся API, заменяются только действия этого хранилища — компоненты остаются теми же.

export interface FeedComment { id: string; author: string; at: string; text: string }
export interface FeedPost {
	id: string;
	author: string;
	at: string; // ISO
	taskTitle: string;
	responsible: string;
	pinned: boolean;
	following: boolean;
	withImage: boolean;
	comments: FeedComment[];
}

export type CalendarKind = "my" | "company";
export interface CalEvent {
	id: string;
	title: string;
	color: string;
	calendar: CalendarKind;
	date: string; // "YYYY-MM-DD"
	startTime: string; // "HH:mm"
	endDate: string;
	endTime: string;
	attendees: string;
	location: string;
	reminder: string; // "15" — за сколько минут; "" — без напоминания
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

const uid = () => Math.random().toString(36).slice(2, 10);
// Локальное время без пояса ("2023-06-23T18:10:00"): сервер и браузер покажут одно и то же время
const p2 = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number, h = 0, min = 0) => `${y}-${p2(m)}-${p2(d)}T${p2(h)}:${p2(min)}:00`;

const seedPosts = (): FeedPost[] => [
	{
		id: "p1", author: "Tarik Abaza", at: iso(2023, 6, 23, 18, 10), taskTitle: "Send Benefit Review From Sunday",
		responsible: "Tarik Abaza", pinned: false, following: false, withImage: true, comments: [],
	},
	{
		id: "p2", author: "Tarik Abaza", at: iso(2023, 6, 23, 18, 10), taskTitle: "Send Benefit Review From Sunday",
		responsible: "Tarik Abaza", pinned: false, following: false, withImage: false,
		comments: [{ id: "c1", author: "Tarik Abaza", at: iso(2023, 6, 23, 18, 10), text: "Task Is Almost Overdue. Consider Closing The Task Or Changing The Deadline." }],
	},
];

interface CollabStore {
	posts: FeedPost[];
	events: CalEvent[];
	docs: DocFile[];

	togglePin: (id: string) => void;
	toggleFollow: (id: string) => void;
	deletePost: (id: string) => void;
	addComment: (postId: string, author: string, text: string) => void;

	saveEvent: (event: Omit<CalEvent, "id"> & { id?: string }) => void;
	deleteEvent: (id: string) => void;

	addDoc: (name: string, type: DocType, createdBy: string) => void;
	updateDoc: (id: string, patch: Partial<Pick<DocFile, "name" | "shared" | "archived">>) => void;
	deleteDoc: (id: string) => void;

}

export const useCollabStore = create<CollabStore>()(
	persist(
		(set) => ({
			posts: seedPosts(),
			events: [],
			docs: [],

			togglePin: (id) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)) })),
			toggleFollow: (id) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, following: !p.following } : p)) })),
			deletePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),
			addComment: (postId, author, text) =>
				set((s) => ({
					posts: s.posts.map((p) =>
						p.id === postId ? { ...p, comments: [...p.comments, { id: uid(), author, at: new Date().toISOString(), text }] } : p
					),
				})),

			saveEvent: (event) =>
				set((s) => {
					const id = event.id ?? uid();
					const next = { ...event, id } as CalEvent;
					return { events: s.events.some((e) => e.id === id) ? s.events.map((e) => (e.id === id ? next : e)) : [...s.events, next] };
				}),
			deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

			addDoc: (name, type, createdBy) =>
				set((s) => ({ docs: [{ id: uid(), name, type, createdBy, createdAt: new Date().toISOString(), shared: false, archived: false }, ...s.docs] })),
			updateDoc: (id, patch) => set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
			deleteDoc: (id) => set((s) => ({ docs: s.docs.filter((d) => d.id !== id) })),
		}),
		{
			name: "crm-collab",
			version: 2,
			// v2: беседы Chat and Calls и почта Web Mails теперь приходят с сервера — старые тестовые данные из localStorage выбрасываем
			migrate: (state) => {
				const rest = { ...(state as Record<string, unknown>) };
				delete rest.chats;
				delete rest.mails;
				delete rest.mailProvider;
				return rest as never;
			},
			// Читаем localStorage уже в браузере (см. useCollabHydration): на сервере и при первой отрисовке
			// всегда тестовые данные по умолчанию — иначе HTML сервера и клиента разойдутся.
			skipHydration: true,
		}
	)
);

// Вызывается один раз на странице раздела: подтягивает сохранённые данные из localStorage.
export function useCollabHydration() {
	useEffect(() => {
		useCollabStore.persist.rehydrate();
	}, []);
}
