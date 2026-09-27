import { create } from "zustand";
import { apiCall } from "./crmApi";

export type FeedKind = "post" | "task" | "news";
export type FeedAudience = "all" | "people";

export interface FeedComment { id: string; author: string; authorId: string; authorAvatar: string; at: string; text: string }
export interface FeedReaction { emoji: string; count: number; mine: boolean }
export interface FeedPost {
	id: string;
	author: string;
	authorId: string;
	authorAvatar: string;
	at: string;
	kind: FeedKind;
	text: string;
	taskTitle: string;
	responsible: string;
	dueAt: string; // "YYYY-MM-DDTHH:mm" или ""
	audience: FeedAudience;
	audienceIds: string[];
	audienceNames: string[]; // кому адресовано лично/группе — показываем в карточке
	reactions: FeedReaction[];
	pinned: boolean;
	following: boolean;
	comments: FeedComment[];
}

// Чем дополнить публикацию: срок, адресаты, новость вместо обычного поста
export interface PublishOptions {
	kind?: "post" | "news";
	dueAt?: string;
	audienceIds?: string[]; // пусто — запись для всей фирмы
}

interface FeedStore {
	posts: FeedPost[];
	loaded: boolean;
	load: () => Promise<void>;
	publish: (text: string, opts?: PublishOptions) => Promise<string | null>; // текст ошибки или null
	togglePin: (id: string) => Promise<void>;
	toggleFollow: (id: string) => Promise<void>;
	react: (id: string, emoji: string) => Promise<void>;
	setKind: (id: string, kind: "post" | "news") => Promise<void>;
	toTask: (id: string) => Promise<string | null>; // «в задачи»: создаёт задачу по записи
	remove: (id: string) => Promise<void>;
	comment: (id: string, text: string) => Promise<void>;
}

// Лента фирмы: хранится на сервере, коллеги видят записи друг друга (обновляется опросом, см. Feed.tsx)
export const useFeedStore = create<FeedStore>()((set, get) => {
	const replace = (post: FeedPost) => set((s) => ({ posts: s.posts.map((p) => (p.id === post.id ? post : p)) }));
	// свой смайлик переключается сразу, до ответа сервера; при ошибке вернём прежнее состояние
	const toggleReaction = (list: FeedReaction[], emoji: string): FeedReaction[] => {
		const found = list.find((r) => r.emoji === emoji);
		if (!found) return [...list, { emoji, count: 1, mine: true }];
		const next = list.map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r));
		return next.filter((r) => r.count > 0);
	};
	return {
		posts: [],
		loaded: false,
		load: async () => {
			const res = await apiCall<FeedPost[]>("/api/feed");
			if (res.ok && res.data) set({ posts: res.data, loaded: true });
		},
		publish: async (text, opts) => {
			const res = await apiCall<FeedPost>("/api/feed", "POST", {
				text,
				kind: opts?.kind ?? "post",
				dueAt: opts?.dueAt ?? "",
				audience: opts?.audienceIds?.length ? "people" : "all",
				audienceIds: opts?.audienceIds ?? [],
			});
			if (!res.ok || !res.data) return res.message;
			set((s) => ({ posts: [res.data as FeedPost, ...s.posts] }));
			return null;
		},
		togglePin: async (id) => {
			const p = get().posts.find((x) => x.id === id);
			if (!p) return;
			replace({ ...p, pinned: !p.pinned });
			const res = await apiCall<FeedPost>(`/api/feed/${id}`, "PATCH", { pinned: !p.pinned });
			if (res.ok && res.data) replace(res.data); else replace(p);
		},
		toggleFollow: async (id) => {
			const p = get().posts.find((x) => x.id === id);
			if (!p) return;
			replace({ ...p, following: !p.following });
			const res = await apiCall<FeedPost>(`/api/feed/${id}`, "PATCH", { follow: !p.following });
			if (res.ok && res.data) replace(res.data); else replace(p);
		},
		react: async (id, emoji) => {
			const p = get().posts.find((x) => x.id === id);
			if (!p) return;
			replace({ ...p, reactions: toggleReaction(p.reactions, emoji) });
			const res = await apiCall<FeedPost>(`/api/feed/${id}`, "PATCH", { emoji });
			if (res.ok && res.data) replace(res.data); else replace(p);
		},
		setKind: async (id, kind) => {
			const p = get().posts.find((x) => x.id === id);
			if (!p) return;
			replace({ ...p, kind });
			const res = await apiCall<FeedPost>(`/api/feed/${id}`, "PATCH", { kind });
			if (res.ok && res.data) replace(res.data); else replace(p);
		},
		// «В задачи»: из записи получается настоящая задача (POST /api/tasks), а в ленте появляется её карточка
		toTask: async (id) => {
			const p = get().posts.find((x) => x.id === id);
			if (!p) return null;
			const source = (p.text || p.taskTitle).trim();
			if (!source) return "";
			const res = await apiCall("/api/tasks", "POST", {
				title: source.split("\n")[0].slice(0, 200),
				description: p.text,
				deadline: p.dueAt,
			});
			if (!res.ok) return res.message;
			await get().load(); // карточка задачи создаётся на сервере — забираем ленту заново
			return null;
		},
		remove: async (id) => {
			const before = get().posts;
			set({ posts: before.filter((p) => p.id !== id) });
			const res = await apiCall(`/api/feed/${id}`, "DELETE");
			if (!res.ok) set({ posts: before });
		},
		comment: async (id, text) => {
			const res = await apiCall<FeedPost>(`/api/feed/${id}/comments`, "POST", { text });
			if (res.ok && res.data) replace(res.data);
		},
	};
});
