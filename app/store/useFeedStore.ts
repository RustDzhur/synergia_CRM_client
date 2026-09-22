import { create } from "zustand";
import { apiCall } from "./crmApi";

export interface FeedComment { id: string; author: string; authorId: string; at: string; text: string }
export interface FeedPost {
	id: string;
	author: string;
	authorId: string;
	at: string;
	kind: "post" | "task";
	text: string;
	taskTitle: string;
	responsible: string;
	pinned: boolean;
	following: boolean;
	comments: FeedComment[];
}

interface FeedStore {
	posts: FeedPost[];
	loaded: boolean;
	load: () => Promise<void>;
	publish: (text: string) => Promise<string | null>; // текст ошибки или null
	togglePin: (id: string) => Promise<void>;
	toggleFollow: (id: string) => Promise<void>;
	remove: (id: string) => Promise<void>;
	comment: (id: string, text: string) => Promise<void>;
}

// Лента фирмы: хранится на сервере, коллеги видят записи друг друга (обновляется опросом, см. Feed.tsx)
export const useFeedStore = create<FeedStore>()((set, get) => {
	const replace = (post: FeedPost) => set((s) => ({ posts: s.posts.map((p) => (p.id === post.id ? post : p)) }));
	return {
		posts: [],
		loaded: false,
		load: async () => {
			const res = await apiCall<FeedPost[]>("/api/feed");
			if (res.ok && res.data) set({ posts: res.data, loaded: true });
		},
		publish: async (text) => {
			const res = await apiCall<FeedPost>("/api/feed", "POST", { text });
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
