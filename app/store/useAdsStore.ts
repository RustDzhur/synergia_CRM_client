import { create } from "zustand";
import type { AdsConnectionDTO, AdsInsights, AdsStatusDTO } from "@/lib/ads/types";
import { apiCall } from "./crmApi";

export interface AdsItem { connection: AdsConnectionDTO; data: AdsInsights | null; error: string }

interface AdsStore {
	status: AdsStatusDTO | null;
	items: AdsItem[];
	days: number;
	loading: boolean;
	loadStatus: () => Promise<void>;
	loadInsights: (days?: number) => Promise<void>;
	connect: (platform: "google" | "meta", locale: string) => Promise<string | null>; // ошибка или null (тогда браузер уходит на страницу входа)
	choose: (id: string, accountId: string) => Promise<string | null>;
	disconnect: (id: string) => Promise<void>;
}

// Реклама: подключения к Google Ads / Meta Ads и их статистика. Токены остаются на сервере, сюда приходят только цифры.
export const useAdsStore = create<AdsStore>()((set, get) => ({
	status: null,
	items: [],
	days: 30,
	loading: false,

	loadStatus: async () => {
		const res = await apiCall<AdsStatusDTO>("/api/ads");
		if (res.ok && res.data) set({ status: res.data });
	},
	loadInsights: async (days = get().days) => {
		set({ loading: true, days });
		const res = await apiCall<{ items: AdsItem[] }>(`/api/ads/insights?days=${days}`);
		set({ loading: false, ...(res.ok && res.data ? { items: res.data.items } : {}) });
	},
	connect: async (platform, locale) => {
		const res = await apiCall<{ url: string }>("/api/ads/oauth", "POST", { platform, locale });
		if (!res.ok || !res.data) return res.message;
		window.location.href = res.data.url;
		return null;
	},
	choose: async (id, accountId) => {
		const res = await apiCall("/api/ads", "PATCH", { id, accountId });
		if (!res.ok) return res.message;
		await Promise.all([get().loadStatus(), get().loadInsights()]);
		return null;
	},
	disconnect: async (id) => {
		await apiCall(`/api/ads?id=${id}`, "DELETE");
		await Promise.all([get().loadStatus(), get().loadInsights()]);
	},
}));
