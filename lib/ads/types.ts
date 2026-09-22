export type AdsPlatform = "google" | "meta";
export const ADS_PLATFORMS: AdsPlatform[] = ["google", "meta"];

export interface AdsAccount { id: string; name: string; currency: string }
export interface AdsDay { date: string; spend: number; clicks: number; impressions: number; conversions: number }
export interface AdsCampaign { id: string; name: string; status: string; spend: number; clicks: number; impressions: number; conversions: number }
export interface AdsInsights { currency: string; days: AdsDay[]; campaigns: AdsCampaign[] }

export interface AdsConnectionDTO {
    id: string;
    platform: AdsPlatform;
    name: string;
    status: "connected" | "error";
    error: string;
    accountId: string; // выбранный рекламный аккаунт; пусто — нужно выбрать из accounts
    currency: string;
    accounts: AdsAccount[];
    expiresAt: number; // 0 — токен обновляется сам (Google); иначе момент, когда нужно войти заново (Meta)
}

export interface AdsStatusDTO {
    available: Record<AdsPlatform, boolean>; // настроены ли ключи приложения на сервере
    planOk: boolean; // разрешает ли тариф фирмы рекламу (app/config/plans.ts)
    connections: AdsConnectionDTO[];
}
