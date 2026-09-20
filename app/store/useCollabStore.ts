import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Раздел Collaboration (Feed, Chat and Calls, Calendar, Online Documents, Web Mails) пока без сервера:
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

export interface ChatMessage { id: string; from: "them" | "me"; text: string; at: string }
export interface Chat {
	id: string;
	name: string;
	unread: number;
	lastAt: string;
	online: boolean;
	messages: ChatMessage[];
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

export type MailView = "inbox" | "starred" | "snoozed" | "sent" | "draft";
export interface Mail {
	id: string;
	folder: "inbox" | "sent" | "draft";
	from: string;
	to: string;
	subject: string;
	body: string;
	at: string;
	starred: boolean;
	snoozed: boolean;
}
export type MailProvider = "outlook" | "gmail" | "yahoo" | "icloud" | "office365" | "imap";

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

const seedChats = (): Chat[] =>
	Array.from({ length: 10 }, (_, i) => ({
		id: `chat${i + 1}`,
		name: "Rustem",
		unread: i === 0 ? 1 : 2,
		lastAt: iso(2018, 12, 30, 11, 15),
		online: true,
		messages: [
			{ id: `m${i}a`, from: "them" as const, text: "Hello Tarik", at: iso(2018, 12, 30, 11, 12) },
			{ id: `m${i}b`, from: "me" as const, text: "Hello Rustem, How are you doing?", at: iso(2018, 12, 30, 11, 12) },
		],
	}));

const seedMails = (): Mail[] => [
	{ id: "e1", folder: "inbox", from: "Oliver Miller", to: "me", subject: "Quarterly report", body: "Hi! Please find the quarterly report attached.", at: iso(2023, 6, 22, 9, 30), starred: true, snoozed: false },
	{ id: "e2", folder: "inbox", from: "Sven Back", to: "me", subject: "Meeting on Monday", body: "Can we move the meeting to 10:00?", at: iso(2023, 6, 21, 15, 5), starred: false, snoozed: false },
	{ id: "e3", folder: "inbox", from: "Synergia CRM", to: "me", subject: "Welcome to Synergia CRM", body: "Your workspace is ready.", at: iso(2023, 6, 20, 8, 0), starred: false, snoozed: false },
];

interface CollabStore {
	posts: FeedPost[];
	chats: Chat[];
	events: CalEvent[];
	docs: DocFile[];
	mails: Mail[];
	mailProvider: MailProvider | null;

	togglePin: (id: string) => void;
	toggleFollow: (id: string) => void;
	deletePost: (id: string) => void;
	addComment: (postId: string, author: string, text: string) => void;

	readChat: (id: string) => void;
	deleteChat: (id: string) => void;
	sendMessage: (chatId: string, text: string) => void;

	saveEvent: (event: Omit<CalEvent, "id"> & { id?: string }) => void;
	deleteEvent: (id: string) => void;

	addDoc: (name: string, type: DocType, createdBy: string) => void;
	updateDoc: (id: string, patch: Partial<Pick<DocFile, "name" | "shared" | "archived">>) => void;
	deleteDoc: (id: string) => void;

	setMailProvider: (provider: MailProvider | null) => void;
	addMail: (mail: Omit<Mail, "id" | "at" | "starred" | "snoozed">) => void;
	patchMails: (ids: string[], patch: Partial<Pick<Mail, "starred" | "snoozed">>) => void;
	deleteMails: (ids: string[]) => void;
}

export const useCollabStore = create<CollabStore>()(
	persist(
		(set) => ({
			posts: seedPosts(),
			chats: seedChats(),
			events: [],
			docs: [],
			mails: seedMails(),
			mailProvider: null,

			togglePin: (id) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)) })),
			toggleFollow: (id) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, following: !p.following } : p)) })),
			deletePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),
			addComment: (postId, author, text) =>
				set((s) => ({
					posts: s.posts.map((p) =>
						p.id === postId ? { ...p, comments: [...p.comments, { id: uid(), author, at: new Date().toISOString(), text }] } : p
					),
				})),

			readChat: (id) => set((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) })),
			deleteChat: (id) => set((s) => ({ chats: s.chats.filter((c) => c.id !== id) })),
			sendMessage: (chatId, text) =>
				set((s) => ({
					chats: s.chats.map((c) => {
						if (c.id !== chatId) return c;
						const at = new Date().toISOString();
						return { ...c, lastAt: at, messages: [...c.messages, { id: uid(), from: "me" as const, text, at }] };
					}),
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

			setMailProvider: (mailProvider) => set({ mailProvider }),
			addMail: (mail) =>
				set((s) => ({ mails: [{ ...mail, id: uid(), at: new Date().toISOString(), starred: false, snoozed: false }, ...s.mails] })),
			patchMails: (ids, patch) => set((s) => ({ mails: s.mails.map((m) => (ids.includes(m.id) ? { ...m, ...patch } : m)) })),
			deleteMails: (ids) => set((s) => ({ mails: s.mails.filter((m) => !ids.includes(m.id)) })),
		}),
		{
			name: "crm-collab",
			version: 1,
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
